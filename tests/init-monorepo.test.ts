import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'lint-sage-monorepo-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function createTurborepoFixture(dir: string): Promise<void> {
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'monorepo-root',
      private: true,
      workspaces: ['apps/*', 'packages/*'],
    }),
  );
  await writeFile(path.join(dir, 'turbo.json'), JSON.stringify({ pipeline: { lint: {} } }));

  await mkdir(path.join(dir, 'apps', 'web'), { recursive: true });
  await writeFile(
    path.join(dir, 'apps', 'web', 'package.json'),
    JSON.stringify({ name: '@monorepo/web' }),
  );

  await mkdir(path.join(dir, 'apps', 'api'), { recursive: true });
  await writeFile(
    path.join(dir, 'apps', 'api', 'package.json'),
    JSON.stringify({ name: '@monorepo/api' }),
  );

  await mkdir(path.join(dir, 'packages', 'shared'), { recursive: true });
  await writeFile(
    path.join(dir, 'packages', 'shared', 'package.json'),
    JSON.stringify({ name: '@monorepo/shared' }),
  );
}

async function createNpmWorkspaceFixture(dir: string): Promise<void> {
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'npm-monorepo',
      private: true,
      workspaces: ['packages/*'],
    }),
  );

  await mkdir(path.join(dir, 'packages', 'lib'), { recursive: true });
  await writeFile(
    path.join(dir, 'packages', 'lib', 'package.json'),
    JSON.stringify({ name: '@mono/lib' }),
  );

  await mkdir(path.join(dir, 'packages', 'app'), { recursive: true });
  await writeFile(
    path.join(dir, 'packages', 'app', 'package.json'),
    JSON.stringify({ name: '@mono/app' }),
  );
}

async function createPnpmWorkspaceFixture(dir: string): Promise<void> {
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'pnpm-monorepo', private: true }),
  );
  await writeFile(path.join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n  - libs/*\n');

  await mkdir(path.join(dir, 'apps', 'frontend'), { recursive: true });
  await writeFile(
    path.join(dir, 'apps', 'frontend', 'package.json'),
    JSON.stringify({ name: '@pnpm/frontend' }),
  );

  await mkdir(path.join(dir, 'apps', 'backend'), { recursive: true });
  await writeFile(
    path.join(dir, 'apps', 'backend', 'package.json'),
    JSON.stringify({ name: '@pnpm/backend' }),
  );

  await mkdir(path.join(dir, 'libs', 'utils'), { recursive: true });
  await writeFile(
    path.join(dir, 'libs', 'utils', 'package.json'),
    JSON.stringify({ name: '@pnpm/utils' }),
  );
}

describe('monorepo init — Turborepo with preset', () => {
  it('creates root configs and per-package ESLint configs', async () => {
    await createTurborepoFixture(tempDir);

    vi.resetModules();
    vi.doMock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn().mockResolvedValue('turborepo'),
    }));

    const originalCwd = process.cwd;
    process.cwd = () => tempDir;

    try {
      const { handleInit } = await import('../src/commands/init.js');
      const exitCode = await handleInit({
        force: true,
        preset: 'apps/web:next-js,apps/api:nestjs,packages/shared:plain-ts',
      });

      expect(exitCode).toBe(0);

      // Root configs exist
      const rootFiles = [
        'prettier.config.js',
        '.commitlintrc.json',
        '.lintstagedrc.json',
        '.husky/pre-commit',
        '.husky/commit-msg',
        '.vscode/settings.json',
        '.vscode/extensions.json',
        '.github/workflows/lint.yml',
      ];

      for (const file of rootFiles) {
        const content = await readFile(path.join(tempDir, file), 'utf8');
        expect(content.length).toBeGreaterThan(0);
      }

      // Per-package ESLint configs
      const webEslint = await readFile(path.join(tempDir, 'apps/web/eslint.config.js'), 'utf8');
      expect(webEslint).toContain('eslint-config-react');

      const apiEslint = await readFile(path.join(tempDir, 'apps/api/eslint.config.js'), 'utf8');
      expect(apiEslint).toContain('eslint-config-node');

      const sharedEslint = await readFile(
        path.join(tempDir, 'packages/shared/eslint.config.js'),
        'utf8',
      );
      expect(sharedEslint).toContain('eslint-config-node');

      // No root eslint.config.js in mixed-stack monorepo
      await expect(readFile(path.join(tempDir, 'eslint.config.js'), 'utf8')).rejects.toThrow();

      // State file
      const stateRaw = await readFile(path.join(tempDir, '.lint-sage.json'), 'utf8');
      const state = JSON.parse(stateRaw);

      expect(state.monorepo).toBe(true);
      expect(state.monorepoTool).toBe('turborepo');
      expect(state.schemaVersion).toBe(1);
      expect(state.packages['apps/web'].stack).toBe('react');
      expect(state.packages['apps/web'].variant).toBe('next-js');
      expect(state.packages['apps/api'].stack).toBe('node');
      expect(state.packages['apps/api'].variant).toBe('nestjs');
      expect(state.packages['packages/shared'].stack).toBe('node');
      expect(state.packages['packages/shared'].variant).toBe('plain-ts');
      expect(Object.keys(state.managedFiles)).toContain('.github/workflows/lint.yml');
      expect(state.addedDependencies.length).toBeGreaterThan(0);

      // CI workflow uses turbo lint
      const ciWorkflow = await readFile(path.join(tempDir, '.github/workflows/lint.yml'), 'utf8');
      expect(ciWorkflow).toContain('turbo lint');

      // Root package.json updated with deps
      const pkgJson = JSON.parse(await readFile(path.join(tempDir, 'package.json'), 'utf8'));
      expect(pkgJson.devDependencies).toBeDefined();
      expect(pkgJson.devDependencies.prettier).toBeDefined();
      expect(pkgJson.devDependencies.eslint).toBeDefined();
      expect(pkgJson.scripts.lint).toBeDefined();
    } finally {
      process.cwd = originalCwd;
    }
  });
});

describe('monorepo init — npm workspaces with --monorepo flag', () => {
  it('works with --monorepo flag and single-stack preset', async () => {
    await createNpmWorkspaceFixture(tempDir);

    vi.resetModules();
    vi.doMock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn().mockResolvedValue('npm-workspaces'),
    }));

    const originalCwd = process.cwd;
    process.cwd = () => tempDir;

    try {
      const { handleInit } = await import('../src/commands/init.js');
      const exitCode = await handleInit({
        monorepo: true,
        force: true,
        preset: 'packages/lib:plain-ts,packages/app:plain-ts',
      });

      expect(exitCode).toBe(0);

      // State file has correct tool
      const state = JSON.parse(await readFile(path.join(tempDir, '.lint-sage.json'), 'utf8'));
      expect(state.monorepo).toBe(true);
      expect(state.monorepoTool).toBe('npm-workspaces');
      expect(Object.keys(state.packages)).toHaveLength(2);

      // Per-package configs
      const libEslint = await readFile(path.join(tempDir, 'packages/lib/eslint.config.js'), 'utf8');
      expect(libEslint).toContain('eslint-config-node');

      // CI workflow uses npm run lint (not turbo/nx)
      const ciWorkflow = await readFile(path.join(tempDir, '.github/workflows/lint.yml'), 'utf8');
      expect(ciWorkflow).toContain('npm run lint');
      expect(ciWorkflow).toContain('npm ci');
    } finally {
      process.cwd = originalCwd;
    }
  });

  it('cancels before overwriting root package.json entries', async () => {
    await createNpmWorkspaceFixture(tempDir);

    await writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(
        {
          name: 'npm-monorepo',
          private: true,
          workspaces: ['packages/*'],
          scripts: {
            lint: 'custom lint command',
          },
          devDependencies: {
            eslint: '^8.57.0',
          },
        },
        null,
        2,
      ),
    );

    const confirmPackageJsonOverwrite = vi.fn().mockResolvedValue(false);

    vi.resetModules();
    vi.doMock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn().mockResolvedValue('npm-workspaces'),
    }));
    vi.doMock('../src/utils/init-flow.js', async () => {
      const actual = await vi.importActual<typeof import('../src/utils/init-flow.ts')>(
        '../src/utils/init-flow.ts',
      );

      return {
        ...actual,
        confirmPackageJsonOverwrite,
      };
    });

    const originalCwd = process.cwd;
    process.cwd = () => tempDir;

    try {
      const { handleInit } = await import('../src/commands/init.js');
      const exitCode = await handleInit({
        monorepo: true,
        preset: 'packages/lib:plain-ts,packages/app:plain-ts',
      });

      expect(exitCode).toBe(0);
      expect(confirmPackageJsonOverwrite).toHaveBeenCalledWith({
        updatedDependencies: ['eslint'],
        updatedScripts: ['lint'],
      });

      const packageJson = JSON.parse(await readFile(path.join(tempDir, 'package.json'), 'utf8'));
      expect(packageJson.scripts.lint).toBe('custom lint command');
      await expect(readFile(path.join(tempDir, '.lint-sage.json'), 'utf8')).rejects.toThrow();
    } finally {
      process.cwd = originalCwd;
    }
  });
});

describe('monorepo init — pnpm workspaces', () => {
  it('detects pnpm-workspace.yaml and configures packages', async () => {
    await createPnpmWorkspaceFixture(tempDir);

    vi.resetModules();
    vi.doMock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn().mockResolvedValue('pnpm-workspaces'),
    }));

    const originalCwd = process.cwd;
    process.cwd = () => tempDir;

    try {
      const { handleInit } = await import('../src/commands/init.js');
      const exitCode = await handleInit({
        force: true,
        packageManager: 'pnpm',
        preset: 'apps/frontend:vite-react-ts,apps/backend:express,libs/utils:plain-ts',
      });

      expect(exitCode).toBe(0);

      const state = JSON.parse(await readFile(path.join(tempDir, '.lint-sage.json'), 'utf8'));
      expect(state.monorepo).toBe(true);
      expect(state.monorepoTool).toBe('pnpm-workspaces');
      expect(state.packageManager).toBe('pnpm');
      expect(Object.keys(state.packages)).toHaveLength(3);
      expect(state.packages['apps/frontend'].stack).toBe('react');
      expect(state.packages['apps/backend'].stack).toBe('node');

      // CI uses pnpm
      const ciWorkflow = await readFile(path.join(tempDir, '.github/workflows/lint.yml'), 'utf8');
      expect(ciWorkflow).toContain('pnpm');
      expect(ciWorkflow).toContain('pnpm install --frozen-lockfile');
    } finally {
      process.cwd = originalCwd;
    }
  });
});

describe('monorepo init — preset validation', () => {
  it('errors when preset path does not match a discovered package', async () => {
    await createTurborepoFixture(tempDir);

    vi.resetModules();
    vi.doMock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn().mockResolvedValue('turborepo'),
    }));

    const originalCwd = process.cwd;
    process.cwd = () => tempDir;

    try {
      const { handleInit } = await import('../src/commands/init.js');
      const exitCode = await handleInit({
        force: true,
        preset: 'apps/web:next-js,apps/nonexistent:nestjs,packages/shared:plain-ts',
      });

      expect(exitCode).toBe(1);
    } finally {
      process.cwd = originalCwd;
    }
  });

  it('errors when a discovered package is missing from preset', async () => {
    await createTurborepoFixture(tempDir);

    vi.resetModules();
    vi.doMock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn().mockResolvedValue('turborepo'),
    }));

    const originalCwd = process.cwd;
    process.cwd = () => tempDir;

    try {
      const { handleInit } = await import('../src/commands/init.js');
      // Missing packages/shared
      const exitCode = await handleInit({
        force: true,
        preset: 'apps/web:next-js,apps/api:nestjs',
      });

      expect(exitCode).toBe(1);
    } finally {
      process.cwd = originalCwd;
    }
  });

  it('errors with unknown variant in preset', async () => {
    await createTurborepoFixture(tempDir);

    vi.resetModules();
    vi.doMock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn().mockResolvedValue('turborepo'),
    }));

    const originalCwd = process.cwd;
    process.cwd = () => tempDir;

    try {
      const { handleInit } = await import('../src/commands/init.js');
      const exitCode = await handleInit({
        force: true,
        preset: 'apps/web:unknown-variant,apps/api:nestjs,packages/shared:plain-ts',
      });

      expect(exitCode).toBe(1);
    } finally {
      process.cwd = originalCwd;
    }
  });
});

describe('monorepo init — dry run', () => {
  it('does not write files in dry-run mode', async () => {
    await createNpmWorkspaceFixture(tempDir);

    vi.resetModules();
    vi.doMock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn().mockResolvedValue('npm-workspaces'),
    }));

    const originalCwd = process.cwd;
    process.cwd = () => tempDir;

    try {
      const { handleInit } = await import('../src/commands/init.js');
      const exitCode = await handleInit({
        monorepo: true,
        force: true,
        dryRun: true,
        preset: 'packages/lib:plain-ts,packages/app:express',
      });

      expect(exitCode).toBe(0);

      // No configs should be written
      await expect(readFile(path.join(tempDir, '.lint-sage.json'), 'utf8')).rejects.toThrow();
      await expect(readFile(path.join(tempDir, 'prettier.config.js'), 'utf8')).rejects.toThrow();
      await expect(
        readFile(path.join(tempDir, 'packages/lib/eslint.config.js'), 'utf8'),
      ).rejects.toThrow();
    } finally {
      process.cwd = originalCwd;
    }
  });
});

describe('monorepo init — no workspace packages', () => {
  it('errors when --monorepo is forced but no workspace config exists', async () => {
    await writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'single-project' }));

    vi.resetModules();
    vi.doMock('@inquirer/prompts', () => ({
      confirm: vi.fn().mockResolvedValue(true),
      select: vi.fn(),
    }));

    const originalCwd = process.cwd;
    process.cwd = () => tempDir;

    try {
      const { handleInit } = await import('../src/commands/init.js');
      const exitCode = await handleInit({ monorepo: true, force: true });

      expect(exitCode).toBe(1);
    } finally {
      process.cwd = originalCwd;
    }
  });
});
