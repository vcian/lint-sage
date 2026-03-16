import { select, confirm } from '@inquirer/prompts';

import type { DetectedConfigFile, Stack, Variant } from '../types.js';

const variantOptionsByStack: Record<Stack, { name: string; value: Variant }[]> = {
  react: [
    { name: 'vite-react-ts', value: 'vite-react-ts' },
    { name: '@tanstack/react-start', value: '@tanstack/react-start' },
    { name: 'next-js', value: 'next-js' },
  ],
  node: [
    { name: 'express', value: 'express' },
    { name: 'fastify', value: 'fastify' },
    { name: 'nestjs', value: 'nestjs' },
    { name: 'plain-ts', value: 'plain-ts' },
  ],
  angular: [
    { name: 'angular-standalone', value: 'angular-standalone' },
    { name: 'angular-ssr', value: 'angular-ssr' },
  ],
};

const stackNameByValue: Record<Stack, string> = {
  react: 'React',
  node: 'Node',
  angular: 'Angular',
};

export function resolvePreset(preset: string): { stack: Stack; variant: Variant } | null {
  for (const stack of Object.keys(variantOptionsByStack) as Stack[]) {
    const variant = variantOptionsByStack[stack].find((option) => option.value === preset)?.value;

    if (variant) {
      return { stack, variant };
    }
  }

  return null;
}

export function resolveVariantToStack(variant: string): Stack | null {
  for (const stack of Object.keys(variantOptionsByStack) as Stack[]) {
    if (variantOptionsByStack[stack].some((option) => option.value === variant)) {
      return stack;
    }
  }

  return null;
}

export async function promptForStack(): Promise<Stack> {
  return select({
    message: 'Select your stack:',
    choices: [
      { name: 'React', value: 'react' },
      { name: 'Node', value: 'node' },
      { name: 'Angular', value: 'angular' },
    ],
  });
}

export async function promptForVariant(stack: Stack): Promise<Variant> {
  return select({
    message: `Select your ${stackNameByValue[stack]} variant:`,
    choices: variantOptionsByStack[stack],
  });
}

export async function confirmOverwrite(detectedFiles: DetectedConfigFile[]): Promise<boolean> {
  console.error('⚠ Existing config files detected:');

  for (const detectedFile of detectedFiles) {
    console.error(`  - ${detectedFile.path}`);
  }

  return confirm({
    message: 'Overwrite existing config files?',
    default: false,
  });
}

export async function confirmPackageJsonOverwrite(input: {
  updatedDependencies: string[];
  updatedScripts: string[];
}): Promise<boolean> {
  console.error('⚠ Existing package.json entries would be overwritten:');

  for (const dependencyName of input.updatedDependencies) {
    console.error(`  - devDependency: ${dependencyName}`);
  }

  for (const scriptName of input.updatedScripts) {
    console.error(`  - script: ${scriptName}`);
  }

  return confirm({
    message: 'Overwrite existing package.json entries?',
    default: false,
  });
}
