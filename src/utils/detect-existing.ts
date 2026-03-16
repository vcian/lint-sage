import { access } from 'node:fs/promises';
import path from 'node:path';

import type { DetectedConfigFile } from '../types.js';

const managedConfigPaths = [
  'eslint.config.js',
  'prettier.config.js',
  '.commitlintrc.json',
  '.lintstagedrc.json',
  '.husky/pre-commit',
  '.husky/commit-msg',
  '.vscode/settings.json',
  '.vscode/extensions.json',
  '.github/workflows/lint.yml',
] as const;

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
  '.prettierrc.toml',
] as const;

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function detectExistingConfigs(
  targetDirectory: string,
): Promise<DetectedConfigFile[]> {
  const detected: DetectedConfigFile[] = [];

  for (const managedPath of managedConfigPaths) {
    if (await pathExists(path.join(targetDirectory, managedPath))) {
      detected.push({ path: managedPath, type: 'managed' });
    }
  }

  for (const legacyPath of legacyConfigPaths) {
    if (await pathExists(path.join(targetDirectory, legacyPath))) {
      detected.push({ path: legacyPath, type: 'legacy' });
    }
  }

  return detected.sort((left, right) => left.path.localeCompare(right.path));
}
