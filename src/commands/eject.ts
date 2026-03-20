import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { confirm } from '@inquirer/prompts';

import type {
  GlobalOptions,
  LintSageMonorepoState,
  LintSageState,
  Stack,
} from '../types.js';
import { hashContent, isMonorepoState, readStateFile } from '../utils/state.js';
import { readEjectedConfigFile } from '../utils/template-loader.js';

const EJECTABLE_FILES = new Set(['eslint.config.js', 'prettier.config.js', '.commitlintrc.json']);
const VCIAN_PACKAGE_PREFIX = '@vcian/';

interface EjectFileEntry {
  path: string;
  scope: string;
  stack?: Stack;
  modified: boolean;
}

interface EjectPlan {
  filesToReplace: EjectFileEntry[];
  filesToKeep: string[];
  filesMissing: string[];
  depsToRemove: string[];
}

function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    const { access } = await import('node:fs/promises');
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getStackForState(state: LintSageState | LintSageMonorepoState): Stack | undefined {
  if (!isMonorepoState(state)) {
    return state.stack;
  }
  return undefined;
}

async function classifyEjectActions(
  targetDirectory: string,
  state: LintSageState | LintSageMonorepoState,
): Promise<EjectPlan> {
  const filesToReplace: EjectFileEntry[] = [];
  const filesToKeep: string[] = [];
  const filesMissing: string[] = [];

  // Process root-level managed files
  for (const [fileName, fileRecord] of Object.entries(state.managedFiles)) {
    const fullPath = path.join(targetDirectory, fileName);

    if (EJECTABLE_FILES.has(fileName)) {
      if (!(await pathExists(fullPath))) {
        filesMissing.push(fileName);
        continue;
      }

      const currentContent = await readFile(fullPath, 'utf8');
      const currentHash = hashContent(currentContent);
      const modified = currentHash !== fileRecord.lastAppliedHash;

      filesToReplace.push({
        path: fileName,
        scope: '',
        stack: getStackForState(state),
        modified,
      });
    } else {
      filesToKeep.push(fileName);
    }
  }

  // Process per-package managed files (monorepo)
  if (isMonorepoState(state)) {
    for (const [packagePath, packageConfig] of Object.entries(state.packages)) {
      for (const [fileName, fileRecord] of Object.entries(packageConfig.managedFiles)) {
        const scopedPath = path.posix.join(packagePath, fileName);
        const fullPath = path.join(targetDirectory, scopedPath);

        if (EJECTABLE_FILES.has(fileName)) {
          if (!(await pathExists(fullPath))) {
            filesMissing.push(scopedPath);
            continue;
          }

          const currentContent = await readFile(fullPath, 'utf8');
          const currentHash = hashContent(currentContent);
          const modified = currentHash !== fileRecord.lastAppliedHash;

          filesToReplace.push({
            path: scopedPath,
            scope: packagePath,
            stack: packageConfig.stack,
            modified,
          });
        } else {
          filesToKeep.push(scopedPath);
        }
      }
    }
  }

  // Filter dependencies: only remove @vcian/* packages that were tracked
  const depsToRemove = state.addedDependencies.filter((dep) =>
    dep.startsWith(VCIAN_PACKAGE_PREFIX),
  );

  return { filesToReplace, filesToKeep, filesMissing, depsToRemove };
}

function getEjectSourceLabel(fileName: string, stack?: Stack): string {
  if (fileName === 'eslint.config.js' && stack) {
    return `inlined from @vcian/eslint-config-${stack}`;
  }
  if (fileName === 'prettier.config.js') {
    return 'inlined settings';
  }
  return 'inlined';
}

function printEjectSummary(plan: EjectPlan, dryRun: boolean): void {
  const prefix = dryRun ? '[dry-run] ' : '';

  for (const entry of plan.filesToReplace) {
    const baseName = path.basename(entry.path);
    const label = getEjectSourceLabel(baseName, entry.stack);
    const modifiedNote = entry.modified
      ? dryRun
        ? ' (modified — manual edits will be overwritten)'
        : ''
      : '';
    console.log(`${prefix}Would replace ${entry.path} (${label})${modifiedNote}`);
  }

  for (const filePath of plan.filesToKeep) {
    console.log(`${prefix}Would keep ${filePath} (unchanged)`);
  }

  for (const filePath of plan.filesMissing) {
    console.log(`${prefix}Would skip ${filePath} (not found on disk)`);
  }

  for (const dep of plan.depsToRemove) {
    console.log(`${prefix}Would remove dependency ${dep}`);
  }

  console.log(`${prefix}Would delete .lint-sage.json`);
}

async function replaceEjectableFiles(
  targetDirectory: string,
  plan: EjectPlan,
): Promise<void> {
  for (const entry of plan.filesToReplace) {
    const baseName = path.basename(entry.path);
    const fullPath = path.join(targetDirectory, entry.path);

    if (entry.modified) {
      const label = getEjectSourceLabel(baseName, entry.stack);
      console.log(
        `⚠ ${entry.path} has been modified since last init/update — replacing with ${label}`,
      );
    }

    const ejectedContent = await readEjectedConfigFile(entry.stack ?? 'node', baseName);
    await writeFile(fullPath, ejectedContent, 'utf8');
    console.log(`✔ Replaced ${entry.path}`);
  }

  for (const filePath of plan.filesMissing) {
    console.log(
      `⚠ ${filePath} not found — skipping replacement (inlined version not written)`,
    );
  }
}

async function removeVcianDependencies(
  targetDirectory: string,
  depsToRemove: string[],
): Promise<void> {
  if (depsToRemove.length === 0) {
    return;
  }

  const packageJsonPath = path.join(targetDirectory, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    devDependencies?: Record<string, string>;
    [key: string]: unknown;
  };

  const devDeps = { ...(packageJson.devDependencies ?? {}) };

  for (const dep of depsToRemove) {
    delete devDeps[dep];
  }

  packageJson.devDependencies = sortRecord(devDeps);
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

export async function handleEject(options: GlobalOptions): Promise<number> {
  const targetDirectory = process.cwd();

  try {
    const state = await readStateFile(targetDirectory);
    const plan = await classifyEjectActions(targetDirectory, state);

    printEjectSummary(plan, Boolean(options.dryRun));

    if (options.dryRun) {
      return 0;
    }

    if (!options.force) {
      console.log('');
      const shouldProceed = await confirm({
        message: 'Proceed with eject?',
        default: false,
      });

      if (!shouldProceed) {
        console.log('Eject cancelled.');
        return 0;
      }
    }

    console.log('');

    // Replace ejectable config files with inlined versions
    await replaceEjectableFiles(targetDirectory, plan);

    // Remove only @vcian/* dependencies
    await removeVcianDependencies(targetDirectory, plan.depsToRemove);

    if (plan.depsToRemove.length > 0) {
      console.log(`✔ Removed ${plan.depsToRemove.length} @vcian/* dependencies from package.json`);
    }

    // Delete .lint-sage.json
    const statePath = path.join(targetDirectory, '.lint-sage.json');

    if (await pathExists(statePath)) {
      await unlink(statePath);
    }

    console.log('✔ Deleted .lint-sage.json');

    console.log('');
    console.log("Run your package manager's install command to clean up removed dependencies.");

    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}
