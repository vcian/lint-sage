import { readFileSync } from 'node:fs';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { confirm, select } from '@inquirer/prompts';

import type {
  GlobalOptions,
  LintSageMonorepoState,
  LintSageState,
  MonorepoPackageConfig,
  MonorepoTool,
  PackageManager,
  Stack,
  Variant,
} from '../types.js';
import {
  detectMonorepoTools,
  discoverWorkspacePackages,
  getMonorepoLintCommand,
  getMonorepoToolDisplayName,
} from '../utils/detect-monorepo.js';
import {
  promptForStack,
  promptForVariant,
  resolvePreset,
  resolveVariantToStack,
  confirmOverwrite,
  confirmPackageJsonOverwrite,
} from '../utils/init-flow.js';
import {
  collectInitCompatibilityIssues,
  detectAngularSsrMismatch,
  shouldCheckAngularSsr,
  verifySharedConfigPackagesAvailable,
} from '../utils/init-compatibility.js';
import { detectExistingConfigs } from '../utils/detect-existing.js';
import { detectPackageManager } from '../utils/package-manager.js';
import {
  buildManagedFilesRecord,
  buildMonorepoRootManagedFiles,
  buildPackageManagedFiles,
  writeMonorepoStateFile,
  writeStateFile,
} from '../utils/state.js';
import {
  readTemplateFile,
  listMonorepoTemplateFiles,
  readMonorepoTemplateFile,
  renderMonorepoCiWorkflow,
} from '../utils/template-loader.js';
import { updateMonorepoPackageJson } from '../utils/monorepo-package.js';
import { updatePackage } from '../utils/update-package.js';
import { writeConfigs } from '../utils/write-configs.js';

function readLintSageVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { version: string };

  return packageJson.version;
}

async function resolveSelection(
  options: GlobalOptions,
): Promise<{ stack: Stack; variant: Variant }> {
  if (options.preset) {
    const resolvedPreset = resolvePreset(options.preset);

    if (!resolvedPreset) {
      throw new Error(`Unknown preset "${options.preset}".`);
    }

    return resolvedPreset;
  }

  const stack = await promptForStack();
  const variant = await promptForVariant(stack);

  return { stack, variant };
}

function printCreatedFileSummary(filePaths: string[], dryRun: boolean): void {
  const prefix = dryRun ? '[dry-run] Would create' : '✔ Created';

  for (const filePath of filePaths) {
    console.log(`${prefix} ${filePath}`);
  }
}

function printPackageSummary(dryRun: boolean): void {
  if (dryRun) {
    console.log('[dry-run] Would update package.json (devDependencies + overrides + scripts)');
    return;
  }

  console.log('✔ Updated package.json (devDependencies + overrides + scripts)');
}

function printOverrideSummary(
  addedOverrides: string[],
  updatedOverrides: { name: string; oldVersion: string; newVersion: string }[],
  dryRun: boolean,
): void {
  const prefix = dryRun ? '[dry-run] ' : '';
  if (addedOverrides.length === 0 && updatedOverrides.length === 0) {
    return;
  }

  console.log(`${prefix}Compatibility overrides:`);
  for (const override of updatedOverrides) {
    console.log(`  ↑ ${override.name}: ${override.oldVersion} → ${override.newVersion}`);
  }
  for (const override of addedOverrides) {
    console.log(`  + ${override}`);
  }
}

function printStateSummary(dryRun: boolean): void {
  if (dryRun) {
    console.log('[dry-run] Would create .lint-sage.json');
    return;
  }

  console.log('✔ Created .lint-sage.json');
}

type PackageJsonShape = {
  workspaces?: string[] | { packages: string[] };
  [key: string]: unknown;
};

interface PackageSelection {
  packagePath: string;
  stack: Stack;
  variant: Variant;
}

function parseMonorepoPreset(preset: string, discoveredPackages: string[]): PackageSelection[] {
  const entries = preset
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  const selections: PackageSelection[] = [];
  const discoveredSet = new Set(discoveredPackages);
  const mappedPaths = new Set<string>();

  for (const entry of entries) {
    const colonIndex = entry.lastIndexOf(':');

    if (colonIndex === -1) {
      throw new Error(
        `Invalid preset entry "${entry}". Expected format: "path:variant" (e.g., "apps/web:next-js").`,
      );
    }

    const packagePath = entry.slice(0, colonIndex);
    const variantName = entry.slice(colonIndex + 1);

    if (!discoveredSet.has(packagePath)) {
      throw new Error(
        `Preset path "${packagePath}" does not match any discovered workspace package. Available: ${discoveredPackages.join(', ')}`,
      );
    }

    const stack = resolveVariantToStack(variantName);

    if (!stack) {
      throw new Error(`Unknown variant "${variantName}" in preset entry "${entry}".`);
    }

    mappedPaths.add(packagePath);
    selections.push({ packagePath, stack, variant: variantName as Variant });
  }

  const missingPackages = discoveredPackages.filter((p) => !mappedPaths.has(p));

  if (missingPackages.length > 0) {
    throw new Error(
      `Missing preset entries for discovered packages: ${missingPackages.join(', ')}. All workspace packages must be mapped.`,
    );
  }

  return selections;
}

async function resolveMonorepoTool(
  detectedTools: { tool: MonorepoTool; indicator: string }[],
  force: boolean,
): Promise<MonorepoTool> {
  if (detectedTools.length === 1) {
    return detectedTools[0].tool;
  }

  if (force) {
    return detectedTools[0].tool;
  }

  return select({
    message: 'Multiple monorepo tools detected. Select the primary orchestrator:',
    choices: detectedTools.map((d) => ({
      name: `${getMonorepoToolDisplayName(d.tool)} (${d.indicator})`,
      value: d.tool,
    })),
  });
}

const executableFiles = new Set(['.husky/commit-msg', '.husky/pre-commit']);
const skippedTemplateFiles = new Set(['README.md', 'dependencies.json']);

async function writeMonorepoRootConfigs(
  targetDirectory: string,
  packageManager: PackageManager,
  lintCommand: string,
  dryRun: boolean,
  verbose: boolean,
): Promise<string[]> {
  const templateFiles = await listMonorepoTemplateFiles();
  const writtenFiles: string[] = [];

  for (const relativeTemplatePath of templateFiles) {
    if (skippedTemplateFiles.has(relativeTemplatePath)) {
      continue;
    }

    const renderedContent = await readMonorepoTemplateFile(relativeTemplatePath);
    const targetFilePath = path.join(targetDirectory, relativeTemplatePath);
    const displayPath = relativeTemplatePath.split(path.sep).join(path.posix.sep);

    writtenFiles.push(displayPath);

    if (dryRun) {
      console.log(`[dry-run] Would create ${displayPath}`);
      continue;
    }

    await mkdir(path.dirname(targetFilePath), { recursive: true });
    await writeFile(targetFilePath, renderedContent, 'utf8');

    if (executableFiles.has(displayPath)) {
      await chmod(targetFilePath, 0o755);
    }

    if (verbose) {
      console.log(`Created ${targetFilePath}`);
    }
  }

  const ciWorkflowPath = path.join(targetDirectory, '.github', 'workflows', 'lint.yml');
  const ciDisplayPath = '.github/workflows/lint.yml';
  writtenFiles.push(ciDisplayPath);

  if (dryRun) {
    console.log(`[dry-run] Would create ${ciDisplayPath}`);
  } else {
    await mkdir(path.dirname(ciWorkflowPath), { recursive: true });
    await writeFile(
      ciWorkflowPath,
      await renderMonorepoCiWorkflow(packageManager, lintCommand),
      'utf8',
    );

    if (verbose) {
      console.log(`Created ${ciWorkflowPath}`);
    }
  }

  return writtenFiles;
}

async function writePackageEslintConfig(
  targetDirectory: string,
  packagePath: string,
  stack: Stack,
  variant: Variant,
  dryRun: boolean,
  verbose: boolean,
): Promise<string> {
  const renderedContent = await readTemplateFile(stack, variant, 'eslint.config.js');
  const targetFilePath = path.join(targetDirectory, packagePath, 'eslint.config.js');
  const displayPath = `${packagePath}/eslint.config.js`;

  if (dryRun) {
    console.log(`[dry-run] Would create ${displayPath}`);
  } else {
    await mkdir(path.dirname(targetFilePath), { recursive: true });
    await writeFile(targetFilePath, renderedContent, 'utf8');

    if (verbose) {
      console.log(`Created ${targetFilePath}`);
    }
  }

  return displayPath;
}

async function handleMonorepoInit(options: GlobalOptions): Promise<number> {
  const targetDirectory = process.cwd();
  const packageJsonPath = path.join(targetDirectory, 'package.json');

  try {
    readFileSync(packageJsonPath, 'utf8');
  } catch {
    console.error(
      'package.json not found in the current directory. Run lint-sage from a project root.',
    );
    return 1;
  }

  try {
    const { packageManager, source } = await detectPackageManager(
      targetDirectory,
      options.packageManager,
    );

    if (options.verbose) {
      console.log(`Detected package manager: ${packageManager} (${source})`);
    }

    // Detect monorepo tools
    const detectedTools = await detectMonorepoTools(targetDirectory, packageManager);

    if (detectedTools.length === 0) {
      // --monorepo was forced but no tool detected; check for workspaces in package.json
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJsonShape;

      if (!packageJson.workspaces) {
        console.error(
          'No monorepo tool or workspace configuration detected. ' +
            'Add a workspaces field to package.json, or create a pnpm-workspace.yaml, turbo.json, or nx.json.',
        );
        return 1;
      }
    }

    // Resolve which monorepo tool to use
    let monorepoTool: MonorepoTool;

    if (detectedTools.length === 0) {
      monorepoTool = packageManager === 'yarn' ? 'yarn-workspaces' : 'npm-workspaces';
    } else {
      monorepoTool = await resolveMonorepoTool(detectedTools, Boolean(options.force));
    }

    console.log(`Monorepo detected (${getMonorepoToolDisplayName(monorepoTool)}).`);

    // Discover workspace packages
    const discoveredPackages = await discoverWorkspacePackages(targetDirectory);

    if (discoveredPackages.length === 0) {
      console.error(
        'No workspace packages found. Ensure your workspace configuration contains valid package paths.',
      );
      return 1;
    }

    console.log(`Found ${discoveredPackages.length} packages: ${discoveredPackages.join(', ')}`);

    // Confirm root config generation
    if (!options.force && !options.dryRun) {
      const shouldConfigureRoot = await confirm({
        message: 'Configure root-level settings (Husky, commitlint, Prettier, VSCode)?',
        default: true,
      });

      if (!shouldConfigureRoot) {
        console.error('Init cancelled.');
        return 0;
      }
    }

    // Resolve per-package selections
    let packageSelections: PackageSelection[];

    if (options.preset) {
      packageSelections = parseMonorepoPreset(options.preset, discoveredPackages);
    } else {
      packageSelections = [];

      for (const packagePath of discoveredPackages) {
        console.log(`\nConfiguring ${packagePath}:`);
        const stack = await promptForStack();
        const variant = await promptForVariant(stack);
        packageSelections.push({ packagePath, stack, variant });
      }
    }

    const existingPackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const compatibility = collectInitCompatibilityIssues(existingPackageJson);
    const includesAngularSsr = shouldCheckAngularSsr(packageSelections.map((p) => p.variant));
    const angularSsrWarning = includesAngularSsr ? detectAngularSsrMismatch(existingPackageJson) : null;

    if (compatibility.errors.length > 0) {
      console.error('Detected incompatible dependency versions in current project:');
      for (const issue of compatibility.errors) {
        console.error(`  - ${issue}`);
      }
      return 1;
    }

    for (const warning of compatibility.warnings) {
      console.error(`⚠ ${warning}`);
    }

    if (angularSsrWarning) {
      console.error(`⚠ ${angularSsrWarning}`);
    }

    if (!options.dryRun) {
      verifySharedConfigPackagesAvailable([...new Set(packageSelections.map((p) => p.stack))]);
    }

    const dryRun = Boolean(options.dryRun);
    const verbose = Boolean(options.verbose);
    const lintCommand = getMonorepoLintCommand(monorepoTool, packageManager);
    const packagePreview = await updateMonorepoPackageJson({
      targetDirectory,
      packages: packageSelections,
      dryRun: true,
      respectHigherPatch: false,
    });

    if (
      !options.force &&
      !options.dryRun &&
      (packagePreview.updatedDependencies.length > 0 || packagePreview.updatedScripts.length > 0)
    ) {
      const shouldOverwritePackageJson = await confirmPackageJsonOverwrite({
        updatedDependencies: packagePreview.updatedDependencies.map(
          (dependency) => dependency.name,
        ),
        updatedScripts: packagePreview.updatedScripts,
      });

      if (!shouldOverwritePackageJson) {
        console.error('Init cancelled.');
        return 0;
      }
    }

    // Write root configs
    const rootWrittenFiles = await writeMonorepoRootConfigs(
      targetDirectory,
      packageManager,
      lintCommand,
      dryRun,
      verbose,
    );

    // Write per-package ESLint configs
    const packageWrittenFiles: string[] = [];

    for (const sel of packageSelections) {
      const displayPath = await writePackageEslintConfig(
        targetDirectory,
        sel.packagePath,
        sel.stack,
        sel.variant,
        dryRun,
        verbose,
      );
      packageWrittenFiles.push(displayPath);
    }

    // Update root package.json
    const packageResult = await updateMonorepoPackageJson({
      targetDirectory,
      packages: packageSelections,
      dryRun,
      respectHigherPatch: false,
      verbose,
    });

    // Build state
    const timestamp = new Date().toISOString();
    const rootManagedFiles = await buildMonorepoRootManagedFiles(
      packageManager,
      monorepoTool,
      lintCommand,
    );

    const packages: Record<string, MonorepoPackageConfig> = {};

    for (const sel of packageSelections) {
      packages[sel.packagePath] = {
        path: sel.packagePath,
        stack: sel.stack,
        variant: sel.variant,
        managedFiles: await buildPackageManagedFiles(sel.stack, sel.variant),
      };
    }

    const monorepoState: LintSageMonorepoState = {
      schemaVersion: 1,
      version: readLintSageVersion(),
      packageManager,
      monorepo: true,
      monorepoTool,
      managedFiles: rootManagedFiles,
      packages,
      addedDependencies: packageResult.addedDependencies,
      addedScripts: packageResult.addedScripts,
      initializedAt: timestamp,
      lastUpdatedAt: timestamp,
    };

    await writeMonorepoStateFile(targetDirectory, monorepoState, dryRun);

    // Print summary
    if (!dryRun) {
      for (const filePath of rootWrittenFiles) {
        console.log(`✔ Created ${filePath}`);
      }

      for (const filePath of packageWrittenFiles) {
        console.log(`✔ Created ${filePath}`);
      }
    }

    if (dryRun) {
      console.log('[dry-run] Would update package.json (devDependencies + overrides + scripts)');
      console.log('[dry-run] Would create .lint-sage.json');
    } else {
      console.log('✔ Updated package.json (devDependencies + overrides + scripts)');
      console.log('✔ Created .lint-sage.json');
    }
    printOverrideSummary(
      packageResult.addedOverrides,
      packageResult.updatedOverrides,
      Boolean(options.dryRun),
    );

    console.log('');
    console.log("Run your package manager's install command to install the new dependencies.");

    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}

export async function handleInit(options: GlobalOptions): Promise<number> {
  const targetDirectory = process.cwd();
  const packageJsonPath = path.join(targetDirectory, 'package.json');

  try {
    readFileSync(packageJsonPath, 'utf8');
  } catch {
    console.error(
      'package.json not found in the current directory. Run lint-sage from a project root.',
    );
    return 1;
  }

  // Route to monorepo init if --monorepo flag or auto-detected
  if (options.monorepo) {
    return handleMonorepoInit(options);
  }

  try {
    const { packageManager } = await detectPackageManager(targetDirectory, options.packageManager);
    const detectedTools = await detectMonorepoTools(targetDirectory, packageManager);

    if (detectedTools.length > 0) {
      return handleMonorepoInit(options);
    }
  } catch {
    // If detection fails, fall through to single-project init
  }

  try {
    const { packageManager, source } = await detectPackageManager(
      targetDirectory,
      options.packageManager,
    );

    if (options.verbose) {
      console.log(`Detected package manager: ${packageManager} (${source})`);
    }

    const { stack, variant } = await resolveSelection(options);
    const existingPackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const compatibility = collectInitCompatibilityIssues(existingPackageJson);
    const angularSsrWarning =
      variant === 'angular-ssr' ? detectAngularSsrMismatch(existingPackageJson) : null;

    if (compatibility.errors.length > 0) {
      console.error('Detected incompatible dependency versions in current project:');
      for (const issue of compatibility.errors) {
        console.error(`  - ${issue}`);
      }
      return 1;
    }

    for (const warning of compatibility.warnings) {
      console.error(`⚠ ${warning}`);
    }

    if (angularSsrWarning) {
      console.error(`⚠ ${angularSsrWarning}`);
    }

    if (!options.dryRun) {
      verifySharedConfigPackagesAvailable([stack]);
    }

    const detectedExistingFiles = await detectExistingConfigs(targetDirectory);
    const packagePreview = await updatePackage({
      targetDirectory,
      stack,
      variant,
      dryRun: true,
    });

    if (detectedExistingFiles.length > 0 && !options.force) {
      const shouldOverwrite = await confirmOverwrite(detectedExistingFiles);

      if (!shouldOverwrite) {
        console.error('Init cancelled.');
        return 0;
      }
    }

    if (
      !options.force &&
      !options.dryRun &&
      (packagePreview.updatedDependencies.length > 0 || packagePreview.updatedScripts.length > 0)
    ) {
      const shouldOverwritePackageJson = await confirmPackageJsonOverwrite({
        updatedDependencies: packagePreview.updatedDependencies,
        updatedScripts: packagePreview.updatedScripts,
      });

      if (!shouldOverwritePackageJson) {
        console.error('Init cancelled.');
        return 0;
      }
    }

    const writeResult = await writeConfigs({
      targetDirectory,
      stack,
      variant,
      dryRun: options.dryRun,
      force: options.force,
      verbose: options.verbose,
      packageManager,
    });

    const packageResult = await updatePackage({
      targetDirectory,
      stack,
      variant,
      dryRun: options.dryRun,
      verbose: options.verbose,
    });

    const timestamp = new Date().toISOString();
    const state: LintSageState = {
      schemaVersion: 1,
      version: readLintSageVersion(),
      packageManager,
      stack,
      variant,
      managedFiles: await buildManagedFilesRecord(stack, variant, packageManager),
      addedDependencies: packageResult.addedDependencies,
      addedScripts: packageResult.addedScripts,
      initializedAt: timestamp,
      lastUpdatedAt: timestamp,
    };

    await writeStateFile(targetDirectory, state, options.dryRun);

    if (!options.dryRun) {
      printCreatedFileSummary(writeResult.writtenFiles, false);
    }
    printPackageSummary(Boolean(options.dryRun));
    printOverrideSummary(
      packageResult.addedOverrides,
      packageResult.updatedOverrides,
      Boolean(options.dryRun),
    );
    printStateSummary(Boolean(options.dryRun));
    console.log('');
    console.log("Run your package manager's install command to install the new dependencies.");

    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}
