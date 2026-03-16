import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { WriteConfigsInput, WriteConfigsResult } from '../types.js';
import { listVariantTemplateFiles, readTemplateFile, renderCiWorkflow } from './template-loader.js';

const executableTemplateFiles = new Set(['.husky/commit-msg', '.husky/pre-commit']);
const skippedTemplateFiles = new Set(['README.md', 'dependencies.json']);

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep);
}

export async function writeConfigs(input: WriteConfigsInput): Promise<WriteConfigsResult> {
  const {
    dryRun = false,
    packageManager = 'npm',
    stack,
    targetDirectory,
    variant,
    verbose = false,
  } = input;
  const templateFiles = await listVariantTemplateFiles(stack, variant);
  const writtenFiles: string[] = [];

  for (const relativeTemplatePath of templateFiles) {
    if (skippedTemplateFiles.has(relativeTemplatePath)) {
      continue;
    }

    const renderedContent = await readTemplateFile(stack, variant, relativeTemplatePath);
    const targetFilePath = path.join(targetDirectory, relativeTemplatePath);
    const displayPath = toPosixPath(relativeTemplatePath);

    writtenFiles.push(displayPath);

    if (dryRun) {
      console.log(`[dry-run] Would create ${displayPath}`);
      continue;
    }

    await mkdir(path.dirname(targetFilePath), { recursive: true });
    await writeFile(targetFilePath, renderedContent, 'utf8');

    if (executableTemplateFiles.has(displayPath)) {
      await chmod(targetFilePath, 0o755);
    }

    if (verbose) {
      console.log(`Created ${targetFilePath}`);
    }
  }

  const ciWorkflowPath = path.join(targetDirectory, '.github', 'workflows', 'lint.yml');
  const ciDisplayPath = '.github/workflows/lint.yml';
  writtenFiles.push(ciDisplayPath);

  if (dryRun) {
    console.log(`[dry-run] Would create ${ciDisplayPath}`);
  } else {
    await mkdir(path.dirname(ciWorkflowPath), { recursive: true });
    await writeFile(ciWorkflowPath, await renderCiWorkflow(packageManager), 'utf8');

    if (verbose) {
      console.log(`Created ${ciWorkflowPath}`);
    }
  }

  return { writtenFiles };
}
