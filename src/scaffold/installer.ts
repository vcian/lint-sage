import { execSync } from 'node:child_process';
import type { DependencyToInstall, PackageManagerName } from '../types.js';

function buildInstallCommand(
  packageManager: PackageManagerName,
  deps: DependencyToInstall[],
): string {
  const packages = deps.map((d) => `${d.name}@${d.version}`).join(' ');

  switch (packageManager) {
    case 'npm':
      return `npm install -D ${packages}`;
    case 'yarn':
      return `yarn add -D ${packages}`;
    case 'pnpm':
      return `pnpm add -D ${packages}`;
  }
}

export function installDependencies(
  packageManager: PackageManagerName,
  deps: DependencyToInstall[],
  projectDir: string,
): void {
  if (deps.length === 0) {
    console.log('  No dependencies to install.');
    return;
  }

  const command = buildInstallCommand(packageManager, deps);
  console.log(`\n📦 Installing dependencies...\n  $ ${command}\n`);

  try {
    execSync(command, {
      cwd: projectDir,
      stdio: 'inherit',
    });
  } catch {
    throw new Error(
      'Dependency installation failed.\n' +
        'Please check your network connection and try again.',
    );
  }
}
