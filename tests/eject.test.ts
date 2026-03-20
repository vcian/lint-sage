import { access, mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleInit } from '../src/commands/init.ts';
import type { LintSageState } from '../src/types.ts';

async function withWorkingDirectory<T>(directory: string, callback: () => Promise<T>): Promise<T> {
  const previousDirectory = process.cwd();
  process.chdir(directory);

  try {
    return await callback();
  } finally {
    process.chdir(previousDirectory);
  }
}

function silenceConsole() {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  return {
    get stdout() {
      return logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    },
    get stderr() {
      return errorSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    },
    restore() {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    },
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function initProject(targetDir: string, preset = 'plain-ts'): Promise<void> {
  await writeFile(
    path.join(targetDir, 'package.json'),
    `${JSON.stringify({ name: 'sample-app', private: true }, null, 2)}\n`,
    'utf8',
  );

  await withWorkingDirectory(targetDir, () => handleInit({ preset }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleEject', () => {
  it('replaces config files with inlined versions', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-inline-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);
      consoleSilencer.restore();

      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleEject } = await import('../src/commands/eject.ts');
      const consoleSilencer2 = silenceConsole();

      const exitCode = await withWorkingDirectory(targetDir, () => handleEject({ force: true }));

      expect(exitCode).toBe(0);

      // eslint.config.js should still exist and contain inlined rules
      expect(await pathExists(path.join(targetDir, 'eslint.config.js'))).toBe(true);
      const eslintConfig = await readFile(path.join(targetDir, 'eslint.config.js'), 'utf8');
      expect(eslintConfig).not.toContain('@vcian/eslint-config-node');
      expect(eslintConfig).toContain('@typescript-eslint/no-unused-vars');
      expect(eslintConfig).toContain('module.exports');
      expect(eslintConfig).toContain('// Add your project-specific rule overrides here');

      // prettier.config.js should still exist and be fully inlined
      expect(await pathExists(path.join(targetDir, 'prettier.config.js'))).toBe(true);
      const prettierConfig = await readFile(path.join(targetDir, 'prettier.config.js'), 'utf8');
      expect(prettierConfig).not.toContain('@vcian/prettier-config');
      expect(prettierConfig).toContain('printWidth');
      expect(prettierConfig).toContain('singleQuote');

      // .commitlintrc.json should still exist and extend @commitlint/config-conventional
      expect(await pathExists(path.join(targetDir, '.commitlintrc.json'))).toBe(true);
      const commitlintConfig = await readFile(
        path.join(targetDir, '.commitlintrc.json'),
        'utf8',
      );
      expect(commitlintConfig).toContain('@commitlint/config-conventional');
      expect(commitlintConfig).not.toContain('@vcian/commitlint-config');

      // .lint-sage.json should be gone
      expect(await pathExists(path.join(targetDir, '.lint-sage.json'))).toBe(false);

      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('removes only @vcian/ dependencies, keeps others', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-deps-'));
    const consoleSilencer = silenceConsole();

    try {
      await writeFile(
        path.join(targetDir, 'package.json'),
        `${JSON.stringify(
          {
            name: 'sample-app',
            private: true,
            devDependencies: {
              eslint: '~9.22.0',
              typescript: '^5.8.0',
            },
            scripts: {
              test: 'vitest',
              lint: 'old lint command',
            },
          },
          null,
          2,
        )}\n`,
        'utf8',
      );

      await withWorkingDirectory(targetDir, () => handleInit({ preset: 'plain-ts', force: true }));
      consoleSilencer.restore();

      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleEject } = await import('../src/commands/eject.ts');
      const consoleSilencer2 = silenceConsole();

      const exitCode = await withWorkingDirectory(targetDir, () => handleEject({ force: true }));

      expect(exitCode).toBe(0);

      const packageJson = JSON.parse(
        await readFile(path.join(targetDir, 'package.json'), 'utf8'),
      ) as {
        devDependencies: Record<string, string>;
        scripts: Record<string, string>;
      };

      // @vcian/* deps should be gone
      for (const dep of Object.keys(packageJson.devDependencies)) {
        expect(dep.startsWith('@vcian/')).toBe(false);
      }

      // Non-@vcian deps should be preserved (eslint, prettier, plugins, etc.)
      expect(packageJson.devDependencies.eslint).toBeDefined();
      expect(packageJson.devDependencies.typescript).toBe('^5.8.0');

      // Scripts should be kept
      expect(packageJson.scripts.test).toBe('vitest');
      expect(packageJson.scripts.lint).toBeDefined();

      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('keeps scripts unchanged', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-scripts-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);

      const state = JSON.parse(
        await readFile(path.join(targetDir, '.lint-sage.json'), 'utf8'),
      ) as LintSageState;

      consoleSilencer.restore();

      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleEject } = await import('../src/commands/eject.ts');
      const consoleSilencer2 = silenceConsole();

      await withWorkingDirectory(targetDir, () => handleEject({ force: true }));

      const packageJson = JSON.parse(
        await readFile(path.join(targetDir, 'package.json'), 'utf8'),
      ) as {
        scripts: Record<string, string>;
      };

      // All added scripts should still be present
      for (const script of state.addedScripts) {
        expect(packageJson.scripts[script]).toBeDefined();
      }

      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('keeps non-ejectable files unchanged', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-keep-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);
      consoleSilencer.restore();

      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleEject } = await import('../src/commands/eject.ts');
      const consoleSilencer2 = silenceConsole();

      await withWorkingDirectory(targetDir, () => handleEject({ force: true }));

      // Non-ejectable files should still exist
      expect(await pathExists(path.join(targetDir, '.husky', 'pre-commit'))).toBe(true);
      expect(await pathExists(path.join(targetDir, '.husky', 'commit-msg'))).toBe(true);
      expect(await pathExists(path.join(targetDir, '.vscode', 'settings.json'))).toBe(true);

      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('deletes .lint-sage.json', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-state-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);
      consoleSilencer.restore();

      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleEject } = await import('../src/commands/eject.ts');
      const consoleSilencer2 = silenceConsole();

      await withWorkingDirectory(targetDir, () => handleEject({ force: true }));

      expect(await pathExists(path.join(targetDir, '.lint-sage.json'))).toBe(false);

      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('--dry-run shows plan without modifying', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-dry-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);
      consoleSilencer.restore();

      const { handleEject } = await import('../src/commands/eject.ts');
      const consoleSilencer2 = silenceConsole();

      const exitCode = await withWorkingDirectory(targetDir, () => handleEject({ dryRun: true }));

      expect(exitCode).toBe(0);

      const output = consoleSilencer2.stdout;
      expect(output).toContain('[dry-run]');
      expect(output).toContain('Would replace');
      expect(output).toContain('Would keep');
      expect(output).toContain('Would remove dependency');
      expect(output).toContain('Would delete .lint-sage.json');

      // Files should still exist unchanged
      expect(await pathExists(path.join(targetDir, '.lint-sage.json'))).toBe(true);
      expect(await pathExists(path.join(targetDir, 'eslint.config.js'))).toBe(true);

      // eslint.config.js should still reference @vcian (not yet inlined)
      const eslintConfig = await readFile(path.join(targetDir, 'eslint.config.js'), 'utf8');
      expect(eslintConfig).toContain('@vcian/eslint-config-node');

      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('--force skips confirmation', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-force-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);
      consoleSilencer.restore();

      vi.resetModules();

      const confirmMock = vi.fn().mockResolvedValue(true);
      vi.doMock('@inquirer/prompts', () => ({
        confirm: confirmMock,
        select: vi.fn(),
      }));

      const { handleEject } = await import('../src/commands/eject.ts');
      const consoleSilencer2 = silenceConsole();

      const exitCode = await withWorkingDirectory(targetDir, () => handleEject({ force: true }));

      expect(exitCode).toBe(0);
      expect(confirmMock).not.toHaveBeenCalled();

      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('monorepo eject replaces per-package eslint configs using correct stack', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-mono-'));
    const consoleSilencer = silenceConsole();

    try {
      const { mkdir } = await import('node:fs/promises');

      // Set up monorepo structure
      await writeFile(
        path.join(targetDir, 'turbo.json'),
        JSON.stringify({ $schema: 'https://turbo.build/schema.json', tasks: {} }, null, 2) + '\n',
        'utf8',
      );

      await writeFile(
        path.join(targetDir, 'package.json'),
        JSON.stringify(
          {
            name: 'test-monorepo',
            version: '1.0.0',
            private: true,
            workspaces: ['apps/*'],
          },
          null,
          2,
        ) + '\n',
        'utf8',
      );

      await mkdir(path.join(targetDir, 'apps', 'web'), { recursive: true });
      await writeFile(
        path.join(targetDir, 'apps', 'web', 'package.json'),
        JSON.stringify({ name: '@test/web', version: '1.0.0' }, null, 2) + '\n',
        'utf8',
      );

      await mkdir(path.join(targetDir, 'apps', 'api'), { recursive: true });
      await writeFile(
        path.join(targetDir, 'apps', 'api', 'package.json'),
        JSON.stringify({ name: '@test/api', version: '1.0.0' }, null, 2) + '\n',
        'utf8',
      );

      await withWorkingDirectory(targetDir, () =>
        handleInit({ force: true, preset: 'apps/web:next-js,apps/api:nestjs' }),
      );

      consoleSilencer.restore();

      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleEject } = await import('../src/commands/eject.ts');
      const consoleSilencer2 = silenceConsole();

      const exitCode = await withWorkingDirectory(targetDir, () => handleEject({ force: true }));

      expect(exitCode).toBe(0);

      // Web (react) should have react-hooks rules
      const webEslint = await readFile(
        path.join(targetDir, 'apps', 'web', 'eslint.config.js'),
        'utf8',
      );
      expect(webEslint).toContain('react-hooks');
      expect(webEslint).toContain('jsx-a11y');
      expect(webEslint).toContain('module.exports');

      // API (node) should have eslint-plugin-n rules
      const apiEslint = await readFile(
        path.join(targetDir, 'apps', 'api', 'eslint.config.js'),
        'utf8',
      );
      expect(apiEslint).toContain('eslint-plugin-n');
      expect(apiEslint).toContain('eslint-plugin-security');
      expect(apiEslint).toContain('module.exports');

      // Root prettier should be inlined
      const prettierConfig = await readFile(path.join(targetDir, 'prettier.config.js'), 'utf8');
      expect(prettierConfig).toContain('printWidth');
      expect(prettierConfig).not.toContain('@vcian/prettier-config');

      // .lint-sage.json should be gone
      expect(await pathExists(path.join(targetDir, '.lint-sage.json'))).toBe(false);

      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('warns when replacing a manually edited config file', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-modified-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);

      // Modify eslint.config.js after init
      const eslintPath = path.join(targetDir, 'eslint.config.js');
      const originalContent = await readFile(eslintPath, 'utf8');
      await writeFile(eslintPath, originalContent + '\n// my custom edit\n', 'utf8');

      consoleSilencer.restore();

      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleEject } = await import('../src/commands/eject.ts');
      const consoleSilencer2 = silenceConsole();

      const exitCode = await withWorkingDirectory(targetDir, () => handleEject({ force: true }));

      expect(exitCode).toBe(0);

      const output = consoleSilencer2.stdout;
      expect(output).toContain('has been modified since last init/update');

      // File should still be replaced with inlined version
      const finalContent = await readFile(eslintPath, 'utf8');
      expect(finalContent).not.toContain('// my custom edit');
      expect(finalContent).toContain('@typescript-eslint/no-unused-vars');
      expect(finalContent).toContain('module.exports');

      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('skips replacement when managed file is missing from disk', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-missing-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);

      // Delete eslint.config.js before eject
      await unlink(path.join(targetDir, 'eslint.config.js'));

      consoleSilencer.restore();

      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleEject } = await import('../src/commands/eject.ts');
      const consoleSilencer2 = silenceConsole();

      const exitCode = await withWorkingDirectory(targetDir, () => handleEject({ force: true }));

      expect(exitCode).toBe(0);

      const output = consoleSilencer2.stdout;
      expect(output).toContain('not found');
      expect(output).toContain('skipping replacement');

      // eslint.config.js should NOT be recreated
      expect(await pathExists(path.join(targetDir, 'eslint.config.js'))).toBe(false);

      // Other eject actions should still complete
      expect(await pathExists(path.join(targetDir, '.lint-sage.json'))).toBe(false);
      expect(await pathExists(path.join(targetDir, 'prettier.config.js'))).toBe(true);

      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });
});
