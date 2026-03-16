import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { dependencyVersions } from '../../src/constants/versions.js';

const templatesRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/templates',
);

describe('lint-sage template integration with shared configs', () => {
  describe('eslint.config.js templates reference shared configs', () => {
    it('react templates import @vcian/eslint-config-react', async () => {
      const content = await readFile(
        path.join(templatesRoot, 'react/vite-react-ts/eslint.config.js'),
        'utf8',
      );
      expect(content).toContain('@vcian/eslint-config-react');
    });

    it('node templates import @vcian/eslint-config-node', async () => {
      const content = await readFile(
        path.join(templatesRoot, 'node/express/eslint.config.js'),
        'utf8',
      );
      expect(content).toContain('@vcian/eslint-config-node');
    });

    it('angular templates import @vcian/eslint-config-angular', async () => {
      const content = await readFile(
        path.join(templatesRoot, 'angular/angular-standalone/eslint.config.js'),
        'utf8',
      );
      expect(content).toContain('@vcian/eslint-config-angular');
    });
  });

  describe('prettier.config.js templates reference shared config', () => {
    it('react prettier config imports @vcian/prettier-config', async () => {
      const content = await readFile(
        path.join(templatesRoot, 'react/vite-react-ts/prettier.config.js'),
        'utf8',
      );
      expect(content).toContain('@vcian/prettier-config');
    });

    it('node prettier config imports @vcian/prettier-config', async () => {
      const content = await readFile(
        path.join(templatesRoot, 'node/express/prettier.config.js'),
        'utf8',
      );
      expect(content).toContain('@vcian/prettier-config');
    });
  });

  describe('.commitlintrc.json templates reference shared config', () => {
    it('react commitlint extends @vcian/commitlint-config', async () => {
      const content = await readFile(
        path.join(templatesRoot, 'react/vite-react-ts/.commitlintrc.json'),
        'utf8',
      );
      const parsed = JSON.parse(content);
      expect(parsed.extends).toContain('@vcian/commitlint-config');
    });

    it('node commitlint extends @vcian/commitlint-config', async () => {
      const content = await readFile(
        path.join(templatesRoot, 'node/express/.commitlintrc.json'),
        'utf8',
      );
      const parsed = JSON.parse(content);
      expect(parsed.extends).toContain('@vcian/commitlint-config');
    });
  });

  describe('dependency versions in templates match versions.ts', () => {
    it('react dependencies.json lists @vcian/eslint-config-react', async () => {
      const content = await readFile(
        path.join(templatesRoot, 'react/vite-react-ts/dependencies.json'),
        'utf8',
      );
      expect(content).toContain('@vcian/eslint-config-react');
    });

    it('node dependencies.json lists @vcian/eslint-config-node', async () => {
      const content = await readFile(
        path.join(templatesRoot, 'node/express/dependencies.json'),
        'utf8',
      );
      expect(content).toContain('@vcian/eslint-config-node');
    });

    it('angular dependencies.json lists @vcian/eslint-config-angular', async () => {
      const content = await readFile(
        path.join(templatesRoot, 'angular/angular-standalone/dependencies.json'),
        'utf8',
      );
      expect(content).toContain('@vcian/eslint-config-angular');
    });

    it('all shared config package versions in versions.ts are ~1.0.0', () => {
      expect(dependencyVersions['@vcian/eslint-config-react']).toBe('~1.0.0');
      expect(dependencyVersions['@vcian/eslint-config-node']).toBe('~1.0.0');
      expect(dependencyVersions['@vcian/eslint-config-angular']).toBe('~1.0.0');
      expect(dependencyVersions['@vcian/prettier-config']).toBe('~1.0.0');
      expect(dependencyVersions['@vcian/commitlint-config']).toBe('~1.0.0');
    });
  });

  describe('no hardcoded rules in generated configs', () => {
    it('react eslint.config.js has empty rules override only', async () => {
      const content = await readFile(
        path.join(templatesRoot, 'react/vite-react-ts/eslint.config.js'),
        'utf8',
      );
      // The template should spread the shared config and only have an empty rules object
      expect(content).toContain('rules: {}');
    });

    it('node eslint.config.js has empty rules override only', async () => {
      const content = await readFile(
        path.join(templatesRoot, 'node/express/eslint.config.js'),
        'utf8',
      );
      expect(content).toContain('rules: {}');
    });

    it('angular eslint.config.js has empty rules override only', async () => {
      const content = await readFile(
        path.join(templatesRoot, 'angular/angular-standalone/eslint.config.js'),
        'utf8',
      );
      expect(content).toContain('rules: {}');
    });
  });
});
