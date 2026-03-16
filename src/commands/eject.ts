import { readdir, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { confirm } from '@inquirer/prompts';

import type { GlobalOptions, LintSageMonorepoState, LintSageState } from '../types.js';
import { isMonorepoState, readStateFile } from '../utils/state.js';

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

async function tryRemoveEmptyDir(dirPath: string): Promise<void> {
  try {
    const entries = await readdir(dirPath);

    if (entries.length === 0) {
      await rmdir(dirPath);
    }
  } catch {
    // Directory doesn't exist or can't be read — ignore.
  }
}

function collectManagedFilePaths(state: LintSageState | LintSageMonorepoState): string[] {
  if (!isMonorepoState(state)) {
    return Object.keys(state.managedFiles);
  }

  return [
    ...Object.keys(state.managedFiles),
    ...Object.entries(state.packages).flatMap(([packagePath, packageConfig]) =>
      Object.keys(packageConfig.managedFiles).map((filePath) =>
        path.posix.join(packagePath, filePath),
      ),
    ),
  ].sort();
}

function printEjectSummary(state: LintSageState | LintSageMonorepoState, dryRun: boolean): void {
  const prefix = dryRun ? '[dry-run] ' : '';

  console.log(`${prefix}The following will be removed:`);
  console.log('');
  console.log(`${prefix}Config files:`);

  for (const filePath of collectManagedFilePaths(state)) {
    console.log(`  - ${filePath}`);
  }

  console.log('  - .lint-sage.json');

  if (state.addedDependencies.length > 0) {
    console.log('');
    console.log(`${prefix}devDependencies from package.json:`);

    for (const dep of state.addedDependencies) {
      console.log(`  - ${dep}`);
    }
  }

  if (state.addedScripts.length > 0) {
    console.log('');
    console.log(`${prefix}Scripts from package.json:`);

    for (const script of state.addedScripts) {
      console.log(`  - ${script}`);
    }
  }
}

async function cleanPackageJson(
  targetDirectory: string,
  state: LintSageState | LintSageMonorepoState,
  dryRun: boolean,
): Promise<void> {
  const packageJsonPath = path.join(targetDirectory, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    [key: string]: unknown;
  };

  const devDeps = { ...(packageJson.devDependencies ?? {}) };
  const scripts = { ...(packageJson.scripts ?? {}) };

  for (const dep of state.addedDependencies) {
    delete devDeps[dep];
  }

  for (const script of state.addedScripts) {
    delete scripts[script];
  }

  packageJson.devDependencies = sortRecord(devDeps);
  packageJson.scripts = sortRecord(scripts);

  if (!dryRun) {
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  }
}

async function deleteManagedFilesInScope(
  targetDirectory: string,
  baseDirectory: string,
  managedFilePaths: string[],
  dryRun: boolean,
  dirsToCheck: Set<string>,
): Promise<void> {
  const prefix = dryRun ? '[dry-run] Would delete' : '✔ Deleted';

  for (const filePath of managedFilePaths) {
    const scopedFilePath = baseDirectory ? path.posix.join(baseDirectory, filePath) : filePath;
    const fullPath = path.join(targetDirectory, scopedFilePath);

    if (await pathExists(fullPath)) {
      if (!dryRun) {
        await unlink(fullPath);
      }

      console.log(`${prefix} ${scopedFilePath}`);
    }

    const dirName = path.dirname(scopedFilePath);

    if (dirName !== '.') {
      dirsToCheck.add(path.join(targetDirectory, dirName));

      const parentDir = path.dirname(dirName);

      if (parentDir !== '.') {
        dirsToCheck.add(path.join(targetDirectory, parentDir));
      }
    }
  }
}

async function deleteManagedFiles(
  targetDirectory: string,
  state: LintSageState | LintSageMonorepoState,
  dryRun: boolean,
): Promise<void> {
  const dirsToCheck = new Set<string>();

  await deleteManagedFilesInScope(
    targetDirectory,
    '',
    Object.keys(state.managedFiles),
    dryRun,
    dirsToCheck,
  );

  if (isMonorepoState(state)) {
    for (const [packagePath, packageConfig] of Object.entries(state.packages)) {
      await deleteManagedFilesInScope(
        targetDirectory,
        packagePath,
        Object.keys(packageConfig.managedFiles),
        dryRun,
        dirsToCheck,
      );
    }
  }

  const prefix = dryRun ? '[dry-run] Would delete' : '✔ Deleted';
  const statePath = path.join(targetDirectory, '.lint-sage.json');

  if (!dryRun && (await pathExists(statePath))) {
    await unlink(statePath);
  }

  console.log(`${prefix} .lint-sage.json`);

  if (!dryRun) {
    const sortedDirs = [...dirsToCheck].sort((a, b) => b.length - a.length);

    for (const dir of sortedDirs) {
      await tryRemoveEmptyDir(dir);
    }
  }
}

export async function handleEject(options: GlobalOptions): Promise<number> {
  const targetDirectory = process.cwd();

  try {
    const state = await readStateFile(targetDirectory);

    printEjectSummary(state, Boolean(options.dryRun));

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
    await cleanPackageJson(targetDirectory, state, false);
    console.log('✔ Cleaned package.json');

    await deleteManagedFiles(targetDirectory, state, false);

    console.log('');
    console.log("Run your package manager's install command to clean up removed dependencies.");

    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}
