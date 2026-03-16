import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { dependencyVersions, type DependencyName } from '../constants/versions.js';
import type { PackageManager, Stack, Variant } from '../types.js';

type DependenciesTemplate = {
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
};

const templateRootUrl = new URL('../templates/', import.meta.url);

const variantsByStack: Record<Stack, readonly Variant[]> = {
  react: ['vite-react-ts', '@tanstack/react-start', 'next-js'],
  node: ['express', 'fastify', 'nestjs', 'plain-ts'],
  angular: ['angular-standalone', 'angular-ssr'],
};

function assertValidVariant(stack: Stack, variant: Variant): void {
  if (!variantsByStack[stack].includes(variant)) {
    throw new Error(`Variant "${variant}" is not supported for stack "${stack}".`);
  }
}

function buildVersionVariables(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(dependencyVersions).map(([dependencyName, version]) => [
      `version:${dependencyName as DependencyName}`,
      version,
    ]),
  );
}

export function renderTemplateContent(
  templateContent: string,
  variables: Record<string, string>,
): string {
  return templateContent.replace(/{{\s*([^}]+?)\s*}}/g, (_match, rawKey: string) => {
    const key = rawKey.trim();

    if (!(key in variables)) {
      throw new Error(`Missing template variable "${key}".`);
    }

    return variables[key];
  });
}

export async function getVariantTemplateDirectory(stack: Stack, variant: Variant): Promise<string> {
  assertValidVariant(stack, variant);

  return path.join(fileURLToPath(templateRootUrl), stack, variant);
}

async function collectFiles(
  rootDirectory: string,
  currentDirectory = rootDirectory,
): Promise<string[]> {
  const directoryEntries = await readdir(currentDirectory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of directoryEntries) {
    const entryPath = path.join(currentDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(rootDirectory, entryPath)));
      continue;
    }

    files.push(path.relative(rootDirectory, entryPath));
  }

  return files.sort();
}

export async function listVariantTemplateFiles(stack: Stack, variant: Variant): Promise<string[]> {
  const templateDirectory = await getVariantTemplateDirectory(stack, variant);
  return collectFiles(templateDirectory);
}

export async function readTemplateFile(
  stack: Stack,
  variant: Variant,
  relativeFilePath: string,
  variables: Record<string, string> = {},
): Promise<string> {
  const templateDirectory = await getVariantTemplateDirectory(stack, variant);
  const filePath = path.join(templateDirectory, relativeFilePath);
  const rawContent = await readFile(filePath, 'utf8');

  return renderTemplateContent(rawContent, {
    ...buildVersionVariables(),
    ...variables,
  });
}

export async function readDependenciesTemplate(
  stack: Stack,
  variant: Variant,
): Promise<DependenciesTemplate> {
  const rendered = await readTemplateFile(stack, variant, 'dependencies.json');
  return JSON.parse(rendered) as DependenciesTemplate;
}

function getPackageManagerScriptPrefix(packageManager: PackageManager): string {
  if (packageManager === 'npm') {
    return 'npm run';
  }

  return packageManager;
}

export function getCiVariables(packageManager: PackageManager): Record<string, string> {
  const scriptPrefix = getPackageManagerScriptPrefix(packageManager);
  const installCommandByPackageManager: Record<PackageManager, string> = {
    npm: 'npm ci',
    pnpm: 'pnpm install --frozen-lockfile',
    yarn: 'yarn install --frozen-lockfile',
  };

  return {
    packageManager,
    installCommand: installCommandByPackageManager[packageManager],
    lintCommand: `${scriptPrefix} lint`,
    formatCheckCommand: `${scriptPrefix} format:check`,
  };
}

export async function renderCiWorkflow(packageManager: PackageManager): Promise<string> {
  const ciTemplatePath = new URL('../templates/ci/lint.yml.template', import.meta.url);
  const rawContent = await readFile(ciTemplatePath, 'utf8');

  return renderTemplateContent(rawContent, getCiVariables(packageManager));
}

export async function renderMonorepoCiWorkflow(
  packageManager: PackageManager,
  lintCommand: string,
): Promise<string> {
  const ciTemplatePath = new URL('../templates/ci/monorepo-lint.yml.template', import.meta.url);
  const rawContent = await readFile(ciTemplatePath, 'utf8');
  const installCommandByPackageManager: Record<PackageManager, string> = {
    npm: 'npm ci',
    pnpm: 'pnpm install --frozen-lockfile',
    yarn: 'yarn install --frozen-lockfile',
  };
  const scriptPrefix = packageManager === 'npm' ? 'npm run' : packageManager;

  return renderTemplateContent(rawContent, {
    packageManager,
    installCommand: installCommandByPackageManager[packageManager],
    lintCommand,
    formatCheckCommand: `${scriptPrefix} format:check`,
  });
}

export function getMonorepoTemplateDirectory(): string {
  return path.join(fileURLToPath(templateRootUrl), 'monorepo');
}

export async function listMonorepoTemplateFiles(): Promise<string[]> {
  return collectFiles(getMonorepoTemplateDirectory());
}

export async function readMonorepoTemplateFile(relativeFilePath: string): Promise<string> {
  const templateDirectory = getMonorepoTemplateDirectory();
  const filePath = path.join(templateDirectory, relativeFilePath);
  const rawContent = await readFile(filePath, 'utf8');

  return renderTemplateContent(rawContent, buildVersionVariables());
}

export async function readMonorepoDependenciesTemplate(): Promise<{
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
}> {
  const rendered = await readMonorepoTemplateFile('dependencies.json');
  return JSON.parse(rendered) as {
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
}
