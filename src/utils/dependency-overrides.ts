import type { Stack, Variant } from '../types.js';

type PackageJsonShape = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function getVersion(pkg: PackageJsonShape, name: string): string | null {
  return pkg.devDependencies?.[name] ?? pkg.dependencies?.[name] ?? null;
}

function extractSemver(versionSpec: string): { major: number; minor: number; patch: number } | null {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(versionSpec);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function normalizeToTilde(versionSpec: string): string | null {
  const semver = extractSemver(versionSpec);
  if (!semver) {
    return null;
  }

  return `~${semver.major}.${semver.minor}.${semver.patch}`;
}

function isSupportedEslintMajor(major: number): boolean {
  return major === 8 || major === 9;
}

export function resolveDependencyOverrides(
  existingPackageJson: PackageJsonShape,
  stack: Stack,
  variant: Variant,
  templateDevDependencies: Record<string, string>,
): Record<string, string> {
  const overrides: Record<string, string> = {};

  const existingEslint = getVersion(existingPackageJson, 'eslint');
  const templateEslint = templateDevDependencies.eslint;

  if (existingEslint) {
    const normalizedExistingEslint = normalizeToTilde(existingEslint);
    const parsed = normalizedExistingEslint ? extractSemver(normalizedExistingEslint) : null;

    if (normalizedExistingEslint && parsed && isSupportedEslintMajor(parsed.major)) {
      overrides.eslint = normalizedExistingEslint;
    } else if (templateEslint) {
      overrides.eslint = templateEslint;
    }
  } else if (templateEslint) {
    overrides.eslint = templateEslint;
  }

  const existingParser = getVersion(existingPackageJson, '@typescript-eslint/parser');
  const existingPlugin = getVersion(existingPackageJson, '@typescript-eslint/eslint-plugin');
  const templateParser = templateDevDependencies['@typescript-eslint/parser'];
  const templatePlugin = templateDevDependencies['@typescript-eslint/eslint-plugin'];

  if (existingParser && existingPlugin) {
    const parserSemver = extractSemver(existingParser);
    const pluginSemver = extractSemver(existingPlugin);

    if (
      parserSemver &&
      pluginSemver &&
      parserSemver.major === pluginSemver.major &&
      parserSemver.minor === pluginSemver.minor
    ) {
      const normalizedParser = normalizeToTilde(existingParser);
      const normalizedPlugin = normalizeToTilde(existingPlugin);

      if (normalizedParser && normalizedPlugin) {
        overrides['@typescript-eslint/parser'] = normalizedParser;
        overrides['@typescript-eslint/eslint-plugin'] = normalizedPlugin;
      }
    } else {
      if (templateParser) {
        overrides['@typescript-eslint/parser'] = templateParser;
      }
      if (templatePlugin) {
        overrides['@typescript-eslint/eslint-plugin'] = templatePlugin;
      }
    }
  } else {
    if (templateParser) {
      overrides['@typescript-eslint/parser'] = templateParser;
    }
    if (templatePlugin) {
      overrides['@typescript-eslint/eslint-plugin'] = templatePlugin;
    }
  }

  if (stack === 'angular' && variant === 'angular-ssr') {
    const buildVersion = getVersion(existingPackageJson, '@angular/build');
    const ssrVersion = getVersion(existingPackageJson, '@angular/ssr');
    const normalizedBuildVersion = buildVersion ? normalizeToTilde(buildVersion) : null;
    const normalizedSsrVersion = ssrVersion ? normalizeToTilde(ssrVersion) : null;

    if (normalizedBuildVersion && normalizedSsrVersion && normalizedBuildVersion !== normalizedSsrVersion) {
      overrides['@angular/ssr'] = normalizedBuildVersion;
    }
  }

  return overrides;
}

