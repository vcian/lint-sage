# @vcian/lint-sage

[![npm version](https://img.shields.io/npm/v/@vcian/lint-sage)](https://www.npmjs.com/package/@vcian/lint-sage)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

CLI for bootstrapping and maintaining consistent linting, formatting, commit, editor, and CI standards across Viitor Cloud TypeScript projects. Set up once with `init`, keep healthy with `update` and `doctor`, and eject to take full control with `eject`.

## Prerequisites

- Node.js >= 20
- A TypeScript project with a `package.json`

## Quick Start

```bash
npx @vcian/lint-sage@latest init
```

Select your stack and variant interactively, or use a preset:

```bash
npx @vcian/lint-sage@latest init --preset next-js
```

Then install dependencies:

```bash
npm install   # or pnpm install / yarn install
```

## Supported Stacks & Variants

| Stack   | Variants                                            |
| ------- | --------------------------------------------------- |
| React   | `vite-react-ts`, `@tanstack/react-start`, `next-js` |
| Node    | `express`, `fastify`, `nestjs`, `plain-ts`          |
| Angular | `angular-standalone`, `angular-ssr`                 |

## What Gets Configured

- **ESLint** — stack-specific flat config via shared config packages
- **Prettier** — consistent formatting via `@vcian/prettier-config`
- **Husky** — pre-commit and commit-msg hooks
- **lint-staged** — run linters on staged files only
- **commitlint** — enforce Conventional Commits via `@vcian/commitlint-config`
- **VS Code** — workspace settings and extension recommendations
- **GitHub Actions** — `.github/workflows/lint.yml` CI workflow
- **package.json** — `devDependencies` and lint/format scripts

## CLI Commands

### `init`

Scaffolds lint-sage configuration in the current project.

```bash
npx @vcian/lint-sage init [options]
```

### `update`

Compares your project against the latest templates and applies safe updates using a three-state merge (auto-replace unchanged files, keep locally modified files, flag conflicts).

```bash
npx @vcian/lint-sage update [options]
```

### `doctor`

Runs health checks on your lint-sage setup and reports issues. Use `--fix` to auto-repair.

```bash
npx @vcian/lint-sage doctor [options]
```

### `eject`

Ejects from lint-sage by inlining all hidden configuration and removing only `@vcian/*` wrapper dependencies. Config files are replaced with standalone versions containing all rules directly, scripts are kept, and `.lint-sage.json` is deleted.

```bash
npx @vcian/lint-sage eject [options]
```

## Preset Values

For CI pipelines or template repos where interactive prompts are not viable, `--preset` accepts the canonical variant ID directly:

```bash
# React
npx @vcian/lint-sage@latest init --preset vite-react-ts
npx @vcian/lint-sage@latest init --preset next-js
npx @vcian/lint-sage@latest init --preset @tanstack/react-start

# Node
npx @vcian/lint-sage@latest init --preset express
npx @vcian/lint-sage@latest init --preset nestjs

# Angular
npx @vcian/lint-sage@latest init --preset angular-standalone
npx @vcian/lint-sage@latest init --preset angular-ssr
```

For non-interactive monorepo initialization, use a comma-separated `--preset` with `package-path:variant` mapping:

```bash
npx @vcian/lint-sage@latest init --monorepo \
  --preset apps/web:next-js,apps/api:nestjs,packages/shared-utils:plain-ts
```

All packages must be listed — lint-sage will error if a discovered package is missing from the preset map.

## CLI Flags

| Flag                | Commands                  | Description                                            |
| ------------------- | ------------------------- | ------------------------------------------------------ |
| `--preset <value>`  | `init`                    | Skip prompts with a preset (`next-js`, `nestjs`, etc.) |
| `--monorepo`        | `init`                    | Force monorepo mode                                    |
| `--force`           | `init`, `eject`           | Skip confirmation prompts                              |
| `--dry-run`         | `init`, `update`, `eject` | Preview changes without writing files                  |
| `--verbose`         | all                       | Print detailed output for debugging                    |
| `--package-manager` | `init`, `update`, `eject` | Override detection (`npm`, `pnpm`, `yarn`)             |
| `--fix`             | `doctor`                  | Auto-fix issues found by health checks                 |

## Monorepo Support

lint-sage auto-detects monorepos (Turborepo, Nx, npm/yarn/pnpm workspaces, Lerna) and configures shared root settings with per-package ESLint configs.

```bash
# Auto-detected
npx @vcian/lint-sage init

# Explicit
npx @vcian/lint-sage init --monorepo

# Non-interactive with presets
npx @vcian/lint-sage init --preset "apps/web:next-js,apps/api:nestjs,packages/shared:plain-ts"
```

Root gets shared configs (Prettier, Husky, commitlint, lint-staged, VS Code, CI). Each package gets its own `eslint.config.js` matching its stack.

## Compatibility Preflight

Before writing files, `init` now performs compatibility checks and fails early with actionable guidance for known dependency conflicts (for example, `typescript@6` with `ts-jest@29`, or `eslint@10` with `@typescript-eslint@8`).

For Angular SSR variants, `init` also warns when `@angular/build` and `@angular/ssr` versions are misaligned in the current project.

`init` also writes compatibility `package.json#overrides` for critical dependency alignment.

## Compatibility Overrides

lint-sage manages deterministic compatibility overrides to reduce peer dependency conflicts:

- `eslint` is pinned to a supported major (8/9), normalized to a tilde version.
- `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` are aligned together.
- for `angular-ssr`, `@angular/ssr` is aligned to `@angular/build` when host versions diverge.

`update` now prints an `Overrides` section so compatibility pins are visible during preview/apply.

`doctor` validates missing/mismatched compatibility overrides and `doctor --fix` reconciles them.

## Shared Config Packages

lint-sage generates config files that reference these shared packages:

| Package                        | Purpose                             |
| ------------------------------ | ----------------------------------- |
| `@vcian/eslint-config-react`   | ESLint flat config for React + TS   |
| `@vcian/eslint-config-node`    | ESLint flat config for Node + TS    |
| `@vcian/eslint-config-angular` | ESLint flat config for Angular + TS |
| `@vcian/prettier-config`       | Shared Prettier formatting rules    |
| `@vcian/commitlint-config`     | Conventional Commits enforcement    |

These packages work standalone — any project can install and wire them manually without lint-sage.

## `.lint-sage.json`

lint-sage writes a `.lint-sage.json` state file to track what it manages. **Commit this file to version control.** It enables `update`, `doctor`, and `eject` to work correctly.

## Versioning Strategy

Dependencies are tilde-pinned (e.g., `~9.22.0`) to allow patch updates within a range. When `update` runs:

- If your version is a higher patch within the same range — kept as-is
- If the template has a newer minor/major — updated and reported

## Ejecting

`eject` inlines all hidden configuration and detaches from lint-sage management:

- **Replaced** — `eslint.config.js`, `prettier.config.js`, and `.commitlintrc.json` are rewritten with all rules visible (no `@vcian/*` imports)
- **Kept** — Husky hooks, lint-staged, VS Code settings, CI workflow, scripts, and non-`@vcian/*` dependencies remain unchanged
- **Removed** — only tracked `@vcian/*` wrapper dependencies are removed from `package.json`
- **Deleted** — `.lint-sage.json` state file

After eject, the project is fully standalone with no dependency on lint-sage.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
