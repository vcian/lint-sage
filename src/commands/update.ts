import { readFileSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { confirm } from '@inquirer/prompts';

import type {
  AnyLintSageState,
  DepVersionChange,
  DiffResult,
  FileDiffResult,
  FileDiffStatus,
  GlobalOptions,
  LintSageMonorepoState,
  LintSageState,
  ManagedFileRecord,
  UpdatePackageForUpdateResult,
} from '../types.js';
import { getMonorepoLintCommand } from '../utils/detect-monorepo.js';
import { computeDiff } from '../utils/diff.js';
import { updateMonorepoPackageJson } from '../utils/monorepo-package.js';
import { hashContent, isMonorepoState, readStateFile, writeStateFile } from '../utils/state.js';
import {
  readMonorepoTemplateFile,
  readTemplateFile,
  renderCiWorkflow,
  renderMonorepoCiWorkflow,
} from '../utils/template-loader.js';
import { updatePackageForUpdate } from '../utils/update-package.js';

const executableFiles = new Set(['.husky/commit-msg', '.husky/pre-commit']);

type ScopedFileDiffResult = FileDiffResult & {
  managedFileKey: string;
};

function readLintSageVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { version: string };

  return packageJson.version;
}

function printFileSummary(files: FileDiffResult[], dryRun: boolean): void {
  const prefix = dryRun ? '[dry-run] ' : '';

  console.log(`${prefix}Config files:`);

  for (const file of files) {
    switch (file.status) {
      case 'auto-replace':
        console.log(`  ✔ ${file.filePath} — will be updated (template changed, no local edits)`);
        break;
      case 'keep':
        console.log(`  — ${file.filePath} (locally modified, template unchanged — keeping yours)`);
        break;
      case 'conflict':
        console.log(
          `  ⚠ ${file.filePath} — both local and template changed. Review ${file.filePath}.lint-sage.new`,
        );
        break;
      case 'no-change':
        console.log(`  — ${file.filePath} — no changes`);
        break;
    }
  }
}

function printDepsSummary(
  addedDeps: string[],
  updatedDeps: DepVersionChange[],
  addedScripts: string[],
  updatedScripts: string[],
  dryRun: boolean,
): void {
  const prefix = dryRun ? '[dry-run] ' : '';

  console.log('');
  console.log(`${prefix}Dependencies:`);

  if (addedDeps.length === 0 && updatedDeps.length === 0) {
    console.log('  (no changes)');
  } else {
    for (const dep of updatedDeps) {
      console.log(`  ↑ ${dep.name}: ${dep.oldVersion} → ${dep.newVersion}`);
    }

    for (const dep of addedDeps) {
      console.log(`  + ${dep}`);
    }
  }

  console.log('');
  console.log(`${prefix}Scripts:`);

  if (addedScripts.length === 0 && updatedScripts.length === 0) {
    console.log('  (no changes)');
  } else {
    for (const script of updatedScripts) {
      console.log(`  ↑ ${script}`);
    }

    for (const script of addedScripts) {
      console.log(`  + ${script}`);
    }
  }
}

function hasChanges(diff: DiffResult, packageResult: UpdatePackageForUpdateResult): boolean {
  const hasFileChanges = diff.files.some(
    (file) => file.status === 'auto-replace' || file.status === 'conflict',
  );
  const hasPackageChanges =
    packageResult.addedDependencies.length > 0 ||
    packageResult.updatedDependencies.length > 0 ||
    packageResult.addedScripts.length > 0 ||
    packageResult.updatedScripts.length > 0;

  return hasFileChanges || hasPackageChanges;
}

function classifyFile(
  currentHash: string | null,
  lastAppliedHash: string,
  templateHash: string,
): FileDiffStatus {
  if (currentHash === null) {
    return 'auto-replace';
  }

  const currentMatchesApplied = currentHash === lastAppliedHash;
  const templateMatchesApplied = templateHash === lastAppliedHash;

  if (currentMatchesApplied && templateMatchesApplied) {
    return 'no-change';
  }

  if (currentMatchesApplied && !templateMatchesApplied) {
    return 'auto-replace';
  }

  if (!currentMatchesApplied && templateMatchesApplied) {
    return 'keep';
  }

  return 'conflict';
}

async function readProjectFile(targetDirectory: string, filePath: string): Promise<string | null> {
  try {
    return await readFile(path.join(targetDirectory, filePath), 'utf8');
  } catch {
    return null;
  }
}

async function getNewTemplateContent(state: LintSageState, filePath: string): Promise<string> {
  if (state.managedFiles[filePath]?.template === 'ci/lint.yml.template') {
    return renderCiWorkflow(state.packageManager);
  }

  return readTemplateFile(state.stack, state.variant, filePath);
}

async function getMonorepoRootTemplateContent(
  state: LintSageMonorepoState,
  filePath: string,
  record: ManagedFileRecord,
): Promise<string> {
  if (record.template === 'ci/monorepo-lint.yml.template') {
    return renderMonorepoCiWorkflow(
      state.packageManager,
      getMonorepoLintCommand(state.monorepoTool, state.packageManager),
    );
  }

  const templatePath = record.template.startsWith('monorepo/')
    ? record.template.slice('monorepo/'.length)
    : filePath;

  return readMonorepoTemplateFile(templatePath);
}

async function computeScopedDiff(
  targetDirectory: string,
  baseDirectory: string,
  managedFiles: Record<string, ManagedFileRecord>,
  getTemplateContent: (filePath: string, record: ManagedFileRecord) => Promise<string>,
): Promise<ScopedFileDiffResult[]> {
  const files: ScopedFileDiffResult[] = [];

  for (const [managedFileKey, record] of Object.entries(managedFiles)) {
    const scopedFilePath = baseDirectory
      ? path.posix.join(baseDirectory.split(path.sep).join(path.posix.sep), managedFileKey)
      : managedFileKey;
    const projectContent = await readProjectFile(targetDirectory, scopedFilePath);
    const currentHash = projectContent !== null ? hashContent(projectContent) : null;
    const templateContent = await getTemplateContent(managedFileKey, record);
    const templateHash = hashContent(templateContent);

    files.push({
      filePath: scopedFilePath,
      managedFileKey,
      status: classifyFile(currentHash, record.lastAppliedHash, templateHash),
      currentHash,
      lastAppliedHash: record.lastAppliedHash,
      templateHash,
    });
  }

  return files;
}

async function applyFileChanges(
  targetDirectory: string,
  state: LintSageState,
  diff: DiffResult,
  verbose: boolean,
): Promise<void> {
  for (const file of diff.files) {
    const targetPath = path.join(targetDirectory, file.filePath);

    if (file.status === 'auto-replace') {
      const newContent = await getNewTemplateContent(state, file.filePath);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, newContent, 'utf8');

      if (executableFiles.has(file.filePath)) {
        await chmod(targetPath, 0o755);
      }

      state.managedFiles[file.filePath].lastAppliedHash = file.templateHash;

      if (verbose) {
        console.log(`✔ Updated ${file.filePath}`);
      }
    }

    if (file.status === 'conflict') {
      const newContent = await getNewTemplateContent(state, file.filePath);
      const conflictPath = `${targetPath}.lint-sage.new`;
      await writeFile(conflictPath, newContent, 'utf8');

      if (verbose) {
        console.log(`⚠ Wrote conflict file ${file.filePath}.lint-sage.new`);
      }
    }
  }
}

async function applyScopedFileChanges(
  targetDirectory: string,
  managedFiles: Record<string, ManagedFileRecord>,
  diffFiles: ScopedFileDiffResult[],
  getTemplateContent: (filePath: string, record: ManagedFileRecord) => Promise<string>,
  verbose: boolean,
): Promise<void> {
  for (const file of diffFiles) {
    const targetPath = path.join(targetDirectory, file.filePath);
    const record = managedFiles[file.managedFileKey];

    if (file.status === 'auto-replace') {
      const newContent = await getTemplateContent(file.managedFileKey, record);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, newContent, 'utf8');

      if (executableFiles.has(file.managedFileKey)) {
        await chmod(targetPath, 0o755);
      }

      managedFiles[file.managedFileKey].lastAppliedHash = file.templateHash;

      if (verbose) {
        console.log(`✔ Updated ${file.filePath}`);
      }
    }

    if (file.status === 'conflict') {
      const newContent = await getTemplateContent(file.managedFileKey, record);
      await writeFile(`${targetPath}.lint-sage.new`, newContent, 'utf8');

      if (verbose) {
        console.log(`⚠ Wrote conflict file ${file.filePath}.lint-sage.new`);
      }
    }
  }
}

function appendTrackedEntries(
  state: AnyLintSageState,
  packageResult: UpdatePackageForUpdateResult,
): void {
  for (const dep of packageResult.addedDependencies) {
    if (!state.addedDependencies.includes(dep)) {
      state.addedDependencies.push(dep);
    }
  }

  for (const script of packageResult.addedScripts) {
    if (!state.addedScripts.includes(script)) {
      state.addedScripts.push(script);
    }
  }
}

async function handleSingleProjectUpdate(
  targetDirectory: string,
  state: LintSageState,
  options: GlobalOptions,
): Promise<number> {
  if (options.verbose) {
    console.log(
      `Loaded state: stack=${state.stack}, variant=${state.variant}, packageManager=${state.packageManager}`,
    );
  }

  const diff = await computeDiff(targetDirectory, state);
  const packageResult = await updatePackageForUpdate({
    targetDirectory,
    stack: state.stack,
    variant: state.variant,
    dryRun: true,
  });

  console.log('lint-sage update — comparing against latest templates...');
  console.log('');

  printFileSummary(diff.files, Boolean(options.dryRun));
  printDepsSummary(
    packageResult.addedDependencies,
    packageResult.updatedDependencies,
    packageResult.addedScripts,
    packageResult.updatedScripts,
    Boolean(options.dryRun),
  );

  if (!hasChanges(diff, packageResult)) {
    console.log('');
    console.log('Everything is up to date.');
    return 0;
  }

  if (options.dryRun) {
    return 0;
  }

  const shouldApply = await confirm({
    message: 'Apply these changes?',
    default: true,
  });

  if (!shouldApply) {
    console.log('Update cancelled.');
    return 0;
  }

  await applyFileChanges(targetDirectory, state, diff, Boolean(options.verbose));

  const realPackageResult = await updatePackageForUpdate({
    targetDirectory,
    stack: state.stack,
    variant: state.variant,
    dryRun: false,
    verbose: options.verbose,
  });

  state.version = readLintSageVersion();
  state.lastUpdatedAt = new Date().toISOString();
  appendTrackedEntries(state, realPackageResult);
  await writeStateFile(targetDirectory, state);

  const hasPackageChanges =
    realPackageResult.addedDependencies.length > 0 ||
    realPackageResult.updatedDependencies.length > 0;

  if (hasPackageChanges) {
    console.log('');
    console.log("Run your package manager's install command to install the new dependencies.");
  }

  return 0;
}

async function handleMonorepoUpdate(
  targetDirectory: string,
  state: LintSageMonorepoState,
  options: GlobalOptions,
): Promise<number> {
  if (options.verbose) {
    console.log(
      `Loaded monorepo state: tool=${state.monorepoTool}, packageManager=${state.packageManager}, packages=${Object.keys(state.packages).length}`,
    );
  }

  const rootDiffFiles = await computeScopedDiff(
    targetDirectory,
    '',
    state.managedFiles,
    (filePath, record) => getMonorepoRootTemplateContent(state, filePath, record),
  );
  const packageDiffs = await Promise.all(
    Object.entries(state.packages).map(async ([packagePath, packageConfig]) => ({
      packageConfig,
      files: await computeScopedDiff(
        targetDirectory,
        packagePath,
        packageConfig.managedFiles,
        (filePath) => readTemplateFile(packageConfig.stack, packageConfig.variant, filePath),
      ),
    })),
  );
  const diff: DiffResult = {
    files: [...rootDiffFiles, ...packageDiffs.flatMap((entry) => entry.files)],
  };
  const packageResult = await updateMonorepoPackageJson({
    targetDirectory,
    packages: Object.values(state.packages),
    dryRun: true,
    respectHigherPatch: true,
  });

  console.log('lint-sage update — comparing against latest templates...');
  console.log('');

  printFileSummary(diff.files, Boolean(options.dryRun));
  printDepsSummary(
    packageResult.addedDependencies,
    packageResult.updatedDependencies,
    packageResult.addedScripts,
    packageResult.updatedScripts,
    Boolean(options.dryRun),
  );

  if (!hasChanges(diff, packageResult)) {
    console.log('');
    console.log('Everything is up to date.');
    return 0;
  }

  if (options.dryRun) {
    return 0;
  }

  const shouldApply = await confirm({
    message: 'Apply these changes?',
    default: true,
  });

  if (!shouldApply) {
    console.log('Update cancelled.');
    return 0;
  }

  await applyScopedFileChanges(
    targetDirectory,
    state.managedFiles,
    rootDiffFiles,
    (filePath, record) => getMonorepoRootTemplateContent(state, filePath, record),
    Boolean(options.verbose),
  );

  for (const { packageConfig, files } of packageDiffs) {
    await applyScopedFileChanges(
      targetDirectory,
      packageConfig.managedFiles,
      files,
      (filePath) => readTemplateFile(packageConfig.stack, packageConfig.variant, filePath),
      Boolean(options.verbose),
    );
  }

  const realPackageResult = await updateMonorepoPackageJson({
    targetDirectory,
    packages: Object.values(state.packages),
    dryRun: false,
    respectHigherPatch: true,
    verbose: options.verbose,
  });

  state.version = readLintSageVersion();
  state.lastUpdatedAt = new Date().toISOString();
  appendTrackedEntries(state, realPackageResult);
  await writeStateFile(targetDirectory, state);

  const hasPackageChanges =
    realPackageResult.addedDependencies.length > 0 ||
    realPackageResult.updatedDependencies.length > 0;

  if (hasPackageChanges) {
    console.log('');
    console.log("Run your package manager's install command to install the new dependencies.");
  }

  return 0;
}

export async function handleUpdate(options: GlobalOptions): Promise<number> {
  const targetDirectory = process.cwd();

  try {
    const state = await readStateFile(targetDirectory);

    if (isMonorepoState(state)) {
      return handleMonorepoUpdate(targetDirectory, state, options);
    }

    return handleSingleProjectUpdate(targetDirectory, state, options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}
