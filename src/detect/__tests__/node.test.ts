import { describe, it, expect } from 'vitest';
import { detectNodeVersion } from '../node.js';

describe('detectNodeVersion', () => {
  it('returns a valid node version object', () => {
    const version = detectNodeVersion();
    expect(version.major).toBeGreaterThanOrEqual(18);
    expect(version.minor).toBeGreaterThanOrEqual(0);
    expect(version.patch).toBeGreaterThanOrEqual(0);
  });

  it('returns numbers for all version parts', () => {
    const version = detectNodeVersion();
    expect(typeof version.major).toBe('number');
    expect(typeof version.minor).toBe('number');
    expect(typeof version.patch).toBe('number');
  });
});
