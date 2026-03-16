# lint-sage Overview

## What It Is

`@vcian/lint-sage` is a CLI for bootstrapping and maintaining a consistent code quality toolchain across Viitor Cloud TypeScript projects.

Its job is to standardize the setup and ongoing maintenance of:

- ESLint
- Prettier
- Husky
- lint-staged
- commitlint
- VS Code workspace settings
- GitHub Actions lint workflow
- related `package.json` scripts and dev dependencies

The primary value of lint-sage is not only initial setup, but also safe long-term maintenance through `update`, `doctor`, and `eject`.

## Problem It Solves

Without a shared tool, each project tends to configure linting, formatting, commit rules, editor settings, and CI checks differently. That creates:

- inconsistent engineering standards across teams
- repeated setup work during project creation
- onboarding friction for new developers
- configuration drift as org standards evolve
- higher review and CI noise caused by mismatched tooling

lint-sage reduces that drift by making org-standard setup reproducible and maintainable.

## Core Product Idea

The product idea is simple:

1. Generate the right quality-tooling setup for a project's stack.
2. Track what was generated.
3. Safely update that setup later as standards evolve.
4. Let teams keep local overrides without losing ownership of their repo.

That makes lint-sage closer to a lifecycle management tool than a one-time project generator.

## Who It Is For

lint-sage is designed for:

- Viitor Cloud teams creating new TypeScript projects
- maintainers who want consistent linting and formatting across repos
- teams managing monorepos with multiple package types
- contributors who need predictable standards without hand-rolling config

## Supported Scope

lint-sage v3 is scoped to TypeScript-only projects.

Supported stacks and variants:

| Stack   | Variants                                            |
| ------- | --------------------------------------------------- |
| React   | `vite-react-ts`, `@tanstack/react-start`, `next-js` |
| Node    | `express`, `fastify`, `nestjs`, `plain-ts`          |
| Angular | `angular-standalone`, `angular-ssr`                 |

It also supports monorepos, with shared root-level tooling and per-package ESLint configuration.

## Command Model

lint-sage is built around four core commands:

- `init`
  Creates the initial config, updates `package.json`, and writes `.lint-sage.json`.
- `update`
  Compares the current project against the latest templates and applies safe updates.
- `doctor`
  Checks whether the setup is healthy and reports warnings or failures.
- `eject`
  Removes lint-sage-managed files and tracked `package.json` entries cleanly.

## Key Principles

The current design is guided by these principles:

- Standardize the common path without blocking project-specific overrides.
- Prefer safe updates over destructive rewrites.
- Never run install commands automatically.
- Preserve the repository's existing package manager.
- Keep monorepo behavior explicit and workspace-aware.
- Track managed state so changes remain explainable and reversible.

## Why `update` Matters

Many scaffolding tools help only once, at project creation time. lint-sage is different because it keeps a durable record of what it added and how it was generated. That lets it:

- detect whether a managed file is unchanged, locally modified, or in conflict
- update templates safely when org standards change
- warn about version drift and missing files
- re-generate known config when repairs are possible
- remove only the entries it originally added during `eject`

This maintenance model is one of the main differentiators of the project.

## Shared Config Strategy

lint-sage uses published shared config packages for org-level rules, including:

- `@vcian/eslint-config-react`
- `@vcian/eslint-config-node`
- `@vcian/eslint-config-angular`
- `@vcian/prettier-config`
- `@vcian/commitlint-config`

Generated project files import these packages rather than duplicating all rules inline. This gives the org a central place to evolve standards while still letting each project own its generated config files.

## Monorepo Strategy

In monorepos, lint-sage applies:

- shared root-level config for Prettier, Husky, commitlint, lint-staged, VS Code, and CI
- package-local `eslint.config.js` files so stack-specific rules stay isolated
- root-level package manager detection and lockfile handling
- package discovery based on the detected monorepo tool or workspace configuration

This keeps mixed-stack monorepos manageable without leaking rules across packages.

## Relationship to Other Docs

Use this file for the product summary.

Use the other docs for deeper detail:

- `docs/architecture.md`
  Technical structure, data flow, design constraints, and detailed command behavior.
- `docs/glossary.md`
  Shared terminology used across the docs set.
