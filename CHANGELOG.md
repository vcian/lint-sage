## 3.0.0

_Unreleased_

Complete rewrite of lint-sage as a stateful CLI with lifecycle management.

### Reliability Improvements (Unreleased)

- Added `init` compatibility preflight checks for known peer-conflict combinations (e.g. `ts-jest@29` with TypeScript 6, `@typescript-eslint@8` with ESLint 10).
- Added Angular SSR mismatch warnings when host project versions for `@angular/build` and `@angular/ssr` are not aligned.
- Added shared-package availability checks so `init` fails early if required `@vcian/*` packages are not resolvable from npm.
- Added `init --fix-compat` support (and interactive confirmation path) to auto-remediate known conflict pairs like `typescript@6 + ts-jest@29` and `eslint@10 + @typescript-eslint@8`.
- Added `init --skip-shared-check` for local testing workflows where shared `@vcian/*` packages are installed from local links/tarballs instead of npm registry.
- Added deterministic compatibility override generation in package updates (`eslint`, `@typescript-eslint/*`, Angular SSR alignment).
- Added explicit override reporting in `update` output so pinned compatibility changes are visible.
- Added `doctor` override health checks (missing/mismatched overrides) and `doctor --fix` reconciliation support.
- Updated docs to reflect generated CI workflow path (`.github/workflows/lint.yml`) and new preflight behavior.

### New Features

- **`init` command** — interactive stack/variant selection, preset support (`--preset`), generates ESLint, Prettier, Husky, lint-staged, commitlint, VS Code, and GitHub Actions configs
- **`update` command** — three-state merge model (auto-replace, keep, conflict) to safely update configs when org standards evolve
- **`doctor` command** — health checks for managed files, dependency versions, Husky hooks, legacy configs, and shared config resolution; `--fix` flag for auto-repair
- **`eject` command** — inlines all hidden configuration (ESLint, Prettier, commitlint) into standalone config files, removes only `@vcian/*` wrapper dependencies, keeps scripts and non-ejectable files (Husky, VS Code, lint-staged, CI), and deletes `.lint-sage.json`. Supports drift detection, `--dry-run`, and monorepo per-package ejection
- **Monorepo support** — auto-detects Turborepo, Nx, npm/yarn/pnpm workspaces, Lerna; shared root configs with per-package ESLint
- **Composable shared config packages** — `@vcian/eslint-config-react`, `@vcian/eslint-config-node`, `@vcian/eslint-config-angular`, `@vcian/prettier-config`, `@vcian/commitlint-config`
- **`.lint-sage.json` state tracking** — records managed files, added dependencies/scripts, template hashes for safe updates and clean eject
- **ESLint 9 flat config** — all generated configs use the flat config format
- **Tilde-pinned dependency versioning** — allows patches, blocks unreviewed minor/major bumps
- **`--dry-run`** — preview changes without writing files (init, update, eject)
- **`--package-manager`** — override auto-detection for npm, pnpm, or yarn
- **GitHub Actions CI workflow generation** — `.github/workflows/lint.yml` generated per stack

### Breaking Changes

- Minimum Node.js version raised to 20
- All v2 config files (`config/` directory) removed — replaced by template-based generation in `src/templates/`
- CLI is now command-based (`init`, `update`, `doctor`, `eject`) instead of the v2 single-command model
- Generated ESLint configs use flat config format (ESLint 9.x) instead of legacy `.eslintrc.*`
- Generated configs import shared config packages instead of inlining rules

---

## 2.1.0

_Feb 19, 2024_

- add interface naming convention rule for nestjs
- remove mix-operator rule for Nest.
- change max-length from 200 to 120
- add es5 value in trailingComma

## 2.0.2

_Jan 9, 2024_

- Fix the double quotation issue in the commands scripts.lint and scripts.prepare

## 2.0.1

_Jan 8, 2024_

- Remove 'multiline-ternary' rule of ESLint for Nestjs.
- Add 'no-nested-ternary' rule of ESLint for Nest.

## 2.0.0

_Jan 3, 2024_

- Added support for the Angular( [@vc-vishakha](https://github.com/vc-vishakha) in [#7](https://github.com/vcian/lint-sage/pull/7) )
- Added support for the Nestjs( [@vc-lbmadesia](https://github.com/vc-lbmadesia) in [#5](https://github.com/vcian/lint-sage/pull/5) ).
- Added Documentation for configs in Angular, Next js and Nest js.

## 1.1.1

_Dec 8, 2023_

- Update VS Code settings to use LF (line feed) as end of line (EOL)

## 1.1.0

_Nov 24, 2023_

- Added a curated list of recommended Visual Studio Code (VSCode) extensions to enhance development workflow and productivity. ([@palaklive](https://github.com/palaklive) in [#3](https://github.com/vcian/lint-sage/pull/3))
- Enhance TypeScript function return type flexibility. ([@raj-vc](https://github.com/raj-vc) in [#3](https://github.com/vcian/lint-sage/pull/3))

## 1.0.5(Initial Release)

_Nov 16, 2023_

- Integrated `ESLint` with standard rules for consistent code quality.
- Implemented `Prettier` for automatic code formatting and style consistency.
- Introduced `Husky` Git hooks for pre-commit and pre-push checks.
- Added `Lint Staged` to validate staged changes against coding standards.
- Provided optimized VS Code configuration for seamless development.
