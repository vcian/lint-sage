# ESLint Configuration (.eslintrc.json)

## Overview

The `.eslintrc.json` file is used with ESLint, a JavaScript and TypeScript linter, to enforce coding standards, catch errors, and maintain a consistent codebase.

The `.eslintrc.json` file is essential for enforcing coding standards and maintaining a consistent codebase in JavaScript and TypeScript projects. Customize based on project requirements.

### `env`

- **Description:** Specifies environments for ESLint.
- **Values:**
  - `browser`: Enables browser global variables.
  - `node`: Enables Node.js global variables.

### `parser`

- **Description:** Specifies the parser for code analysis.
- **Value:** `@typescript-eslint/parser`

### `parserOptions`

- **Description:** Configures parser options for ECMAScript and TypeScript.

### `plugins`

- **Description:** Lists ESLint plugins for linting specific code types.
  - `react`
  - `react-hooks`
  - `promise`
  - `import`
  - `@typescript-eslint`

### `ignorePatterns`

- **Description:** Ignores specified file patterns.

### `rules`

- **Description:** Specifies ESLint rules and their configurations.
  - `react/react-in-jsx-scope`: Turns off React import requirement.
  - `jsx-a11y/anchor-is-valid`: Turns off anchor element validation.
  - `@typescript-eslint/no-unused-vars`: Warns on unused TypeScript variables.
  - `prettier/prettier`: Enforces Prettier code formatting rules.
  - `promise/prefer-await-to-then`: Warns against using `.then()`.
