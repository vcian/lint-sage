# Prettier Configuration (.prettierrc.json)

## Overview

The `.prettierrc.json` file is used with Prettier, a code formatter, to define code styling rules and formatting options.

The `.prettierrc.json` file sets Prettier formatting rules, ensuring code consistency and adherence to styling preferences. Customize these settings according to project requirements and coding conventions.

### Configuration Details

- **`printWidth`**

  - **Description:** Specifies the maximum line length before wrapping.
  - **Value:** `80`

- **`singleQuote`**

  - **Description:** Determines whether single or double quotes are used for strings.
  - **Value:** `false`

- **`trailingComma`**

  - **Description:** Controls the usage of trailing commas in object literals and arrays.
  - **Value:** `"es5"`

- **`tabWidth`**

  - **Description:** Defines the number of spaces per indentation level.
  - **Value:** `2`

- **`endOfLine`**
  - **Description:** Specifies the line ending style.
  - **Value:** `"lf"`

# Prettier Ignore File (.prettierignore)

## Overview

The `.prettierignore` file is used with Prettier, a code formatter, to specify files and directories that should be excluded from formatting.

The `.prettierignore` file excludes files and directories from Prettier formatting. Customize this file based on project requirements and coding conventions.

### Configuration Details

- **Pattern: `.next`**

  - **Description:** Excludes the `.next` directory from formatting.

- **Pattern: `.cache`**

  - **Description:** Excludes the `.cache` directory from formatting.

- **Pattern: `package-lock.json`**

  - **Description:** Excludes the `package-lock.json` file from formatting.

- **Pattern: `public`**

  - **Description:** Excludes the `public` directory from formatting.

- **Pattern: `node_modules`**

  - **Description:** Excludes the `node_modules` directory from formatting.

- **Pattern: `next-env.d.ts`**

  - **Description:** Excludes the `next-env.d.ts` file from formatting.

- **Pattern: `next.config.ts`**

  - **Description:** Excludes the `next.config.ts` file from formatting.
