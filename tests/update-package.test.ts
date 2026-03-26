import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { updatePackage } from '../src/utils/update-package.ts';

describe('updatePackage', () => {
  it('merges devDependencies and scripts without touching unrelated fields', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-package-'));
    const packageJsonPath = path.join(targetDirectory, 'package.json');

    await writeFile(
      packageJsonPath,
      `${JSON.stringify(
        {
          name: 'sample-app',
          private: true,
          devDependencies: {
            eslint: '^8.57.0',
            typescript: '^5.7.0',
          },
          scripts: {
            test: 'vitest',
            lint: 'old lint command',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const result = await updatePackage({
      targetDirectory,
      stack: 'react',
      variant: 'next-js',
    });

    const updatedPackageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      name: string;
      private: boolean;
      devDependencies: Record<string, string>;
      overrides: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(updatedPackageJson.name).toBe('sample-app');
    expect(updatedPackageJson.private).toBe(true);
    expect(updatedPackageJson.devDependencies.eslint).toBe('~9.22.0');
    expect(updatedPackageJson.devDependencies.typescript).toBe('^5.7.0');
    expect(updatedPackageJson.devDependencies['@vcian/eslint-config-react']).toBe('~1.0.0');
    expect(updatedPackageJson.overrides.eslint).toBe('~8.57.0');
    expect(updatedPackageJson.overrides['@typescript-eslint/parser']).toBe('~8.26.0');
    expect(updatedPackageJson.overrides['@typescript-eslint/eslint-plugin']).toBe('~8.26.0');
    expect(updatedPackageJson.scripts.lint).toBe('eslint .');
    expect(updatedPackageJson.scripts['format:check']).toBe('prettier --check .');
    expect(updatedPackageJson.scripts.test).toBe('vitest');
    expect(result.addedDependencies).toContain('@vcian/eslint-config-react');
    expect(result.addedScripts).toContain('format:check');
    expect(result.updatedDependencies).toContain('eslint');
    expect(result.updatedScripts).toContain('lint');
    expect(result.wroteFile).toBe(true);
  });

  it('supports dry-run without modifying package.json', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-package-dry-'));
    const packageJsonPath = path.join(targetDirectory, 'package.json');
    const initialPackageJson = {
      name: 'dry-run-app',
      devDependencies: {},
      scripts: {},
    };

    await writeFile(packageJsonPath, `${JSON.stringify(initialPackageJson, null, 2)}\n`, 'utf8');

    const result = await updatePackage({
      targetDirectory,
      stack: 'node',
      variant: 'plain-ts',
      dryRun: true,
    });

    const persistedPackageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      name: string;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(result.addedDependencies).toContain('@vcian/eslint-config-node');
    expect(result.addedScripts).toContain('lint');
    expect(result.wroteFile).toBe(false);
    expect(persistedPackageJson).toEqual(initialPackageJson);
  });

  it('adds angular SSR alignment override when versions are mismatched', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-package-angular-'));
    const packageJsonPath = path.join(targetDirectory, 'package.json');

    await writeFile(
      packageJsonPath,
      `${JSON.stringify(
        {
          name: 'angular-ssr-app',
          devDependencies: {
            '@angular/build': '^20.3.17',
            '@angular/ssr': '^20.3.13',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    await updatePackage({
      targetDirectory,
      stack: 'angular',
      variant: 'angular-ssr',
    });

    const updatedPackageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      overrides?: Record<string, string>;
    };

    expect(updatedPackageJson.overrides?.['@angular/ssr']).toBe('~20.3.17');
  });
});
