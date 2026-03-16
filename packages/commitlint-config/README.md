# @vcian/commitlint-config

Shared commitlint config for Viitor Cloud projects. Enforces the [Conventional Commits](https://www.conventionalcommits.org/) format.

## Installation

```bash
npm install -D @vcian/commitlint-config @commitlint/cli
```

## Usage

Create a `.commitlintrc.json` in your project root:

```json
{
  "extends": ["@vcian/commitlint-config"]
}
```

## Rules

Extends `@commitlint/config-conventional`, which enforces:

- **type** — Required. Must be one of: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **scope** — Optional
- **subject** — Required. Lowercase, no period at end

## lint-sage

This config is automatically wired when you run `npx @vcian/lint-sage init`.
