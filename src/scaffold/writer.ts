import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { confirm } from '@inquirer/prompts';
import type { ConfigToWrite } from '../types.js';

export async function writeConfigFiles(
  configs: ConfigToWrite[],
  existingFileOverwrites: string[],
  projectDir: string,
  options?: { yes?: boolean },
): Promise<void> {
  for (const config of configs) {
    const targetPath = join(projectDir, config.targetPath);
    const targetDir = dirname(targetPath);

    // Ensure parent directory exists
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const isOverwrite = existingFileOverwrites.includes(config.targetPath);

    if (isOverwrite) {
      const existing = readFileSync(targetPath, 'utf-8');
      const template = readFileSync(config.templatePath, 'utf-8');

      if (existing === template) {
        console.log(`  ✓ ${config.targetPath} (already up to date)`);
        continue;
      }

      console.log(`\n  ⚠ ${config.targetPath} already exists and differs.`);
      let shouldOverwrite = false;
      if (options?.yes) {
        shouldOverwrite = true;
        console.log(`  Overwriting ${config.targetPath} (--yes)`);
      } else {
        shouldOverwrite = await confirm({
          message: `  Overwrite ${config.targetPath}?`,
          default: false,
        });
      }

      if (!shouldOverwrite) {
        console.log(`  ⏭ Skipped ${config.targetPath}`);
        continue;
      }

      writeFileSync(targetPath, template);
      console.log(`  ✓ ${config.targetPath}`);
      continue;
    }

    const content = readFileSync(config.templatePath, 'utf-8');
    writeFileSync(targetPath, content);
    console.log(`  ✓ ${config.targetPath}`);
  }
}
