# @vcian/eslint-config-node

Shared ESLint flat config for Node.js + TypeScript projects by Viitor Cloud.

## Installation

```bash
npm install -D @vcian/eslint-config-node eslint typescript
```

## Usage

Create an `eslint.config.js` in your project root:

```js
const vcianNode = require('@vcian/eslint-config-node');

module.exports = [
  ...vcianNode,
  {
    rules: {
      // your overrides here
    },
  },
];
```

## Included Plugins & Rules

- **@typescript-eslint** — TypeScript-aware linting (no-unused-vars, no-explicit-any, consistent-type-imports)
- **eslint-plugin-n** — Node.js-specific rules (no-process-exit, unsupported features)
- **eslint-plugin-security** — Security-sensitive pattern detection
- **eslint-plugin-import** — Import ordering and duplicate detection
- **eslint-config-prettier** — Disables formatting rules that conflict with Prettier

## lint-sage

This config is automatically wired when you run `npx @vcian/lint-sage init` and select a Node variant.
