import { access, chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import { confirm } from '@inquirer/prompts';

import type {
  CheckResult,
  GlobalOptions,
  LintSageMonorepoState,
  LintSageState,
  ManagedFileRecord,
} from '../types.js';
import { getMonorepoLintCommand } from '../utils/detect-monorepo.js';
import { legacyConfigPaths, runHealthChecks } from '../utils/health-check.js';
import { updateMonorepoPackageJson } from '../utils/monorepo-package.js';
import { hashContent, isMonorepoState, readStateFile, writeStateFile } from '../utils/state.js';
import {
  readMonorepoTemplateFile,
  readTemplateFile,
  renderCiWorkflow,
  renderMonorepoCiWorkflow,
} from '../utils/template-loader.js';
import { resolveDependencyOverrides } from '../utils/dependency-overrides.js';

const executableFiles = new Set(['.husky/pre-commit', '.husky/commit-msg']);
const sharedPrefixes = [
  '@vcian/eslint-config-',
  '@vcian/prettier-config',
  '@vcian/commitlint-config',
];
const statusIcons: Record<string, string> = {
  pass: '✔',
  warn: '⚠',
  fail: '✖',
};

function printReport(checks: CheckResult[]): void {
  for (const check of checks) {
    console.log(`${statusIcons[check.status]} ${check.name}: ${check.message}`);
  }

  const passCount = checks.filter((c) => c.status === 'pass').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;

  console.log('');
  console.log(
    `Health: ${passCount}/${checks.length} checks passed${warnCount > 0 ? `, ${warnCount} warnings` : ''}${failCount > 0 ? `, ${failCount} failures` : ''}.`,
  );

  if (warnCount > 0 || failCount > 0) {
    console.log(
      'Run "npx @vcian/lint-sage doctor --fix" to attempt auto-repair, or "npx @vcian/lint-sage update" to re-sync templates.',
    );
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fixMissingConfigFiles(
  targetDirectory: string,
  state: LintSageState,
): Promise<boolean> {
  let fixed = false;

  for (const [filePath, record] of Object.entries(state.managedFiles)) {
    const fullPath = path.join(targetDirectory, filePath);

    if (await pathExists(fullPath)) {
      continue;
    }

    const content =
      record.template === 'ci/lint.yml.template'
        ? await renderCiWorkflow(state.packageManager)
        : await readTemplateFile(state.stack, state.variant, filePath);

    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf8');

    if (executableFiles.has(filePath)) {
      await chmod(fullPath, 0o755);
    }

    state.managedFiles[filePath].lastAppliedHash = hashContent(content);
    console.log(`✔ Fixed: re-generated ${filePath} from template`);
    fixed = true;
  }

  return fixed;
}

async function fixMissingScopedFiles(
  targetDirectory: string,
  baseDirectory: string,
  managedFiles: Record<string, ManagedFileRecord>,
  getContent: (filePath: string, record: ManagedFileRecord) => Promise<string>,
): Promise<boolean> {
  let fixed = false;

  for (const [filePath, record] of Object.entries(managedFiles)) {
    const scopedFilePath = baseDirectory ? path.posix.join(baseDirectory, filePath) : filePath;
    const fullPath = path.join(targetDirectory, scopedFilePath);

    if (await pathExists(fullPath)) {
      continue;
    }

    const content = await getContent(filePath, record);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf8');

    if (executableFiles.has(filePath)) {
      await chmod(fullPath, 0o755);
    }

    managedFiles[filePath].lastAppliedHash = hashContent(content);
    console.log(`✔ Fixed: re-generated ${scopedFilePath} from template`);
    fixed = true;
  }

  return fixed;
}

async function fixHuskyHooks(targetDirectory: string, state: LintSageState): Promise<boolean> {
  const hooks = ['.husky/pre-commit', '.husky/commit-msg'];
  let fixed = false;

  for (const hook of hooks) {
    const hookPath = path.join(targetDirectory, hook);
    const exists = await pathExists(hookPath);

    if (exists) {
      const { stat } = await import('node:fs/promises');
      const stats = await stat(hookPath);

      if ((stats.mode & 0o111) !== 0) {
        continue;
      }

      await chmod(hookPath, 0o755);
      console.log(`✔ Fixed: set executable permissions on ${hook}`);
      fixed = true;
    } else {
      const content = await readTemplateFile(state.stack, state.variant, hook);

      await mkdir(path.dirname(hookPath), { recursive: true });
      await writeFile(hookPath, content, 'utf8');
      await chmod(hookPath, 0o755);

      state.managedFiles[hook].lastAppliedHash = hashContent(content);
      console.log(`✔ Fixed: recreated ${hook} (was missing)`);
      fixed = true;
    }
  }

  const huskyRuntimeDir = path.join(targetDirectory, '.husky', '_');

  if (!(await pathExists(huskyRuntimeDir)) && fixed) {
    console.log(
      "Note: Husky runtime directory (.husky/_) not found. Run your package manager's install command, then run npx husky.",
    );
  }

  return fixed;
}

async function fixMonorepoHuskyHooks(
  targetDirectory: string,
  state: LintSageMonorepoState,
): Promise<boolean> {
  const hooks = ['.husky/pre-commit', '.husky/commit-msg'];
  let fixed = false;

  for (const hook of hooks) {
    const hookPath = path.join(targetDirectory, hook);
    const exists = await pathExists(hookPath);

    if (exists) {
      const { stat } = await import('node:fs/promises');
      const stats = await stat(hookPath);

      if ((stats.mode & 0o111) !== 0) {
        continue;
      }

      await chmod(hookPath, 0o755);
      console.log(`✔ Fixed: set executable permissions on ${hook}`);
      fixed = true;
    } else {
      const content = await readMonorepoTemplateFile(hook);

      await mkdir(path.dirname(hookPath), { recursive: true });
      await writeFile(hookPath, content, 'utf8');
      await chmod(hookPath, 0o755);

      state.managedFiles[hook].lastAppliedHash = hashContent(content);
      console.log(`✔ Fixed: recreated ${hook} (was missing)`);
      fixed = true;
    }
  }

  const huskyRuntimeDir = path.join(targetDirectory, '.husky', '_');

  if (!(await pathExists(huskyRuntimeDir)) && fixed) {
    console.log(
      "Note: Husky runtime directory (.husky/_) not found. Run your package manager's install command, then run npx husky.",
    );
  }

  return fixed;
}

async function fixDependencyVersions(
  targetDirectory: string,
  state: LintSageState,
): Promise<boolean> {
  const packageJsonPath = path.join(targetDirectory, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    overrides?: Record<string, string>;
    [key: string]: unknown;
  };
  const devDeps = packageJson.devDependencies ?? {};
  const overrides = packageJson.overrides ?? {};
  const templateDeps = JSON.parse(
    await readTemplateFile(state.stack, state.variant, 'dependencies.json'),
  ) as { devDependencies: Record<string, string> };
  let modified = false;

  for (const [name, expectedVersion] of Object.entries(templateDeps.devDependencies)) {
    if (!(name in devDeps)) {
      devDeps[name] = expectedVersion;
      console.log(`✔ Fixed: added ${name} ${expectedVersion} to devDependencies`);
      modified = true;
    } else if (devDeps[name] !== expectedVersion) {
      const oldVersion = devDeps[name];
      devDeps[name] = expectedVersion;
      console.log(`✔ Fixed: ${name} ${oldVersion} → ${expectedVersion} in package.json`);
      modified = true;
    }
  }

  const expectedOverrides = resolveDependencyOverrides(packageJson, state.stack, state.variant, templateDeps.devDependencies);
  for (const [name, expectedVersion] of Object.entries(expectedOverrides)) {
    const oldVersion = overrides[name];
    if (!oldVersion) {
      overrides[name] = expectedVersion;
      console.log(`✔ Fixed: added override ${name} ${expectedVersion} in package.json`);
      modified = true;
      continue;
    }

    if (oldVersion !== expectedVersion) {
      overrides[name] = expectedVersion;
      console.log(`✔ Fixed: override ${name} ${oldVersion} → ${expectedVersion} in package.json`);
      modified = true;
    }
  }

  if (modified) {
    packageJson.devDependencies = Object.fromEntries(
      Object.entries(devDeps).sort(([a], [b]) => a.localeCompare(b)),
    );
    packageJson.overrides = Object.fromEntries(
      Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)),
    );
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  }

  return modified;
}

async function fixMonorepoDependencyVersions(
  targetDirectory: string,
  state: LintSageMonorepoState,
): Promise<boolean> {
  const result = await updateMonorepoPackageJson({
    targetDirectory,
    packages: Object.values(state.packages),
    dryRun: false,
    includeScripts: false,
    respectHigherPatch: false,
  });

  for (const dep of result.addedDependencies) {
    console.log(`✔ Fixed: added ${dep} to devDependencies`);
  }

  for (const dep of result.updatedDependencies) {
    console.log(`✔ Fixed: ${dep.name} ${dep.oldVersion} → ${dep.newVersion} in package.json`);
  }

  for (const overrideName of result.addedOverrides) {
    console.log(`✔ Fixed: added override ${overrideName} in package.json`);
  }

  for (const override of result.updatedOverrides) {
    console.log(
      `✔ Fixed: override ${override.name} ${override.oldVersion} → ${override.newVersion} in package.json`,
    );
  }

  return (
    result.addedDependencies.length > 0 ||
    result.updatedDependencies.length > 0 ||
    result.addedOverrides.length > 0 ||
    result.updatedOverrides.length > 0
  );
}

async function collectLegacyConfigPaths(
  targetDirectory: string,
  packagePaths: string[] = [],
): Promise<string[]> {
  const directories = ['', ...packagePaths];
  const found = new Set<string>();

  for (const baseDirectory of directories) {
    for (const legacyPath of legacyConfigPaths) {
      const scopedPath = baseDirectory ? path.posix.join(baseDirectory, legacyPath) : legacyPath;

      if (await pathExists(path.join(targetDirectory, scopedPath))) {
        found.add(scopedPath);
      }
    }
  }

  return [...found].sort();
}

async function fixLegacyConfigs(targetDirectory: string, legacyPaths: string[]): Promise<void> {
  for (const legacyPath of legacyPaths) {
    const fullPath = path.join(targetDirectory, legacyPath);
    const shouldDelete = await confirm({
      message: `Legacy ${legacyPath} detected alongside modern config. Delete ${legacyPath}?`,
      default: false,
    });

    if (shouldDelete) {
      await unlink(fullPath);
      console.log(`✔ Fixed: deleted legacy ${legacyPath}`);
    }
  }
}

async function fixSharedConfigs(targetDirectory: string, state: LintSageState): Promise<boolean> {
  const templateDeps = JSON.parse(
    await readTemplateFile(state.stack, state.variant, 'dependencies.json'),
  ) as { devDependencies: Record<string, string> };
  const packageJsonPath = path.join(targetDirectory, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    devDependencies?: Record<string, string>;
    [key: string]: unknown;
  };
  const devDeps = packageJson.devDependencies ?? {};
  let modified = false;

  for (const [name, version] of Object.entries(templateDeps.devDependencies)) {
    if (!sharedPrefixes.some((prefix) => name.startsWith(prefix))) {
      continue;
    }

    if (!(name in devDeps)) {
      devDeps[name] = version;
      console.log(`✔ Fixed: added ${name} ${version} to devDependencies`);
      modified = true;
    }
  }

  if (modified) {
    packageJson.devDependencies = Object.fromEntries(
      Object.entries(devDeps).sort(([a], [b]) => a.localeCompare(b)),
    );
    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  }

  return modified;
}

function buildStateCheck(name = 'State file'): CheckResult {
  return { name, status: 'pass', message: '.lint-sage.json is valid' };
}

async function collectMissingManagedFiles(
  targetDirectory: string,
  baseDirectory: string,
  managedFiles: Record<string, ManagedFileRecord>,
): Promise<string[]> {
  const missing: string[] = [];

  for (const filePath of Object.keys(managedFiles)) {
    const scopedPath = baseDirectory ? path.posix.join(baseDirectory, filePath) : filePath;

    if (!(await pathExists(path.join(targetDirectory, scopedPath)))) {
      missing.push(scopedPath);
    }
  }

  return missing;
}

async function checkMonorepoManagedFiles(
  targetDirectory: string,
  state: LintSageMonorepoState,
): Promise<CheckResult[]> {
  const rootMissing = await collectMissingManagedFiles(targetDirectory, '', state.managedFiles);
  const packageMissing = (
    await Promise.all(
      Object.entries(state.packages).map(([packagePath, packageConfig]) =>
        collectMissingManagedFiles(targetDirectory, packagePath, packageConfig.managedFiles),
      ),
    )
  ).flat();

  return [
    rootMissing.length === 0
      ? {
          name: 'Root config files',
          status: 'pass',
          message: 'All root managed config files present',
        }
      : {
          name: 'Root config files',
          status: 'fail',
          message: `Missing config files: ${rootMissing.join(', ')}`,
          fixable: true,
        },
    packageMissing.length === 0
      ? {
          name: 'Package config files',
          status: 'pass',
          message: 'All package ESLint configs present',
        }
      : {
          name: 'Package config files',
          status: 'fail',
          message: `Missing config files: ${packageMissing.join(', ')}`,
          fixable: true,
        },
  ];
}

async function checkMonorepoDependencyVersions(
  targetDirectory: string,
  state: LintSageMonorepoState,
): Promise<CheckResult> {
  const preview = await updateMonorepoPackageJson({
    targetDirectory,
    packages: Object.values(state.packages),
    dryRun: true,
    includeScripts: false,
    respectHigherPatch: false,
  });

  if (preview.addedDependencies.length > 0) {
    return {
      name: 'Dependency versions',
      status: 'fail',
      message: `Missing dependencies: ${preview.addedDependencies.join(', ')}`,
      fixable: true,
    };
  }

  if (preview.updatedDependencies.length > 0) {
    return {
      name: 'Dependency versions',
      status: 'warn',
      message: `Version mismatches: ${preview.updatedDependencies.map((dep) => `${dep.name} (has ${dep.oldVersion}, expected ${dep.newVersion})`).join(', ')}`,
      fixable: true,
    };
  }

  return { name: 'Dependency versions', status: 'pass', message: 'All dependency versions match' };
}

async function checkLegacyConfigs(paths: string[]): Promise<CheckResult> {
  if (paths.length === 0) {
    return {
      name: 'Legacy configs',
      status: 'pass',
      message: 'No conflicting legacy config files',
    };
  }

  return {
    name: 'Legacy configs',
    status: 'warn',
    message: `Legacy config files found: ${paths.join(', ')}`,
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
      continue;
    }

    const { stat } = await import('node:fs/promises');
    const stats = await stat(hookPath);

    if ((stats.mode & 0o111) === 0) {
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

function checkNodeModules(
  targetDirectory: string,
  state: { addedDependencies: string[] },
): CheckResult {
  const require = createRequire(path.join(targetDirectory, 'package.json'));
  const missing: string[] = [];

  for (const dep of state.addedDependencies) {
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

function checkSharedConfigs(targetDirectory: string): CheckResult {
  const require = createRequire(path.join(targetDirectory, 'package.json'));
  const packageJson = JSON.parse(
    require('fs').readFileSync(path.join(targetDirectory, 'package.json'), 'utf8') as string,
  ) as { devDependencies?: Record<string, string> };
  const devDeps = packageJson.devDependencies ?? {};
  const unresolvable: string[] = [];

  for (const pkg of Object.keys(devDeps)) {
    if (!sharedPrefixes.some((prefix) => pkg.startsWith(prefix))) {
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

async function runMonorepoHealthChecks(
  targetDirectory: string,
  state: LintSageMonorepoState,
): Promise<CheckResult[]> {
  const legacyPaths = await collectLegacyConfigPaths(targetDirectory, Object.keys(state.packages));

  return [
    buildStateCheck(),
    ...(await checkMonorepoManagedFiles(targetDirectory, state)),
    await checkMonorepoDependencyVersions(targetDirectory, state),
    await checkLegacyConfigs(legacyPaths),
    await checkHuskyHooks(targetDirectory),
    checkNodeModules(targetDirectory, state),
    checkSharedConfigs(targetDirectory),
    await checkGithubWorkflow(targetDirectory),
  ];
}

async function handleMonorepoDoctor(
  targetDirectory: string,
  state: LintSageMonorepoState,
  options: GlobalOptions,
): Promise<number> {
  const checks = await runMonorepoHealthChecks(targetDirectory, state);

  printReport(checks);

  if (!options.fix) {
    return checks.some((check) => check.status !== 'pass') ? 1 : 0;
  }

  const fixableIssues = checks.filter((check) => check.status !== 'pass' && check.fixable);

  if (fixableIssues.length === 0) {
    console.log('');
    console.log('No fixable issues found.');
    return checks.some((check) => check.status !== 'pass') ? 1 : 0;
  }

  console.log('');
  console.log('Attempting auto-fix...');

  let packageJsonModified = false;

  await fixMissingScopedFiles(targetDirectory, '', state.managedFiles, (filePath, record) =>
    record.template === 'ci/monorepo-lint.yml.template'
      ? renderMonorepoCiWorkflow(
          state.packageManager,
          getMonorepoLintCommand(state.monorepoTool, state.packageManager),
        )
      : readMonorepoTemplateFile(filePath),
  );

  for (const [packagePath, packageConfig] of Object.entries(state.packages)) {
    await fixMissingScopedFiles(
      targetDirectory,
      packagePath,
      packageConfig.managedFiles,
      (filePath) => readTemplateFile(packageConfig.stack, packageConfig.variant, filePath),
    );
  }

  await fixMonorepoHuskyHooks(targetDirectory, state);

  if (await fixMonorepoDependencyVersions(targetDirectory, state)) {
    packageJsonModified = true;
  }

  const legacyPaths = await collectLegacyConfigPaths(targetDirectory, Object.keys(state.packages));
  await fixLegacyConfigs(targetDirectory, legacyPaths);
  await writeStateFile(targetDirectory, state);

  if (packageJsonModified) {
    console.log('');
    console.log("Run your package manager's install command to install updated dependencies.");
  }

  return 0;
}

export async function handleDoctor(options: GlobalOptions): Promise<number> {
  const targetDirectory = process.cwd();

  try {
    const state = await readStateFile(targetDirectory);

    if (isMonorepoState(state)) {
      return handleMonorepoDoctor(targetDirectory, state, options);
    }

    const checks = await runHealthChecks(targetDirectory, state);

    printReport(checks);

    if (!options.fix) {
      const hasIssues = checks.some((c) => c.status !== 'pass');
      return hasIssues ? 1 : 0;
    }

    const fixableIssues = checks.filter((c) => c.status !== 'pass' && c.fixable);

    if (fixableIssues.length === 0) {
      console.log('');
      console.log('No fixable issues found.');
      return checks.some((c) => c.status !== 'pass') ? 1 : 0;
    }

    console.log('');
    console.log('Attempting auto-fix...');

    let packageJsonModified = false;

    await fixMissingConfigFiles(targetDirectory, state);
    await fixHuskyHooks(targetDirectory, state);

    if (await fixDependencyVersions(targetDirectory, state)) {
      packageJsonModified = true;
    }

    if (await fixSharedConfigs(targetDirectory, state)) {
      packageJsonModified = true;
    }

    await fixLegacyConfigs(targetDirectory, await collectLegacyConfigPaths(targetDirectory));
    await writeStateFile(targetDirectory, state);

    if (packageJsonModified) {
      console.log('');
      console.log("Run your package manager's install command to install updated dependencies.");
    }

    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}
