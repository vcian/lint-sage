# Changelog

## 3.0.0

__Unreleased__

### Complete Rewrite

v3 is a ground-up rewrite of Lint Sage. The project has been redesigned from a simple config-copy script into a full CLI tool with intelligent environment detection, smart dependency resolution, and framework-aware scaffolding.

### Breaking Changes

- **ESM-only** — The package now uses `type: "module"` and ships ESM output. Node 18+ is required.
- **New CLI interface** — Usage changed from `npx @vcian/lint-sage` to `npx @vcian/lint-sage@latest init`. The tool now uses `commander` with a proper `init` command.
- **ESLint flat config by default** — New projects get `eslint.config.mjs` (ESLint v9 flat config). Legacy `.eslintrc.*` format is used only when an existing ESLint v8 installation is detected.
- **Removed old config directory** — The `config/` directory with hardcoded JSON/JS configs has been replaced by a `templates/` directory organized by tool and framework.
- **Removed `index.js` entry point** — Replaced by a compiled TypeScript CLI at `dist/cli.js`.

### New Features

- **Automatic framework detection** — Detects 8 frameworks from `package.json` dependencies: `vite-react-ts`, `next-js`, `tanstack-react-start`, `express`, `fastify`, `nestjs`, `angular-standalone`, `angular-ssr`.
- **Package manager detection** — Automatically detects npm, yarn, or pnpm via lock files and uses the correct install command.
- **Smart dependency resolution** — Only installs missing tools. Existing ESLint, Prettier, Husky, lint-staged, and commitlint installations are detected and respected.
- **ESLint v8/v9 compatibility** — Automatically selects flat config (`eslint.config.mjs`) or legacy config (`.eslintrc.cjs`) based on the installed ESLint version. Conflicting config files are cleaned up.
- **Environment report** — Displays a full summary of what was detected and what will be changed before prompting for user confirmation.
- **Diff-based overwrite prompts** — When a config file already exists, the tool shows a diff and asks for explicit confirmation before overwriting.
- **commitlint** — New tool. Scaffolds `commitlint.config.mjs` with conventional commits rules, plus a `.husky/commit-msg` hook to enforce them.
- **EditorConfig** — New tool. Scaffolds `.editorconfig` for IDE-agnostic formatting consistency.
- **VS Code integration** — New tool. Scaffolds `.vscode/settings.json` (format-on-save, ESLint auto-fix) and `.vscode/extensions.json` (recommended extensions).
- **GitHub Actions CI** — New tool. Scaffolds `.github/workflows/lint.yml` for automated lint and format checks on PRs.
- **`.prettierignore`** — Now scaffolded alongside `.prettierrc`.

### New Frameworks (vs v2)

| Framework | Detection |
|-----------|-----------|
| `vite-react-ts` | `vite` + `react` + `typescript` in deps |
| `next-js` | `next` in deps (extends `eslint-config-next`) |
| `tanstack-react-start` | `@tanstack/react-start` in deps |
| `express` | `express` in deps (no frontend framework) |
| `fastify` | `fastify` in deps |
| `nestjs` | `@nestjs/core` in deps |
| `angular-standalone` | `@angular/core` in deps |
| `angular-ssr` | `@angular/core` + `@angular/ssr` in deps |

### Architecture

- **TypeScript** — Full TypeScript codebase with strict mode, compiled to ESM.
- **Modular pipeline** — Detect -> Resolve -> Report -> Scaffold. Detection is read-only with no side effects; scaffolding only runs after user confirmation.
- **Template-based configs** — Each framework has its own static template files under `templates/`. No templating engine, no conditionals in configs.
- **Testing** — Vitest test suite (v2 had no tests).

### Config Files Scaffolded

| Tool | Files |
|------|-------|
| ESLint | `eslint.config.mjs` or `.eslintrc.cjs` (per framework) |
| Prettier | `.prettierrc`, `.prettierignore` |
| EditorConfig | `.editorconfig` |
| Husky | `.husky/pre-commit`, `.husky/commit-msg` |
| commitlint | `commitlint.config.mjs` |
| lint-staged | Config in `package.json` |
| VS Code | `.vscode/settings.json`, `.vscode/extensions.json` |
| GitHub Actions | `.github/workflows/lint.yml` |

### Scripts Added to `package.json`

| Script | Command |
|--------|---------|
| `lint` | `eslint .` |
| `format:check` | `prettier --check .` |
| `prepare` | `husky` |

Existing scripts with the same name are never overwritten.

### Dependencies

Runtime dependencies kept to a minimum:
- `commander` ^14 — CLI framework
- `@inquirer/prompts` ^8 — Interactive prompts

Tool versions installed for new projects:
- ESLint ^9, Prettier ^3, Husky ^9, lint-staged ^15, commitlint ^19

---

## 2.1.0

_Feb 19, 2024_

- add interface naming convention rule for nestjs
- remove mix-operator rule for  Nest.
- change max-length from 200 to 120
- add es5 value in trailingComma

## 2.0.2

_Jan 9, 2024_

- Fix the double quotation issue in the commands scripts.lint and scripts.prepare

## 2.0.1

_Jan 8, 2024_

- Remove 'multiline-ternary' rule of ESLint for Nestjs.
- Add 'no-nested-ternary' rule of ESLint for  Nest.

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

## 1.0.5 (Initial Release)

_Nov 16, 2023_

- Integrated `ESLint` with standard rules for consistent code quality.
- Implemented `Prettier` for automatic code formatting and style consistency.
- Introduced `Husky` Git hooks for pre-commit and pre-push checks.
- Added `Lint Staged` to validate staged changes against coding standards.
- Provided optimized VS Code configuration for seamless development.
