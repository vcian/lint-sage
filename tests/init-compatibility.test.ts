import { describe, expect, it } from 'vitest';

import {
  collectInitCompatibilityIssues,
  detectAngularSsrMismatch,
  shouldCheckAngularSsr,
} from '../src/utils/init-compatibility.ts';

describe('init compatibility preflight', () => {
  it('detects ts-jest + typescript 6 incompatibility', () => {
    const issues = collectInitCompatibilityIssues({
      devDependencies: {
        'ts-jest': '^29.4.6',
        typescript: '^6.0.2',
      },
    });

    expect(issues.errors.some((error) => error.includes('ts-jest@29'))).toBe(true);
  });

  it('detects eslint 10 + typescript-eslint 8 incompatibility', () => {
    const issues = collectInitCompatibilityIssues({
      devDependencies: {
        eslint: '^10.1.0',
        'typescript-eslint': '^8.20.0',
      },
    });

    expect(issues.errors.some((error) => error.includes('@typescript-eslint v8'))).toBe(true);
  });

  it('warns when ajv is pinned in project dependencies', () => {
    const issues = collectInitCompatibilityIssues({
      dependencies: {
        ajv: '8.18.0',
      },
    });

    expect(issues.warnings.length).toBeGreaterThan(0);
    expect(issues.warnings[0]).toContain('ajv');
  });

  it('detects angular build/ssr major mismatch', () => {
    const warning = detectAngularSsrMismatch({
      devDependencies: {
        '@angular/build': '^20.3.13',
        '@angular/ssr': '^19.2.4',
      },
    });

    expect(warning).toContain('Angular major mismatch');
  });

  it('detects angular-ssr variant in selection list', () => {
    expect(shouldCheckAngularSsr(['nestjs', 'angular-ssr'])).toBe(true);
    expect(shouldCheckAngularSsr(['nestjs', 'next-js'])).toBe(false);
  });
});

