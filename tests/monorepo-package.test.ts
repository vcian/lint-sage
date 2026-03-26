import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { updateMonorepoPackageJson } from '../src/utils/monorepo-package.ts';

describe('updateMonorepoPackageJson', () => {
  it('merges dynamic overrides for selected package variants', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-monorepo-pkg-'));
    const packageJsonPath = path.join(targetDirectory, 'package.json');

    await writeFile(
      packageJsonPath,
      `${JSON.stringify(
        {
          name: 'root',
          private: true,
          devDependencies: {
            eslint: '^8.57.0',
            '@angular/build': '^20.3.17',
            '@angular/ssr': '^20.3.13',
          },
          scripts: {},
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    await updateMonorepoPackageJson({
      targetDirectory,
      packages: [
        { stack: 'node', variant: 'nestjs' },
        { stack: 'angular', variant: 'angular-ssr' },
      ],
    });

    const updatedPackageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      overrides?: Record<string, string>;
    };

    expect(updatedPackageJson.overrides?.eslint).toBe('~8.57.0');
    expect(updatedPackageJson.overrides?.['@typescript-eslint/parser']).toBeTruthy();
    expect(updatedPackageJson.overrides?.['@typescript-eslint/eslint-plugin']).toBeTruthy();
    expect(updatedPackageJson.overrides?.['@angular/ssr']).toBe('~20.3.17');
  });
});

