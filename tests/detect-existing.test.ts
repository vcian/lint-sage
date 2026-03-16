import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectExistingConfigs } from '../src/utils/detect-existing.ts';

describe('detectExistingConfigs', () => {
  it('detects both managed and legacy config files', async () => {
    const targetDirectory = await mkdtemp(path.join(os.tmpdir(), 'lint-sage-detect-'));

    await mkdir(path.join(targetDirectory, '.husky'), { recursive: true });
    await mkdir(path.join(targetDirectory, '.vscode'), { recursive: true });

    await writeFile(
      path.join(targetDirectory, 'eslint.config.js'),
      'module.exports = [];\n',
      'utf8',
    );
    await writeFile(path.join(targetDirectory, '.eslintrc.json'), '{}\n', 'utf8');
    await writeFile(path.join(targetDirectory, '.prettierrc'), '{}\n', 'utf8');
    await writeFile(
      path.join(targetDirectory, '.husky', 'pre-commit'),
      'npx lint-staged\n',
      'utf8',
    );
    await writeFile(path.join(targetDirectory, '.vscode', 'settings.json'), '{}\n', 'utf8');

    const detectedConfigs = await detectExistingConfigs(targetDirectory);

    expect(detectedConfigs).toEqual(
      expect.arrayContaining([
        { path: '.eslintrc.json', type: 'legacy' },
        { path: '.husky/pre-commit', type: 'managed' },
        { path: '.prettierrc', type: 'legacy' },
        { path: '.vscode/settings.json', type: 'managed' },
        { path: 'eslint.config.js', type: 'managed' },
      ]),
    );
  });
});
