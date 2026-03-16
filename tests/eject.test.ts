import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
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
  it('removes all managed files, cleans package.json, and deletes .lint-sage.json with --force', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-full-'));
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

      const exitCode = await withWorkingDirectory(targetDir, () => handleEject({ force: true }));

      expect(exitCode).toBe(0);

      // All managed files should be gone
      for (const filePath of Object.keys(state.managedFiles)) {
        expect(await pathExists(path.join(targetDir, filePath))).toBe(false);
      }

      // .lint-sage.json should be gone
      expect(await pathExists(path.join(targetDir, '.lint-sage.json'))).toBe(false);

      // package.json should be cleaned
      const packageJson = JSON.parse(
        await readFile(path.join(targetDir, 'package.json'), 'utf8'),
      ) as {
        devDependencies: Record<string, string>;
        scripts: Record<string, string>;
      };

      for (const dep of state.addedDependencies) {
        expect(packageJson.devDependencies[dep]).toBeUndefined();
      }

      for (const script of state.addedScripts) {
        expect(packageJson.scripts[script]).toBeUndefined();
      }

      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('preserves pre-existing dependencies during eject', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-preserve-'));
    const consoleSilencer = silenceConsole();

    try {
      // Create package.json with pre-existing deps
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

      // Init uses the real inquirer — silence and run
      await withWorkingDirectory(targetDir, () => handleInit({ preset: 'plain-ts', force: true }));
      consoleSilencer.restore();

      // Now eject with --force (no confirm needed)
      const consoleSilencer2 = silenceConsole();

      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleEject } = await import('../src/commands/eject.ts');

      const exitCode = await withWorkingDirectory(targetDir, () => handleEject({ force: true }));

      expect(exitCode).toBe(0);

      const packageJson = JSON.parse(
        await readFile(path.join(targetDir, 'package.json'), 'utf8'),
      ) as {
        devDependencies: Record<string, string>;
        scripts: Record<string, string>;
      };

      // Pre-existing deps should be preserved
      expect(packageJson.devDependencies.typescript).toBe('^5.8.0');
      // eslint was pre-existing (not in addedDependencies), so it should be preserved
      expect(packageJson.devDependencies.eslint).toBe('~9.22.0');
      // Pre-existing script should be preserved
      expect(packageJson.scripts.test).toBe('vitest');
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('--dry-run shows plan without deleting files', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-dry-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);
      consoleSilencer.restore();

      const { handleEject } = await import('../src/commands/eject.ts');
      const consoleSilencer2 = silenceConsole();

      const exitCode = await withWorkingDirectory(targetDir, () => handleEject({ dryRun: true }));

      expect(exitCode).toBe(0);
      expect(consoleSilencer2.stdout).toContain('[dry-run]');

      // Files should still exist
      expect(await pathExists(path.join(targetDir, '.lint-sage.json'))).toBe(true);
      expect(await pathExists(path.join(targetDir, 'eslint.config.js'))).toBe(true);
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('cleans up empty directories after eject', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-eject-dirs-'));
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

      // Empty directories should be removed
      expect(await pathExists(path.join(targetDir, '.husky'))).toBe(false);
      expect(await pathExists(path.join(targetDir, '.vscode'))).toBe(false);
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });
});
