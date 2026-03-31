import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FrameworkId, PackageJson } from '../types.js';

function hasDep(pkg: PackageJson, name: string): boolean {
  return !!(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
}

export function detectFramework(projectDir: string): FrameworkId | null {
  const pkgPath = join(projectDir, 'package.json');
  let pkg: PackageJson;

  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    throw new Error(
      'No package.json found in the current directory.\n' +
        'Please run this command from the root of your project.',
    );
  }

  // Order matters — more specific frameworks first

  // Angular SSR (must check before angular-standalone)
  if (hasDep(pkg, '@angular/core') && hasDep(pkg, '@angular/ssr')) {
    return 'angular-ssr';
  }

  // Angular standalone
  if (hasDep(pkg, '@angular/core')) {
    return 'angular-standalone';
  }

  // NestJS
  if (hasDep(pkg, '@nestjs/core')) {
    return 'nestjs';
  }

  // Next.js
  if (hasDep(pkg, 'next')) {
    return 'next-js';
  }

  // TanStack React Start
  if (hasDep(pkg, '@tanstack/react-start')) {
    return 'tanstack-react-start';
  }

  // Vite + React + TypeScript
  if (hasDep(pkg, 'vite') && hasDep(pkg, 'react') && hasDep(pkg, 'typescript')) {
    return 'vite-react-ts';
  }

  // Fastify
  if (hasDep(pkg, 'fastify')) {
    return 'fastify';
  }

  // Express (only if no frontend framework detected)
  if (hasDep(pkg, 'express')) {
    return 'express';
  }

  return null;
}
