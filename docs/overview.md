# Lint Sage

**A CLI tool for bootstrapping linting, formatting, and code quality infrastructure for ViitorCloud TypeScript projects.**

Copy-paste, not dependency. Lint Sage scaffolds config files directly into your project. You own every file. Developers have full control to modify configs after scaffolding.

---

## Problem

Every new ViitorCloud project spends hours manually wiring up ESLint, Prettier, Husky, lint-staged, commitlint, and CI workflows. Existing projects drift apart in configuration. Teams lack a standardized, repeatable setup.

## Solution

A single CLI command that detects your environment, resolves compatibility, and scaffolds production-ready configs — tailored to your framework and existing dependencies.

```bash
npx @vcian/lint-sage@latest init

```

Published as a **public npm package** under `@vcian/lint-sage`. The `@latest` tag ensures you always get the newest templates and rules — no stale cached versions.

---

## What Gets Scaffolded


| Tool           | Files                                                                        |
| -------------- | ---------------------------------------------------------------------------- |
| ESLint         | `eslint.config.mjs` or `.eslintrc.*` (auto-detected based on installed ESLint version) |
| Prettier       | `.prettierrc`, `.prettierignore`                                             |
| EditorConfig   | `.editorconfig`                                                              |
| Husky          | `.husky/pre-commit`, `.husky/commit-msg`                                     |
| lint-staged    | Configuration in `package.json`                                              |
| commitlint     | `commitlint.config.js` (conventional commits)                                |
| VS Code        | `.vscode/settings.json`, `.vscode/extensions.json`                           |
| GitHub Actions | `.github/workflows/lint.yml`                                                 |
| package.json   | `lint`, `format:check`, `prepare` scripts + devDependencies                  |


### Scripts Added to `package.json`


| Script         | Purpose                                          |
| -------------- | ------------------------------------------------ |
| `lint`         | Run ESLint check — used in CI                    |
| `format:check` | Run Prettier check — used in CI                  |
| `prepare`      | Required by Husky to set up git hooks on install |


Hands-on fixes (`eslint --fix`, `prettier --write`) are handled by lint-staged on pre-commit. Developers can run them directly via `npx` when needed.

---

## Supported Frameworks

### React

- `vite-react-ts` — Vite + React + TypeScript
- `@tanstack/react-start` — TanStack Start
- `next-js` — Next.js (extends built-in ESLint config)

### Node

- `express` — Express.js
- `fastify` — Fastify
- `nestjs` — NestJS (decorator support, strict mode)

### Angular

- `angular-standalone` — Angular standalone components
- `angular-ssr` — Angular with SSR

Monorepo setups (Nx, Turborepo) are not supported.

---

## How It Works

### 1. Pre-flight Detection

Before scaffolding anything, Lint Sage reads the environment:

```
📦 package.json
   → Detect framework and version (react, next, angular, nest, etc.)
   → Detect existing lint/format tools and their versions
   → Detect scripts that might conflict

🖥️  Runtime checks
   → node --version (minimum: Node 18)
   → Package manager (npm / yarn / pnpm) + version
   → Installed tool versions (eslint, prettier, husky, etc.)
   → .git directory exists (required for Husky — abort if missing)

```

**Git required:** If no `.git` directory is found, Lint Sage aborts with a clear message asking the user to initialize a git repository first (`git init`). Husky and pre-commit hooks cannot function without git.

### 2. Compatibility Resolution

Lint Sage follows a simple rule:

- **Tool already installed?** → Keep it. Only configure rules.
- **Tool not installed?** → Install the latest compatible version, then configure.


| Condition                | Resolution                                           |
| ------------------------ | ---------------------------------------------------- |
| ESLint already installed (v9+ flat config) | Configure ViitorCloud rules via `eslint.config.mjs`           |
| ESLint already installed (v8 legacy config) | Configure ViitorCloud rules via `.eslintrc.*` (legacy format) |
| ESLint not installed     | Install latest compatible version + configure with flat config |
| Husky already installed  | Configure hooks only — do not upgrade                |
| Husky not installed      | Install latest compatible version + configure hooks  |
| Next.js detected         | Extend built-in `eslint-config-next` (never replace) |
| Angular detected         | Work with existing `@angular-eslint` setup           |
| NestJS detected          | Add decorator + strict mode rules                    |


**ESLint version handling:** Lint Sage detects the installed ESLint version and scaffolds the appropriate config format — flat config (`eslint.config.mjs`) for ESLint 9+, legacy config (`.eslintrc.*`) for ESLint 8. When ESLint is not installed, the latest version with flat config is used.

This applies to **every tool** — Prettier, lint-staged, commitlint, etc.

### 3. Environment Report

The user sees a clear report before anything is written:

```
🔍 Lint Sage — Environment Report

Node:         20.11.0 ✓
Package Mgr:  pnpm 9.1
Framework:    next-js (14.2.3)
ESLint:       9.0.0 (installed) → will configure rules
Prettier:     not installed → will install 3.x + configure
Husky:        not installed → will install 9.x + configure
lint-staged:  not installed → will install + configure
commitlint:   not installed → will install + configure
Git:          ✓ initialized

Proceed? (Y/n)

```

### 4. Install + Scaffold

After user confirmation, Lint Sage:

1. **Installs missing dependencies** via the detected package manager — this must happen first since tools like Husky require installation before hooks can be configured
2. **Patches** `package.json` with scripts (`lint`, `format:check`, `prepare`)
3. **Scaffolds config files** — templates selected based on the detected framework

For each config file:

- **File does not exist** → Create it
- **File already exists** → Show diff, ask user for confirmation to overwrite

No state files are created. After scaffolding, Lint Sage leaves no trace — only the configs you asked for.

---

## CLI Commands


| Command          | Description                                                                        |
| ---------------- | ---------------------------------------------------------------------------------- |
| `lint-sage init` | Detect environment, install missing tools, scaffold configs with user confirmation |


One command. After scaffolding, all configs are yours — edit, extend, or delete as needed.

---

## Architecture

```
lint-sage/
├── src/
│   ├── cli.ts                  # Entry point (commander + inquirer)
│   ├── detect/
│   │   ├── node.ts             # Node version detection (minimum: 18)
│   │   ├── package-manager.ts  # npm / yarn / pnpm
│   │   ├── framework.ts        # Framework detection from package.json
│   │   ├── existing-tools.ts   # Installed versions of eslint, prettier, husky, etc.
│   │   └── git.ts              # .git directory check
│   ├── resolve/
│   │   └── compatibility.ts    # Decide: configure only vs install + configure
│   ├── scaffold/
│   │   ├── installer.ts        # Install missing dependencies via detected pkg manager
│   │   ├── writer.ts           # File writer with overwrite confirmation
│   │   └── patch-package.ts    # Add scripts + devDependencies to package.json
│   └── templates/
│       ├── eslint/
│       │   ├── react/          # vite-react-ts, @tanstack/react-start, next-js
│       │   ├── node/           # express, fastify, nestjs
│       │   └── angular/        # angular-standalone, angular-ssr
│       ├── prettier/
│       ├── editorconfig/
│       ├── husky/
│       ├── commitlint/
│       ├── vscode/
│       └── github-actions/
└── package.json

```

---

## Design Principles

1. **Copy-paste, not dependency** — Configs live in your project. No hidden runtime package. Full developer control after scaffolding.
2. **Detect first, scaffold second** — Always read the environment before writing files. Never blindly overwrite.
3. **Respect existing tools** — If a tool is already installed, configure it — don't upgrade or replace it. Only install what's missing.
4. **Framework-aware** — Each framework has different linting needs. Configs are tailored, not generic.
5. **Confirm before overwrite** — Every existing config change requires explicit user confirmation.
6. **Leave no trace** — No state files, no lock files, no hidden dependencies. Just your configs.
7. **Node 18+ only** — Minimum Node 18. All templates and dependencies target modern Node.

---

## Rollout Plan

### Phase 1 — MVP

- `lint-sage init` for `vite-react-ts`, `next-js`, `express`, `angular-standalone`
- Pre-flight detection + environment report
- Compatibility resolution (configure existing vs install missing)
- Auto-install missing dependencies before scaffolding

### Phase 2 — Full Framework Coverage

- Add `@tanstack/react-start`, `fastify`, `nestjs`, `angular-ssr`

