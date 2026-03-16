import { describe, expect, it } from 'vitest';

describe('@vcian/eslint-config-node', () => {
  it('exports a non-empty array (flat config)', async () => {
    const config = await import('../../packages/eslint-config-node/index.js');
    const configArray = config.default ?? config;

    expect(Array.isArray(configArray)).toBe(true);
    expect(configArray.length).toBeGreaterThanOrEqual(2);
  });

  it('first entry targets ts/js files only (no tsx/jsx)', async () => {
    const config = await import('../../packages/eslint-config-node/index.js');
    const configArray = config.default ?? config;
    const mainEntry = configArray[0];

    expect(mainEntry.files).toContain('**/*.ts');
    expect(mainEntry.files).toContain('**/*.js');
    expect(mainEntry.files).not.toContain('**/*.tsx');
    expect(mainEntry.files).not.toContain('**/*.jsx');
  });

  it('includes Node.js and security plugins', async () => {
    const config = await import('../../packages/eslint-config-node/index.js');
    const configArray = config.default ?? config;
    const mainEntry = configArray[0];

    expect(mainEntry.plugins['@typescript-eslint']).toBeDefined();
    expect(mainEntry.plugins['n']).toBeDefined();
    expect(mainEntry.plugins['security']).toBeDefined();
    expect(mainEntry.plugins['import']).toBeDefined();
  });

  it('does not include React or JSX rules', async () => {
    const config = await import('../../packages/eslint-config-node/index.js');
    const configArray = config.default ?? config;
    const mainEntry = configArray[0];

    expect(mainEntry.plugins['react-hooks']).toBeUndefined();
    expect(mainEntry.plugins['jsx-a11y']).toBeUndefined();
  });

  it('includes security rules', async () => {
    const config = await import('../../packages/eslint-config-node/index.js');
    const configArray = config.default ?? config;
    const mainEntry = configArray[0];

    expect(mainEntry.rules['security/detect-object-injection']).toBe('warn');
  });
});
