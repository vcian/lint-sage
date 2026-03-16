import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  DepVersionChange,
  UpdatePackageForUpdateResult,
  UpdatePackageInput,
  UpdatePackageResult,
} from '../types.js';
import { readDependenciesTemplate } from './template-loader.js';

type PackageJsonShape = {
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
};

function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function parseTildeVersion(
  version: string,
): { prefix: string; major: number; minor: number; patch: number } | null {
  const match = /^(~?)(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    return null;
  }

  return {
    prefix: match[1],
    major: Number(match[2]),
    minor: Number(match[3]),
    patch: Number(match[4]),
  };
}

export function shouldUpdateVersion(existingVersion: string, templateVersion: string): boolean {
  const existing = parseTildeVersion(existingVersion);
  const template = parseTildeVersion(templateVersion);

  if (!existing || !template) {
    return existingVersion !== templateVersion;
  }

  if (existing.major === template.major && existing.minor === template.minor) {
    return existing.patch < template.patch;
  }

  return true;
}

export async function updatePackage(input: UpdatePackageInput): Promise<UpdatePackageResult> {
  const { dryRun = false, stack, targetDirectory, variant, verbose = false } = input;
  const packageJsonPath = path.join(targetDirectory, 'package.json');
  const existingPackageJson = JSON.parse(
    await readFile(packageJsonPath, 'utf8'),
  ) as PackageJsonShape;
  const templatePackageJson = await readDependenciesTemplate(stack, variant);

  const existingDevDependencies = { ...(existingPackageJson.devDependencies ?? {}) };
  const existingScripts = { ...(existingPackageJson.scripts ?? {}) };
  const addedDependencies: string[] = [];
  const updatedDependencies: string[] = [];
  const addedScripts: string[] = [];
  const updatedScripts: string[] = [];

  for (const [dependencyName, dependencyVersion] of Object.entries(
    templatePackageJson.devDependencies,
  )) {
    if (!(dependencyName in existingDevDependencies)) {
      addedDependencies.push(dependencyName);
      existingDevDependencies[dependencyName] = dependencyVersion;

      if (verbose) {
        console.log(`Added devDependency ${dependencyName}@${dependencyVersion}`);
      }

      continue;
    }

    if (existingDevDependencies[dependencyName] !== dependencyVersion) {
      updatedDependencies.push(dependencyName);
      existingDevDependencies[dependencyName] = dependencyVersion;

      if (verbose) {
        console.log(`Updated devDependency ${dependencyName}: ${dependencyVersion}`);
      }
    }
  }

  for (const [scriptName, scriptValue] of Object.entries(templatePackageJson.scripts)) {
    if (!(scriptName in existingScripts)) {
      addedScripts.push(scriptName);
      existingScripts[scriptName] = scriptValue;

      if (verbose) {
        console.log(`Added script ${scriptName}`);
      }

      continue;
    }

    if (existingScripts[scriptName] !== scriptValue) {
      updatedScripts.push(scriptName);
      existingScripts[scriptName] = scriptValue;

      if (verbose) {
        console.log(`Updated script ${scriptName}`);
      }
    }
  }

  const nextPackageJson: PackageJsonShape = {
    ...existingPackageJson,
    devDependencies: sortRecord(existingDevDependencies),
    scripts: sortRecord(existingScripts),
  };

  if (!dryRun) {
    await writeFile(`${packageJsonPath}`, `${JSON.stringify(nextPackageJson, null, 2)}\n`, 'utf8');

    if (verbose) {
      console.log('Updated package.json');
    }
  }

  return {
    addedDependencies,
    addedScripts,
    updatedDependencies,
    updatedScripts,
    wroteFile: !dryRun,
  };
}

export async function updatePackageForUpdate(
  input: UpdatePackageInput,
): Promise<UpdatePackageForUpdateResult> {
  const { dryRun = false, stack, targetDirectory, variant, verbose = false } = input;
  const packageJsonPath = path.join(targetDirectory, 'package.json');
  const existingPackageJson = JSON.parse(
    await readFile(packageJsonPath, 'utf8'),
  ) as PackageJsonShape;
  const templatePackageJson = await readDependenciesTemplate(stack, variant);

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

    if (
      existingVersion !== dependencyVersion &&
      shouldUpdateVersion(existingVersion, dependencyVersion)
    ) {
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
