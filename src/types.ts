export type PackageManager = 'npm' | 'pnpm' | 'yarn';
export type Stack = 'react' | 'node' | 'angular';
export type ReactVariant = 'vite-react-ts' | '@tanstack/react-start' | 'next-js';
export type NodeVariant = 'express' | 'fastify' | 'nestjs' | 'plain-ts';
export type AngularVariant = 'angular-standalone' | 'angular-ssr';
export type Variant = ReactVariant | NodeVariant | AngularVariant;

export interface GlobalOptions {
  force?: boolean;
  preset?: string;
  dryRun?: boolean;
  verbose?: boolean;
  packageManager?: PackageManager;
  monorepo?: boolean;
  fix?: boolean;
}

export interface WriteConfigsOptions {
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
  packageManager?: PackageManager;
}

export interface WriteConfigsInput extends WriteConfigsOptions {
  targetDirectory: string;
  stack: Stack;
  variant: Variant;
}

export interface WriteConfigsResult {
  writtenFiles: string[];
}

export interface UpdatePackageOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

export interface UpdatePackageInput extends UpdatePackageOptions {
  targetDirectory: string;
  stack: Stack;
  variant: Variant;
}

export interface UpdatePackageResult {
  addedDependencies: string[];
  addedScripts: string[];
  updatedDependencies: string[];
  addedOverrides: string[];
  updatedOverrides: DepVersionChange[];
  updatedScripts: string[];
  wroteFile: boolean;
}

export interface DetectedConfigFile {
  path: string;
  type: 'managed' | 'legacy';
}

export interface ManagedFileRecord {
  template: string;
  lastAppliedHash: string;
}

export interface LintSageState {
  schemaVersion: 1;
  version: string;
  packageManager: PackageManager;
  stack: Stack;
  variant: Variant;
  managedFiles: Record<string, ManagedFileRecord>;
  addedDependencies: string[];
  addedScripts: string[];
  initializedAt: string;
  lastUpdatedAt: string;
}

export type FileDiffStatus = 'auto-replace' | 'keep' | 'conflict' | 'no-change';

export interface FileDiffResult {
  filePath: string;
  status: FileDiffStatus;
  currentHash: string | null;
  lastAppliedHash: string;
  templateHash: string;
}

export interface DiffResult {
  files: FileDiffResult[];
}

export interface DepVersionChange {
  name: string;
  oldVersion: string;
  newVersion: string;
}

export interface UpdatePackageForUpdateResult {
  addedDependencies: string[];
  addedScripts: string[];
  updatedDependencies: DepVersionChange[];
  addedOverrides: string[];
  updatedOverrides: DepVersionChange[];
  updatedScripts: string[];
  wroteFile: boolean;
}

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
  fixable?: boolean;
}

export interface HealthCheckResults {
  checks: CheckResult[];
}

export type MonorepoTool =
  | 'turborepo'
  | 'nx'
  | 'npm-workspaces'
  | 'yarn-workspaces'
  | 'pnpm-workspaces'
  | 'lerna';

export interface MonorepoDetectionResult {
  tool: MonorepoTool;
  indicator: string;
}

export interface MonorepoPackageConfig {
  path: string;
  stack: Stack;
  variant: Variant;
  managedFiles: Record<string, ManagedFileRecord>;
}

export interface LintSageMonorepoState {
  schemaVersion: 1;
  version: string;
  packageManager: PackageManager;
  monorepo: true;
  monorepoTool: MonorepoTool;
  managedFiles: Record<string, ManagedFileRecord>;
  packages: Record<string, MonorepoPackageConfig>;
  addedDependencies: string[];
  addedScripts: string[];
  initializedAt: string;
  lastUpdatedAt: string;
}

export type AnyLintSageState = LintSageState | LintSageMonorepoState;
