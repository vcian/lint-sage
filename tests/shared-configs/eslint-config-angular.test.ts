import { describe, expect, it } from 'vitest';

describe('@vcian/eslint-config-angular', () => {
  it('exports a non-empty array (flat config)', async () => {
    const config = await import('../../packages/eslint-config-angular/index.js');
    const configArray = config.default ?? config;

    expect(Array.isArray(configArray)).toBe(true);
    expect(configArray.length).toBeGreaterThanOrEqual(3);
  });

  it('has separate config objects for .ts and .html files', async () => {
    const config = await import('../../packages/eslint-config-angular/index.js');
    const configArray = config.default ?? config;

    const tsEntry = configArray.find(
      (entry: { files?: string[] }) => entry.files && entry.files.includes('**/*.ts'),
    );
    const htmlEntry = configArray.find(
      (entry: { files?: string[] }) => entry.files && entry.files.includes('**/*.html'),
    );

    expect(tsEntry).toBeDefined();
    expect(htmlEntry).toBeDefined();
  });

  it('ts config includes Angular and TypeScript plugins', async () => {
    const config = await import('../../packages/eslint-config-angular/index.js');
    const configArray = config.default ?? config;

    const tsEntry = configArray.find(
      (entry: { files?: string[] }) => entry.files && entry.files.includes('**/*.ts'),
    );

    expect(tsEntry.plugins['@typescript-eslint']).toBeDefined();
    expect(tsEntry.plugins['@angular-eslint']).toBeDefined();
    expect(tsEntry.plugins['import']).toBeDefined();
  });

  it('html config uses angular template parser', async () => {
    const config = await import('../../packages/eslint-config-angular/index.js');
    const configArray = config.default ?? config;

    const htmlEntry = configArray.find(
      (entry: { files?: string[] }) => entry.files && entry.files.includes('**/*.html'),
    );

    expect(htmlEntry.languageOptions.parser).toBeDefined();
    expect(htmlEntry.plugins['@angular-eslint/template']).toBeDefined();
  });

  it('includes Angular-specific rules', async () => {
    const config = await import('../../packages/eslint-config-angular/index.js');
    const configArray = config.default ?? config;

    const tsEntry = configArray.find(
      (entry: { files?: string[] }) => entry.files && entry.files.includes('**/*.ts'),
    );

    expect(tsEntry.rules['@angular-eslint/component-class-suffix']).toBe('error');
    expect(tsEntry.rules['@angular-eslint/directive-class-suffix']).toBe('error');
  });

  it('html config includes template rules', async () => {
    const config = await import('../../packages/eslint-config-angular/index.js');
    const configArray = config.default ?? config;

    const htmlEntry = configArray.find(
      (entry: { files?: string[] }) => entry.files && entry.files.includes('**/*.html'),
    );

    expect(htmlEntry.rules['@angular-eslint/template/banana-in-box']).toBe('error');
  });
});
