# @vcian/lint-sage

A CLI tool that bootstraps linting, formatting, and code quality infrastructure for ViitorCloud TypeScript projects.

**Copy-paste, not dependency.** Config files are scaffolded directly into your project. You own every file. Zero runtime coupling after setup.

## Quick Start

```bash
npx @vcian/lint-sage@latest init
```

> Requires **Node 18+** and an initialized **git repository** (`git init`).

## What Gets Scaffolded

| Tool | Files |
|------|-------|
| ESLint | `eslint.config.mjs` (v9+) or `.eslintrc.*` (v8 legacy) |
| Prettier | `.prettierrc`, `.prettierignore` |
| EditorConfig | `.editorconfig` |
| Husky | `.husky/pre-commit`, `.husky/commit-msg` |
| lint-staged | Configuration in `package.json` |
| commitlint | `commitlint.config.mjs` (conventional commits) |
| VS Code | `.vscode/settings.json`, `.vscode/extensions.json` |
| GitHub Actions | `.github/workflows/lint.yml` |

### Scripts Added to `package.json`

| Script | Command | Purpose |
|--------|---------|---------|
| `lint` | `eslint .` | CI lint check |
| `format:check` | `prettier --check .` | CI format check |
| `prepare` | `husky` | Git hooks setup on install |

## Supported Frameworks

### React
- **Vite + React + TS** — React hooks, JSX, import sorting rules
- **Next.js** — Extends built-in `eslint-config-next` (never replaces)
- **TanStack Start** — React + hooks + refresh plugins

### Node
- **Express** — Node + TypeScript rules
- **Fastify** — Node + TypeScript rules
- **NestJS** — Decorator support, strict mode rules

### Angular
- **Angular Standalone** — Coexists with `@angular-eslint`
- **Angular SSR** — Same as standalone with SSR support

## How It Works

1. **Detect** — Reads your environment: framework, package manager, existing tools, Node version
2. **Resolve** — Determines what to install vs. configure (respects existing tools)
3. **Report** — Shows a clear environment report for your confirmation
4. **Scaffold** — Installs missing dependencies, patches `package.json`, writes config files

### Key Behaviors

- **Tool already installed?** Keep it. Only configure rules.
- **Tool not installed?** Install the latest compatible version, then configure.
- **ESLint v8 detected?** Uses legacy `.eslintrc.*` format (not flat config).
- **File already exists?** Shows a diff and asks before overwriting.

## Requirements

- Node.js 18 or later
- Git repository initialized (`git init`)
- A `package.json` in the project root

## License

[MIT](LICENSE)
