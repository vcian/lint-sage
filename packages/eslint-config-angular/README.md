# @vcian/eslint-config-angular

Shared ESLint flat config for Angular + TypeScript projects by Viitor Cloud.

## Installation

```bash
npm install -D @vcian/eslint-config-angular eslint typescript
```

## Usage

Create an `eslint.config.js` in your project root:

```js
const vcianAngular = require('@vcian/eslint-config-angular');

module.exports = [
  ...vcianAngular,
  {
    rules: {
      // your overrides here
    },
  },
];
```

## Included Plugins & Rules

- **@typescript-eslint** — TypeScript-aware linting (no-unused-vars, no-explicit-any, consistent-type-imports)
- **@angular-eslint/eslint-plugin** — Angular component/directive rules (class suffixes, lifecycle interfaces)
- **@angular-eslint/eslint-plugin-template** — Angular `.html` template linting (banana-in-box, no-negated-async)
- **@angular-eslint/template-parser** — Parser for `.html` Angular templates
- **eslint-plugin-import** — Import ordering and duplicate detection
- **eslint-config-prettier** — Disables formatting rules that conflict with Prettier

## lint-sage

This config is automatically wired when you run `npx @vcian/lint-sage init` and select an Angular variant.
