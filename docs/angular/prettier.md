# Prettier Configuration (.prettierrc.json)

## Overview

The `.prettierrc.json` file is used with Prettier, a code formatter, to define code styling rules and formatting options.

The `.prettierrc.json` file sets Prettier formatting rules, ensuring code consistency and adherence to styling preferences. Customize these settings according to project requirements and coding conventions.


### `printWidth`

- **Description:** Specifies the maximum line width before wrapping.
- **Value:** `80`

### `tabWidth`

- **Description:** Specifies the number of spaces per indentation-level.
- **Value:** `2`

### `trailingComma`

- **Description:** Controls the usage of trailing commas in object literals and arrays.
- **Value:** `"es5"`

### `singleQuote`

- **Description:** Defines whether to use single quotes instead of double quotes for strings.
- **Value:** `true`

### `semi`

- **Description:** Indicates whether to add a semicolon at the end of statements.
- **Value:** `true`

### `bracketSpacing`

- **Description:** Controls whether to add spaces inside object literals' curly braces.
- **Value:** `true`

### `endOfLine`

- **Description:** Specifies the type of line endings.
- **Value:** `"lf"`

### `overrides`

- **Description:** Allows specific configurations for certain file types.

  #### CSS, SCSS, HTML Files

  - `files`
    - `"**/*.css"`
    - `"**/*.scss"`
    - `"**/*.html"`
  - `options`
    - `singleQuote`: `false` (Overrides single quotes for these file types)

