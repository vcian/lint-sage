import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  DiffResult,
  FileDiffResult,
  FileDiffStatus,
  LintSageState,
  ManagedFileRecord,
} from '../types.js';
import { readTemplateFile, renderCiWorkflow } from './template-loader.js';

function hashContent(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

async function readProjectFile(targetDirectory: string, filePath: string): Promise<string | null> {
  try {
    return await readFile(path.join(targetDirectory, filePath), 'utf8');
  } catch {
    return null;
  }
}

function classifyFile(
  currentHash: string | null,
  lastAppliedHash: string,
  templateHash: string,
): FileDiffStatus {
  if (currentHash === null) {
    return 'auto-replace';
  }

  const currentMatchesApplied = currentHash === lastAppliedHash;
  const templateMatchesApplied = templateHash === lastAppliedHash;

  if (currentMatchesApplied && templateMatchesApplied) {
    return 'no-change';
  }

  if (currentMatchesApplied && !templateMatchesApplied) {
    return 'auto-replace';
  }

  if (!currentMatchesApplied && templateMatchesApplied) {
    return 'keep';
  }

  return 'conflict';
}

async function getTemplateContent(
  state: LintSageState,
  filePath: string,
  record: ManagedFileRecord,
): Promise<string> {
  if (record.template === 'ci/lint.yml.template') {
    return renderCiWorkflow(state.packageManager);
  }

  return readTemplateFile(state.stack, state.variant, filePath);
}

export async function computeDiff(
  targetDirectory: string,
  state: LintSageState,
): Promise<DiffResult> {
  const files: FileDiffResult[] = [];

  for (const [filePath, record] of Object.entries(state.managedFiles)) {
    const projectContent = await readProjectFile(targetDirectory, filePath);
    const currentHash = projectContent !== null ? hashContent(projectContent) : null;
    const templateContent = await getTemplateContent(state, filePath, record);
    const templateHash = hashContent(templateContent);

    files.push({
      filePath,
      status: classifyFile(currentHash, record.lastAppliedHash, templateHash),
      currentHash,
      lastAppliedHash: record.lastAppliedHash,
      templateHash,
    });
  }

  return { files };
}
