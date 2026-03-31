import { describe, it, expect, vi } from 'vitest';
import { execSync } from 'node:child_process';

// We test command construction by intercepting execSync
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// Need to import after mock
const { installDependencies } = await import('../installer.js');

describe('installDependencies', () => {
  it('skips when no deps to install', () => {
    installDependencies('npm', [], '/tmp');
    expect(execSync).not.toHaveBeenCalled();
  });

  it('builds npm install command', () => {
    installDependencies(
      'npm',
      [{ name: 'eslint', version: '^9' }],
      '/tmp',
    );
    expect(execSync).toHaveBeenCalledWith(
      'npm install -D eslint@^9',
      expect.objectContaining({ cwd: '/tmp' }),
    );
  });

  it('builds yarn add command', () => {
    installDependencies(
      'yarn',
      [{ name: 'prettier', version: '^3' }],
      '/tmp',
    );
    expect(execSync).toHaveBeenCalledWith(
      'yarn add -D prettier@^3',
      expect.objectContaining({ cwd: '/tmp' }),
    );
  });

  it('builds pnpm add command', () => {
    installDependencies(
      'pnpm',
      [{ name: 'husky', version: '^9' }],
      '/tmp',
    );
    expect(execSync).toHaveBeenCalledWith(
      'pnpm add -D husky@^9',
      expect.objectContaining({ cwd: '/tmp' }),
    );
  });

  it('includes multiple packages in a single command', () => {
    installDependencies(
      'npm',
      [
        { name: 'eslint', version: '^9' },
        { name: 'prettier', version: '^3' },
      ],
      '/tmp',
    );
    expect(execSync).toHaveBeenCalledWith(
      'npm install -D eslint@^9 prettier@^3',
      expect.objectContaining({ cwd: '/tmp' }),
    );
  });
});
