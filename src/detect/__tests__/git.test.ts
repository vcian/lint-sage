import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectGit } from '../git.js';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'lint-sage-test-'));
}

describe('detectGit', () => {
  it('returns true when .git directory exists', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.git'));
    expect(detectGit(dir)).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it('calls process.exit when .git is missing', () => {
    const dir = makeTempDir();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    expect(() => detectGit(dir)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    rmSync(dir, { recursive: true });
  });
});
