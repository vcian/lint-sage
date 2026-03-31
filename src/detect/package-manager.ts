import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import type { PackageManagerInfo, PackageManagerName } from '../types.js';

export function detectPackageManager(projectDir: string): PackageManagerInfo {
  let name: PackageManagerName = 'npm';

  if (existsSync(join(projectDir, 'pnpm-lock.yaml'))) {
    name = 'pnpm';
  } else if (existsSync(join(projectDir, 'yarn.lock'))) {
    name = 'yarn';
  }

  let version = 'unknown';
  try {
    version = execSync(`${name} --version`, { encoding: 'utf-8' }).trim();
  } catch {
    // Fallback — version detection failed but tool exists
  }

  return { name, version };
}
