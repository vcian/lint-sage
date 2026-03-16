import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Command, CommanderError, InvalidArgumentError } from 'commander';

import { handleDoctor } from './commands/doctor.js';
import { handleEject } from './commands/eject.js';
import { handleInit } from './commands/init.js';
import { handleUpdate } from './commands/update.js';
import type { GlobalOptions, PackageManager } from './types.js';

type CommandName = 'init' | 'update' | 'doctor' | 'eject';
type CommandExecutionState = { exitCode: number };

const COMMAND_DESCRIPTIONS: Record<CommandName, string> = {
  init: 'Initialize lint-sage in a project',
  update: 'Update an existing lint-sage setup',
  doctor: 'Check the health of a lint-sage setup',
  eject: 'Remove lint-sage-managed configuration',
};

const FLAG_LABELS: Record<keyof GlobalOptions, string> = {
  force: '--force',
  preset: '--preset',
  dryRun: '--dry-run',
  verbose: '--verbose',
  packageManager: '--package-manager',
  monorepo: '--monorepo',
  fix: '--fix',
};

const VALID_FLAGS_BY_COMMAND: Record<CommandName, ReadonlySet<keyof GlobalOptions>> = {
  init: new Set(['force', 'preset', 'dryRun', 'verbose', 'packageManager', 'monorepo']),
  update: new Set(['dryRun', 'verbose', 'packageManager']),
  doctor: new Set(['verbose', 'fix']),
  eject: new Set(['force', 'dryRun', 'verbose', 'packageManager']),
};

function readPackageMetadata(): { description: string; version: string } {
  const rawPackageJson = readFileSync(new URL('../package.json', import.meta.url), 'utf8');

  return JSON.parse(rawPackageJson) as { description: string; version: string };
}

function parsePackageManager(value: string): PackageManager {
  if (value === 'npm' || value === 'pnpm' || value === 'yarn') {
    return value;
  }

  throw new InvalidArgumentError('Expected one of "npm", "pnpm", or "yarn".');
}

function addCommonOptions(command: Command): Command {
  return command
    .option('--force', 'Skip confirmation prompts')
    .option('--preset <value>', 'Use a preset instead of interactive prompts')
    .option('--dry-run', 'Show what would change without writing files')
    .option('--verbose', 'Print detailed output for each step')
    .option(
      '--package-manager <value>',
      'Override package manager detection (npm, pnpm, yarn)',
      parsePackageManager,
    )
    .option('--monorepo', 'Force monorepo mode')
    .option('--fix', 'Attempt to auto-fix issues found by doctor');
}

function findInvalidFlags(commandName: CommandName, options: GlobalOptions): string[] {
  const validFlags = VALID_FLAGS_BY_COMMAND[commandName];

  return Object.entries(options)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key]) => key as keyof GlobalOptions)
    .filter((key) => !validFlags.has(key))
    .map((key) => FLAG_LABELS[key]);
}

function warnOnInvalidFlags(commandName: CommandName, options: GlobalOptions): void {
  const invalidFlags = findInvalidFlags(commandName, options);

  if (invalidFlags.length === 0) {
    return;
  }

  const formattedFlags = invalidFlags.join(', ');
  console.error(
    `Warning: ${formattedFlags} ${invalidFlags.length === 1 ? 'is' : 'are'} not supported by "${commandName}".`,
  );
}

function registerCommand(
  program: Command,
  commandName: CommandName,
  handler: (options: GlobalOptions) => Promise<number>,
  executionState: CommandExecutionState,
): void {
  addCommonOptions(
    program.command(commandName).description(COMMAND_DESCRIPTIONS[commandName]),
  ).action(async (_options, command) => {
    const resolvedOptions = (command as Command).optsWithGlobals() as GlobalOptions;

    warnOnInvalidFlags(commandName, resolvedOptions);
    executionState.exitCode = await handler(resolvedOptions);
  });
}

function buildProgram(executionState: CommandExecutionState = { exitCode: 0 }): Command {
  const { description, version } = readPackageMetadata();
  const program = addCommonOptions(new Command());

  program
    .name('lint-sage')
    .description(description)
    .version(version)
    .showHelpAfterError()
    .exitOverride();

  registerCommand(program, 'init', handleInit, executionState);
  registerCommand(program, 'update', handleUpdate, executionState);
  registerCommand(program, 'doctor', handleDoctor, executionState);
  registerCommand(program, 'eject', handleEject, executionState);

  return program;
}

export function createProgram(): Command {
  return buildProgram();
}

export async function run(argv: string[] = process.argv): Promise<number> {
  try {
    const executionState: CommandExecutionState = { exitCode: 0 };
    const program = buildProgram(executionState);
    await program.parseAsync(argv);
    return executionState.exitCode;
  } catch (error) {
    if (error instanceof InvalidArgumentError) {
      console.error(error.message);
      return 1;
    }

    if (error instanceof CommanderError) {
      return error.exitCode;
    }

    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unexpected error occurred.');
    }

    return 1;
  }
}

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];

  if (!entryPoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPoint).href;
}

if (isDirectExecution()) {
  void run(process.argv).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
