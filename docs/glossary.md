# lint-sage Glossary

## Added Dependencies

Dependency names recorded in `.lint-sage.json` because lint-sage actually added them to `package.json`. During `eject`, only tracked dependencies prefixed with `@vcian/` are removed — all other tracked dependencies (ESLint plugins, Prettier, etc.) are preserved so the project remains functional after detaching.

## Added Scripts

Script names recorded in `.lint-sage.json` because lint-sage actually added them to `package.json`. Scripts remain tracked for schema stability, but `eject` keeps all scripts unchanged since the project still needs them after detaching from lint-sage.

## Auto-replace

An `update` outcome where the current managed file still matches the last template lint-sage applied, and the template has changed since then. Because the file has no local divergence, lint-sage can replace it safely.

## Canonical Variant ID

The stable string used to identify a supported project variant everywhere in the system, such as `next-js`, `nestjs`, or `angular-standalone`. The same identifier is used in prompts, templates, flags, and `.lint-sage.json`.

## Command Layer

The part of the CLI that implements user-facing workflows such as `init`, `update`, `doctor`, and `eject`.

## Conflict

An `update` outcome where both the local managed file and the upstream template changed since the last lint-sage application. Instead of overwriting the file, lint-sage writes a `.lint-sage.new` candidate file for manual review.

## Dependencies Template

The template data, typically stored in `dependencies.json`, that defines which `devDependencies` and scripts should be merged into the target project's `package.json`.

## Dry Run

A command mode that calculates and prints what lint-sage would do without writing, modifying, or deleting files.

## Eject

The command that inlines all hidden configuration (replacing `@vcian/*` imports with visible rules), removes only tracked `@vcian/*` wrapper dependencies, keeps all other files and scripts, and deletes the `.lint-sage.json` state file.

## Generated Config

A configuration file written by lint-sage into the target repository, such as `eslint.config.js` or `prettier.config.js`.

## Health Check

A diagnostic check run by `doctor` to determine whether a lint-sage setup is healthy, degraded, or broken.

## Keep

An `update` outcome where the managed file was edited locally but the upstream template has not changed since the last lint-sage application. In this case, lint-sage leaves the local file untouched.

## Last Applied Hash

The SHA-256 hash stored in `.lint-sage.json` for the template content that lint-sage last applied to a managed file. It is a key input to update decision-making.

## Legacy Config

An older or conflicting configuration format that should not coexist with the current generated setup, such as `.eslintrc.*` alongside `eslint.config.js`.

## lint-sage

The CLI tool `@vcian/lint-sage`, which bootstraps and maintains quality-tooling standards for supported TypeScript projects.

## Managed File

A file that lint-sage created or explicitly tracks in `.lint-sage.json`. Managed files participate in `update`, `doctor`, and `eject`.

## Monorepo

A repository containing multiple apps or packages managed together, often through a tool like Turborepo, Nx, pnpm workspaces, npm workspaces, Yarn workspaces, or Lerna.

## Monorepo Root Config

Configuration managed once at the workspace root in monorepo mode, such as Prettier, Husky, commitlint, lint-staged, VS Code settings, and CI workflow files.

## Monorepo Tool

The primary workspace orchestration tool detected or selected for a monorepo, such as Turborepo, Nx, or Lerna.

## Package Manager

The dependency manager lint-sage detects or is instructed to use for a project, currently `npm`, `pnpm`, or `yarn`.

## Package-local ESLint

The monorepo rule that ESLint configuration lives in each app or package rather than at the root when multiple stacks are present.

## Preset

A non-interactive way to tell `init` which variant to use. In monorepo mode, presets map package paths to variant IDs.

## Project-owned Config Model

The architectural approach where lint-sage writes real config files into the repository and expects teams to own, review, commit, and optionally customize those files directly.

## Root-only Lockfile Detection

The monorepo rule that package manager detection only uses lockfiles found at the repository root, not lockfiles inside workspace packages.

## Schema Version

The integer version of the `.lint-sage.json` data shape. It changes only when the structure of that file changes, not for every package release.

## Shared Config Package

A published package that centralizes org-level tool rules, such as `@vcian/eslint-config-react` or `@vcian/prettier-config`. Generated project config files import these packages.

## Stack

The broad project category used by lint-sage to choose templates and supported variants. Current stacks are React, Node, and Angular.

## State File

The `.lint-sage.json` file stored in the repository root. It records the information lint-sage needs to maintain the project after initialization.

## Template

The source file or data definition used by lint-sage to generate a managed file or merge `package.json` entries.

## Three-State Merge Model

The update safety model that classifies managed files as auto-replace, keep, or conflict based on the local file hash, last applied hash, and current template hash.

## Tilde Pinning

The dependency versioning strategy that uses `~` ranges to allow patch updates while blocking unreviewed minor and major upgrades.

## Update

The command that compares the current project state against the latest lint-sage templates and applies safe changes.

## Variant

A specific supported setup within a stack, such as `next-js` under React or `plain-ts` under Node.
