import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import type {
  EnvironmentState,
  ActionPlan,
  DependencyToInstall,
  ConfigToWrite,
  FrameworkId,
} from '../types.js';
import { getEslintMajorVersion } from '../detect/existing-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', '..', 'templates');

// Latest compatible versions for missing tools
const TOOL_VERSIONS: Record<string, string> = {
  eslint: '^9',
  prettier: '^3',
  husky: '^9',
  'lint-staged': '^15',
  '@commitlint/cli': '^19',
  '@commitlint/config-conventional': '^19',
};

// ESLint plugins/configs per framework
const ESLINT_DEPS: Record<string, DependencyToInstall[]> = {
  'vite-react-ts': [
    { name: '@eslint/js', version: '^9' },
    { name: 'typescript-eslint', version: '^8' },
    { name: 'eslint-plugin-react', version: '^7' },
    { name: 'eslint-plugin-react-hooks', version: '^5' },
    { name: 'eslint-plugin-react-refresh', version: '^0.4' },
    { name: 'globals', version: '^16' },
  ],
  'next-js': [
    { name: '@eslint/js', version: '^9' },
    { name: 'typescript-eslint', version: '^8' },
    { name: 'eslint-config-next', version: '^15' },
    { name: 'globals', version: '^16' },
  ],
  express: [
    { name: '@eslint/js', version: '^9' },
    { name: 'typescript-eslint', version: '^8' },
    { name: 'globals', version: '^16' },
  ],
  'angular-standalone': [
    { name: '@eslint/js', version: '^9' },
    { name: 'typescript-eslint', version: '^8' },
    { name: 'angular-eslint', version: '^19' },
    { name: 'globals', version: '^16' },
  ],
  'tanstack-react-start': [
    { name: '@eslint/js', version: '^9' },
    { name: 'typescript-eslint', version: '^8' },
    { name: 'eslint-plugin-react', version: '^7' },
    { name: 'eslint-plugin-react-hooks', version: '^5' },
    { name: 'eslint-plugin-react-refresh', version: '^0.4' },
    { name: 'globals', version: '^16' },
  ],
  fastify: [
    { name: '@eslint/js', version: '^9' },
    { name: 'typescript-eslint', version: '^8' },
    { name: 'globals', version: '^16' },
  ],
  nestjs: [
    { name: '@eslint/js', version: '^9' },
    { name: 'typescript-eslint', version: '^8' },
    { name: 'globals', version: '^16' },
  ],
  'angular-ssr': [
    { name: '@eslint/js', version: '^9' },
    { name: 'typescript-eslint', version: '^8' },
    { name: 'angular-eslint', version: '^19' },
    { name: 'globals', version: '^16' },
  ],
};

// Framework category mapping for template paths
function getFrameworkCategory(framework: FrameworkId): string {
  switch (framework) {
    case 'vite-react-ts':
    case 'next-js':
    case 'tanstack-react-start':
      return 'react';
    case 'express':
    case 'fastify':
    case 'nestjs':
      return 'node';
    case 'angular-standalone':
    case 'angular-ssr':
      return 'angular';
  }
}

// ESLint config files that may conflict when we write our own
const ESLINT_CONFIG_FILES = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml',
];

export function resolveActionPlan(env: EnvironmentState, projectDir: string): ActionPlan {
  const depsToInstall: DependencyToInstall[] = [];
  const configsToWrite: ConfigToWrite[] = [];
  const scriptsToAdd: Record<string, string> = {};
  const existingFileOverwrites: string[] = [];
  const filesToRemove: string[] = [];

  const eslintMajor = getEslintMajorVersion(env.tools);
  const useFlatConfig = eslintMajor === null || eslintMajor >= 9;

  // --- Resolve dependencies ---

  // ESLint
  const eslint = env.tools.get('eslint');
  if (!eslint?.installed) {
    depsToInstall.push({ name: 'eslint', version: TOOL_VERSIONS.eslint });
  }

  // ESLint plugins for the detected framework
  if (env.framework && ESLINT_DEPS[env.framework]) {
    for (const dep of ESLINT_DEPS[env.framework]) {
      depsToInstall.push(dep);
    }
  }

  // Prettier
  const prettier = env.tools.get('prettier');
  if (!prettier?.installed) {
    depsToInstall.push({ name: 'prettier', version: TOOL_VERSIONS.prettier });
  }

  // Husky
  const husky = env.tools.get('husky');
  if (!husky?.installed) {
    depsToInstall.push({ name: 'husky', version: TOOL_VERSIONS.husky });
  }

  // lint-staged
  const lintStaged = env.tools.get('lint-staged');
  if (!lintStaged?.installed) {
    depsToInstall.push({
      name: 'lint-staged',
      version: TOOL_VERSIONS['lint-staged'],
    });
  }

  // commitlint
  const commitlint = env.tools.get('commitlint');
  if (!commitlint?.installed) {
    depsToInstall.push({
      name: '@commitlint/cli',
      version: TOOL_VERSIONS['@commitlint/cli'],
    });
    depsToInstall.push({
      name: '@commitlint/config-conventional',
      version: TOOL_VERSIONS['@commitlint/config-conventional'],
    });
  }

  // --- Resolve config files ---

  // ESLint config
  if (env.framework) {
    const category = getFrameworkCategory(env.framework);
    if (useFlatConfig) {
      configsToWrite.push({
        templatePath: join(
          TEMPLATES_DIR,
          'eslint',
          category,
          env.framework,
          'eslint.config.mjs',
        ),
        targetPath: 'eslint.config.mjs',
      });
    } else {
      configsToWrite.push({
        templatePath: join(
          TEMPLATES_DIR,
          'eslint',
          category,
          env.framework,
          '.eslintrc.cjs',
        ),
        targetPath: '.eslintrc.cjs',
      });
    }

    // Mark conflicting ESLint config files for removal
    const ourTarget = useFlatConfig ? 'eslint.config.mjs' : '.eslintrc.cjs';
    for (const configFile of ESLINT_CONFIG_FILES) {
      if (configFile !== ourTarget && existsSync(join(projectDir, configFile))) {
        filesToRemove.push(configFile);
      }
    }
  }

  // Prettier
  configsToWrite.push({
    templatePath: join(TEMPLATES_DIR, 'prettier', '.prettierrc'),
    targetPath: '.prettierrc',
  });
  configsToWrite.push({
    templatePath: join(TEMPLATES_DIR, 'prettier', '.prettierignore'),
    targetPath: '.prettierignore',
  });

  // EditorConfig
  configsToWrite.push({
    templatePath: join(TEMPLATES_DIR, 'editorconfig', '.editorconfig'),
    targetPath: '.editorconfig',
  });

  // Husky hooks
  configsToWrite.push({
    templatePath: join(TEMPLATES_DIR, 'husky', 'pre-commit'),
    targetPath: '.husky/pre-commit',
  });
  configsToWrite.push({
    templatePath: join(TEMPLATES_DIR, 'husky', 'commit-msg'),
    targetPath: '.husky/commit-msg',
  });

  // Commitlint
  configsToWrite.push({
    templatePath: join(TEMPLATES_DIR, 'commitlint', 'commitlint.config.mjs'),
    targetPath: 'commitlint.config.mjs',
  });

  // VS Code
  configsToWrite.push({
    templatePath: join(TEMPLATES_DIR, 'vscode', 'settings.json'),
    targetPath: '.vscode/settings.json',
  });
  configsToWrite.push({
    templatePath: join(TEMPLATES_DIR, 'vscode', 'extensions.json'),
    targetPath: '.vscode/extensions.json',
  });

  // GitHub Actions
  configsToWrite.push({
    templatePath: join(TEMPLATES_DIR, 'github-actions', 'lint.yml'),
    targetPath: '.github/workflows/lint.yml',
  });

  // --- Detect existing files for overwrite prompts ---
  for (const config of configsToWrite) {
    if (existsSync(join(projectDir, config.targetPath))) {
      existingFileOverwrites.push(config.targetPath);
    }
  }

  // --- Resolve scripts ---
  scriptsToAdd['lint'] = 'eslint .';
  scriptsToAdd['format:check'] = 'prettier --check .';
  scriptsToAdd['prepare'] = 'husky';

  return {
    depsToInstall,
    configsToWrite,
    scriptsToAdd,
    existingFileOverwrites,
    filesToRemove,
  };
}
