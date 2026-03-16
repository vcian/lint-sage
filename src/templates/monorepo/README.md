# Template Files

This directory contains the root-level template files for monorepo lint-sage setups.

Expected files:

- `prettier.config.js`
- `.commitlintrc.json`
- `.lintstagedrc.json`
- `.husky/pre-commit`
- `.husky/commit-msg`
- `.vscode/settings.json`
- `.vscode/extensions.json`
- `dependencies.json`

Per-package ESLint configs are sourced from the stack-specific template directories (e.g., `react/next-js/`, `node/nestjs/`).

`README.md` is documentation-only and is not copied into the target project.
