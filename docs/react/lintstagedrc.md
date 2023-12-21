# lint-staged Configuration (.lintstagedrc.json)

## Overview

The `.lintstagedrc.json` file configures lint-staged, a Git pre-commit hook tool, to run specific tasks on files that are staged for commit.

The `.lintstagedrc.json` file optimizes the pre-commit process by focusing linting and formatting tasks on staged files. Customize the configuration based on project requirements and coding conventions.

### Configuration Details

- **Pattern: `**/\*.{js,jsx,ts,tsx}`\*\*

  - **Description:** Targets JavaScript and TypeScript files for linting and formatting.
  - **Tasks:**
    - `eslint --fix`: Runs ESLint with the fix option to automatically correct linting issues.
    - `prettier --config ./.prettierrc.json --write`: Runs Prettier with a specific configuration file to format code.

- **Pattern: `**/\*.{css,scss,md,html,json}`\*\*
  - **Description:** Targets CSS, SCSS, Markdown, HTML, and JSON files for formatting.
  - **Task:**
    - `prettier --config ./.prettierrc.json --write`: Runs Prettier with a specific configuration file to format code.
