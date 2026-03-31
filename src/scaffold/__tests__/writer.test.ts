import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock @inquirer/prompts
vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
}));

const { confirm } = await import('@inquirer/prompts');
const { writeConfigFiles } = await import('../writer.js');

function createTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'lint-sage-writer-'));
}

function createTemplateDir(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'lint-sage-tpl-'));
  const tplPath = join(dir, 'template.txt');
  writeFileSync(tplPath, content);
  return tplPath;
}

describe('writeConfigFiles', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(confirm).mockReset();
  });

  it('creates a new file when target does not exist', async () => {
    const projectDir = createTempProject();
    const templatePath = createTemplateDir('new config content');

    await writeConfigFiles(
      [{ templatePath, targetPath: 'config.txt' }],
      [],
      projectDir,
    );

    const result = readFileSync(join(projectDir, 'config.txt'), 'utf-8');
    expect(result).toBe('new config content');
  });

  it('creates parent directories if needed', async () => {
    const projectDir = createTempProject();
    const templatePath = createTemplateDir('nested content');

    await writeConfigFiles(
      [{ templatePath, targetPath: '.husky/pre-commit' }],
      [],
      projectDir,
    );

    expect(existsSync(join(projectDir, '.husky'))).toBe(true);
    const result = readFileSync(join(projectDir, '.husky', 'pre-commit'), 'utf-8');
    expect(result).toBe('nested content');
  });

  it('overwrites file when user confirms', async () => {
    const projectDir = createTempProject();
    writeFileSync(join(projectDir, 'config.txt'), 'old content');
    const templatePath = createTemplateDir('new content');

    vi.mocked(confirm).mockResolvedValueOnce(true);

    await writeConfigFiles(
      [{ templatePath, targetPath: 'config.txt' }],
      ['config.txt'],
      projectDir,
    );

    const result = readFileSync(join(projectDir, 'config.txt'), 'utf-8');
    expect(result).toBe('new content');
    expect(confirm).toHaveBeenCalled();
  });

  it('skips file when user declines overwrite', async () => {
    const projectDir = createTempProject();
    writeFileSync(join(projectDir, 'config.txt'), 'old content');
    const templatePath = createTemplateDir('new content');

    vi.mocked(confirm).mockResolvedValueOnce(false);

    await writeConfigFiles(
      [{ templatePath, targetPath: 'config.txt' }],
      ['config.txt'],
      projectDir,
    );

    const result = readFileSync(join(projectDir, 'config.txt'), 'utf-8');
    expect(result).toBe('old content');
  });

  it('skips file without prompt when content is already up to date', async () => {
    const projectDir = createTempProject();
    writeFileSync(join(projectDir, 'config.txt'), 'same content');
    const templatePath = createTemplateDir('same content');

    await writeConfigFiles(
      [{ templatePath, targetPath: 'config.txt' }],
      ['config.txt'],
      projectDir,
    );

    expect(confirm).not.toHaveBeenCalled();
  });

  it('processes multiple config files in sequence', async () => {
    const projectDir = createTempProject();
    const tpl1 = createTemplateDir('content A');
    const tpl2 = createTemplateDir('content B');

    await writeConfigFiles(
      [
        { templatePath: tpl1, targetPath: 'a.txt' },
        { templatePath: tpl2, targetPath: 'nested/b.txt' },
      ],
      [],
      projectDir,
    );

    expect(readFileSync(join(projectDir, 'a.txt'), 'utf-8')).toBe('content A');
    expect(readFileSync(join(projectDir, 'nested', 'b.txt'), 'utf-8')).toBe('content B');
  });
});
