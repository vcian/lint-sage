import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectPackageManager } from '../package-manager.js';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'lint-sage-test-'));
}

describe('detectPackageManager', () => {
  it('detects npm when package-lock.json exists', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'package-lock.json'), '{}');
    const result = detectPackageManager(dir);
    expect(result.name).toBe('npm');
    rmSync(dir, { recursive: true });
  });

  it('detects yarn when yarn.lock exists', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'yarn.lock'), '');
    const result = detectPackageManager(dir);
    expect(result.name).toBe('yarn');
    rmSync(dir, { recursive: true });
  });

  it('detects pnpm when pnpm-lock.yaml exists', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'pnpm-lock.yaml'), '');
    const result = detectPackageManager(dir);
    expect(result.name).toBe('pnpm');
    rmSync(dir, { recursive: true });
  });

  it('falls back to npm when no lock file exists', () => {
    const dir = makeTempDir();
    const result = detectPackageManager(dir);
    expect(result.name).toBe('npm');
    rmSync(dir, { recursive: true });
  });

  it('returns a version string', () => {
    const dir = makeTempDir();
    const result = detectPackageManager(dir);
    expect(typeof result.version).toBe('string');
    rmSync(dir, { recursive: true });
  });
});
