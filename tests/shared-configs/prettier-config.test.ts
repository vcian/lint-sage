import { describe, expect, it } from 'vitest';

describe('@vcian/prettier-config', () => {
  it('exports a valid Prettier config object', async () => {
    const config = await import('../../packages/prettier-config/index.js');
    const prettierConfig = config.default ?? config;

    expect(typeof prettierConfig).toBe('object');
    expect(prettierConfig).not.toBeNull();
  });

  it('has expected formatting settings', async () => {
    const config = await import('../../packages/prettier-config/index.js');
    const prettierConfig = config.default ?? config;

    expect(prettierConfig.printWidth).toBe(100);
    expect(prettierConfig.tabWidth).toBe(2);
    expect(prettierConfig.useTabs).toBe(false);
    expect(prettierConfig.semi).toBe(true);
    expect(prettierConfig.singleQuote).toBe(true);
    expect(prettierConfig.trailingComma).toBe('all');
    expect(prettierConfig.bracketSpacing).toBe(true);
    expect(prettierConfig.arrowParens).toBe('always');
    expect(prettierConfig.endOfLine).toBe('lf');
  });

  it('is spreadable', async () => {
    const config = await import('../../packages/prettier-config/index.js');
    const prettierConfig = config.default ?? config;

    const userConfig = {
      ...prettierConfig,
      printWidth: 120,
    };

    expect(userConfig.printWidth).toBe(120);
    expect(userConfig.singleQuote).toBe(true);
  });
});
