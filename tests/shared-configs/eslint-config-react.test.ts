import { describe, expect, it } from 'vitest';

describe('@vcian/eslint-config-react', () => {
  it('exports a non-empty array (flat config)', async () => {
    const config = await import('../../packages/eslint-config-react/index.js');
    const configArray = config.default ?? config;

    expect(Array.isArray(configArray)).toBe(true);
    expect(configArray.length).toBeGreaterThanOrEqual(2);
  });

  it('first entry targets ts/tsx/js/jsx files', async () => {
    const config = await import('../../packages/eslint-config-react/index.js');
    const configArray = config.default ?? config;
    const mainEntry = configArray[0];

    expect(mainEntry.files).toBeDefined();
    expect(mainEntry.files).toContain('**/*.ts');
    expect(mainEntry.files).toContain('**/*.tsx');
    expect(mainEntry.files).toContain('**/*.js');
    expect(mainEntry.files).toContain('**/*.jsx');
  });

  it('includes required plugins', async () => {
    const config = await import('../../packages/eslint-config-react/index.js');
    const configArray = config.default ?? config;
    const mainEntry = configArray[0];

    expect(mainEntry.plugins).toBeDefined();
    expect(mainEntry.plugins['@typescript-eslint']).toBeDefined();
    expect(mainEntry.plugins['react-hooks']).toBeDefined();
    expect(mainEntry.plugins['jsx-a11y']).toBeDefined();
    expect(mainEntry.plugins['import']).toBeDefined();
    expect(mainEntry.plugins['unused-imports']).toBeDefined();
  });

  it('includes react-hooks rules', async () => {
    const config = await import('../../packages/eslint-config-react/index.js');
    const configArray = config.default ?? config;
    const mainEntry = configArray[0];

    expect(mainEntry.rules['react-hooks/rules-of-hooks']).toBe('error');
    expect(mainEntry.rules['react-hooks/exhaustive-deps']).toBe('warn');
  });

  it('includes prettier as last config entry', async () => {
    const config = await import('../../packages/eslint-config-react/index.js');
    const configArray = config.default ?? config;
    const lastEntry = configArray[configArray.length - 1];

    // eslint-config-prettier exports an object with a rules key
    expect(lastEntry.rules).toBeDefined();
  });

  it('is spreadable in a flat config array', async () => {
    const config = await import('../../packages/eslint-config-react/index.js');
    const configArray = config.default ?? config;

    const userConfig = [...configArray, { rules: { 'no-console': 'off' } }];

    expect(userConfig.length).toBe(configArray.length + 1);
  });
});
