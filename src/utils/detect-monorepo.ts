import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { glob } from 'glob';
import { parse as parseYaml } from 'yaml';

import type { MonorepoDetectionResult, MonorepoTool, PackageManager } from '../types.js';

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function detectMonorepoTools(
  targetDirectory: string,
  packageManager: PackageManager,
): Promise<MonorepoDetectionResult[]> {
  const results: MonorepoDetectionResult[] = [];

  if (await pathExists(path.join(targetDirectory, 'turbo.json'))) {
    results.push({ tool: 'turborepo', indicator: 'turbo.json' });
  }

  if (await pathExists(path.join(targetDirectory, 'nx.json'))) {
    results.push({ tool: 'nx', indicator: 'nx.json' });
  }

  if (await pathExists(path.join(targetDirectory, 'lerna.json'))) {
    results.push({ tool: 'lerna', indicator: 'lerna.json' });
  }

  if (await pathExists(path.join(targetDirectory, 'pnpm-workspace.yaml'))) {
    results.push({ tool: 'pnpm-workspaces', indicator: 'pnpm-workspace.yaml' });
  }

  const packageJsonPath = path.join(targetDirectory, 'package.json');

  if (await pathExists(packageJsonPath)) {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      workspaces?: string[] | { packages: string[] };
    };

    if (packageJson.workspaces) {
      const tool: MonorepoTool = packageManager === 'yarn' ? 'yarn-workspaces' : 'npm-workspaces';
      results.push({ tool, indicator: 'package.json workspaces' });
    }
  }

  return results;
}

async function readWorkspaceGlobs(targetDirectory: string): Promise<string[]> {
  const packageJsonPath = path.join(targetDirectory, 'package.json');
  const pnpmWorkspacePath = path.join(targetDirectory, 'pnpm-workspace.yaml');
  const lernaJsonPath = path.join(targetDirectory, 'lerna.json');

  if (await pathExists(pnpmWorkspacePath)) {
    const content = await readFile(pnpmWorkspacePath, 'utf8');
    const parsed = parseYaml(content) as { packages?: string[] };
    return parsed.packages ?? [];
  }

  if (await pathExists(lernaJsonPath)) {
    const content = await readFile(lernaJsonPath, 'utf8');
    const parsed = JSON.parse(content) as { packages?: string[] };
    return parsed.packages ?? ['packages/*'];
  }

  if (await pathExists(packageJsonPath)) {
    const content = await readFile(packageJsonPath, 'utf8');
    const parsed = JSON.parse(content) as {
      workspaces?: string[] | { packages: string[] };
    };

    if (Array.isArray(parsed.workspaces)) {
      return parsed.workspaces;
    }

    if (parsed.workspaces && Array.isArray(parsed.workspaces.packages)) {
      return parsed.workspaces.packages;
    }
  }

  return [];
}

export async function discoverWorkspacePackages(targetDirectory: string): Promise<string[]> {
  const globs = await readWorkspaceGlobs(targetDirectory);

  if (globs.length === 0) {
    return [];
  }

  const matchedDirs: string[] = [];

  for (const pattern of globs) {
    const matches = await glob(pattern, {
      cwd: targetDirectory,
      absolute: false,
    });

    for (const match of matches) {
      const packageJsonPath = path.join(targetDirectory, match, 'package.json');

      if (await pathExists(packageJsonPath)) {
        matchedDirs.push(match);
      }
    }
  }

  // Also check if glob patterns point directly to dirs with package.json
  // when glob doesn't expand (e.g., "apps/web" literal path)
  for (const pattern of globs) {
    if (!pattern.includes('*') && !matchedDirs.includes(pattern)) {
      const packageJsonPath = path.join(targetDirectory, pattern, 'package.json');

      if (await pathExists(packageJsonPath)) {
        matchedDirs.push(pattern);
      }
    }
  }

  return [...new Set(matchedDirs)].sort();
}

export function getMonorepoToolDisplayName(tool: MonorepoTool): string {
  const names: Record<MonorepoTool, string> = {
    turborepo: 'Turborepo',
    nx: 'Nx',
    'npm-workspaces': 'npm workspaces',
    'yarn-workspaces': 'Yarn workspaces',
    'pnpm-workspaces': 'pnpm workspaces',
    lerna: 'Lerna',
  };

  return names[tool];
}

export function getMonorepoLintCommand(tool: MonorepoTool, packageManager: PackageManager): string {
  if (tool === 'turborepo') {
    return 'turbo lint';
  }

  if (tool === 'nx') {
    return 'nx run-many --target=lint';
  }

  const prefix = packageManager === 'npm' ? 'npm run' : packageManager;
  return `${prefix} lint`;
}
