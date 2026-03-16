import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { listVariantTemplateFiles } from '../src/utils/template-loader.ts';
import { writeConfigs } from '../src/utils/write-configs.ts';

const requiredTemplateFiles = [
  '.commitlintrc.json',
  '.husky/commit-msg',
  '.husky/pre-commit',
  '.lintstagedrc.json',
  '.vscode/extensions.json',
  '.vscode/settings.json',
  'README.md',
  'dependencies.json',
  'eslint.config.js',
  'prettier.config.js',
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('template directories', () => {
  it.each([
    ['react', 'vite-react-ts'],
    ['react', '@tanstack/react-start'],
    ['react', 'next-js'],
    ['node', 'express'],
    ['node', 'fastify'],
    ['node', 'nestjs'],
    ['node', 'plain-ts'],
    ['angular', 'angular-standalone'],
    ['angular', 'angular-ssr'],
  ] as const)('contains the full template set for %s/%s', async (stack, variant) => {
    const templateFiles = await listVariantTemplateFiles(stack, variant);

    expect(templateFiles).toEqual(expect.arrayContaining(requiredTemplateFiles));
  });
});

describe('writeConfigs', () => {
  it('writes all config files and returns tracked relative paths', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-write-'));

    const result = await writeConfigs({
      targetDirectory,
      stack: 'react',
      variant: 'next-js',
      verbose: true,
    });

    expect(result.writtenFiles).toEqual(
      expect.arrayContaining([
        '.commitlintrc.json',
        '.github/workflows/lint.yml',
        '.husky/commit-msg',
        '.husky/pre-commit',
        '.lintstagedrc.json',
        '.vscode/extensions.json',
        '.vscode/settings.json',
        'eslint.config.js',
        'prettier.config.js',
      ]),
    );

    const eslintConfig = await readFile(path.join(targetDirectory, 'eslint.config.js'), 'utf8');
    expect(eslintConfig).toContain('@vcian/eslint-config-react');

    const commitMsgStats = await stat(path.join(targetDirectory, '.husky', 'commit-msg'));
    expect(commitMsgStats.mode & 0o777).toBe(0o755);
  });

  it('supports dry-run without writing files', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-dry-run-'));
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await writeConfigs({
      targetDirectory,
      stack: 'node',
      variant: 'plain-ts',
      dryRun: true,
    });

    expect(result.writtenFiles).toContain('.github/workflows/lint.yml');
    expect(consoleLogSpy).toHaveBeenCalledWith('[dry-run] Would create eslint.config.js');
    await expect(stat(path.join(targetDirectory, 'eslint.config.js'))).rejects.toThrow();
  });

  it.each([
    ['npm', 'npm ci', 'npm run lint'],
    ['pnpm', 'pnpm install --frozen-lockfile', 'pnpm lint'],
    ['yarn', 'yarn install --frozen-lockfile', 'yarn lint'],
  ] as const)(
    'renders the CI workflow for %s',
    async (packageManager, installCommand, lintCommand) => {
      const targetDirectory = await mkdtemp(
        path.join(os.tmpdir(), `lint-sage-ci-${packageManager}-`),
      );

      await writeConfigs({
        targetDirectory,
        stack: 'angular',
        variant: 'angular-standalone',
        packageManager,
      });

      const workflow = await readFile(
        path.join(targetDirectory, '.github', 'workflows', 'lint.yml'),
        'utf8',
      );

      expect(workflow).toContain(`cache: ${packageManager}`);
      expect(workflow).toContain(`run: ${installCommand}`);
      expect(workflow).toContain(`run: ${lintCommand}`);
      expect(workflow).toContain('run: ');
    },
  );
});
