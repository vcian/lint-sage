import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ToolName, ToolInfo, PackageJson } from '../types.js';

const TOOL_PACKAGES: Record<ToolName, string> = {
  eslint: 'eslint',
  prettier: 'prettier',
  husky: 'husky',
  'lint-staged': 'lint-staged',
  commitlint: '@commitlint/cli',
};

export function detectExistingTools(
  projectDir: string,
): Map<ToolName, ToolInfo> {
  const tools = new Map<ToolName, ToolInfo>();
  let pkg: PackageJson;

  try {
    pkg = JSON.parse(
      readFileSync(join(projectDir, 'package.json'), 'utf-8'),
    );
  } catch {
    // If no package.json, nothing is installed
    for (const toolName of Object.keys(TOOL_PACKAGES) as ToolName[]) {
      tools.set(toolName, { installed: false, version: null });
    }
    return tools;
  }

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  for (const [toolName, packageName] of Object.entries(TOOL_PACKAGES) as [
    ToolName,
    string,
  ][]) {
    if (allDeps[packageName]) {
      // Try to get installed version from node_modules
      const installedVersion = getInstalledVersion(projectDir, packageName);
      tools.set(toolName, {
        installed: true,
        version: installedVersion,
      });
    } else {
      tools.set(toolName, { installed: false, version: null });
    }
  }

  return tools;
}

function getInstalledVersion(
  projectDir: string,
  packageName: string,
): string | null {
  const pkgJsonPath = join(
    projectDir,
    'node_modules',
    packageName,
    'package.json',
  );

  if (!existsSync(pkgJsonPath)) {
    return null;
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

export function getEslintMajorVersion(
  tools: Map<ToolName, ToolInfo>,
): number | null {
  const eslint = tools.get('eslint');
  if (!eslint?.installed || !eslint.version) return null;

  const match = eslint.version.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
