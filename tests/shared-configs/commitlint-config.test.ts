import { describe, expect, it } from 'vitest';

describe('@vcian/commitlint-config', () => {
  it('exports a valid commitlint config object', async () => {
    const config = await import('../../packages/commitlint-config/index.js');
    const commitlintConfig = config.default ?? config;

    expect(typeof commitlintConfig).toBe('object');
    expect(commitlintConfig).not.toBeNull();
  });

  it('extends @commitlint/config-conventional', async () => {
    const config = await import('../../packages/commitlint-config/index.js');
    const commitlintConfig = config.default ?? config;

    expect(commitlintConfig.extends).toBeDefined();
    expect(Array.isArray(commitlintConfig.extends)).toBe(true);
    expect(commitlintConfig.extends).toContain('@commitlint/config-conventional');
  });
});
