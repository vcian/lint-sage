import { describe, it, expect } from 'vitest';
import { resolveActionPlan } from '../compatibility.js';
import type { EnvironmentState, ToolName, ToolInfo } from '../../types.js';

function makeEnv(overrides: Partial<EnvironmentState> = {}): EnvironmentState {
  const defaultTools = new Map<ToolName, ToolInfo>([
    ['eslint', { installed: false, version: null }],
    ['prettier', { installed: false, version: null }],
    ['husky', { installed: false, version: null }],
    ['lint-staged', { installed: false, version: null }],
    ['commitlint', { installed: false, version: null }],
  ]);

  return {
    node: { major: 20, minor: 0, patch: 0 },
    packageManager: { name: 'npm', version: '10.0.0' },
    framework: 'express',
    tools: defaultTools,
    git: true,
    ...overrides,
  };
}

describe('resolveActionPlan', () => {
  it('installs all tools for a fresh project', () => {
    const plan = resolveActionPlan(makeEnv(), '/tmp/test-project');
    const depNames = plan.depsToInstall.map((d) => d.name);
    expect(depNames).toContain('eslint');
    expect(depNames).toContain('prettier');
    expect(depNames).toContain('husky');
    expect(depNames).toContain('lint-staged');
    expect(depNames).toContain('@commitlint/cli');
  });

  it('skips eslint install when already installed', () => {
    const tools = new Map<ToolName, ToolInfo>([
      ['eslint', { installed: true, version: '9.5.0' }],
      ['prettier', { installed: false, version: null }],
      ['husky', { installed: false, version: null }],
      ['lint-staged', { installed: false, version: null }],
      ['commitlint', { installed: false, version: null }],
    ]);
    const plan = resolveActionPlan(makeEnv({ tools }), '/tmp/test-project');
    const depNames = plan.depsToInstall.map((d) => d.name);
    expect(depNames).not.toContain('eslint');
    expect(depNames).toContain('prettier');
  });

  it('installs no core tools when all are installed', () => {
    const tools = new Map<ToolName, ToolInfo>([
      ['eslint', { installed: true, version: '9.5.0' }],
      ['prettier', { installed: true, version: '3.2.0' }],
      ['husky', { installed: true, version: '9.0.0' }],
      ['lint-staged', { installed: true, version: '15.0.0' }],
      ['commitlint', { installed: true, version: '19.0.0' }],
    ]);
    const plan = resolveActionPlan(makeEnv({ tools }), '/tmp/test-project');
    const coreTools = ['eslint', 'prettier', 'husky', 'lint-staged', '@commitlint/cli', '@commitlint/config-conventional'];
    const depNames = plan.depsToInstall.map((d) => d.name);
    for (const tool of coreTools) {
      expect(depNames).not.toContain(tool);
    }
  });

  it('adds lint, format:check, and prepare scripts', () => {
    const plan = resolveActionPlan(makeEnv(), '/tmp/test-project');
    expect(plan.scriptsToAdd['lint']).toBe('eslint .');
    expect(plan.scriptsToAdd['format:check']).toBe('prettier --check .');
    expect(plan.scriptsToAdd['prepare']).toBe('husky');
  });

  it('includes eslint config for express framework', () => {
    const plan = resolveActionPlan(makeEnv({ framework: 'express' }), '/tmp/test-project');
    const eslintConfig = plan.configsToWrite.find((c) =>
      c.targetPath.includes('eslint'),
    );
    expect(eslintConfig).toBeDefined();
    expect(eslintConfig!.targetPath).toBe('eslint.config.mjs');
  });

  it('uses legacy eslint config for ESLint 8', () => {
    const tools = new Map<ToolName, ToolInfo>([
      ['eslint', { installed: true, version: '8.57.0' }],
      ['prettier', { installed: false, version: null }],
      ['husky', { installed: false, version: null }],
      ['lint-staged', { installed: false, version: null }],
      ['commitlint', { installed: false, version: null }],
    ]);
    const plan = resolveActionPlan(makeEnv({ tools }), '/tmp/test-project');
    const eslintConfig = plan.configsToWrite.find((c) =>
      c.targetPath.includes('eslint'),
    );
    expect(eslintConfig).toBeDefined();
    expect(eslintConfig!.targetPath).toBe('.eslintrc.cjs');
  });

  it('includes eslint config for tanstack-react-start framework', () => {
    const plan = resolveActionPlan(makeEnv({ framework: 'tanstack-react-start' }), '/tmp/test-project');
    const eslintConfig = plan.configsToWrite.find((c) =>
      c.targetPath.includes('eslint'),
    );
    expect(eslintConfig).toBeDefined();
    expect(eslintConfig!.targetPath).toBe('eslint.config.mjs');
    const depNames = plan.depsToInstall.map((d) => d.name);
    expect(depNames).toContain('eslint-plugin-react');
    expect(depNames).toContain('eslint-plugin-react-hooks');
  });

  it('includes eslint config for fastify framework', () => {
    const plan = resolveActionPlan(makeEnv({ framework: 'fastify' }), '/tmp/test-project');
    const eslintConfig = plan.configsToWrite.find((c) =>
      c.targetPath.includes('eslint'),
    );
    expect(eslintConfig).toBeDefined();
    expect(eslintConfig!.targetPath).toBe('eslint.config.mjs');
    const depNames = plan.depsToInstall.map((d) => d.name);
    expect(depNames).toContain('typescript-eslint');
    expect(depNames).not.toContain('eslint-plugin-react');
  });

  it('includes eslint config for nestjs framework', () => {
    const plan = resolveActionPlan(makeEnv({ framework: 'nestjs' }), '/tmp/test-project');
    const eslintConfig = plan.configsToWrite.find((c) =>
      c.targetPath.includes('eslint'),
    );
    expect(eslintConfig).toBeDefined();
    expect(eslintConfig!.targetPath).toBe('eslint.config.mjs');
    const depNames = plan.depsToInstall.map((d) => d.name);
    expect(depNames).toContain('typescript-eslint');
  });

  it('includes eslint config for angular-ssr framework', () => {
    const plan = resolveActionPlan(makeEnv({ framework: 'angular-ssr' }), '/tmp/test-project');
    const eslintConfig = plan.configsToWrite.find((c) =>
      c.targetPath.includes('eslint'),
    );
    expect(eslintConfig).toBeDefined();
    expect(eslintConfig!.targetPath).toBe('eslint.config.mjs');
    const depNames = plan.depsToInstall.map((d) => d.name);
    expect(depNames).toContain('angular-eslint');
  });

  it('includes prettier, editorconfig, husky, commitlint, vscode, github-actions configs', () => {
    const plan = resolveActionPlan(makeEnv(), '/tmp/test-project');
    const targets = plan.configsToWrite.map((c) => c.targetPath);
    expect(targets).toContain('.prettierrc');
    expect(targets).toContain('.prettierignore');
    expect(targets).toContain('.editorconfig');
    expect(targets).toContain('.husky/pre-commit');
    expect(targets).toContain('.husky/commit-msg');
    expect(targets).toContain('commitlint.config.mjs');
    expect(targets).toContain('.vscode/settings.json');
    expect(targets).toContain('.vscode/extensions.json');
    expect(targets).toContain('.github/workflows/lint.yml');
  });
});
