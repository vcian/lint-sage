import { afterEach, describe, expect, it, vi } from 'vitest';

import { createProgram, run } from '../src/cli.ts';

function createStreamCapture() {
  let stdout = '';
  let stderr = '';

  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout += `${args.join(' ')}\n`;
  });

  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr += `${args.join(' ')}\n`;
  });

  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((
    chunk: string | Uint8Array,
  ) => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write);

  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((
    chunk: string | Uint8Array,
  ) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write);

  return {
    restore() {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    },
    get stderr() {
      return stderr;
    },
    get stdout() {
      return stdout;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('createProgram', () => {
  it('shows the four commands and common flags in help output', () => {
    const helpOutput = createProgram().helpInformation();

    expect(helpOutput).toContain('init');
    expect(helpOutput).toContain('update');
    expect(helpOutput).toContain('doctor');
    expect(helpOutput).toContain('eject');
    expect(helpOutput).toContain('--force');
    expect(helpOutput).toContain('--package-manager <value>');
  });
});

describe('run', () => {
  it('prints help output with all commands', async () => {
    const capture = createStreamCapture();

    try {
      const exitCode = await run(['node', 'lint-sage', '--help']);

      expect(exitCode).toBe(0);
      expect(capture.stdout).toContain('init');
      expect(capture.stdout).toContain('update');
      expect(capture.stdout).toContain('doctor');
      expect(capture.stdout).toContain('eject');
    } finally {
      capture.restore();
    }
  });

  it('prints the package version', async () => {
    const capture = createStreamCapture();

    try {
      const exitCode = await run(['node', 'lint-sage', '--version']);

      expect(exitCode).toBe(0);
      expect(capture.stdout.trim()).toBe('3.0.0');
    } finally {
      capture.restore();
    }
  });

  it.each(['doctor', 'eject'])(
    'errors for %s when .lint-sage.json is missing',
    async (commandName) => {
      const capture = createStreamCapture();

      try {
        const exitCode = await run(['node', 'lint-sage', commandName]);

        expect(exitCode).toBe(1);
        expect(capture.stderr).toContain('.lint-sage.json not found');
      } finally {
        capture.restore();
      }
    },
  );

  it('update errors when .lint-sage.json is missing', async () => {
    const capture = createStreamCapture();

    try {
      const exitCode = await run(['node', 'lint-sage', 'update']);

      expect(exitCode).toBe(1);
      expect(capture.stderr).toContain('.lint-sage.json not found');
    } finally {
      capture.restore();
    }
  });

  it('returns exit code 1 for unknown commands', async () => {
    const capture = createStreamCapture();

    try {
      const exitCode = await run(['node', 'lint-sage', 'unknown-command']);

      expect(exitCode).toBe(1);
      expect(capture.stderr).toContain('unknown command');
    } finally {
      capture.restore();
    }
  });

  it('warns on incompatible flags but continues', async () => {
    const mockedInitHandler = vi.fn().mockResolvedValue(0);

    vi.doMock('../src/commands/init.js', () => ({
      handleInit: mockedInitHandler,
    }));

    const { run: mockedRun } = await import('../src/cli.ts');
    const capture = createStreamCapture();

    try {
      const exitCode = await mockedRun(['node', 'lint-sage', 'init', '--fix']);

      expect(exitCode).toBe(0);
      expect(capture.stderr).toContain('Warning: --fix is not supported by "init".');
      expect(mockedInitHandler).toHaveBeenCalledWith({
        fix: true,
      });
    } finally {
      capture.restore();
    }
  });

  it('returns the handler exit code', async () => {
    const mockedInitHandler = vi.fn().mockResolvedValue(1);

    vi.doMock('../src/commands/init.js', () => ({
      handleInit: mockedInitHandler,
    }));

    const { run: mockedRun } = await import('../src/cli.ts');

    const exitCode = await mockedRun(['node', 'lint-sage', 'init', '--preset', 'next-js']);

    expect(exitCode).toBe(1);
    expect(mockedInitHandler).toHaveBeenCalledWith({
      preset: 'next-js',
    });
  });

  it('returns exit code 1 for invalid package manager values', async () => {
    const capture = createStreamCapture();

    try {
      const exitCode = await run(['node', 'lint-sage', 'init', '--package-manager', 'bun']);

      expect(exitCode).toBe(1);
      expect(capture.stderr).toContain('Expected one of "npm", "pnpm", or "yarn".');
    } finally {
      capture.restore();
    }
  });

  it('passes global options declared before the command', async () => {
    const mockedInitHandler = vi.fn().mockResolvedValue(0);

    vi.doMock('../src/commands/init.js', () => ({
      handleInit: mockedInitHandler,
    }));

    const { run: mockedRun } = await import('../src/cli.ts');
    const capture = createStreamCapture();

    try {
      const exitCode = await mockedRun([
        'node',
        'lint-sage',
        '--verbose',
        'init',
        '--preset',
        'next-js',
      ]);

      expect(exitCode).toBe(0);
      expect(mockedInitHandler).toHaveBeenCalledWith({
        preset: 'next-js',
        verbose: true,
      });
      expect(capture.stderr).toBe('');
    } finally {
      capture.restore();
    }
  });

  it('passes option values provided with equals syntax', async () => {
    const mockedInitHandler = vi.fn().mockResolvedValue(0);

    vi.doMock('../src/commands/init.js', () => ({
      handleInit: mockedInitHandler,
    }));

    const { run: mockedRun } = await import('../src/cli.ts');

    const exitCode = await mockedRun([
      'node',
      'lint-sage',
      'init',
      '--preset=next-js',
      '--dry-run',
    ]);

    expect(exitCode).toBe(0);
    expect(mockedInitHandler).toHaveBeenCalledWith({
      dryRun: true,
      preset: 'next-js',
    });
  });

  it('passes parsed options to the init handler', async () => {
    const mockedInitHandler = vi.fn().mockResolvedValue(0);

    vi.doMock('../src/commands/init.js', () => ({
      handleInit: mockedInitHandler,
    }));

    const { run: mockedRun } = await import('../src/cli.ts');
    const capture = createStreamCapture();

    try {
      const exitCode = await mockedRun([
        'node',
        'lint-sage',
        'init',
        '--force',
        '--preset',
        'next-js',
        '--dry-run',
        '--verbose',
        '--package-manager',
        'pnpm',
        '--monorepo',
        '--fix',
      ]);

      expect(exitCode).toBe(0);
      expect(mockedInitHandler).toHaveBeenCalledWith({
        dryRun: true,
        fix: true,
        force: true,
        monorepo: true,
        packageManager: 'pnpm',
        preset: 'next-js',
        verbose: true,
      });
      expect(capture.stderr).toContain('Warning: --fix is not supported by "init".');
    } finally {
      capture.restore();
    }
  });
});
