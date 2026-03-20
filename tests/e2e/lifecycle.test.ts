import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LintSageMonorepoState, LintSageState } from '../../src/types.ts';

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

let tempDir: string | undefined;

afterEach(async () => {
  vi.restoreAllMocks();
  vi.resetModules();

  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    tempDir = undefined;
  }
});

describe('E2E lifecycle', () => {
  it('single project full lifecycle: init -> doctor -> eject', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-e2e-lifecycle-'));

    await writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2) + '\n',
      'utf8',
    );

    const consoleSilencer = silenceConsole();

    try {
      // --- INIT ---
      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn().mockResolvedValue('next-js'),
      }));

      const { handleInit } = await import('../../src/commands/init.ts');

      const initExitCode = await withWorkingDirectory(tempDir, () =>
        handleInit({ force: true, preset: 'next-js' }),
      );

      expect(initExitCode).toBe(0);

      // Verify .lint-sage.json exists
      expect(await pathExists(path.join(tempDir, '.lint-sage.json'))).toBe(true);

      const state = JSON.parse(
        await readFile(path.join(tempDir, '.lint-sage.json'), 'utf8'),
      ) as LintSageState;

      expect(state.stack).toBe('react');
      expect(state.variant).toBe('next-js');

      // Verify config files exist
      expect(await pathExists(path.join(tempDir, 'eslint.config.js'))).toBe(true);
      expect(await pathExists(path.join(tempDir, 'prettier.config.js'))).toBe(true);
      expect(await pathExists(path.join(tempDir, '.husky', 'pre-commit'))).toBe(true);
      expect(await pathExists(path.join(tempDir, '.husky', 'commit-msg'))).toBe(true);
      expect(await pathExists(path.join(tempDir, '.commitlintrc.json'))).toBe(true);

      // --- DOCTOR (without --fix) ---
      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleDoctor } = await import('../../src/commands/doctor.ts');

      // Doctor may return non-zero due to missing node_modules — that is acceptable
      const doctorExitCode = await withWorkingDirectory(tempDir, () => handleDoctor({}));

      // We just verify it ran without throwing; exit code may be 0 or 1
      expect(typeof doctorExitCode).toBe('number');

      // --- EJECT ---
      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleEject } = await import('../../src/commands/eject.ts');

      const ejectExitCode = await withWorkingDirectory(tempDir, () => handleEject({ force: true }));

      expect(ejectExitCode).toBe(0);

      // Verify .lint-sage.json is gone
      expect(await pathExists(path.join(tempDir, '.lint-sage.json'))).toBe(false);

      // Config files should still exist with inlined content
      expect(await pathExists(path.join(tempDir, 'eslint.config.js'))).toBe(true);
      expect(await pathExists(path.join(tempDir, 'prettier.config.js'))).toBe(true);
      expect(await pathExists(path.join(tempDir, '.commitlintrc.json'))).toBe(true);

      // eslint.config.js should have inlined rules, not @vcian reference
      const eslintConfig = await readFile(path.join(tempDir, 'eslint.config.js'), 'utf8');
      expect(eslintConfig).toContain('module.exports');
      expect(eslintConfig).toContain('react-hooks');
      expect(eslintConfig).not.toContain('@vcian/eslint-config');

      // prettier.config.js should be fully inlined
      const prettierConfig = await readFile(path.join(tempDir, 'prettier.config.js'), 'utf8');
      expect(prettierConfig).toContain('printWidth');
      expect(prettierConfig).not.toContain('@vcian/prettier-config');

      // .commitlintrc.json should extend @commitlint/config-conventional
      const commitlintConfig = await readFile(path.join(tempDir, '.commitlintrc.json'), 'utf8');
      expect(commitlintConfig).toContain('@commitlint/config-conventional');
    } finally {
      consoleSilencer.restore();
    }
  });

  it('preset-based single project: init nestjs -> update dry-run -> eject', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-e2e-preset-'));

    await writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2) + '\n',
      'utf8',
    );

    const consoleSilencer = silenceConsole();

    try {
      // --- INIT with nestjs preset ---
      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleInit } = await import('../../src/commands/init.ts');

      const initExitCode = await withWorkingDirectory(tempDir, () =>
        handleInit({ force: true, preset: 'nestjs' }),
      );

      expect(initExitCode).toBe(0);

      // Verify eslint.config.js contains eslint-config-node
      const eslintConfig = await readFile(path.join(tempDir, 'eslint.config.js'), 'utf8');
      expect(eslintConfig).toContain('eslint-config-node');

      // --- UPDATE with --dry-run ---
      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleUpdate } = await import('../../src/commands/update.ts');

      const updateExitCode = await withWorkingDirectory(tempDir, () =>
        handleUpdate({ dryRun: true }),
      );

      expect(updateExitCode).toBe(0);

      // --- EJECT ---
      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleEject } = await import('../../src/commands/eject.ts');

      const ejectExitCode = await withWorkingDirectory(tempDir, () => handleEject({ force: true }));

      expect(ejectExitCode).toBe(0);

      // Verify clean state
      expect(await pathExists(path.join(tempDir, '.lint-sage.json'))).toBe(false);

      // Config files should still exist with inlined content
      expect(await pathExists(path.join(tempDir, 'eslint.config.js'))).toBe(true);
      expect(await pathExists(path.join(tempDir, 'prettier.config.js'))).toBe(true);
      expect(await pathExists(path.join(tempDir, '.commitlintrc.json'))).toBe(true);

      // eslint.config.js should have inlined node rules
      const ejectedEslint = await readFile(path.join(tempDir, 'eslint.config.js'), 'utf8');
      expect(ejectedEslint).toContain('eslint-plugin-n');
      expect(ejectedEslint).toContain('eslint-plugin-security');
      expect(ejectedEslint).not.toContain('@vcian/eslint-config-node');
    } finally {
      consoleSilencer.restore();
    }
  });

  it('monorepo lifecycle: init -> doctor -> update -> eject', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-e2e-monorepo-'));

    // Create turbo.json
    await writeFile(
      path.join(tempDir, 'turbo.json'),
      JSON.stringify({ $schema: 'https://turbo.build/schema.json', tasks: {} }, null, 2) + '\n',
      'utf8',
    );

    // Create root package.json with workspaces
    await writeFile(
      path.join(tempDir, 'package.json'),
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

    // Create apps/web/package.json
    await mkdir(path.join(tempDir, 'apps', 'web'), { recursive: true });
    await writeFile(
      path.join(tempDir, 'apps', 'web', 'package.json'),
      JSON.stringify({ name: '@test/web', version: '1.0.0' }, null, 2) + '\n',
      'utf8',
    );

    // Create apps/api/package.json
    await mkdir(path.join(tempDir, 'apps', 'api'), { recursive: true });
    await writeFile(
      path.join(tempDir, 'apps', 'api', 'package.json'),
      JSON.stringify({ name: '@test/api', version: '1.0.0' }, null, 2) + '\n',
      'utf8',
    );

    const consoleSilencer = silenceConsole();

    try {
      // --- INIT monorepo with preset ---
      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleInit } = await import('../../src/commands/init.ts');

      const initExitCode = await withWorkingDirectory(tempDir, () =>
        handleInit({ force: true, preset: 'apps/web:next-js,apps/api:nestjs' }),
      );

      expect(initExitCode).toBe(0);

      // Verify .lint-sage.json exists and has monorepo: true
      expect(await pathExists(path.join(tempDir, '.lint-sage.json'))).toBe(true);

      const state = JSON.parse(
        await readFile(path.join(tempDir, '.lint-sage.json'), 'utf8'),
      ) as LintSageMonorepoState;

      expect(state.monorepo).toBe(true);
      expect(state.packages['apps/web']).toBeDefined();
      expect(state.packages['apps/web'].variant).toBe('next-js');
      expect(state.packages['apps/api']).toBeDefined();
      expect(state.packages['apps/api'].variant).toBe('nestjs');

      // Verify root configs exist
      expect(await pathExists(path.join(tempDir, 'prettier.config.js'))).toBe(true);
      expect(await pathExists(path.join(tempDir, '.commitlintrc.json'))).toBe(true);

      // Verify per-package eslint.config.js exist
      expect(await pathExists(path.join(tempDir, 'apps', 'web', 'eslint.config.js'))).toBe(true);
      expect(await pathExists(path.join(tempDir, 'apps', 'api', 'eslint.config.js'))).toBe(true);

      // --- DOCTOR ---
      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleDoctor } = await import('../../src/commands/doctor.ts');

      const doctorExitCode = await withWorkingDirectory(tempDir, () => handleDoctor({}));

      expect(typeof doctorExitCode).toBe('number');

      // --- UPDATE ---
      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleUpdate } = await import('../../src/commands/update.ts');

      const updateExitCode = await withWorkingDirectory(tempDir, () =>
        handleUpdate({ dryRun: true }),
      );

      expect(updateExitCode).toBe(0);

      // --- EJECT ---
      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleEject } = await import('../../src/commands/eject.ts');

      const ejectExitCode = await withWorkingDirectory(tempDir, () => handleEject({ force: true }));

      expect(ejectExitCode).toBe(0);
      expect(await pathExists(path.join(tempDir, '.lint-sage.json'))).toBe(false);

      // Root prettier should still exist and be inlined
      expect(await pathExists(path.join(tempDir, 'prettier.config.js'))).toBe(true);
      const prettierConfig = await readFile(path.join(tempDir, 'prettier.config.js'), 'utf8');
      expect(prettierConfig).toContain('printWidth');
      expect(prettierConfig).not.toContain('@vcian/prettier-config');

      // Root .commitlintrc.json should still exist and extend @commitlint/config-conventional
      expect(await pathExists(path.join(tempDir, '.commitlintrc.json'))).toBe(true);
      const commitlintConfig = await readFile(path.join(tempDir, '.commitlintrc.json'), 'utf8');
      expect(commitlintConfig).toContain('@commitlint/config-conventional');

      // Per-package eslint.config.js files should still exist with stack-specific rules
      expect(await pathExists(path.join(tempDir, 'apps', 'web', 'eslint.config.js'))).toBe(true);
      const webEslint = await readFile(
        path.join(tempDir, 'apps', 'web', 'eslint.config.js'),
        'utf8',
      );
      expect(webEslint).toContain('react-hooks');

      expect(await pathExists(path.join(tempDir, 'apps', 'api', 'eslint.config.js'))).toBe(true);
      const apiEslint = await readFile(
        path.join(tempDir, 'apps', 'api', 'eslint.config.js'),
        'utf8',
      );
      expect(apiEslint).toContain('eslint-plugin-n');
    } finally {
      consoleSilencer.restore();
    }
  });
});
