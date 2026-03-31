# Contributing to Lint Sage

Thanks for contributing to Lint Sage. This project scaffolds linting, formatting, and code quality infrastructure for ViitorCloud TypeScript projects, so even small changes can affect how new projects are bootstrapped. Please favor clarity, predictability, and safe defaults.

## Before You Start

Read these project references before making non-trivial changes:

- `README.md`
- `AGENTS.md`
- `docs/overview.md`
- `docs/architecture.md`

The most important design rules are:

- Copy-paste, not dependency
- Detect first, scaffold second
- Respect existing tools instead of upgrading or replacing them
- Use framework-specific static templates
- Prompt before overwriting existing files
- Leave no trace outside the files the user asked to scaffold

## Local Setup

Lint Sage targets Node 18+ and uses npm in this repository.

```bash
npm ci
npm run build
npm run test -- --run
```

Useful commands during development:

```bash
npm run dev
npm run build
npm run test
```

## Project Map

- `src/cli.ts`: CLI entry point and top-level orchestration
- `src/detect/`: read-only environment detection
- `src/resolve/`: compatibility rules and action-plan generation
- `src/scaffold/`: dependency installation, `package.json` patching, file writing
- `templates/`: static framework-aware config templates
- `docs/`: product and architecture documentation

## Contribution Guidelines

### Keep the Pipeline Intact

The expected flow is:

1. Detect the environment
2. Resolve an action plan
3. Report the plan and ask for confirmation
4. Install missing dependencies
5. Scaffold files and patch `package.json`

Avoid changes that blur those responsibilities or introduce writes during detection.

### Respect Existing Projects

Lint Sage runs inside user projects. Changes should preserve the current safety model:

- Do not overwrite existing scripts with the same name
- Do not write files before the user confirms
- Do not silently replace framework-specific configs
- Do not introduce hidden state, caches, or trace files
- Keep all missing dependency installs in a single package-manager command

### Prefer Static, Auditable Templates

Templates should remain plain files organized by framework. If a framework needs different behavior, add or update the relevant template instead of introducing a complex templating engine.

### Keep Docs and Behavior in Sync

If you change supported frameworks, generated files, scripts, CLI prompts, or compatibility rules, update the related documentation in the same pull request.

## Testing Expectations

When your change affects behavior, add or update tests close to the code you changed:

- Detection changes: `src/detect/__tests__/`
- Resolution changes: `src/resolve/__tests__/`
- Scaffolding changes: `src/scaffold/__tests__/`

Before opening a pull request, run:

```bash
npm run build
npm run test -- --run
```

If your change affects release artifacts, rebuild `dist/` from source instead of editing generated files by hand.

## Pull Requests

To help reviews move quickly:

- Keep pull requests focused on one concern when possible
- Explain the user impact and affected frameworks or tools
- Call out any changes to generated files, prompts, install behavior, or overwrite behavior
- Include tests for new behavior or explain why tests were not needed
- Avoid bundling unrelated refactors with functional changes

For larger changes, opening an issue first is helpful so the design can be aligned before implementation.

## Reporting Bugs and Requesting Features

- Use GitHub issues for bug reports, feature requests, and documentation improvements
- Include reproduction steps, expected behavior, and actual behavior when reporting bugs
- If a report may expose a security issue, follow `SECURITY.md` instead of filing it publicly

## Community Standards

By participating in this repository, you agree to follow the expectations in `CODE_OF_CONDUCT.md`.
