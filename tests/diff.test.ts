import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { LintSageState } from '../src/types.ts';
import { computeDiff } from '../src/utils/diff.ts';
import { hashContent } from '../src/utils/state.ts';

function makeState(overrides: Partial<LintSageState> = {}): LintSageState {
  return {
    schemaVersion: 1,
    version: '3.0.0',
    packageManager: 'npm',
    stack: 'node',
    variant: 'plain-ts',
    managedFiles: {},
    addedDependencies: [],
    addedScripts: [],
    initializedAt: '2025-01-01T00:00:00.000Z',
    lastUpdatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeDiff', () => {
  it('returns no-change when project file matches template and lastAppliedHash', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-diff-nochange-'));

    const { readTemplateFile } = await import('../src/utils/template-loader.ts');
    const templateContent = await readTemplateFile('node', 'plain-ts', 'eslint.config.js');
    const hash = hashContent(templateContent);

    await writeFile(path.join(targetDir, 'eslint.config.js'), templateContent, 'utf8');

    const state = makeState({
      managedFiles: {
        'eslint.config.js': {
          template: 'node/plain-ts/eslint.config.js',
          lastAppliedHash: hash,
        },
      },
    });

    const result = await computeDiff(targetDir, state);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].status).toBe('no-change');
  });

  it('returns auto-replace when project file matches lastAppliedHash but template changed', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-diff-replace-'));
    const oldContent = 'old template content';
    const oldHash = hashContent(oldContent);

    await writeFile(path.join(targetDir, 'eslint.config.js'), oldContent, 'utf8');

    const state = makeState({
      managedFiles: {
        'eslint.config.js': {
          template: 'node/plain-ts/eslint.config.js',
          lastAppliedHash: oldHash,
        },
      },
    });

    const result = await computeDiff(targetDir, state);

    // The real template content won't match oldHash, so template has "changed"
    expect(result.files).toHaveLength(1);
    expect(result.files[0].status).toBe('auto-replace');
  });

  it('returns keep when project file was locally modified but template unchanged', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-diff-keep-'));

    // We need the real template hash for this test. Let's use the actual template.
    const { readTemplateFile } = await import('../src/utils/template-loader.ts');
    const templateContent = await readTemplateFile('node', 'plain-ts', 'eslint.config.js');
    const templateHash = hashContent(templateContent);

    // Write a modified version to the project
    await writeFile(
      path.join(targetDir, 'eslint.config.js'),
      templateContent + '\n// custom rule',
      'utf8',
    );

    const state = makeState({
      managedFiles: {
        'eslint.config.js': {
          template: 'node/plain-ts/eslint.config.js',
          lastAppliedHash: templateHash,
        },
      },
    });

    const result = await computeDiff(targetDir, state);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].status).toBe('keep');
  });

  it('returns conflict when both project file and template changed', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-diff-conflict-'));
    const originalContent = 'original content from old template';
    const originalHash = hashContent(originalContent);

    // Write a modified version to the project (different from original)
    await writeFile(path.join(targetDir, 'eslint.config.js'), 'user modified content', 'utf8');

    const state = makeState({
      managedFiles: {
        'eslint.config.js': {
          template: 'node/plain-ts/eslint.config.js',
          lastAppliedHash: originalHash,
        },
      },
    });

    const result = await computeDiff(targetDir, state);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].status).toBe('conflict');
  });

  it('returns auto-replace when managed file is missing from disk', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-diff-missing-'));

    const state = makeState({
      managedFiles: {
        'eslint.config.js': {
          template: 'node/plain-ts/eslint.config.js',
          lastAppliedHash:
            'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        },
      },
    });

    const result = await computeDiff(targetDir, state);

    expect(result.files).toHaveLength(1);
    // currentHash is null (file missing) !== lastAppliedHash, and templateHash !== lastAppliedHash
    // Both changed → conflict... but spec says missing file = auto-replace candidate
    // Actually: currentHash(null) !== lastAppliedHash AND templateHash !== lastAppliedHash → conflict
    // Wait, let me re-read the spec: "If a managed file is missing from disk, it should be treated as eligible for auto-replace (re-create from template)"
    // So missing files should be auto-replace regardless.
    expect(result.files[0].status).toBe('auto-replace');
  });

  it('handles CI workflow file correctly', async () => {
    const targetDir = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-diff-ci-'));
    const ciDir = path.join(targetDir, '.github', 'workflows');
    await mkdir(ciDir, { recursive: true });

    const { renderCiWorkflow } = await import('../src/utils/template-loader.ts');
    const ciContent = await renderCiWorkflow('npm');
    const ciHash = hashContent(ciContent);

    await writeFile(path.join(ciDir, 'lint.yml'), ciContent, 'utf8');

    const state = makeState({
      managedFiles: {
        '.github/workflows/lint.yml': {
          template: 'ci/lint.yml.template',
          lastAppliedHash: ciHash,
        },
      },
    });

    const result = await computeDiff(targetDir, state);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].status).toBe('no-change');
  });
});
