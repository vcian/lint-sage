import { chmod, mkdtemp, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleInit } from '../src/commands/init.ts';
import { handleDoctor } from '../src/commands/doctor.ts';

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

describe('handleDoctor', () => {
  it('runs all 8 checks and prints a health report', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-doctor-healthy-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);
      consoleSilencer.restore();

      const consoleSilencer2 = silenceConsole();
      const exitCode = await withWorkingDirectory(targetDir, () => handleDoctor({}));

      // Some checks (node_modules, shared configs) will fail in temp dirs without npm install
      // but the report should still print all 8 checks
      expect(consoleSilencer2.stdout).toContain('State file');
      expect(consoleSilencer2.stdout).toContain('Config files');
      expect(consoleSilencer2.stdout).toContain('Dependency versions');
      expect(consoleSilencer2.stdout).toContain('Legacy configs');
      expect(consoleSilencer2.stdout).toContain('Husky hooks');
      expect(consoleSilencer2.stdout).toContain('Installed packages');
      expect(consoleSilencer2.stdout).toContain('Shared configs');
      expect(consoleSilencer2.stdout).toContain('CI workflow');
      expect(consoleSilencer2.stdout).toContain('Health:');
      // exit code 1 is expected because node_modules packages are not installed
      expect(exitCode).toBe(1);
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('detects a missing config file as fail', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-doctor-missing-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);

      // Delete a managed config file
      await unlink(path.join(targetDir, 'eslint.config.js'));

      consoleSilencer.restore();
      const consoleSilencer2 = silenceConsole();
      const exitCode = await withWorkingDirectory(targetDir, () => handleDoctor({}));

      expect(exitCode).toBe(1);
      expect(consoleSilencer2.stdout).toContain('eslint.config.js');
      expect(consoleSilencer2.stdout).toContain('Missing');
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('--fix recreates a missing config file', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-doctor-fix-missing-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);

      // Delete a managed config file
      await unlink(path.join(targetDir, 'eslint.config.js'));

      consoleSilencer.restore();
      const consoleSilencer2 = silenceConsole();
      const exitCode = await withWorkingDirectory(targetDir, () => handleDoctor({ fix: true }));

      expect(exitCode).toBe(0);
      expect(consoleSilencer2.stdout).toContain('re-generated eslint.config.js');

      // File should be recreated
      const eslintContent = await readFile(path.join(targetDir, 'eslint.config.js'), 'utf8');
      expect(eslintContent).toContain('@vcian/eslint-config-node');
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('detects version mismatch as warn', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-doctor-version-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);

      // Modify a dependency version
      const packageJsonPath = path.join(targetDir, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
        devDependencies: Record<string, string>;
        [key: string]: unknown;
      };
      packageJson.devDependencies.eslint = '~8.0.0';
      await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

      consoleSilencer.restore();
      const consoleSilencer2 = silenceConsole();
      const exitCode = await withWorkingDirectory(targetDir, () => handleDoctor({}));

      expect(exitCode).toBe(1);
      expect(consoleSilencer2.stdout).toContain('Version mismatch');
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('--fix corrects version mismatches', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-doctor-fix-version-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);

      // Change a version
      const packageJsonPath = path.join(targetDir, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
        devDependencies: Record<string, string>;
        [key: string]: unknown;
      };
      packageJson.devDependencies.eslint = '~8.0.0';
      await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

      consoleSilencer.restore();
      const consoleSilencer2 = silenceConsole();
      const exitCode = await withWorkingDirectory(targetDir, () => handleDoctor({ fix: true }));

      expect(exitCode).toBe(0);
      expect(consoleSilencer2.stdout).toContain('Fixed:');

      const fixed = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
        devDependencies: Record<string, string>;
        overrides?: Record<string, string>;
      };
      expect(fixed.devDependencies.eslint).toBe('~9.22.0');
      expect(fixed.overrides?.eslint).toBe('~9.22.0');

      // Should prompt to install
      expect(consoleSilencer2.stdout).toContain('install command');
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('--fix adds missing compatibility overrides', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-doctor-fix-overrides-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir, 'next-js');

      const packageJsonPath = path.join(targetDir, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
        overrides?: Record<string, string>;
        [key: string]: unknown;
      };
      delete packageJson.overrides;
      await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

      consoleSilencer.restore();
      const consoleSilencer2 = silenceConsole();
      const exitCode = await withWorkingDirectory(targetDir, () => handleDoctor({ fix: true }));

      expect(exitCode).toBe(0);
      expect(consoleSilencer2.stdout).toContain('added override');

      const fixed = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
        overrides?: Record<string, string>;
      };
      expect(fixed.overrides?.eslint).toBe('~9.22.0');
      expect(fixed.overrides?.['@typescript-eslint/parser']).toBe('~8.26.0');
      expect(fixed.overrides?.['@typescript-eslint/eslint-plugin']).toBe('~8.26.0');
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('detects missing husky hooks as fail and --fix recreates them', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-doctor-fix-hooks-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);
      await unlink(path.join(targetDir, '.husky', 'pre-commit'));

      consoleSilencer.restore();
      const consoleSilencer2 = silenceConsole();
      const exitCode = await withWorkingDirectory(targetDir, () => handleDoctor({ fix: true }));

      expect(exitCode).toBe(0);
      expect(consoleSilencer2.stdout).toContain('re-generated .husky');

      const stats = await stat(path.join(targetDir, '.husky', 'pre-commit'));
      expect(stats.isFile()).toBe(true);
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('--fix repairs non-executable husky hooks', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-doctor-fix-chmod-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);
      await chmod(path.join(targetDir, '.husky', 'pre-commit'), 0o644);

      consoleSilencer.restore();
      const consoleSilencer2 = silenceConsole();
      const exitCode = await withWorkingDirectory(targetDir, () => handleDoctor({ fix: true }));

      expect(exitCode).toBe(0);
      expect(consoleSilencer2.stdout).toContain('executable permissions');

      const stats = await stat(path.join(targetDir, '.husky', 'pre-commit'));
      expect(stats.isFile()).toBe(true);
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('detects legacy config files as warn', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-doctor-legacy-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);
      await writeFile(path.join(targetDir, '.eslintrc.js'), 'module.exports = {};', 'utf8');

      consoleSilencer.restore();
      const consoleSilencer2 = silenceConsole();
      const exitCode = await withWorkingDirectory(targetDir, () => handleDoctor({}));

      expect(exitCode).toBe(1);
      expect(consoleSilencer2.stdout).toContain('Legacy config files found');
      expect(consoleSilencer2.stdout).toContain('.eslintrc.js');
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });
});
