#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { select } from '@inquirer/prompts';
import { detectEnvironment } from './detect/index.js';
import { resolveActionPlan } from './resolve/index.js';
import { displayReport, confirmProceed } from './report.js';
import { scaffold } from './scaffold/index.js';
import type { FrameworkId } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
);

const program = new Command();

program
  .name('lint-sage')
  .description(
    'Bootstrap linting, formatting, and code quality infrastructure for TypeScript projects',
  )
  .version(pkg.version);

program
  .command('init')
  .description('Detect environment and scaffold linting/formatting configs')
  .option('-y, --yes', 'Skip confirmation prompts (accept all defaults)')
  .action(async (options: { yes?: boolean }) => {
    try {
      // Stage 1: Detect
      const environment = await detectEnvironment(process.cwd());

      // Stage 1.5: If no framework detected, prompt user to select or abort
      if (environment.framework === null) {
        console.log('\n⚠ No recognized framework detected in package.json.');
        const choice = await select<FrameworkId | 'abort'>({
          message: 'Select a framework to configure, or abort:',
          choices: [
            { name: 'Vite + React + TypeScript', value: 'vite-react-ts' as const },
            { name: 'Next.js', value: 'next-js' as const },
            { name: 'Express', value: 'express' as const },
            { name: 'Angular (standalone)', value: 'angular-standalone' as const },
            { name: 'Abort — exit without changes', value: 'abort' as const },
          ],
        });

        if (choice === 'abort') {
          console.log('\nAborted. No changes were made.');
          process.exit(0);
        }

        environment.framework = choice;
      }

      // Stage 2: Resolve
      const actionPlan = resolveActionPlan(environment, process.cwd());

      // Stage 3: Report + Confirm
      displayReport(environment, actionPlan);
      if (!options.yes) {
        const confirmed = await confirmProceed();
        if (!confirmed) {
          console.log('\nAborted. No changes were made.');
          process.exit(0);
        }
      }

      // Stage 4: Scaffold
      await scaffold(environment, actionPlan, process.cwd(), { yes: options.yes });

      console.log('\n✅ Lint Sage setup complete!');
    } catch (error) {
      // @inquirer/prompts throws ExitPromptError on Ctrl+C
      if (
        error instanceof Error &&
        error.name === 'ExitPromptError'
      ) {
        console.log('\n\nAborted. No changes were made.');
        process.exit(0);
      }
      if (error instanceof Error) {
        console.error(`\n❌ ${error.message}`);
      } else {
        console.error('\n❌ An unexpected error occurred.');
      }
      process.exit(1);
    }
  });

program.parse();
