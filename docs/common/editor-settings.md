# Visual Studio Code Settings (settings.json)

## Overview

The `settings.json` file configures Visual Studio Code (VSCode) settings to customize the editor's behavior and integrate with code formatting and linting tools. It is recommended to maintain consistent configurations across all developers' VSCode editors for a unified development experience.

The `settings.json` file enhances the VSCode editor experience by enabling automatic code formatting on save and paste, specifying the default formatter, and defining code actions for ESLint and import organization.

### Configuration Details

- **`editor.formatOnSave`**

  - **Description:** Enables automatic code formatting when saving a file.
  - **Value:** `true`

- **`editor.formatOnPaste`**

  - **Description:** Enables automatic code formatting when pasting code into the editor.
  - **Value:** `true`

- **`editor.defaultFormatter`**

  - **Description:** Sets the default formatter for code formatting.
  - **Value:** `"esbenp.prettier-vscode"`

- **`editor.codeActionsOnSave`**

  - **Description:** Defines code actions to run on save.
  - **Actions:**
    - `source.fixAll.eslint`: Runs ESLint to fix all issues.
    - `source.fixAll.format`: Runs the default formatter to fix formatting issues.
    - `source.organizeImports`: Organizes imports in the source code.

- **`files.eol`**
  - **Description:** Specifies the default end-of-line (EOL) character.
  - **Value:** `"\n"`
