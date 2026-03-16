import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'lint-sage-version-conflict-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function setupInitProject(packageJson: Record<string, unknown>): Promise<void> {
  await writeFile(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
}

describe('9.1 — Version conflict: init overwrites existing deps', () => {
  it('init overwrites an existing dep at a different version', async () => {
    await setupInitProject({
      name: 'test-project',
      devDependencies: {
        eslint: '^8.56.0',
      },
    });

    vi.resetModules();
    vi.doMock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn(),
    }));

    const originalCwd = process.cwd;
    process.cwd = () => tempDir;

    try {
      const { handleInit } = await import('../src/commands/init.js');
      const exitCode = await handleInit({ force: true, preset: 'plain-ts' });
      expect(exitCode).toBe(0);

      const pkgJson = JSON.parse(await readFile(path.join(tempDir, 'package.json'), 'utf8'));
      // init should have overwritten with tilde-pinned version
      expect(pkgJson.devDependencies.eslint).toMatch(/^~/);
      expect(pkgJson.devDependencies.eslint).not.toBe('^8.56.0');
    } finally {
      process.cwd = originalCwd;
    }
  });
});

describe('9.1 — Version conflict: update leaves higher patch alone', () => {
  it('update does not downgrade when project has higher patch in same tilde range', async () => {
    // First init the project
    await setupInitProject({ name: 'test-project' });

    vi.resetModules();
    vi.doMock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn(),
    }));

    const originalCwd = process.cwd;
    process.cwd = () => tempDir;

    try {
      const { handleInit } = await import('../src/commands/init.js');
      await handleInit({ force: true, preset: 'plain-ts' });

      // Now manually bump a dependency to a higher patch
      const pkgJsonPath = path.join(tempDir, 'package.json');
      const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'));
      const eslintVersion = pkgJson.devDependencies.eslint as string;
      // Change ~9.22.0 to ~9.22.9 (higher patch, same minor)
      const higherPatch = eslintVersion.replace(/\.\d+$/, '.9');
      pkgJson.devDependencies.eslint = higherPatch;
      await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

      // Reset modules to re-import with fresh mocks
      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleUpdate } = await import('../src/commands/update.js');
      await handleUpdate({ dryRun: true });

      // Verify eslint version was NOT downgraded (still higher patch)
      const afterPkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'));
      expect(afterPkgJson.devDependencies.eslint).toBe(higherPatch);
    } finally {
      process.cwd = originalCwd;
    }
  });
});

describe('9.1 — Version conflict: doctor reports version mismatches', () => {
  it('doctor warns about version mismatch', async () => {
    await setupInitProject({ name: 'test-project' });

    vi.resetModules();
    vi.doMock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn(),
    }));

    const originalCwd = process.cwd;
    process.cwd = () => tempDir;

    try {
      const { handleInit } = await import('../src/commands/init.js');
      await handleInit({ force: true, preset: 'plain-ts' });

      // Manually change a dep version to create a mismatch
      const pkgJsonPath = path.join(tempDir, 'package.json');
      const pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'));
      pkgJson.devDependencies.eslint = '~8.0.0';
      await writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleDoctor } = await import('../src/commands/doctor.js');
      const exitCode = await handleDoctor({});

      // doctor should report issues (exit code 1)
      expect(exitCode).toBe(1);
    } finally {
      process.cwd = originalCwd;
    }
  });

  it('doctor --fix corrects version mismatches', async () => {
    await setupInitProject({ name: 'test-project' });

    vi.resetModules();
    vi.doMock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn(),
    }));

    const originalCwd = process.cwd;
    process.cwd = () => tempDir;

    try {
      const { handleInit } = await import('../src/commands/init.js');
      await handleInit({ force: true, preset: 'plain-ts' });

      // Save original versions for comparison
      const pkgJsonPath = path.join(tempDir, 'package.json');
      const originalPkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'));
      const originalEslint = originalPkgJson.devDependencies.eslint;

      // Create a mismatch
      originalPkgJson.devDependencies.eslint = '~8.0.0';
      await writeFile(pkgJsonPath, JSON.stringify(originalPkgJson, null, 2));

      vi.resetModules();
      vi.doMock('@inquirer/prompts', () => ({
        confirm: vi.fn().mockResolvedValue(true),
        select: vi.fn(),
      }));

      const { handleDoctor } = await import('../src/commands/doctor.js');
      await handleDoctor({ fix: true });

      // Verify version was corrected
      const fixedPkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'));
      expect(fixedPkgJson.devDependencies.eslint).toBe(originalEslint);
    } finally {
      process.cwd = originalCwd;
    }
  });
});
