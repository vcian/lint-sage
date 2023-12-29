# Prettier Configuration (.prettierrc.json)

## Overview

The `.prettierrc.json` file is used with Prettier, a code formatter, to define code styling rules and formatting options.

The `.prettierrc.json` file sets Prettier formatting rules, ensuring code consistency and adherence to styling preferences. Customize these settings according to project requirements and coding conventions.

### Configuration Details

- **`singleQuote`**

  - **Description:** Enables the use of single quotes for string literals.
  - **Value:** `true`

- **`semi`**

  - **Description:** Enforces the use of semicolons at the end of statements.
  - **Value:** `true`

- **`tabWidth`**

  - **Description:** Specifies the number of spaces for an indentation level.
  - **Value:** `2`

- **`trailingComma`**

  - **Description:**  Configures the placement of trailing commas in object literals, arrays, and function parameters.
  - **Value:** `all`
  
- **`printWidth`**

  - **Description:** Specifies the maximum line length before wrapping.
  - **Value:** `80`

- **`endOfLine`**
  - **Description:** Specifies the line ending style.
  - **Value:** `"lf"`

# Prettier Ignore File (.prettierignore)

## Overview

The `.prettierignore` file is used with Prettier, a code formatter, to specify files and directories that should be excluded from formatting.

The `.prettierignore` file excludes files and directories from Prettier formatting. Customize this file based on project requirements and coding conventions.

### Configuration Details



- **Pattern: `package-lock.json`**

  - **Description:** Excludes the `package-lock.json` file from formatting.

- **Pattern: `dist`**

  - **Description:** Excludes the `dist` directory from formatting.

- **Pattern: `public`**

  - **Description:** Excludes the `public` directory from formatting.

- **Pattern: `node_modules`**

  - **Description:** Excludes the `node_modules` directory from formatting.

