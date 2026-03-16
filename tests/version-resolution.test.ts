import { describe, expect, it } from 'vitest';

import { shouldUpdateVersion } from '../src/utils/update-package.ts';

describe('shouldUpdateVersion', () => {
  it('does NOT update when same major.minor and existing has higher patch', () => {
    expect(shouldUpdateVersion('~9.2.3', '~9.2.0')).toBe(false);
  });

  it('does NOT update when versions are identical', () => {
    expect(shouldUpdateVersion('~9.2.0', '~9.2.0')).toBe(false);
  });

  it('updates when template has higher patch in same minor', () => {
    expect(shouldUpdateVersion('~9.2.0', '~9.2.3')).toBe(true);
  });

  it('updates when different major version', () => {
    expect(shouldUpdateVersion('~8.56.0', '~9.2.0')).toBe(true);
  });

  it('updates when different minor version (even if same major)', () => {
    expect(shouldUpdateVersion('~9.5.0', '~9.2.0')).toBe(true);
  });

  it('updates when existing has caret and template has tilde (non-tilde format)', () => {
    expect(shouldUpdateVersion('^8.57.0', '~9.2.0')).toBe(true);
  });

  it('does NOT update when non-parseable versions are equal', () => {
    expect(shouldUpdateVersion('latest', 'latest')).toBe(false);
  });

  it('updates when non-parseable versions differ', () => {
    expect(shouldUpdateVersion('latest', '~9.2.0')).toBe(true);
  });
});
