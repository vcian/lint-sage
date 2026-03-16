# @vcian/prettier-config

Shared Prettier config for Viitor Cloud projects.

## Installation

```bash
npm install -D @vcian/prettier-config prettier
```

## Usage

Create a `prettier.config.js` in your project root:

```js
const vcianPrettier = require('@vcian/prettier-config');

module.exports = {
  ...vcianPrettier,
};
```

Or reference it in `package.json`:

```json
{
  "prettier": "@vcian/prettier-config"
}
```

## Formatting Rules

| Option         | Value  |
| -------------- | ------ |
| printWidth     | 100    |
| tabWidth       | 2      |
| useTabs        | false  |
| semi           | true   |
| singleQuote    | true   |
| trailingComma  | all    |
| bracketSpacing | true   |
| arrowParens    | always |
| endOfLine      | lf     |

## lint-sage

This config is automatically wired when you run `npx @vcian/lint-sage init`.
