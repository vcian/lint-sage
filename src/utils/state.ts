import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  AnyLintSageState,
  LintSageMonorepoState,
  LintSageState,
  ManagedFileRecord,
  MonorepoTool,
  PackageManager,
  Stack,
  Variant,
} from '../types.js';
import {
  listMonorepoTemplateFiles,
  listVariantTemplateFiles,
  readMonorepoTemplateFile,
  readTemplateFile,
  renderCiWorkflow,
  renderMonorepoCiWorkflow,
} from './template-loader.js';

const skippedTemplateFiles = new Set(['README.md', 'dependencies.json']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertPathWithinDirectory(basePath: string, filePath: string): void {
  const resolved = path.resolve(basePath, filePath);
  const normalizedBase = path.resolve(basePath) + path.sep;

  if (!resolved.startsWith(normalizedBase) && resolved !== path.resolve(basePath)) {
    throw new Error(
      `.lint-sage.json contains a path that escapes the project directory: ${filePath}`,
    );
  }
}

function validateManagedFilePaths(
  targetDirectory: string,
  managedFiles: Record<string, unknown>,
): void {
  for (const filePath of Object.keys(managedFiles)) {
    assertPathWithinDirectory(targetDirectory, filePath);
  }
}

function validateMonorepoPackagePaths(
  targetDirectory: string,
  packages: Record<string, unknown>,
): void {
  for (const [packagePath, packageConfig] of Object.entries(packages)) {
    assertPathWithinDirectory(targetDirectory, packagePath);

    if (isRecord(packageConfig) && isRecord(packageConfig.managedFiles)) {
      for (const filePath of Object.keys(packageConfig.managedFiles)) {
        assertPathWithinDirectory(targetDirectory, path.join(packagePath, filePath));
      }
    }
  }
}

function hasCommonStateFields(state: Record<string, unknown>): boolean {
  return (
    state.schemaVersion === 1 &&
    typeof state.packageManager === 'string' &&
    isRecord(state.managedFiles) &&
    Array.isArray(state.addedDependencies) &&
    Array.isArray(state.addedScripts) &&
    typeof state.initializedAt === 'string' &&
    typeof state.lastUpdatedAt === 'string'
  );
}

export function isMonorepoState(state: AnyLintSageState): state is LintSageMonorepoState {
  return 'monorepo' in state && state.monorepo === true;
}

export function hashContent(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

export async function buildManagedFilesRecord(
  stack: Stack,
  variant: Variant,
  packageManager: PackageManager,
): Promise<Record<string, ManagedFileRecord>> {
  const managedFiles: Record<string, ManagedFileRecord> = {};
  const templateFiles = await listVariantTemplateFiles(stack, variant);

  for (const relativeTemplatePath of templateFiles) {
    if (skippedTemplateFiles.has(relativeTemplatePath)) {
      continue;
    }

    const renderedContent = await readTemplateFile(stack, variant, relativeTemplatePath);

    managedFiles[relativeTemplatePath] = {
      template: `${stack}/${variant}/${relativeTemplatePath}`,
      lastAppliedHash: hashContent(renderedContent),
    };
  }

  managedFiles['.github/workflows/lint.yml'] = {
    template: 'ci/lint.yml.template',
    lastAppliedHash: hashContent(await renderCiWorkflow(packageManager)),
  };

  return managedFiles;
}

export async function buildMonorepoRootManagedFiles(
  packageManager: PackageManager,
  monorepoTool: MonorepoTool,
  lintCommand: string,
): Promise<Record<string, ManagedFileRecord>> {
  const managedFiles: Record<string, ManagedFileRecord> = {};
  const templateFiles = await listMonorepoTemplateFiles();

  for (const relativeTemplatePath of templateFiles) {
    if (skippedTemplateFiles.has(relativeTemplatePath)) {
      continue;
    }

    const renderedContent = await readMonorepoTemplateFile(relativeTemplatePath);

    managedFiles[relativeTemplatePath] = {
      template: `monorepo/${relativeTemplatePath}`,
      lastAppliedHash: hashContent(renderedContent),
    };
  }

  managedFiles['.github/workflows/lint.yml'] = {
    template: 'ci/monorepo-lint.yml.template',
    lastAppliedHash: hashContent(await renderMonorepoCiWorkflow(packageManager, lintCommand)),
  };

  return managedFiles;
}

export async function buildPackageManagedFiles(
  stack: Stack,
  variant: Variant,
): Promise<Record<string, ManagedFileRecord>> {
  const renderedContent = await readTemplateFile(stack, variant, 'eslint.config.js');

  return {
    'eslint.config.js': {
      template: `${stack}/${variant}/eslint.config.js`,
      lastAppliedHash: hashContent(renderedContent),
    },
  };
}

export async function writeMonorepoStateFile(
  targetDirectory: string,
  state: LintSageMonorepoState,
  dryRun = false,
): Promise<void> {
  if (dryRun) {
    return;
  }

  const statePath = path.join(targetDirectory, '.lint-sage.json');
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export async function readStateFile(targetDirectory: string): Promise<AnyLintSageState> {
  const statePath = path.join(targetDirectory, '.lint-sage.json');
  let raw: string;

  try {
    raw = await readFile(statePath, 'utf8');
  } catch {
    throw new Error('.lint-sage.json not found. Run "npx @vcian/lint-sage init" first.');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('.lint-sage.json contains invalid JSON.');
  }

  if (!isRecord(parsed)) {
    throw new Error(
      '.lint-sage.json is corrupted or missing required fields (schemaVersion, stack, variant, packageManager, managedFiles).',
    );
  }

  if (parsed.monorepo === true) {
    if (
      !hasCommonStateFields(parsed) ||
      typeof parsed.monorepoTool !== 'string' ||
      !isRecord(parsed.packages)
    ) {
      throw new Error(
        '.lint-sage.json is corrupted or missing required fields (schemaVersion, packageManager, monorepoTool, managedFiles, packages).',
      );
    }

    validateManagedFilePaths(targetDirectory, parsed.managedFiles as Record<string, unknown>);
    validateMonorepoPackagePaths(targetDirectory, parsed.packages as Record<string, unknown>);

    return parsed as unknown as LintSageMonorepoState;
  }

  if (
    !hasCommonStateFields(parsed) ||
    typeof parsed.stack !== 'string' ||
    typeof parsed.variant !== 'string'
  ) {
    throw new Error(
      '.lint-sage.json is corrupted or missing required fields (schemaVersion, stack, variant, packageManager, managedFiles).',
    );
  }

  validateManagedFilePaths(targetDirectory, parsed.managedFiles as Record<string, unknown>);

  return parsed as unknown as LintSageState;
}

export async function writeStateFile(
  targetDirectory: string,
  state: AnyLintSageState,
  dryRun = false,
): Promise<void> {
  if (dryRun) {
    return;
  }

  const statePath = path.join(targetDirectory, '.lint-sage.json');
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}
