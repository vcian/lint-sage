import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

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
    restore() {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

async function loadHandleInit() {
  const module = await import('../src/commands/init.ts');
  return module.handleInit;
}

describe('handleInit', () => {
  it.each([
    ['react', 'vite-react-ts', '@vcian/eslint-config-react'],
    ['react', '@tanstack/react-start', '@vcian/eslint-config-react'],
    ['react', 'next-js', '@vcian/eslint-config-react'],
    ['node', 'express', '@vcian/eslint-config-node'],
    ['node', 'fastify', '@vcian/eslint-config-node'],
    ['node', 'nestjs', '@vcian/eslint-config-node'],
    ['node', 'plain-ts', '@vcian/eslint-config-node'],
    ['angular', 'angular-standalone', '@vcian/eslint-config-angular'],
    ['angular', 'angular-ssr', '@vcian/eslint-config-angular'],
  ] as const)('initializes %s/%s with --preset', async (expectedStack, preset, eslintPackage) => {
    const handleInit = await loadHandleInit();
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-init-'));
    const consoleSilencer = silenceConsole();

    await writeFile(
      path.join(targetDirectory, 'package.json'),
      `${JSON.stringify({ name: 'sample-app', private: true }, null, 2)}\n`,
      'utf8',
    );

    try {
      const exitCode = await withWorkingDirectory(targetDirectory, () =>
        handleInit({
          preset,
        }),
      );

      const state = JSON.parse(
        await readFile(path.join(targetDirectory, '.lint-sage.json'), 'utf8'),
      ) as LintSageState;
      const eslintConfig = await readFile(path.join(targetDirectory, 'eslint.config.js'), 'utf8');
      const packageJson = JSON.parse(
        await readFile(path.join(targetDirectory, 'package.json'), 'utf8'),
      ) as {
        devDependencies: Record<string, string>;
        scripts: Record<string, string>;
      };
      const commitMsgStats = await stat(path.join(targetDirectory, '.husky', 'commit-msg'));

      expect(exitCode).toBe(0);
      expect(state.stack).toBe(expectedStack);
      expect(state.variant).toBe(preset);
      expect(state.packageManager).toBe('npm');
      expect(Object.keys(state.managedFiles)).toContain('.github/workflows/lint.yml');
      expect(packageJson.scripts['format:check']).toBe('prettier --check .');
      expect(eslintConfig).toContain(eslintPackage);
      expect(commitMsgStats.mode & 0o777).toBe(0o755);
    } finally {
      consoleSilencer.restore();
    }
  });

  it('supports --dry-run without writing files', async () => {
    const handleInit = await loadHandleInit();
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-init-dry-'));
    const consoleSilencer = silenceConsole();

    await writeFile(
      path.join(targetDirectory, 'package.json'),
      `${JSON.stringify({ name: 'sample-app' }, null, 2)}\n`,
      'utf8',
    );

    try {
      const exitCode = await withWorkingDirectory(targetDirectory, () =>
        handleInit({
          preset: 'next-js',
          dryRun: true,
        }),
      );

      expect(exitCode).toBe(0);
      await expect(stat(path.join(targetDirectory, '.lint-sage.json'))).rejects.toThrow();
      await expect(stat(path.join(targetDirectory, 'eslint.config.js'))).rejects.toThrow();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('overwrites existing config files when --force is provided', async () => {
    const handleInit = await loadHandleInit();
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-init-force-'));
    const consoleSilencer = silenceConsole();

    await writeFile(
      path.join(targetDirectory, 'package.json'),
      `${JSON.stringify({ name: 'sample-app' }, null, 2)}\n`,
      'utf8',
    );
    await writeFile(path.join(targetDirectory, 'eslint.config.js'), 'old content\n', 'utf8');

    try {
      const exitCode = await withWorkingDirectory(targetDirectory, () =>
        handleInit({
          preset: 'plain-ts',
          force: true,
        }),
      );

      const eslintConfig = await readFile(path.join(targetDirectory, 'eslint.config.js'), 'utf8');
      expect(exitCode).toBe(0);
      expect(eslintConfig).toContain('@vcian/eslint-config-node');
    } finally {
      consoleSilencer.restore();
    }
  });

  it('excludes pre-existing dependencies from addedDependencies', async () => {
    const handleInit = await loadHandleInit();
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-init-preexisting-'));
    const consoleSilencer = silenceConsole();

    await writeFile(
      path.join(targetDirectory, 'package.json'),
      `${JSON.stringify(
        {
          name: 'sample-app',
          devDependencies: {
            eslint: '~9.22.0',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    try {
      const exitCode = await withWorkingDirectory(targetDirectory, () =>
        handleInit({
          preset: 'next-js',
        }),
      );

      const state = JSON.parse(
        await readFile(path.join(targetDirectory, '.lint-sage.json'), 'utf8'),
      ) as LintSageState;

      expect(exitCode).toBe(0);
      expect(state.addedDependencies).not.toContain('eslint');
    } finally {
      consoleSilencer.restore();
    }
  });

  it('returns exit code 1 for an unknown preset', async () => {
    const handleInit = await loadHandleInit();
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-init-invalid-'));
    const consoleSilencer = silenceConsole();

    await writeFile(
      path.join(targetDirectory, 'package.json'),
      `${JSON.stringify({ name: 'sample-app' }, null, 2)}\n`,
      'utf8',
    );

    try {
      const exitCode = await withWorkingDirectory(targetDirectory, () =>
        handleInit({
          preset: 'foobar',
        }),
      );

      expect(exitCode).toBe(1);
    } finally {
      consoleSilencer.restore();
    }
  });

  it('auto-fixes known compatibility conflicts with --fix-compat', async () => {
    const handleInit = await loadHandleInit();
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-init-fix-compat-'));
    const consoleSilencer = silenceConsole();

    await writeFile(
      path.join(targetDirectory, 'package.json'),
      `${JSON.stringify(
        {
          name: 'sample-app',
          devDependencies: {
            eslint: '^10.1.0',
            'ts-jest': '^29.2.5',
            typescript: '^6.0.2',
            'typescript-eslint': '^8.20.0',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    try {
      const exitCode = await withWorkingDirectory(targetDirectory, () =>
        handleInit({
          preset: 'plain-ts',
          fixCompat: true,
        }),
      );

      const packageJson = JSON.parse(await readFile(path.join(targetDirectory, 'package.json'), 'utf8')) as {
        devDependencies: Record<string, string>;
      };

      expect(exitCode).toBe(0);
      expect(packageJson.devDependencies.typescript).toBe('~5.9.3');
      expect(packageJson.devDependencies.eslint).toBe('~9.22.0');
    } finally {
      consoleSilencer.restore();
    }
  });

  it('prints dry-run compatibility fix preview with --fix-compat', async () => {
    const handleInit = await loadHandleInit();
    const targetDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'lint-sage-init-fix-compat-dryrun-'),
    );
    const consoleSilencer = silenceConsole();

    await writeFile(
      path.join(targetDirectory, 'package.json'),
      `${JSON.stringify(
        {
          name: 'sample-app',
          devDependencies: {
            eslint: '^10.1.0',
            'ts-jest': '^29.2.5',
            typescript: '^6.0.2',
            'typescript-eslint': '^8.20.0',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    try {
      const beforePackageJson = await readFile(path.join(targetDirectory, 'package.json'), 'utf8');
      const exitCode = await withWorkingDirectory(targetDirectory, () =>
        handleInit({
          preset: 'plain-ts',
          fixCompat: true,
          dryRun: true,
        }),
      );
      const afterPackageJson = await readFile(path.join(targetDirectory, 'package.json'), 'utf8');

      expect(exitCode).toBe(0);
      expect(consoleSilencer.stdout).toContain('[dry-run] Would fix typescript: ^6.0.2 -> ~5.9.3');
      expect(consoleSilencer.stdout).toContain('[dry-run] Would fix eslint: ^10.1.0 -> ~9.22.0');
      expect(afterPackageJson).toBe(beforePackageJson);
    } finally {
      consoleSilencer.restore();
    }
  });

  it('allows local init with --skip-shared-check', async () => {
    const handleInit = await loadHandleInit();
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-init-skip-shared-'));
    const consoleSilencer = silenceConsole();

    await writeFile(
      path.join(targetDirectory, 'package.json'),
      `${JSON.stringify({ name: 'sample-app', private: true }, null, 2)}\n`,
      'utf8',
    );

    try {
      const exitCode = await withWorkingDirectory(targetDirectory, () =>
        handleInit({
          preset: 'plain-ts',
          skipSharedCheck: true,
        }),
      );

      expect(exitCode).toBe(0);
      await expect(stat(path.join(targetDirectory, '.lint-sage.json'))).resolves.toBeTruthy();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('cancels before overwriting existing package.json entries', async () => {
    const confirmPackageJsonOverwrite = vi.fn().mockResolvedValue(false);

    vi.doMock('../src/utils/init-flow.js', async () => {
      const actual = await vi.importActual<typeof import('../src/utils/init-flow.ts')>(
        '../src/utils/init-flow.ts',
      );

      return {
        ...actual,
        confirmPackageJsonOverwrite,
      };
    });

    const handleInit = await loadHandleInit();
    const targetDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'lint-sage-init-package-confirm-'),
    );
    const consoleSilencer = silenceConsole();
    const initialPackageJson = {
      name: 'sample-app',
      scripts: {
        lint: 'custom lint command',
      },
      devDependencies: {
        eslint: '^8.57.0',
      },
    };

    await writeFile(
      path.join(targetDirectory, 'package.json'),
      `${JSON.stringify(initialPackageJson, null, 2)}\n`,
      'utf8',
    );

    try {
      const exitCode = await withWorkingDirectory(targetDirectory, () =>
        handleInit({
          preset: 'next-js',
        }),
      );

      const packageJson = JSON.parse(
        await readFile(path.join(targetDirectory, 'package.json'), 'utf8'),
      );

      expect(exitCode).toBe(0);
      expect(confirmPackageJsonOverwrite).toHaveBeenCalledWith({
        updatedDependencies: ['eslint'],
        updatedScripts: ['lint'],
      });
      expect(packageJson).toEqual(initialPackageJson);
      await expect(stat(path.join(targetDirectory, '.lint-sage.json'))).rejects.toThrow();
    } finally {
      consoleSilencer.restore();
    }
  });
});
