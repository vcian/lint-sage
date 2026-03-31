import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { patchPackageJson } = await import('../patch-package.js');

function createTempProject(pkgContent: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'lint-sage-test-'));
  writeFileSync(join(dir, 'package.json'), pkgContent);
  return dir;
}

function readPkg(dir: string) {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
}

describe('patchPackageJson', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('adds all scripts when scripts object is empty', () => {
    const dir = createTempProject(JSON.stringify({ name: 'test', scripts: {} }, null, 2));
    patchPackageJson(dir, { lint: 'eslint .', 'format:check': 'prettier --check .', prepare: 'husky' }, 'express');
    const pkg = readPkg(dir);
    expect(pkg.scripts.lint).toBe('eslint .');
    expect(pkg.scripts['format:check']).toBe('prettier --check .');
    expect(pkg.scripts.prepare).toBe('husky');
  });

  it('adds scripts when scripts key is missing entirely', () => {
    const dir = createTempProject(JSON.stringify({ name: 'test' }, null, 2));
    patchPackageJson(dir, { lint: 'eslint .', prepare: 'husky' }, 'express');
    const pkg = readPkg(dir);
    expect(pkg.scripts.lint).toBe('eslint .');
    expect(pkg.scripts.prepare).toBe('husky');
  });

  it('does not overwrite existing scripts', () => {
    const dir = createTempProject(JSON.stringify({
      name: 'test',
      scripts: { lint: 'my-custom-lint', test: 'jest' },
    }, null, 2));
    patchPackageJson(dir, { lint: 'eslint .', 'format:check': 'prettier --check .' }, 'express');
    const pkg = readPkg(dir);
    expect(pkg.scripts.lint).toBe('my-custom-lint');
    expect(pkg.scripts['format:check']).toBe('prettier --check .');
    expect(pkg.scripts.test).toBe('jest');
  });

  it('skips all scripts when all already exist', () => {
    const dir = createTempProject(JSON.stringify({
      name: 'test',
      scripts: { lint: 'existing', 'format:check': 'existing', prepare: 'existing' },
    }, null, 2));
    patchPackageJson(dir, { lint: 'eslint .', 'format:check': 'prettier --check .', prepare: 'husky' }, 'express');
    const pkg = readPkg(dir);
    expect(pkg.scripts.lint).toBe('existing');
    expect(pkg.scripts['format:check']).toBe('existing');
    expect(pkg.scripts.prepare).toBe('existing');
  });

  it('adds lint-staged config for node framework (express)', () => {
    const dir = createTempProject(JSON.stringify({ name: 'test' }, null, 2));
    patchPackageJson(dir, {}, 'express');
    const pkg = readPkg(dir);
    expect(pkg['lint-staged']['*.{ts,tsx,js,jsx}']).toEqual(['eslint --fix', 'prettier --write']);
    expect(pkg['lint-staged']['*.{json,md}']).toEqual(['prettier --write']);
    // Node frameworks should NOT have CSS/HTML rules
    expect(pkg['lint-staged']['*.{css,scss,less}']).toBeUndefined();
    expect(pkg['lint-staged']['*.html']).toBeUndefined();
  });

  it('adds lint-staged config with CSS rules for React framework', () => {
    const dir = createTempProject(JSON.stringify({ name: 'test' }, null, 2));
    patchPackageJson(dir, {}, 'vite-react-ts');
    const pkg = readPkg(dir);
    expect(pkg['lint-staged']['*.{css,scss,less}']).toEqual(['prettier --write']);
    // React should NOT have HTML rules
    expect(pkg['lint-staged']['*.html']).toBeUndefined();
  });

  it('adds lint-staged config with CSS + HTML rules for Angular framework', () => {
    const dir = createTempProject(JSON.stringify({ name: 'test' }, null, 2));
    patchPackageJson(dir, {}, 'angular-standalone');
    const pkg = readPkg(dir);
    expect(pkg['lint-staged']['*.{css,scss,less}']).toEqual(['prettier --write']);
    expect(pkg['lint-staged']['*.html']).toEqual(['prettier --write']);
  });

  it('does not overwrite existing lint-staged config', () => {
    const dir = createTempProject(JSON.stringify({
      name: 'test',
      'lint-staged': { '*.ts': ['custom-lint'] },
    }, null, 2));
    patchPackageJson(dir, {}, 'express');
    const pkg = readPkg(dir);
    expect(pkg['lint-staged']['*.ts']).toEqual(['custom-lint']);
    expect(pkg['lint-staged']['*.{ts,tsx,js,jsx}']).toBeUndefined();
  });

  it('preserves 4-space indent formatting', () => {
    const dir = createTempProject(JSON.stringify({ name: 'test' }, null, 4));
    patchPackageJson(dir, { lint: 'eslint .' }, 'express');
    const raw = readFileSync(join(dir, 'package.json'), 'utf-8');
    // 4-space indent should be preserved
    expect(raw).toContain('    "name"');
  });

  it('preserves tab indent formatting', () => {
    const content = '{\n\t"name": "test"\n}\n';
    const dir = createTempProject(content);
    patchPackageJson(dir, { lint: 'eslint .' }, 'express');
    const raw = readFileSync(join(dir, 'package.json'), 'utf-8');
    expect(raw).toContain('\t"name"');
  });
});
