# lint-sage Architecture

## Overview

lint-sage is a stateful CLI that generates, tracks, updates, diagnoses, and removes project quality-tooling configuration.

At a high level, the system combines:

- command handlers that drive user-facing workflows
- templates that define generated files
- package metadata merging for `package.json`
- state tracking in `.lint-sage.json`
- shared config packages for org-level rules
- diagnostic and diff logic for maintenance commands

## Architectural Goals

The architecture is designed to support a few core goals:

- generate consistent project setup from known templates
- preserve team ownership of generated files
- support safe updates over time
- avoid hidden global state outside the repository
- work for both single-project repos and monorepos
- separate org-level standards from project-level overrides

## Core Layers

### 1. CLI command layer

The command layer exposes the product workflows:

- `init`
- `update`
- `doctor`
- `eject`

Each command is responsible for orchestrating prompts, reading project state, calling the relevant utilities, and printing user-facing output.

### 2. Template layer

Templates define the raw configuration files that lint-sage can generate.

They are organized by:

- stack
- variant
- monorepo root templates
- CI workflow templates

Example template responsibilities include:

- `eslint.config.js`
- `prettier.config.js`
- `.commitlintrc.json`
- `.lintstagedrc.json`
- `.husky/*`
- `.vscode/*`
- `dependencies.json`

Templates are the source of truth for generated file content.

### 3. Shared config package layer

Generated configs depend on published shared config packages instead of embedding all rules inline.

This creates a clean split:

- shared packages own org-wide defaults
- generated files provide the repo-local integration point

That split gives projects a place to override behavior without forking the entire standard setup.

### 4. State tracking layer

`.lint-sage.json` is the persistence layer for command behavior after `init`.

It records:

- schema version
- lint-sage version
- selected stack and variant
- package manager
- managed files and their template hashes
- dependencies and scripts actually added by lint-sage
- timestamps
- monorepo package mappings where applicable

This file is what makes `update`, `doctor`, and `eject` possible without re-asking setup questions.

### Schema Versioning and Migration

The `.lint-sage.json` file includes a `schemaVersion` field (integer) that tracks the structure of the JSON itself, independent of the lint-sage package version stored in `version`.

- `schemaVersion` starts at `1` for lint-sage v3.0.0
- The `version` field tracks which lint-sage release last wrote the file
- `schemaVersion` only increments when the shape of `.lint-sage.json` changes (new required fields, renamed keys, restructured nesting) — not on every lint-sage release

When lint-sage reads a `.lint-sage.json` with an older `schemaVersion`:

1. It runs an automatic in-place migration that transforms the JSON to the new schema shape
2. The migration preserves all existing data (stack, variant, package mappings, managed file hashes)
3. It prints a notice: `ℹ Migrated .lint-sage.json schema from v{old} to v{new}`
4. The migrated file is written back before proceeding with the command

If a `.lint-sage.json` has no `schemaVersion` field (created by lint-sage v2.x or earlier), lint-sage treats it as schema version `0` and migrates it to the current schema. If the `schemaVersion` is **higher** than the running version understands, lint-sage exits with an error and instructs the user to update lint-sage.

### How `addedDependencies` and `addedScripts` Are Recorded

During `init`, lint-sage compares the stack's `dependencies.json` template against the project's existing `package.json`. Only entries that lint-sage actually adds (i.e., not already present) are recorded in `addedDependencies` and `addedScripts`. If the project already had `eslint` installed before `init`, it will not appear in `addedDependencies` and `eject` will leave it intact.

During `update`, if lint-sage adds new dependencies or scripts that were not in the original template, the new entries are appended to `addedDependencies` and `addedScripts`.

During `eject`, only tracked dependencies prefixed with `@vcian/` are removed — all other tracked dependencies and scripts are preserved so the project remains functional after detaching from lint-sage.

### Single-Project State Example

```json
{
  "schemaVersion": 1,
  "version": "3.0.0",
  "packageManager": "npm",
  "stack": "react",
  "variant": "next-js",
  "managedFiles": {
    "eslint.config.js": {
      "template": "react/next-js/eslint.config.js",
      "lastAppliedHash": "sha256:abc123"
    },
    "prettier.config.js": {
      "template": "react/next-js/prettier.config.js",
      "lastAppliedHash": "sha256:def456"
    }
  },
  "addedDependencies": [
    "eslint",
    "prettier",
    "husky",
    "lint-staged",
    "@commitlint/cli",
    "@commitlint/config-conventional",
    "@typescript-eslint/parser",
    "@typescript-eslint/eslint-plugin",
    "eslint-config-prettier",
    "@vcian/eslint-config-react",
    "@vcian/prettier-config",
    "@vcian/commitlint-config"
  ],
  "addedScripts": ["lint", "lint:fix", "format", "format:check"],
  "initializedAt": "2026-03-15T10:30:00Z",
  "lastUpdatedAt": "2026-03-15T10:30:00Z"
}
```

### Monorepo State Example

```json
{
  "schemaVersion": 1,
  "version": "3.0.0",
  "monorepo": true,
  "packageManager": "pnpm",
  "monorepoTool": "turborepo",
  "managedFiles": {
    "prettier.config.js": {
      "template": "monorepo/prettier.config.js",
      "lastAppliedHash": "sha256:aaa111"
    },
    ".commitlintrc.json": {
      "template": "monorepo/.commitlintrc.json",
      "lastAppliedHash": "sha256:bbb222"
    },
    ".lintstagedrc.json": {
      "template": "monorepo/.lintstagedrc.json",
      "lastAppliedHash": "sha256:ccc222"
    },
    ".husky/pre-commit": {
      "template": "monorepo/.husky/pre-commit",
      "lastAppliedHash": "sha256:ddd222"
    },
    ".husky/commit-msg": {
      "template": "monorepo/.husky/commit-msg",
      "lastAppliedHash": "sha256:eee222"
    },
    ".vscode/settings.json": {
      "template": "monorepo/.vscode/settings.json",
      "lastAppliedHash": "sha256:fff222"
    },
    ".vscode/extensions.json": {
      "template": "monorepo/.vscode/extensions.json",
      "lastAppliedHash": "sha256:ggg222"
    },
    ".github/workflows/lint.yml": { "template": "ci/lint.yml", "lastAppliedHash": "sha256:hhh222" }
  },
  "packages": {
    "apps/web": {
      "stack": "react",
      "variant": "next-js",
      "managedFiles": {
        "eslint.config.js": {
          "template": "react/next-js/eslint.config.js",
          "lastAppliedHash": "sha256:ccc333"
        }
      }
    },
    "apps/api": {
      "stack": "node",
      "variant": "nestjs",
      "managedFiles": {
        "eslint.config.js": {
          "template": "node/nestjs/eslint.config.js",
          "lastAppliedHash": "sha256:ddd444"
        }
      }
    }
  },
  "addedDependencies": ["prettier", "husky", "lint-staged", "..."],
  "addedScripts": ["lint", "lint:fix", "format", "format:check"],
  "initializedAt": "2026-03-15T10:30:00Z",
  "lastUpdatedAt": "2026-03-15T10:30:00Z"
}
```

Root-level `managedFiles` tracks shared configs. Each package entry has its own `managedFiles` for package-local configs. This enables the three-state merge model to work correctly across the entire monorepo.

### 5. Maintenance utilities layer

Maintenance behavior is implemented through a small set of utilities:

- project config detection
- monorepo detection and workspace discovery
- config writing
- `package.json` merge logic
- diffing managed files against templates
- health checks and repair actions

These utilities do the heavy lifting while command handlers control flow and UX.

## Design Model

lint-sage follows a repository-owned config model.

That means generated files live directly in the target repository and are expected to be committed. Projects own those files after generation. lint-sage does not depend on hidden per-machine state, remote config evaluation, or a wrapper runtime to make the generated config work.

This model has a few important consequences:

- teams can inspect generated files directly
- project-specific overrides remain local and explicit
- maintenance commands can reason about tracked files deterministically
- `eject` can cleanly remove only what lint-sage manages

## Command Flows

### `init`

The `init` flow is roughly:

1. Detect package manager.
2. Detect whether the repo is a monorepo.
3. Resolve stack and variant through prompts or `--preset`.
4. Detect conflicting existing config files.
5. Generate files from templates.
6. Merge required `devDependencies` and scripts into `package.json`.
7. Write `.lint-sage.json`.
8. Print a summary and install reminder.

### `update`

The `update` flow is roughly:

1. Read `.lint-sage.json`.
2. Resolve the latest templates for tracked files.
3. Compare current file hash, last applied hash, and latest template hash.
4. Classify each file as no-change, auto-replace, keep, or conflict.
5. Merge relevant `package.json` updates.
6. Apply confirmed changes.
7. Update `.lint-sage.json` metadata.

### `doctor`

The `doctor` flow is roughly:

1. Validate `.lint-sage.json`.
2. Check managed files, dependency versions, legacy config conflicts, hooks, and package resolution.
3. Print pass, warn, and fail results.
4. If `--fix` is enabled, repair supported issues and report what changed.

#### `doctor --fix` Repairs

| Issue                                                                           | Fix applied                                                                                                                                                                                               |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Husky hooks missing or not executable                                           | Recreates hook files from templates and sets executable permissions. If the Husky runtime bootstrap is missing, prints a reminder to run the repo's Husky setup command after dependencies are installed. |
| Dependency version mismatch in `package.json`                                   | Updates the version range in `devDependencies` to match the expected tilde pin                                                                                                                            |
| Missing managed config file                                                     | Re-generates the file from the current template                                                                                                                                                           |
| Legacy config file conflict (e.g., `.eslintrc.js` alongside `eslint.config.js`) | Prompts to delete the legacy file                                                                                                                                                                         |
| Shared config package not resolvable                                            | Adds it to `devDependencies` at the expected version                                                                                                                                                      |

In monorepo mode, `--fix` applies repairs across both root-level and per-package configs. Each fix is printed with its scope (e.g., `[apps/api] Re-generated eslint.config.js`).

After `--fix` completes, lint-sage prints a reminder to run the project's package manager install command if any `package.json` changes were made. `--fix` never runs install commands itself.

### `eject`

The `eject` flow is roughly:

1. Read `.lint-sage.json`.
2. Classify managed files as ejectable (ESLint, Prettier, commitlint configs) or non-ejectable (Husky, VS Code, lint-staged, CI).
3. Check for drift by comparing current file hashes against `lastAppliedHash` — warn if files were manually edited.
4. Confirm the eject plan unless forced.
5. Replace ejectable config files with inlined versions (all rules visible, no `@vcian/*` imports). Non-ejectable files are kept unchanged.
6. Remove only tracked `@vcian/*` wrapper dependencies from `package.json`. All other dependencies and scripts are preserved.
7. Delete `.lint-sage.json`.

## `--dry-run` Behavior

`--dry-run` is supported on `init`, `update`, and `eject`. When active:

- No files are written, modified, or deleted
- No `package.json` changes are applied
- Interactive prompts (stack selection, overwrite confirmation) still run so the user sees the full flow. If `--preset` is also passed, prompts are skipped as usual — `--dry-run` only prevents writes
- Output prefixes each action with `[dry-run]` instead of the checkmark (e.g., `[dry-run] Would create eslint.config.js`)
- For `update`, the same replace/keep/conflict decisions are computed and printed without applying them
- For `eject`, the list of files and `package.json` entries that would be removed is printed without deleting anything
- Exit code is always `0` unless the command encounters a hard error (e.g., missing `.lint-sage.json` on `update`)

## Three-State Update Model

The `update` command is built around a three-state merge model:

- auto-replace
  The local file still matches the last applied template, so it is safe to replace.
- keep
  The local file changed but the upstream template did not, so the local version is preserved.
- conflict
  Both the local file and template changed, so lint-sage writes a candidate `.lint-sage.new` file instead of overwriting.

This is the central safety mechanism in the architecture.

## `package.json` Merge Strategy

lint-sage treats `package.json` differently from normal generated files.

Instead of replacing the file wholesale, it merges only managed areas:

- `devDependencies`
- `scripts`

Everything else is preserved. It also records which dependencies and scripts it actually added so `eject` can remove only those entries later.

## Monorepo Architecture

Monorepo mode splits responsibility by scope.

Root-level responsibilities:

- shared Prettier config
- Husky hooks
- commitlint config
- lint-staged config
- VS Code workspace files
- GitHub Actions workflow
- root `package.json` dependency and script updates
- root `.lint-sage.json`

Package-level responsibilities:

- package-specific `eslint.config.js`
- stack and variant mapping per package
- per-package managed file tracking

Important rule:

- mixed-stack monorepos do not get a root `eslint.config.js`

This prevents React, Node, and Angular ESLint concerns from leaking across packages.

## Package Manager Detection

The package manager is detected in priority order:

1. `--package-manager`
2. root `package.json` `packageManager`
3. root lockfile presence
4. fallback to `npm`

The architecture intentionally avoids rewriting lockfile formats or switching package managers. In monorepos, only root-level lockfiles and the root `package.json` influence detection.

## Versioning Strategy

lint-sage uses tilde-pinned versions for managed dependencies.

This architecture choice aims to:

- allow patch upgrades
- block unreviewed minor upgrades
- block breaking major upgrades

When expected versions change, lint-sage updates the pinned versions through template and constants changes, and the maintenance commands bring projects forward deliberately.

### Version Conflict Resolution

If a project already has a dependency installed at a version that differs from lint-sage's expected tilde pin:

- **During `init`:** lint-sage overwrites the version in `devDependencies` with its tilde pin and warns the user about the change (e.g., `⚠ eslint: overriding ^8.56.0 → ~9.22.0`). The `--force` flag suppresses the warning.
- **During `update`:** lint-sage updates the version to match the new expected pin. If the project has manually pinned a higher patch within the same minor (e.g., `~9.22.3` when lint-sage expects `~9.22.0`), lint-sage leaves it — the tilde range already satisfies the requirement. If the project has a different minor or major, lint-sage updates the range and reports it.
- **During `doctor`:** version mismatches are reported as warnings. `doctor --fix` updates `package.json` to match the expected pin.

This applies equally to shared config packages and third-party tooling.

## Failure and Safety Boundaries

The current design intentionally avoids a few risky behaviors:

- no automatic dependency installation
- no silent destructive overwrite of locally modified managed files
- no removal of dependencies or scripts that lint-sage did not track
- no monorepo package manager switching

These constraints are a core part of the architecture, not incidental implementation details.

## Future Extension Direction

The current v3 architecture is intentionally narrow: core tooling first, stable state tracking, and predictable update behavior before extensibility.

A future plugin system would let teams extend lint-sage beyond its core tooling. A plugin would be a standardized package that exports config files to copy, dependencies to add, and scripts to merge:

```bash
npx @vcian/lint-sage add stylelint
npx @vcian/lint-sage add cspell
```

Each plugin (e.g., `@vcian/lint-sage-plugin-stylelint`) would register itself in `.lint-sage.json` and lint-sage would compose it alongside the core config during `init`, `update`, and `doctor`:

```json
{
  "schemaVersion": 1,
  "version": "3.0.0",
  "stack": "react",
  "variant": "next-js",
  "plugins": ["stylelint", "cspell"],
  "managedFiles": { "...": "..." },
  "addedDependencies": ["..."],
  "addedScripts": ["..."]
}
```

This keeps the core lean while letting individual teams extend it with tools specific to their needs. The `.lint-sage.json` schema is designed to be forwards-compatible with plugin tracking.

## Relationship to Other Docs

- `docs/overview.md`
  Product summary and goals.
- `docs/glossary.md`
  Shared terminology for stacks, variants, managed files, and update states.
