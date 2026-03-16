# @vcian/eslint-config-react

Shared ESLint flat config for React + TypeScript projects by Viitor Cloud.

## Installation

```bash
npm install -D @vcian/eslint-config-react eslint typescript
```

## Usage

Create an `eslint.config.js` in your project root:

```js
const vcianReact = require('@vcian/eslint-config-react');

module.exports = [
  ...vcianReact,
  {
    rules: {
      // your overrides here
    },
  },
];
```

## Included Plugins & Rules

- **@typescript-eslint** — TypeScript-aware linting (no-unused-vars, no-explicit-any, consistent-type-imports)
- **eslint-plugin-react-hooks** — Rules of Hooks enforcement and exhaustive-deps
- **eslint-plugin-jsx-a11y** — Accessibility checks for JSX elements
- **eslint-plugin-import** — Import ordering and duplicate detection
- **eslint-plugin-unused-imports** — Auto-remove unused imports
- **eslint-config-prettier** — Disables formatting rules that conflict with Prettier

## lint-sage

This config is automatically wired when you run `npx @vcian/lint-sage init` and select a React variant.
