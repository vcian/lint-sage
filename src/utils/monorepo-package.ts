import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  DepVersionChange,
  MonorepoPackageConfig,
  Stack,
  UpdatePackageForUpdateResult,
  Variant,
} from '../types.js';
import { readDependenciesTemplate, readMonorepoDependenciesTemplate } from './template-loader.js';
import { shouldUpdateVersion } from './update-package.js';

type PackageJsonShape = {
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
};

type MonorepoPackageSelection = {
  stack: Stack;
  variant: Variant;
};

type UpdateMonorepoPackageJsonInput = {
  targetDirectory: string;
  packages: Iterable<MonorepoPackageConfig | MonorepoPackageSelection>;
  dryRun?: boolean;
  includeScripts?: boolean;
  respectHigherPatch?: boolean;
  verbose?: boolean;
};

function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

async function buildMonorepoTemplatePackageJson(
  packages: Iterable<MonorepoPackageConfig | MonorepoPackageSelection>,
): Promise<{ devDependencies: Record<string, string>; scripts: Record<string, string> }> {
  const monorepoTemplate = await readMonorepoDependenciesTemplate();
  const devDependencies = { ...monorepoTemplate.devDependencies };
  const scripts = { ...monorepoTemplate.scripts };
  const seenVariants = new Set<string>();

  for (const pkg of packages) {
    const key = `${pkg.stack}/${pkg.variant}`;

    if (seenVariants.has(key)) {
      continue;
    }

    seenVariants.add(key);

    const variantTemplate = await readDependenciesTemplate(pkg.stack, pkg.variant);

    for (const [name, version] of Object.entries(variantTemplate.devDependencies)) {
      if (name in monorepoTemplate.devDependencies) {
        continue;
      }

      devDependencies[name] = version;
    }
  }

  return { devDependencies, scripts };
}

export async function updateMonorepoPackageJson(
  input: UpdateMonorepoPackageJsonInput,
): Promise<UpdatePackageForUpdateResult> {
  const {
    targetDirectory,
    packages,
    dryRun = false,
    includeScripts = true,
    respectHigherPatch = false,
    verbose = false,
  } = input;
  const packageJsonPath = path.join(targetDirectory, 'package.json');
  const existingPackageJson = JSON.parse(
    await readFile(packageJsonPath, 'utf8'),
  ) as PackageJsonShape;
  const templatePackageJson = await buildMonorepoTemplatePackageJson(packages);

  const existingDevDependencies = { ...(existingPackageJson.devDependencies ?? {}) };
  const existingScripts = { ...(existingPackageJson.scripts ?? {}) };
  const addedDependencies: string[] = [];
  const updatedDependencies: DepVersionChange[] = [];
  const addedScripts: string[] = [];
  const updatedScripts: string[] = [];

  for (const [dependencyName, dependencyVersion] of Object.entries(
    templatePackageJson.devDependencies,
  )) {
    if (!(dependencyName in existingDevDependencies)) {
      addedDependencies.push(dependencyName);
      existingDevDependencies[dependencyName] = dependencyVersion;

      if (verbose) {
        console.log(`+ ${dependencyName}: ${dependencyVersion}`);
      }

      continue;
    }

    const existingVersion = existingDevDependencies[dependencyName];
    const shouldReplace =
      existingVersion !== dependencyVersion &&
      (!respectHigherPatch || shouldUpdateVersion(existingVersion, dependencyVersion));

    if (shouldReplace) {
      updatedDependencies.push({
        name: dependencyName,
        oldVersion: existingVersion,
        newVersion: dependencyVersion,
      });
      existingDevDependencies[dependencyName] = dependencyVersion;

      if (verbose) {
        console.log(`↑ ${dependencyName}: ${existingVersion} → ${dependencyVersion}`);
      }
    }
  }

  if (includeScripts) {
    for (const [scriptName, scriptValue] of Object.entries(templatePackageJson.scripts)) {
      if (!(scriptName in existingScripts)) {
        addedScripts.push(scriptName);
        existingScripts[scriptName] = scriptValue;

        if (verbose) {
          console.log(`+ script ${scriptName}`);
        }

        continue;
      }

      if (existingScripts[scriptName] !== scriptValue) {
        updatedScripts.push(scriptName);
        existingScripts[scriptName] = scriptValue;

        if (verbose) {
          console.log(`↑ script ${scriptName}`);
        }
      }
    }
  }

  const nextPackageJson: PackageJsonShape = {
    ...existingPackageJson,
    devDependencies: sortRecord(existingDevDependencies),
    scripts: sortRecord(existingScripts),
  };

  if (!dryRun) {
    await writeFile(packageJsonPath, `${JSON.stringify(nextPackageJson, null, 2)}\n`, 'utf8');
  }

  return {
    addedDependencies,
    addedScripts,
    updatedDependencies,
    updatedScripts,
    wroteFile: !dryRun,
  };
}
