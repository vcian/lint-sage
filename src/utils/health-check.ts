import { access, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { CheckResult, LintSageState } from '../types.js';
import { resolveDependencyOverrides } from './dependency-overrides.js';
import { readDependenciesTemplate } from './template-loader.js';

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return (stats.mode & 0o111) !== 0;
  } catch {
    return false;
  }
}

const legacyConfigPaths = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  'prettier.config.cjs',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.json',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  '.prettierrc.toml',
  '.commitlintrc',
  '.commitlintrc.js',
  '.commitlintrc.cjs',
  '.commitlintrc.yaml',
  '.commitlintrc.yml',
  'commitlint.config.js',
  'commitlint.config.cjs',
  'commitlint.config.mjs',
  '.lintstagedrc',
  '.lintstagedrc.js',
  '.lintstagedrc.cjs',
  '.lintstagedrc.yaml',
  '.lintstagedrc.yml',
  'lint-staged.config.js',
  'lint-staged.config.cjs',
  'lint-staged.config.mjs',
] as const;

const sharedConfigPackages = [
  '@vcian/eslint-config-react',
  '@vcian/eslint-config-node',
  '@vcian/eslint-config-angular',
  '@vcian/prettier-config',
  '@vcian/commitlint-config',
] as const;

async function checkStateFile(targetDirectory: string): Promise<CheckResult> {
  const statePath = path.join(targetDirectory, '.lint-sage.json');

  if (!(await pathExists(statePath))) {
    return {
      name: 'State file',
      status: 'fail',
      message: '.lint-sage.json is missing',
      fixable: false,
    };
  }

  try {
    const raw = await readFile(statePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (parsed.schemaVersion !== 1 || !parsed.stack || !parsed.variant || !parsed.managedFiles) {
      return {
        name: 'State file',
        status: 'fail',
        message: '.lint-sage.json is corrupted or missing required fields',
        fixable: false,
      };
    }

    return { name: 'State file', status: 'pass', message: '.lint-sage.json is valid' };
  } catch {
    return {
      name: 'State file',
      status: 'fail',
      message: '.lint-sage.json contains invalid JSON',
      fixable: false,
    };
  }
}

async function checkManagedFiles(
  targetDirectory: string,
  state: LintSageState,
): Promise<CheckResult> {
  const missingFiles: string[] = [];

  for (const filePath of Object.keys(state.managedFiles)) {
    if (!(await pathExists(path.join(targetDirectory, filePath)))) {
      missingFiles.push(filePath);
    }
  }

  if (missingFiles.length === 0) {
    return { name: 'Config files', status: 'pass', message: 'All managed config files present' };
  }

  return {
    name: 'Config files',
    status: 'fail',
    message: `Missing config files: ${missingFiles.join(', ')}`,
    fixable: true,
  };
}

async function checkDependencyVersions(
  targetDirectory: string,
  state: LintSageState,
): Promise<CheckResult> {
  const packageJsonPath = path.join(targetDirectory, 'package.json');

  if (!(await pathExists(packageJsonPath))) {
    return { name: 'Dependency versions', status: 'fail', message: 'package.json not found' };
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    devDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
    overrides?: Record<string, string>;
  };
  const devDeps = packageJson.devDependencies ?? {};
  const existingOverrides = packageJson.overrides ?? {};
  const templateDeps = await readDependenciesTemplate(state.stack, state.variant);
  const mismatched: string[] = [];
  const missing: string[] = [];
  const overrideMismatched: string[] = [];
  const overrideMissing: string[] = [];

  for (const [name, expectedVersion] of Object.entries(templateDeps.devDependencies)) {
    if (!(name in devDeps)) {
      missing.push(name);
    } else if (devDeps[name] !== expectedVersion) {
      mismatched.push(`${name} (has ${devDeps[name]}, expected ${expectedVersion})`);
    }
  }

  const expectedOverrides = resolveDependencyOverrides(packageJson, state.stack, state.variant, templateDeps.devDependencies);
  for (const [name, expectedVersion] of Object.entries(expectedOverrides)) {
    const existingVersion = existingOverrides[name];
    if (!existingVersion) {
      overrideMissing.push(name);
      continue;
    }
    if (existingVersion !== expectedVersion) {
      overrideMismatched.push(`${name} (has ${existingVersion}, expected ${expectedVersion})`);
    }
  }

  if (missing.length > 0) {
    return {
      name: 'Dependency versions',
      status: 'fail',
      message: `Missing dependencies: ${missing.join(', ')}${overrideMissing.length > 0 ? `; missing overrides: ${overrideMissing.join(', ')}` : ''}`,
      fixable: true,
    };
  }

  if (mismatched.length > 0 || overrideMismatched.length > 0 || overrideMissing.length > 0) {
    const parts: string[] = [];
    if (mismatched.length > 0) {
      parts.push(`Version mismatches: ${mismatched.join(', ')}`);
    }
    if (overrideMissing.length > 0) {
      parts.push(`Missing overrides: ${overrideMissing.join(', ')}`);
    }
    if (overrideMismatched.length > 0) {
      parts.push(`Override mismatches: ${overrideMismatched.join(', ')}`);
    }
    return {
      name: 'Dependency versions',
      status: 'warn',
      message: parts.join('; '),
      fixable: true,
    };
  }

  return { name: 'Dependency versions', status: 'pass', message: 'All dependency versions match' };
}

async function checkLegacyConfigs(targetDirectory: string): Promise<CheckResult> {
  const found: string[] = [];

  for (const legacyPath of legacyConfigPaths) {
    if (await pathExists(path.join(targetDirectory, legacyPath))) {
      found.push(legacyPath);
    }
  }

  if (found.length === 0) {
    return {
      name: 'Legacy configs',
      status: 'pass',
      message: 'No conflicting legacy config files',
    };
  }

  return {
    name: 'Legacy configs',
    status: 'warn',
    message: `Legacy config files found: ${found.join(', ')}`,
    fixable: true,
  };
}

async function checkHuskyHooks(targetDirectory: string): Promise<CheckResult> {
  const hooks = ['.husky/pre-commit', '.husky/commit-msg'];
  const issues: string[] = [];

  for (const hook of hooks) {
    const hookPath = path.join(targetDirectory, hook);

    if (!(await pathExists(hookPath))) {
      issues.push(`${hook} is missing`);
    } else if (!(await isExecutable(hookPath))) {
      issues.push(`${hook} is not executable`);
    }
  }

  if (issues.length === 0) {
    return { name: 'Husky hooks', status: 'pass', message: 'Husky hooks installed and executable' };
  }

  return {
    name: 'Husky hooks',
    status: 'fail',
    message: issues.join('; '),
    fixable: true,
  };
}

function checkNodeModules(targetDirectory: string, state: LintSageState): CheckResult {
  const require = createRequire(path.join(targetDirectory, 'package.json'));
  const templateDeps = state.addedDependencies;
  const missing: string[] = [];

  for (const dep of templateDeps) {
    try {
      require.resolve(dep);
    } catch {
      missing.push(dep);
    }
  }

  if (missing.length === 0) {
    return {
      name: 'Installed packages',
      status: 'pass',
      message: 'All required packages resolvable',
    };
  }

  return {
    name: 'Installed packages',
    status: 'fail',
    message: `Packages not found in node_modules: ${missing.join(', ')}`,
  };
}

function checkSharedConfigs(targetDirectory: string, _state: LintSageState): CheckResult {
  const require = createRequire(path.join(targetDirectory, 'package.json'));
  const packageJson = JSON.parse(
    require('fs').readFileSync(path.join(targetDirectory, 'package.json'), 'utf8') as string,
  ) as { devDependencies?: Record<string, string> };
  const devDeps = packageJson.devDependencies ?? {};
  const unresolvable: string[] = [];
  const versionMismatch: string[] = [];

  for (const pkg of sharedConfigPackages) {
    if (!(pkg in devDeps)) {
      continue;
    }

    try {
      require.resolve(pkg);
    } catch {
      unresolvable.push(pkg);
    }
  }

  if (unresolvable.length > 0) {
    return {
      name: 'Shared configs',
      status: 'fail',
      message: `Shared config packages not resolvable: ${unresolvable.join(', ')}`,
      fixable: true,
    };
  }

  if (versionMismatch.length > 0) {
    return {
      name: 'Shared configs',
      status: 'warn',
      message: `Shared config version mismatches: ${versionMismatch.join(', ')}`,
    };
  }

  return {
    name: 'Shared configs',
    status: 'pass',
    message: 'All shared config packages resolvable',
  };
}

async function checkGithubWorkflow(targetDirectory: string): Promise<CheckResult> {
  const workflowPath = path.join(targetDirectory, '.github', 'workflows', 'lint.yml');

  if (await pathExists(workflowPath)) {
    return { name: 'CI workflow', status: 'pass', message: 'GitHub Actions workflow present' };
  }

  return {
    name: 'CI workflow',
    status: 'fail',
    message: '.github/workflows/lint.yml is missing',
    fixable: true,
  };
}

export async function runHealthChecks(
  targetDirectory: string,
  state: LintSageState,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  results.push(await checkStateFile(targetDirectory));
  results.push(await checkManagedFiles(targetDirectory, state));
  results.push(await checkDependencyVersions(targetDirectory, state));
  results.push(await checkLegacyConfigs(targetDirectory));
  results.push(await checkHuskyHooks(targetDirectory));
  results.push(checkNodeModules(targetDirectory, state));
  results.push(checkSharedConfigs(targetDirectory, state));
  results.push(await checkGithubWorkflow(targetDirectory));

  return results;
}

export { legacyConfigPaths };
