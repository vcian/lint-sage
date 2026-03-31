import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectFramework } from '../framework.js';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'lint-sage-test-'));
}

function writePackageJson(dir: string, deps: Record<string, string>, devDeps: Record<string, string> = {}): void {
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ dependencies: deps, devDependencies: devDeps }),
  );
}

describe('detectFramework', () => {
  it('detects vite-react-ts', () => {
    const dir = makeTempDir();
    writePackageJson(dir, { vite: '^5', react: '^18' }, { typescript: '^5' });
    expect(detectFramework(dir)).toBe('vite-react-ts');
    rmSync(dir, { recursive: true });
  });

  it('detects next-js', () => {
    const dir = makeTempDir();
    writePackageJson(dir, { next: '^14', react: '^18' });
    expect(detectFramework(dir)).toBe('next-js');
    rmSync(dir, { recursive: true });
  });

  it('detects express', () => {
    const dir = makeTempDir();
    writePackageJson(dir, { express: '^4' });
    expect(detectFramework(dir)).toBe('express');
    rmSync(dir, { recursive: true });
  });

  it('detects angular-standalone', () => {
    const dir = makeTempDir();
    writePackageJson(dir, { '@angular/core': '^17' });
    expect(detectFramework(dir)).toBe('angular-standalone');
    rmSync(dir, { recursive: true });
  });

  it('detects angular-ssr over angular-standalone', () => {
    const dir = makeTempDir();
    writePackageJson(dir, { '@angular/core': '^17', '@angular/ssr': '^17' });
    expect(detectFramework(dir)).toBe('angular-ssr');
    rmSync(dir, { recursive: true });
  });

  it('detects nestjs', () => {
    const dir = makeTempDir();
    writePackageJson(dir, { '@nestjs/core': '^10' });
    expect(detectFramework(dir)).toBe('nestjs');
    rmSync(dir, { recursive: true });
  });

  it('detects fastify', () => {
    const dir = makeTempDir();
    writePackageJson(dir, { fastify: '^4' });
    expect(detectFramework(dir)).toBe('fastify');
    rmSync(dir, { recursive: true });
  });

  it('detects tanstack-react-start', () => {
    const dir = makeTempDir();
    writePackageJson(dir, { '@tanstack/react-start': '^1', react: '^18' });
    expect(detectFramework(dir)).toBe('tanstack-react-start');
    rmSync(dir, { recursive: true });
  });

  it('returns null when no framework detected', () => {
    const dir = makeTempDir();
    writePackageJson(dir, { lodash: '^4' });
    expect(detectFramework(dir)).toBeNull();
    rmSync(dir, { recursive: true });
  });

  it('throws when no package.json exists', () => {
    const dir = makeTempDir();
    expect(() => detectFramework(dir)).toThrow('No package.json found');
    rmSync(dir, { recursive: true });
  });
});
