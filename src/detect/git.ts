import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function detectGit(projectDir: string): boolean {
  const hasGit = existsSync(join(projectDir, '.git'));

  if (!hasGit) {
    console.error(
      '\n❌ No .git directory found.\n' +
        '   Lint Sage requires a Git repository (Husky needs git hooks).\n' +
        '   Please run `git init` first.\n',
    );
    process.exit(1);
  }

  return true;
}
