export type PackageManagerName = 'npm' | 'yarn' | 'pnpm';

export type FrameworkId =
  | 'vite-react-ts'
  | 'next-js'
  | 'express'
  | 'angular-standalone'
  | 'tanstack-react-start'
  | 'fastify'
  | 'nestjs'
  | 'angular-ssr';

export type ToolName =
  | 'eslint'
  | 'prettier'
  | 'husky'
  | 'lint-staged'
  | 'commitlint';

export interface NodeVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface PackageManagerInfo {
  name: PackageManagerName;
  version: string;
}

export interface ToolInfo {
  installed: boolean;
  version: string | null;
}

export interface EnvironmentState {
  node: NodeVersion;
  packageManager: PackageManagerInfo;
  framework: FrameworkId | null;
  tools: Map<ToolName, ToolInfo>;
  git: boolean;
}

export interface DependencyToInstall {
  name: string;
  version: string;
}

export interface ConfigToWrite {
  templatePath: string;
  targetPath: string;
}

export interface ActionPlan {
  depsToInstall: DependencyToInstall[];
  configsToWrite: ConfigToWrite[];
  scriptsToAdd: Record<string, string>;
  existingFileOverwrites: string[];
  filesToRemove: string[];
}

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  'lint-staged'?: Record<string, string | string[]>;
  version?: string;
  [key: string]: unknown;
}
