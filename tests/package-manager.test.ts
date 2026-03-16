import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectPackageManager } from '../src/utils/package-manager.ts';

describe('detectPackageManager', () => {
  it('prefers the CLI override', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-pm-override-'));

    const result = await detectPackageManager(targetDirectory, 'pnpm');

    expect(result).toEqual({
      packageManager: 'pnpm',
      source: 'cli',
    });
  });

  it('detects the package manager from package.json', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-pm-manifest-'));

    await writeFile(
      path.join(targetDirectory, 'package.json'),
      `${JSON.stringify({ name: 'app', packageManager: 'yarn@4.6.0' }, null, 2)}\n`,
      'utf8',
    );

    const result = await detectPackageManager(targetDirectory);

    expect(result).toEqual({
      packageManager: 'yarn',
      source: 'packageManager',
    });
  });

  it('detects the package manager from a lockfile', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-pm-lockfile-'));

    await writeFile(
      path.join(targetDirectory, 'pnpm-lock.yaml'),
      "lockfileVersion: '9.0'\n",
      'utf8',
    );

    const result = await detectPackageManager(targetDirectory);

    expect(result).toEqual({
      packageManager: 'pnpm',
      source: 'lockfile',
    });
  });

  it('fails on a package manager mismatch', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-pm-mismatch-'));

    await writeFile(
      path.join(targetDirectory, 'package.json'),
      `${JSON.stringify({ name: 'app', packageManager: 'pnpm@9.0.0' }, null, 2)}\n`,
      'utf8',
    );
    await writeFile(path.join(targetDirectory, 'yarn.lock'), '', 'utf8');

    await expect(detectPackageManager(targetDirectory)).rejects.toThrow(
      'Package manager mismatch: package.json declares "pnpm" but the lockfile indicates "yarn".',
    );
  });

  // ── 9.2 — Lockfile-only detection ──────────────────────────────────────

  it('detects pnpm from pnpm-lock.yaml alone', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-pm-lockfile-pnpm-'));

    await writeFile(
      path.join(targetDirectory, 'pnpm-lock.yaml'),
      "lockfileVersion: '9.0'\n",
      'utf8',
    );

    const result = await detectPackageManager(targetDirectory);

    expect(result).toEqual({
      packageManager: 'pnpm',
      source: 'lockfile',
    });
  });

  it('detects yarn from yarn.lock alone', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-pm-lockfile-yarn-'));

    await writeFile(path.join(targetDirectory, 'yarn.lock'), '', 'utf8');

    const result = await detectPackageManager(targetDirectory);

    expect(result).toEqual({
      packageManager: 'yarn',
      source: 'lockfile',
    });
  });

  it('detects npm from package-lock.json alone', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-pm-lockfile-npm-'));

    await writeFile(path.join(targetDirectory, 'package-lock.json'), '{}', 'utf8');

    const result = await detectPackageManager(targetDirectory);

    expect(result).toEqual({
      packageManager: 'npm',
      source: 'lockfile',
    });
  });

  it('uses priority order when multiple lockfiles exist (pnpm > yarn > npm)', async () => {
    const targetDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'lint-sage-pm-lockfile-priority-'),
    );

    await writeFile(
      path.join(targetDirectory, 'pnpm-lock.yaml'),
      "lockfileVersion: '9.0'\n",
      'utf8',
    );
    await writeFile(path.join(targetDirectory, 'package-lock.json'), '{}', 'utf8');

    const result = await detectPackageManager(targetDirectory);

    expect(result).toEqual({
      packageManager: 'pnpm',
      source: 'lockfile',
    });
  });

  it('defaults to npm when no lockfile and no packageManager field', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-pm-default-'));

    const result = await detectPackageManager(targetDirectory);

    expect(result).toEqual({
      packageManager: 'npm',
      source: 'default',
    });
  });

  it('detects pnpm from pnpm-workspace.yaml before falling back to npm', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-pm-workspace-'));

    await writeFile(
      path.join(targetDirectory, 'pnpm-workspace.yaml'),
      'packages:\n  - apps/*\n',
      'utf8',
    );

    const result = await detectPackageManager(targetDirectory);

    expect(result).toEqual({
      packageManager: 'pnpm',
      source: 'workspace',
    });
  });

  // ── 9.3 — Root-only lockfile in monorepos ─────────────────────────────

  it('ignores nested lockfiles and detects root lockfile only', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-pm-monorepo-'));

    // Root lockfile → pnpm
    await writeFile(
      path.join(targetDirectory, 'pnpm-lock.yaml'),
      "lockfileVersion: '9.0'\n",
      'utf8',
    );

    // Nested lockfile that should NOT influence root detection
    const nestedDir = path.join(targetDirectory, 'apps', 'web');
    await mkdir(nestedDir, { recursive: true });
    await writeFile(path.join(nestedDir, 'package-lock.json'), '{}', 'utf8');

    const result = await detectPackageManager(targetDirectory);

    expect(result).toEqual({
      packageManager: 'pnpm',
      source: 'lockfile',
    });
  });
});
