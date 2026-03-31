# Architecture

This document describes the high-level architecture of Lint Sage. It is intended as a reference for contributors working on the codebase.

## System Overview

Lint Sage is a single-command CLI tool (`lint-sage init`) that detects a project's environment, resolves what needs to be installed or configured, and scaffolds linting/formatting infrastructure. It runs once, writes config files, and exits — there is no daemon, no runtime dependency, and no state left behind.

```
User runs `npx @vcian/lint-sage@latest init`
        │
        ▼
┌──────────────┐
│   CLI Layer  │  Parse command, orchestrate pipeline
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Detect     │  Read environment: node, pkg manager, framework, tools, git
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Resolve    │  Compare detected state against requirements → build action plan
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Report     │  Display environment summary, prompt user for confirmation
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Scaffold   │  Install missing deps, patch package.json, write config files
└──────────────┘
```

## Directory Structure

```
lint-sage/
├── src/
│   ├── cli.ts                     # Entry point
│   ├── detect/                    # Environment detection modules
│   │   ├── node.ts
│   │   ├── package-manager.ts
│   │   ├── framework.ts
│   │   ├── existing-tools.ts
│   │   └── git.ts
│   ├── resolve/                   # Compatibility resolution
│   │   └── compatibility.ts
│   ├── scaffold/                  # File writing and dependency installation
│   │   ├── installer.ts
│   │   ├── writer.ts
│   │   └── patch-package.ts
│   └── templates/                 # Static config templates per framework
│       ├── eslint/
│       │   ├── react/
│       │   ├── node/
│       │   └── angular/
│       ├── prettier/
│       ├── editorconfig/
│       ├── husky/
│       ├── commitlint/
│       ├── vscode/
│       └── github-actions/
├── docs/
│   ├── overview.md
│   └── architecture.md
├── AGENTS.md
└── package.json
```

## Layer-by-Layer Breakdown

### 1. CLI Layer (`src/cli.ts`)

The entry point. Uses `commander` for command parsing and `inquirer` for interactive prompts. Owns the top-level orchestration: calls detect, resolve, report, and scaffold in sequence. There is one command — `init` — and no subcommands.

**Responsibilities:**
- Parse CLI arguments
- Orchestrate the detect -> resolve -> report -> scaffold pipeline
- Handle top-level errors and exit codes

### 2. Detect Layer (`src/detect/`)

Each module in this layer reads one aspect of the user's environment and returns structured data. Modules are independent of each other and can run in parallel.

| Module              | Reads                                      | Returns                              |
| ------------------- | ------------------------------------------ | ------------------------------------ |
| `node.ts`           | `node --version`                           | Node version; abort if < 18          |
| `package-manager.ts`| Lock files, `npm --version`, etc.          | Package manager name + version       |
| `framework.ts`      | `package.json` dependencies                | Framework identifier (e.g. `next-js`)|
| `existing-tools.ts` | `package.json` devDependencies + installed versions | Map of tool -> installed version or null |
| `git.ts`            | Presence of `.git` directory               | Boolean; abort if missing            |

**Key invariant:** Detection is read-only. No files are written or modified.

**Abort conditions:**
- Node < 18 -> exit with version requirement message
- No `.git` directory -> exit with message to run `git init` first

### 3. Resolve Layer (`src/resolve/compatibility.ts`)

Takes the detection results and produces an **action plan** — a list of what to install and what to configure.

**Core rule:** If a tool is already installed, keep it and only configure rules. If it is not installed, install the latest compatible version and configure.

**Framework-specific resolution:**
- **Next.js** -> extend `eslint-config-next`, never replace it
- **Angular** -> work with existing `@angular-eslint` setup
- **NestJS** -> add decorator support and strict mode rules

**ESLint version branching:**
- ESLint 9+ installed -> flat config (`eslint.config.mjs`)
- ESLint 8 installed -> legacy config (`.eslintrc.*`)
- ESLint not installed -> install latest, use flat config

The output of this layer is a data structure describing:
- Dependencies to install (tool name + version)
- Config files to write (template path + target path)
- Scripts to add to package.json
- Whether each target file already exists (determines overwrite prompt)

### 4. Report and Confirmation

Before any writes, the CLI displays an environment report showing:
- Detected Node version, package manager, framework
- Each tool's status: installed version or "will install X"
- Git status

The user must confirm (`Y/n`) before proceeding. This is the last exit point before side effects.

### 5. Scaffold Layer (`src/scaffold/`)

Executes the action plan produced by the resolve layer. Three modules handle distinct responsibilities:

#### `installer.ts`

Installs missing dependencies using the detected package manager. Runs **before** any config writing — tools like Husky require installation before hooks can be configured.

- Constructs the install command for the detected package manager (`npm install -D`, `yarn add -D`, `pnpm add -D`)
- Installs all missing dependencies in a single command

#### `patch-package.ts`

Adds scripts and devDependencies to the user's `package.json`:

| Script         | Command                     | Purpose                   |
| -------------- | --------------------------- | ------------------------- |
| `lint`         | `eslint .`                  | CI lint check             |
| `format:check` | `prettier --check .`        | CI format check           |
| `prepare`      | `husky`                     | Git hooks setup on install|

Merges into existing scripts — does not overwrite user scripts that already exist.

#### `writer.ts`

Writes config files from templates to the user's project.

**File write strategy:**
- File does not exist -> create it
- File already exists -> show diff, prompt for overwrite confirmation

Templates are static files organized by framework under `src/templates/`. The writer selects the correct template based on the resolved framework and tool version.

## Templates

Templates are plain config files, not dynamically generated. Each framework variation has its own template directory.

```
templates/eslint/react/
├── vite-react-ts/
│   └── eslint.config.mjs
├── tanstack-react-start/
│   └── eslint.config.mjs
└── next-js/
    └── eslint.config.mjs
```

Template selection is a straightforward mapping from the detected framework identifier to a directory path. No templating engine is involved.

## Data Flow

```
package.json ──┐
node --version ─┤
lock files ─────┤──▶ Detect ──▶ Environment State
.git/ ──────────┘         │
                          ▼
                      Resolve ──▶ Action Plan
                          │        (deps to install,
                          │         files to write,
                          │         scripts to add)
                          ▼
                       Report ──▶ User confirms
                          │
                          ▼
                      Scaffold
                       ├── installer.ts  (install deps)
                       ├── patch-package.ts (add scripts)
                       └── writer.ts (write config files)
                          │
                          ▼
                    User's project now has
                    all configs scaffolded
```

## Key Design Decisions

### Copy-paste over dependency

Lint Sage does not install itself as a project dependency. It runs via `npx`, writes files, and exits. The user's project has zero runtime coupling to Lint Sage after scaffolding. This means configs can be freely modified without worrying about version conflicts with a parent package.

### Detect-then-act pipeline

The strict separation between detection (read-only) and scaffolding (write) prevents partial writes. If detection fails (wrong Node version, no git), the tool exits before touching anything. The user always sees the full plan before any side effects.

### Framework-specific templates over generic configs

Instead of one ESLint config with conditional logic, each framework has its own template. This keeps templates simple and auditable — a contributor can read a single file to understand what gets scaffolded for Next.js without tracing through conditionals.

### Single install command

All missing dependencies are installed in one package manager invocation rather than one per tool. This is faster and produces a single lock file update.

## Constraints

- **Node 18+ required** — enforced at detection; the tool aborts on older versions
- **Git required** — Husky hooks need a git repository; the tool aborts if `.git` is missing
- **No monorepo support** — Nx and Turborepo setups are explicitly out of scope
- **No state persistence** — the tool leaves no trace files, caches, or lock files of its own

## Technology Stack

- **Language:** TypeScript
- **CLI framework:** Commander
- **Interactive prompts:** Inquirer
- **Package:** Published to npm as `@vcian/lint-sage`
- **Distribution:** `npx` execution (no global install needed)
