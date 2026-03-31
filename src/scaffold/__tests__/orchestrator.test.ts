import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import type { EnvironmentState, ActionPlan } from '../../types.js';

// Mock child_process.execSync for installer and husky init
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// Mock @inquirer/prompts for writer overwrite prompts
vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn().mockResolvedValue(true),
}));

const { scaffold } = await import('../orchestrator.js');

function createTempProject(pkgContent?: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'lint-sage-scaffold-'));
  mkdirSync(join(dir, '.git'), { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(pkgContent ?? { name: 'test-project', scripts: {} }, null, 2),
  );
  return dir;
}

function buildFreshExpressEnv(): EnvironmentState {
  return {
    node: { major: 22, minor: 0, patch: 0 },
    packageManager: { name: 'npm', version: '10.0.0' },
    framework: 'express',
    git: true,
    tools: new Map([
      ['eslint', { installed: false, version: null }],
      ['prettier', { installed: false, version: null }],
      ['husky', { installed: false, version: null }],
      ['lint-staged', { installed: false, version: null }],
      ['commitlint', { installed: false, version: null }],
    ]),
  };
}

function buildFreshExpressPlan(): ActionPlan {
  // Use the real templates directory
  const templatesDir = join(__dirname, '..', '..', '..', 'templates');
  return {
    depsToInstall: [
      { name: 'eslint', version: '^9' },
      { name: 'prettier', version: '^3' },
      { name: 'husky', version: '^9' },
      { name: 'lint-staged', version: '^15' },
      { name: '@commitlint/cli', version: '^19' },
      { name: '@commitlint/config-conventional', version: '^19' },
    ],
    configsToWrite: [
      {
        templatePath: join(templatesDir, 'eslint', 'node', 'express', 'eslint.config.mjs'),
        targetPath: 'eslint.config.mjs',
      },
      {
        templatePath: join(templatesDir, 'prettier', '.prettierrc'),
        targetPath: '.prettierrc',
      },
      {
        templatePath: join(templatesDir, 'prettier', '.prettierignore'),
        targetPath: '.prettierignore',
      },
      {
        templatePath: join(templatesDir, 'editorconfig', '.editorconfig'),
        targetPath: '.editorconfig',
      },
      {
        templatePath: join(templatesDir, 'husky', 'pre-commit'),
        targetPath: '.husky/pre-commit',
      },
      {
        templatePath: join(templatesDir, 'husky', 'commit-msg'),
        targetPath: '.husky/commit-msg',
      },
      {
        templatePath: join(templatesDir, 'commitlint', 'commitlint.config.mjs'),
        targetPath: 'commitlint.config.mjs',
      },
      {
        templatePath: join(templatesDir, 'vscode', 'settings.json'),
        targetPath: '.vscode/settings.json',
      },
      {
        templatePath: join(templatesDir, 'vscode', 'extensions.json'),
        targetPath: '.vscode/extensions.json',
      },
      {
        templatePath: join(templatesDir, 'github-actions', 'lint.yml'),
        targetPath: '.github/workflows/lint.yml',
      },
    ],
    scriptsToAdd: {
      lint: 'eslint .',
      'format:check': 'prettier --check .',
      prepare: 'husky',
    },
    existingFileOverwrites: [],
    filesToRemove: [],
  };
}

describe('scaffold orchestrator integration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(execSync).mockReset();
  });

  it('runs full scaffold pipeline for a fresh express project', async () => {
    const projectDir = createTempProject();
    const env = buildFreshExpressEnv();
    const plan = buildFreshExpressPlan();

    await scaffold(env, plan, projectDir);

    // Verify dependency install was called
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('npm install -D'),
      expect.objectContaining({ cwd: projectDir }),
    );

    // Verify package.json was patched with scripts
    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.scripts.lint).toBe('eslint .');
    expect(pkg.scripts['format:check']).toBe('prettier --check .');
    expect(pkg.scripts.prepare).toBe('husky');

    // Verify lint-staged config added
    expect(pkg['lint-staged']).toBeDefined();
    expect(pkg['lint-staged']['*.{ts,tsx,js,jsx}']).toEqual(['eslint --fix', 'prettier --write']);

    // Verify all config files were written
    expect(existsSync(join(projectDir, 'eslint.config.mjs'))).toBe(true);
    expect(existsSync(join(projectDir, '.prettierrc'))).toBe(true);
    expect(existsSync(join(projectDir, '.prettierignore'))).toBe(true);
    expect(existsSync(join(projectDir, '.editorconfig'))).toBe(true);
    expect(existsSync(join(projectDir, '.husky', 'pre-commit'))).toBe(true);
    expect(existsSync(join(projectDir, '.husky', 'commit-msg'))).toBe(true);
    expect(existsSync(join(projectDir, 'commitlint.config.mjs'))).toBe(true);
    expect(existsSync(join(projectDir, '.vscode', 'settings.json'))).toBe(true);
    expect(existsSync(join(projectDir, '.vscode', 'extensions.json'))).toBe(true);
    expect(existsSync(join(projectDir, '.github', 'workflows', 'lint.yml'))).toBe(true);

    // Verify Husky init was called
    expect(execSync).toHaveBeenCalledWith(
      'npx husky',
      expect.objectContaining({ cwd: projectDir }),
    );
  });

  it('skips dependency install when depsToInstall is empty', async () => {
    const projectDir = createTempProject();
    const env = buildFreshExpressEnv();
    const plan = buildFreshExpressPlan();
    plan.depsToInstall = [];

    await scaffold(env, plan, projectDir);

    // execSync should only be called for Husky init, not for npm install
    const calls = vi.mocked(execSync).mock.calls;
    const installCalls = calls.filter(([cmd]) =>
      typeof cmd === 'string' && cmd.includes('npm install'),
    );
    expect(installCalls).toHaveLength(0);
  });

  it('writes config files with correct template content', async () => {
    const projectDir = createTempProject();
    const env = buildFreshExpressEnv();
    const plan = buildFreshExpressPlan();

    await scaffold(env, plan, projectDir);

    // ESLint config should contain framework-specific content
    const eslintConfig = readFileSync(join(projectDir, 'eslint.config.mjs'), 'utf-8');
    expect(eslintConfig).toContain('eslint');

    // Prettier config should be valid JSON
    const prettierConfig = readFileSync(join(projectDir, '.prettierrc'), 'utf-8');
    expect(() => JSON.parse(prettierConfig)).not.toThrow();

    // Husky pre-commit should reference lint-staged
    const preCommit = readFileSync(join(projectDir, '.husky', 'pre-commit'), 'utf-8');
    expect(preCommit).toContain('lint-staged');

    // Commitlint config should reference conventional
    const commitlintConfig = readFileSync(join(projectDir, 'commitlint.config.mjs'), 'utf-8');
    expect(commitlintConfig).toContain('conventional');
  });

  it('preserves existing package.json scripts', async () => {
    const projectDir = createTempProject({
      name: 'test-project',
      scripts: { test: 'jest', lint: 'my-custom-lint' },
    });
    const env = buildFreshExpressEnv();
    const plan = buildFreshExpressPlan();

    await scaffold(env, plan, projectDir);

    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.scripts.test).toBe('jest');
    expect(pkg.scripts.lint).toBe('my-custom-lint'); // not overwritten
    expect(pkg.scripts['format:check']).toBe('prettier --check .'); // added
  });
});
