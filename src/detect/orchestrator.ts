import type { EnvironmentState } from '../types.js';
import { detectNodeVersion } from './node.js';
import { detectGit } from './git.js';
import { detectPackageManager } from './package-manager.js';
import { detectFramework } from './framework.js';
import { detectExistingTools } from './existing-tools.js';

export async function detectEnvironment(
  projectDir: string,
): Promise<EnvironmentState> {
  // Abort-early checks first
  const git = detectGit(projectDir);
  const node = detectNodeVersion();

  // Remaining detection
  const packageManager = detectPackageManager(projectDir);
  const framework = detectFramework(projectDir);
  const tools = detectExistingTools(projectDir);

  return {
    node,
    packageManager,
    framework,
    tools,
    git,
  };
}
