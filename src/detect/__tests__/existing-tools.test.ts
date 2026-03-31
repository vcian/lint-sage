import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectExistingTools, getEslintMajorVersion } from '../existing-tools.js';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'lint-sage-test-'));
}

describe('detectExistingTools', () => {
  it('detects no tools when devDependencies is empty', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: {} }));
    const tools = detectExistingTools(dir);
    for (const [, info] of tools) {
      expect(info.installed).toBe(false);
    }
    rmSync(dir, { recursive: true });
  });

  it('detects eslint when in devDependencies', () => {
    const dir = makeTempDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { eslint: '^9.0.0' } }),
    );
    const tools = detectExistingTools(dir);
    expect(tools.get('eslint')?.installed).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it('detects all tools when all are present', () => {
    const dir = makeTempDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        devDependencies: {
          eslint: '^9',
          prettier: '^3',
          husky: '^9',
          'lint-staged': '^15',
          '@commitlint/cli': '^19',
        },
      }),
    );
    const tools = detectExistingTools(dir);
    expect(tools.get('eslint')?.installed).toBe(true);
    expect(tools.get('prettier')?.installed).toBe(true);
    expect(tools.get('husky')?.installed).toBe(true);
    expect(tools.get('lint-staged')?.installed).toBe(true);
    expect(tools.get('commitlint')?.installed).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it('reads installed version from node_modules', () => {
    const dir = makeTempDir();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { eslint: '^9' } }),
    );
    mkdirSync(join(dir, 'node_modules', 'eslint'), { recursive: true });
    writeFileSync(
      join(dir, 'node_modules', 'eslint', 'package.json'),
      JSON.stringify({ version: '9.5.0' }),
    );
    const tools = detectExistingTools(dir);
    expect(tools.get('eslint')?.version).toBe('9.5.0');
    rmSync(dir, { recursive: true });
  });
});

describe('getEslintMajorVersion', () => {
  it('returns major version number', () => {
    const tools = new Map([['eslint', { installed: true, version: '9.5.0' }]]) as Map<any, any>;
    expect(getEslintMajorVersion(tools)).toBe(9);
  });

  it('returns null when eslint not installed', () => {
    const tools = new Map([['eslint', { installed: false, version: null }]]) as Map<any, any>;
    expect(getEslintMajorVersion(tools)).toBeNull();
  });
});
