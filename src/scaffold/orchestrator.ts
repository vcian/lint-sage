import { unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import type { EnvironmentState, ActionPlan, PackageManagerName } from '../types.js';
import { installDependencies } from './installer.js';
import { patchPackageJson } from './patch-package.js';
import { writeConfigFiles } from './writer.js';

export async function scaffold(
  env: EnvironmentState,
  plan: ActionPlan,
  projectDir: string,
  options?: { yes?: boolean },
): Promise<void> {
  // Step 1: Install dependencies (must be first — Husky needs to be installed before hook config)
  installDependencies(env.packageManager.name, plan.depsToInstall, projectDir);

  // Step 2: Patch package.json with scripts + lint-staged config
  console.log('\n📝 Patching package.json...');
  patchPackageJson(projectDir, plan.scriptsToAdd, env.framework);

  // Step 3: Remove conflicting config files
  if (plan.filesToRemove.length > 0) {
    for (const file of plan.filesToRemove) {
      const fullPath = join(projectDir, file);
      try {
        unlinkSync(fullPath);
        console.log(`  🗑 Removed conflicting config: ${file}`);
      } catch {
        // File may not exist from projectDir context — ignore
      }
    }
  }

  // Step 4: Write config files from templates
  console.log('\n📄 Writing config files...');
  await writeConfigFiles(plan.configsToWrite, plan.existingFileOverwrites, projectDir, options);

  // Step 5: Initialize Husky
  console.log('\n🔧 Initializing Husky...');
  const huskyCmd = getExecCommand(env.packageManager.name, 'husky');
  try {
    execSync(huskyCmd, { cwd: projectDir, stdio: 'inherit' });
  } catch {
    console.log('  ⚠ Husky initialization failed — you may need to run `npx husky` manually.');
  }

  // Summary
  console.log('\n📋 Summary');
  console.log('─'.repeat(40));
  if (plan.depsToInstall.length > 0) {
    console.log(`  Installed ${plan.depsToInstall.length} dependencies`);
  }
  console.log(`  Wrote ${plan.configsToWrite.length} config files`);
  console.log(`  Added scripts: ${Object.keys(plan.scriptsToAdd).join(', ')}`);
}

function getExecCommand(packageManager: PackageManagerName, binary: string): string {
  switch (packageManager) {
    case 'npm':
      return `npx ${binary}`;
    case 'yarn':
      return `yarn dlx ${binary}`;
    case 'pnpm':
      return `pnpm exec ${binary}`;
  }
}
