# AGENTS.md

## Project Overview

Lint Sage is a CLI tool that bootstraps linting, formatting, and code quality infrastructure for ViitorCloud TypeScript projects. It follows a **copy-paste, not dependency** model — config files are scaffolded directly into the user's project with full ownership.

Published as `@vcian/lint-sage` on npm. Primary command: `npx @vcian/lint-sage@latest init`. The `@latest` tag ensures users always get the newest templates and rules.

## Architecture

```
src/
├── cli.ts                  # Entry point (commander + inquirer)
├── types.ts                # Shared types: EnvironmentState, ActionPlan, FrameworkId
├── detect/                 # Pre-flight environment detection (read-only)
│   ├── index.ts            # Detect orchestrator — runs all modules, returns EnvironmentState
│   ├── node.ts             # Node version detection (minimum: 18)
│   ├── package-manager.ts  # npm / yarn / pnpm detection via lock files
│   ├── framework.ts        # Framework detection from package.json dependencies
│   ├── existing-tools.ts   # Installed versions of eslint, prettier, husky, etc.
│   └── git.ts              # .git directory check (required — abort if missing)
├── resolve/
│   └── compatibility.ts    # Decide: configure only vs install + configure → produces ActionPlan
├── scaffold/
│   ├── index.ts            # Scaffold orchestrator — runs installer → patch-package → writer
│   ├── installer.ts        # Install missing deps via detected package manager
│   ├── writer.ts           # File writer with diff display and overwrite confirmation
│   └── patch-package.ts    # Add scripts + lint-staged config to package.json
└── templates/              # Framework-specific static config templates (no templating engine)
    ├── eslint/
    │   ├── react/           # vite-react-ts, @tanstack/react-start, next-js
    │   ├── node/            # express, fastify, nestjs
    │   └── angular/         # angular-standalone, angular-ssr
    ├── prettier/
    ├── editorconfig/
    ├── husky/
    ├── commitlint/
    ├── vscode/
    └── github-actions/
```

## Core Execution Flow

The CLI has a single command (`init`) and no subcommands. The pipeline is strictly sequential:

1. **Detect** — Read environment (read-only, no side effects):
   - Git check + Node version check run first (abort-early on failure)
   - Package manager, framework, and existing tools detection
   - Returns `EnvironmentState`
2. **Resolve** — Transform `EnvironmentState` into an `ActionPlan`:
   - Determine what to install vs configure (respect existing tools)
   - Resolve template paths based on framework + tool version
   - Detect existing config files and flag for overwrite prompt
   - Returns `ActionPlan` with: `depsToInstall`, `configsToWrite`, `scriptsToAdd`, `existingFileOverwrites`
3. **Report** — Display formatted environment report, get user confirmation (`Y/n`)
   - This is the last exit point before side effects
4. **Install** — Install all missing dependencies in a single package manager command (must happen first — tools like Husky require installation before hook configuration)
5. **Scaffold** — Patch `package.json` with scripts + lint-staged config, then write config files from templates

## Supported Frameworks

### Phase 1 (MVP)
- `vite-react-ts` — Vite + React + TypeScript
- `next-js` — Next.js (extends built-in ESLint config)
- `express` — Express.js
- `angular-standalone` — Angular standalone components

### Phase 2
- `@tanstack/react-start` — TanStack Start
- `fastify` — Fastify
- `nestjs` — NestJS (decorator support, strict mode)
- `angular-ssr` — Angular with SSR

Monorepo setups (Nx, Turborepo) are not supported.

## Framework Detection Rules

| Framework | Detection Heuristic |
|-----------|-------------------|
| `vite-react-ts` | Has `vite` + `react` + `typescript` in deps |
| `next-js` | Has `next` in deps |
| `express` | Has `express` in deps, no frontend framework |
| `angular-standalone` | Has `@angular/core` in deps |
| `@tanstack/react-start` | Has `@tanstack/react-start` in deps |
| `fastify` | Has `fastify` in deps |
| `nestjs` | Has `@nestjs/core` in deps |
| `angular-ssr` | Has `@angular/core` + `@angular/ssr` in deps |

## What Gets Scaffolded

| Tool | Files |
|------|-------|
| ESLint | `eslint.config.mjs` (v9+ flat config) or `.eslintrc.*` (v8 legacy) |
| Prettier | `.prettierrc`, `.prettierignore` |
| EditorConfig | `.editorconfig` |
| Husky | `.husky/pre-commit`, `.husky/commit-msg` |
| lint-staged | Configuration in `package.json` |
| commitlint | `commitlint.config.js` (conventional commits) |
| VS Code | `.vscode/settings.json`, `.vscode/extensions.json` |
| GitHub Actions | `.github/workflows/lint.yml` |

### Scripts Added to `package.json`

| Script | Command | Purpose |
|--------|---------|---------|
| `lint` | `eslint .` | CI lint check |
| `format:check` | `prettier --check .` | CI format check |
| `prepare` | `husky` | Git hooks setup on install |

Scripts are merged — existing user scripts with the same name are never overwritten. Hands-on fixes (`eslint --fix`, `prettier --write`) are handled by lint-staged on pre-commit.

## Key Compatibility Rules

| Condition | Resolution |
|-----------|-----------|
| ESLint already installed (v9+ flat config) | Configure ViitorCloud rules via `eslint.config.mjs` |
| ESLint already installed (v8 legacy config) | Configure ViitorCloud rules via `.eslintrc.*` (legacy format) |
| ESLint not installed | Install latest compatible version + configure with flat config |
| Husky already installed | Configure hooks only — do not upgrade |
| Husky not installed | Install latest compatible version + configure hooks |
| Next.js detected | Extend built-in `eslint-config-next` (never replace) |
| Angular detected | Work with existing `@angular-eslint` setup |
| NestJS detected | Add decorator + strict mode rules |

This applies to **every tool** — Prettier, lint-staged, commitlint, etc.

## File Write Strategy

- **File does not exist** → Create it (including parent directories)
- **File already exists** → Show diff, prompt user for overwrite confirmation
- **User confirms** → Overwrite; **User declines** → Skip that file

## Coding Guidelines

- TypeScript throughout, strict mode, ESM output (`type: module`)
- Target ES2022, module NodeNext
- CLI uses `commander` for commands and `inquirer` for prompts
- Testing with `vitest`
- Templates are static files selected by framework detection — no templating engine
- Template selection is a straightforward mapping from `FrameworkId` to a directory path
- File writer must diff and prompt before overwriting existing files
- Dependency installation must use the user's detected package manager (npm/yarn/pnpm)
- All missing dependencies installed in a single package manager invocation (faster, single lock file update)
- Package.json patching must preserve existing formatting (detect indent)
- No `.git` directory = abort with clear message (Husky requires git)
- Node < 18 = abort with version requirement message
- No `package.json` found = abort with clear message
- No state or trace files should be left after the tool runs
- Handle Ctrl+C gracefully during prompts — clean exit, no partial writes

## Key Types

```typescript
// EnvironmentState — output of detect layer
{
  node: { major, minor, patch }
  packageManager: { name: 'npm' | 'yarn' | 'pnpm', version: string }
  framework: FrameworkId | null
  tools: Map<ToolName, { installed: boolean, version: string | null }>
  git: boolean
}

// ActionPlan — output of resolve layer
{
  depsToInstall: Array<{ name: string, version: string }>
  configsToWrite: Array<{ templatePath: string, targetPath: string }>
  scriptsToAdd: Record<string, string>
  existingFileOverwrites: string[]
}
```

## Design Principles

1. **Copy-paste, not dependency** — No hidden runtime package. Configs belong to the user. Zero runtime coupling after scaffolding.
2. **Detect first, scaffold second** — Always read the environment before writing. If detection fails, exit before touching anything.
3. **Respect existing tools** — If installed, configure it; don't upgrade or replace. Only install what's missing.
4. **Framework-aware** — Each framework has its own template. Configs are tailored, not generic with conditionals.
5. **Confirm before overwrite** — Existing config changes require explicit user confirmation.
6. **Leave no trace** — No state files, lock files, or hidden dependencies after scaffolding.
7. **Node 18+ only** — All templates and dependencies target modern Node.

## Reference

- [docs/overview.md](docs/overview.md) — Product specification and design details
- [docs/execution-plan.md](docs/execution-plan.md) — Milestone-driven implementation plan
- [docs/architecture.md](docs/architecture.md) — Detailed architecture documentation
