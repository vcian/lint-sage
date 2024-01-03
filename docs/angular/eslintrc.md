# ESLint Configuration (.eslintrc.json)

## Overview

The `.eslintrc.json` file is used with ESLint, a JavaScript and TypeScript linter, to enforce coding standards, catch errors, and maintain a consistent codebase.

The `.eslintrc.json` file is essential for enforcing coding standards and maintaining a consistent codebase in TypeScript and Angular projects. Customize based on project requirements.

### `root`

- **Description:** Indicates that this `.eslintrc.json` is the root configuration file.
- **Value:** `true`

### `ignorePatterns`

- **Description:** Defines patterns for files and directories to be ignored by ESLint.
- **Value:** 
  - `projects/**/*`: Ignores all files under the `projects` directory.

### `overrides`

#### TypeScript Files (`*.ts`)

- **Description:** Configuration specifically for TypeScript files.

  - `extends`
    - `eslint:recommended`: Inherits recommended ESLint rules.
    - `plugin:@typescript-eslint/recommended`: Includes recommended TypeScript ESLint rules.
    - `plugin:@angular-eslint/recommended`: Integrates recommended Angular ESLint rules.
    - `plugin:@angular-eslint/template/process-inline-templates`: Handles inline template processing for Angular.
    - `plugin:@typescript-eslint/eslint-recommended`: Recommends ESLint rules for TypeScript from TypeScript ESLint.

  - `rules`
    - `@angular-eslint/directive-selector`: Specifies directives' naming conventions.
    - `@angular-eslint/component-selector`: Specifies component naming conventions.
    - `max-len`: Sets maximum line length to 120 characters.
    - `semi`: Enforces the usage of semicolons.
    - `@typescript-eslint/member-delimiter-style`: Specifies member delimiter style for TypeScript.
    - `no-magic-numbers`: Disallows magic numbers except for specific cases.
    - `no-console`: Disallows the usage of `console` statements.
    - `no-extra-boolean-cast`: Allows extra boolean casts.

#### HTML Files (`*.html`)

- **Description:** Configuration specifically for HTML files.

  - `extends`
    - `plugin:@angular-eslint/template/recommended`: Incorporates recommended Angular template ESLint rules.
    - `plugin:@angular-eslint/template/accessibility`: Focuses on template accessibility rules.

  - `rules`
    - `prefer-template`: Encourages the use of template literals in HTML.
