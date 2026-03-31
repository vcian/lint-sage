import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FrameworkId, PackageJson } from '../types.js';

function detectIndent(content: string): string {
  const match = content.match(/^(\s+)"/m);
  return match?.[1] ?? '  ';
}

function getLintStagedConfig(
  framework: FrameworkId | null,
): Record<string, string | string[]> {
  const config: Record<string, string | string[]> = {};

  // TypeScript/JavaScript files — lint + format
  config['*.{ts,tsx,js,jsx}'] = [
    'eslint --fix',
    'prettier --write',
  ];

  // Style files (for React/Angular frameworks)
  if (
    framework === 'vite-react-ts' ||
    framework === 'next-js' ||
    framework === 'tanstack-react-start' ||
    framework === 'angular-standalone' ||
    framework === 'angular-ssr'
  ) {
    config['*.{css,scss,less}'] = ['prettier --write'];
  }

  // HTML files (for Angular)
  if (framework === 'angular-standalone' || framework === 'angular-ssr') {
    config['*.html'] = ['prettier --write'];
  }

  // JSON/MD files
  config['*.{json,md}'] = ['prettier --write'];

  return config;
}

export function patchPackageJson(
  projectDir: string,
  scriptsToAdd: Record<string, string>,
  framework: FrameworkId | null,
): void {
  const pkgPath = join(projectDir, 'package.json');
  const raw = readFileSync(pkgPath, 'utf-8');
  const indent = detectIndent(raw);
  const pkg: PackageJson = JSON.parse(raw);

  // Merge scripts — skip existing keys
  if (!pkg.scripts) {
    pkg.scripts = {};
  }
  let scriptsAdded = 0;
  for (const [name, command] of Object.entries(scriptsToAdd)) {
    if (!pkg.scripts[name]) {
      pkg.scripts[name] = command;
      scriptsAdded++;
    }
  }

  // Add lint-staged config
  let lintStagedAdded = false;
  if (!pkg['lint-staged']) {
    pkg['lint-staged'] = getLintStagedConfig(framework);
    lintStagedAdded = true;
  }

  writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + '\n');

  if (scriptsAdded > 0) {
    console.log(`  Added ${scriptsAdded} script(s) to package.json`);
  }
  if (lintStagedAdded) {
    console.log('  Added lint-staged config to package.json');
  }
  if (scriptsAdded === 0 && !lintStagedAdded) {
    console.log('  package.json already up to date');
  }
}
