import { execSync } from 'node:child_process';

import { dependencyVersions } from '../constants/versions.js';
import type { Stack, Variant } from '../types.js';

type PackageJsonShape = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function getVersion(
  packageJson: PackageJsonShape,
  name: string,
): string | null {
  return packageJson.devDependencies?.[name] ?? packageJson.dependencies?.[name] ?? null;
}

function parseMajor(versionSpec: string): number | null {
  const match = /(\d+)\.\d+\.\d+/.exec(versionSpec);
  return match ? Number(match[1]) : null;
}

export function collectInitCompatibilityIssues(
  packageJson: PackageJsonShape,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const eslintVersion = getVersion(packageJson, 'eslint');
  const tsVersion = getVersion(packageJson, 'typescript');
  const tsJestVersion = getVersion(packageJson, 'ts-jest');
  const typescriptEslintMeta = getVersion(packageJson, 'typescript-eslint');
  const typescriptEslintPlugin = getVersion(packageJson, '@typescript-eslint/eslint-plugin');

  const eslintMajor = eslintVersion ? parseMajor(eslintVersion) : null;
  const tsMajor = tsVersion ? parseMajor(tsVersion) : null;
  const tsJestMajor = tsJestVersion ? parseMajor(tsJestVersion) : null;
  const tsEslintMetaMajor = typescriptEslintMeta ? parseMajor(typescriptEslintMeta) : null;
  const tsEslintPluginMajor = typescriptEslintPlugin ? parseMajor(typescriptEslintPlugin) : null;

  // Known npm conflict from peer ranges: ts-jest@29 requires TypeScript < 6
  if (tsMajor !== null && tsMajor >= 6 && tsJestMajor === 29) {
    errors.push(
      'Detected incompatible tooling: ts-jest@29 requires typescript < 6. ' +
        'Pin typescript to ~5.7.x or upgrade ts-jest when TypeScript 6 support is available.',
    );
  }

  // Known peer constraint for @typescript-eslint v8: eslint ^8.57 || ^9
  if (eslintMajor !== null && eslintMajor >= 10 && (tsEslintMetaMajor === 8 || tsEslintPluginMajor === 8)) {
    errors.push(
      'Detected incompatible tooling: @typescript-eslint v8 supports eslint ^8.57 || ^9. ' +
        'Pin eslint to ~9.x or upgrade @typescript-eslint to a compatible major.',
    );
  }

  // Early warning for configs known to cause @eslint/eslintrc runtime crashes.
  const ajvOverride = getVersion(packageJson, 'ajv');
  if (ajvOverride) {
    warnings.push(
      'Detected project-level ajv pin. Overriding ajv can break eslint internals in some setups. ' +
        'If you see ajv/defaultMeta errors, remove the ajv override and reinstall dependencies.',
    );
  }

  return { errors, warnings };
}

export function detectAngularSsrMismatch(packageJson: PackageJsonShape): string | null {
  const buildVersion = getVersion(packageJson, '@angular/build');
  const ssrVersion = getVersion(packageJson, '@angular/ssr');

  if (!buildVersion || !ssrVersion) {
    return null;
  }

  const buildMajor = parseMajor(buildVersion);
  const ssrMajor = parseMajor(ssrVersion);

  if (buildMajor === null || ssrMajor === null) {
    return null;
  }

  if (buildMajor !== ssrMajor) {
    return (
      `Detected Angular major mismatch: @angular/build=${buildVersion} and @angular/ssr=${ssrVersion}. ` +
      'Align Angular package versions before install (recommended: same major/minor/patch).'
    );
  }

  return null;
}

function normalizeVersionForNpmView(versionSpec: string): string {
  return versionSpec.startsWith('~') ? versionSpec.slice(1) : versionSpec;
}

function getRequiredSharedPackages(stacks: Stack[]): string[] {
  const required = new Set<string>(['@vcian/prettier-config', '@vcian/commitlint-config']);

  for (const stack of stacks) {
    if (stack === 'react') {
      required.add('@vcian/eslint-config-react');
    } else if (stack === 'node') {
      required.add('@vcian/eslint-config-node');
    } else if (stack === 'angular') {
      required.add('@vcian/eslint-config-angular');
    }
  }

  return [...required];
}

export function verifySharedConfigPackagesAvailable(stacks: Stack[]): void {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return;
  }

  for (const packageName of getRequiredSharedPackages(stacks)) {
    const version = dependencyVersions[packageName as keyof typeof dependencyVersions];
    if (!version) {
      throw new Error(`Missing version mapping for shared package ${packageName}.`);
    }

    const versionForNpmView = normalizeVersionForNpmView(version);

    try {
      execSync(`npm view "${packageName}@${versionForNpmView}" version`, {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch {
      throw new Error(
        `Shared package "${packageName}@${versionForNpmView}" is not resolvable from npm.\n` +
          'Make sure the package is published and your npm registry/auth configuration is valid.',
      );
    }
  }
}

export function shouldCheckAngularSsr(variants: Variant[]): boolean {
  return variants.includes('angular-ssr');
}

