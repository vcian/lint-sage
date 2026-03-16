import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleInit } from '../src/commands/init.ts';
import { handleUpdate } from '../src/commands/update.ts';
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

describe('handleUpdate', () => {
  it('reports no changes when run immediately after init', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-update-nochange-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);
      consoleSilencer.restore();

      const consoleSilencer2 = silenceConsole();

      const exitCode = await withWorkingDirectory(targetDir, () => handleUpdate({ dryRun: true }));

      expect(exitCode).toBe(0);
      expect(consoleSilencer2.stdout).toContain('Everything is up to date');
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('keeps locally modified files when template is unchanged', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-update-keep-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);

      // Locally modify a config file
      const eslintPath = path.join(targetDir, 'eslint.config.js');
      const original = await readFile(eslintPath, 'utf8');
      await writeFile(eslintPath, `${original}\n// my custom override`, 'utf8');

      consoleSilencer.restore();
      const consoleSilencer2 = silenceConsole();

      const exitCode = await withWorkingDirectory(targetDir, () => handleUpdate({ dryRun: true }));

      expect(exitCode).toBe(0);
      expect(consoleSilencer2.stdout).toContain(
        'locally modified, template unchanged — keeping yours',
      );

      // Verify file was not changed
      const afterContent = await readFile(eslintPath, 'utf8');
      expect(afterContent).toContain('// my custom override');
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('returns exit code 1 when .lint-sage.json is missing', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-update-missing-'));
    await writeFile(
      path.join(targetDir, 'package.json'),
      `${JSON.stringify({ name: 'sample-app' }, null, 2)}\n`,
      'utf8',
    );

    const consoleSilencer = silenceConsole();

    try {
      const exitCode = await withWorkingDirectory(targetDir, () => handleUpdate({}));

      expect(exitCode).toBe(1);
      expect(consoleSilencer.stderr).toContain('.lint-sage.json not found');
    } finally {
      consoleSilencer.restore();
    }
  });

  it('returns exit code 1 when .lint-sage.json is corrupted', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-update-corrupt-'));
    await writeFile(path.join(targetDir, '.lint-sage.json'), 'not valid json{{{', 'utf8');

    const consoleSilencer = silenceConsole();

    try {
      const exitCode = await withWorkingDirectory(targetDir, () => handleUpdate({}));

      expect(exitCode).toBe(1);
      expect(consoleSilencer.stderr).toContain('invalid JSON');
    } finally {
      consoleSilencer.restore();
    }
  });

  it('dry-run does not modify any files', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-update-dryrun-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);

      // Tamper with state to simulate a template change
      const statePath = path.join(targetDir, '.lint-sage.json');
      const state = JSON.parse(await readFile(statePath, 'utf8')) as LintSageState;
      const firstFile = Object.keys(state.managedFiles)[0];
      state.managedFiles[firstFile].lastAppliedHash =
        'sha256:0000000000000000000000000000000000000000000000000000000000000000';
      await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

      const eslintBefore = await readFile(path.join(targetDir, 'eslint.config.js'), 'utf8');
      const stateBefore = await readFile(statePath, 'utf8');

      consoleSilencer.restore();
      const consoleSilencer2 = silenceConsole();

      const exitCode = await withWorkingDirectory(targetDir, () => handleUpdate({ dryRun: true }));

      expect(exitCode).toBe(0);

      // Files should be unchanged
      const eslintAfter = await readFile(path.join(targetDir, 'eslint.config.js'), 'utf8');
      const stateAfter = await readFile(statePath, 'utf8');
      expect(eslintAfter).toBe(eslintBefore);
      expect(stateAfter).toBe(stateBefore);
      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('creates .lint-sage.new file on conflict', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-update-conflict-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);

      // Modify both the local file and fake a template change by tampering with lastAppliedHash
      const statePath = path.join(targetDir, '.lint-sage.json');
      const state = JSON.parse(await readFile(statePath, 'utf8')) as LintSageState;
      state.managedFiles['eslint.config.js'].lastAppliedHash =
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

      // Also modify the local file so it doesn't match lastAppliedHash
      await writeFile(path.join(targetDir, 'eslint.config.js'), 'user modified content', 'utf8');

      consoleSilencer.restore();

      // Mock confirm by mocking the entire module before importing update handler
      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleUpdate: mockedHandleUpdate } = await import('../src/commands/update.ts');

      const consoleSilencer2 = silenceConsole();

      const exitCode = await withWorkingDirectory(targetDir, () => mockedHandleUpdate({}));

      expect(exitCode).toBe(0);

      // Original file should be preserved
      const originalContent = await readFile(path.join(targetDir, 'eslint.config.js'), 'utf8');
      expect(originalContent).toBe('user modified content');

      // .lint-sage.new file should exist
      const newFileExists = await stat(path.join(targetDir, 'eslint.config.js.lint-sage.new'))
        .then(() => true)
        .catch(() => false);
      expect(newFileExists).toBe(true);

      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });

  it('auto-replaces files when template changed and no local edits', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-update-autoreplace-'));
    const consoleSilencer = silenceConsole();

    try {
      await initProject(targetDir);

      const statePath = path.join(targetDir, '.lint-sage.json');
      const state = JSON.parse(await readFile(statePath, 'utf8')) as LintSageState;

      const { hashContent } = await import('../src/utils/state.ts');
      const fakeOldContent = 'fake old template content';
      const fakeOldHash = hashContent(fakeOldContent);

      // Set the project file to the "old template" and update the hash to match
      await writeFile(path.join(targetDir, 'eslint.config.js'), fakeOldContent, 'utf8');
      state.managedFiles['eslint.config.js'].lastAppliedHash = fakeOldHash;
      await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

      consoleSilencer.restore();

      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleUpdate: mockedHandleUpdate } = await import('../src/commands/update.ts');

      const consoleSilencer2 = silenceConsole();

      const exitCode = await withWorkingDirectory(targetDir, () => mockedHandleUpdate({}));

      expect(exitCode).toBe(0);

      // File should be replaced with new template content (not the fake old content)
      const eslintContent = await readFile(path.join(targetDir, 'eslint.config.js'), 'utf8');
      expect(eslintContent).not.toBe(fakeOldContent);
      expect(eslintContent).toContain('@vcian/eslint-config-node');

      // State should be updated with new hash
      const updatedState = JSON.parse(await readFile(statePath, 'utf8')) as LintSageState;
      expect(updatedState.managedFiles['eslint.config.js'].lastAppliedHash).not.toBe(fakeOldHash);
      expect(updatedState.lastUpdatedAt).not.toBe(state.lastUpdatedAt);

      consoleSilencer2.restore();
    } finally {
      consoleSilencer.restore();
    }
  });
});
