import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { PackageManager } from '../types.js';

type DetectionResult = {
  packageManager: PackageManager;
  source: 'cli' | 'packageManager' | 'lockfile' | 'workspace' | 'default';
};

const lockfilesByPackageManager: Record<PackageManager, string> = {
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizePackageManagerField(value: string): PackageManager | null {
  if (value.startsWith('pnpm@')) {
    return 'pnpm';
  }

  if (value.startsWith('yarn@')) {
    return 'yarn';
  }

  if (value.startsWith('npm@')) {
    return 'npm';
  }

  return null;
}

async function detectPackageManagerFromManifest(
  targetDirectory: string,
): Promise<PackageManager | null> {
  const packageJsonPath = path.join(targetDirectory, 'package.json');

  if (!(await fileExists(packageJsonPath))) {
    return null;
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    packageManager?: string;
  };

  if (!packageJson.packageManager) {
    return null;
  }

  return normalizePackageManagerField(packageJson.packageManager);
}

async function detectPackageManagerFromLockfile(
  targetDirectory: string,
): Promise<PackageManager | null> {
  for (const packageManager of ['pnpm', 'yarn', 'npm'] as const) {
    if (await fileExists(path.join(targetDirectory, lockfilesByPackageManager[packageManager]))) {
      return packageManager;
    }
  }

  return null;
}

async function detectPackageManagerFromWorkspace(
  targetDirectory: string,
): Promise<PackageManager | null> {
  if (await fileExists(path.join(targetDirectory, 'pnpm-workspace.yaml'))) {
    return 'pnpm';
  }

  return null;
}

export async function detectPackageManager(
  targetDirectory: string,
  override?: PackageManager,
): Promise<DetectionResult> {
  if (override) {
    return {
      packageManager: override,
      source: 'cli',
    };
  }

  const packageManagerFromManifest = await detectPackageManagerFromManifest(targetDirectory);
  const packageManagerFromLockfile = await detectPackageManagerFromLockfile(targetDirectory);
  const packageManagerFromWorkspace = await detectPackageManagerFromWorkspace(targetDirectory);

  if (
    packageManagerFromManifest &&
    packageManagerFromLockfile &&
    packageManagerFromManifest !== packageManagerFromLockfile
  ) {
    throw new Error(
      `Package manager mismatch: package.json declares "${packageManagerFromManifest}" but the lockfile indicates "${packageManagerFromLockfile}". Resolve the mismatch or pass --package-manager explicitly.`,
    );
  }

  if (packageManagerFromManifest) {
    return {
      packageManager: packageManagerFromManifest,
      source: 'packageManager',
    };
  }

  if (packageManagerFromLockfile) {
    return {
      packageManager: packageManagerFromLockfile,
      source: 'lockfile',
    };
  }

  if (packageManagerFromWorkspace) {
    return {
      packageManager: packageManagerFromWorkspace,
      source: 'workspace',
    };
  }

  return {
    packageManager: 'npm',
    source: 'default',
  };
}
