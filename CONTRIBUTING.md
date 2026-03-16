# Contributing to lint-sage

## Purpose

Thanks for contributing to `lint-sage`.

This project is intended to help Viitor Cloud teams bootstrap and maintain consistent linting, formatting, commit, editor, and CI standards across TypeScript projects. Contributions should keep that core goal in mind: reduce setup drift, improve maintainability, and make standards easier to adopt safely.

## Start Here

Before making changes, read the docs that define the product direction:

- `README.md`
- `docs/architecture.md` — technical structure, design, and detailed command behavior
- `docs/overview.md` — product summary and goals
- `docs/glossary.md` — shared terminology

When code and docs disagree, treat `docs/architecture.md` as the source of truth unless the pull request explicitly updates it.

## What We Welcome

Contributions are especially helpful in these areas:

- CLI command implementation (`init`, `update`, `doctor`, `eject`)
- Template generation and merge logic
- Monorepo support
- Shared config packages
- Tests for edge cases and upgrade paths
- Documentation improvements and onboarding clarity

## Before You Change Anything

Try to keep changes aligned with the project's existing principles:

- TypeScript-only support
- Safe defaults over clever behavior
- No silent destructive changes
- No automatic install commands
- Clear user-facing output
- Monorepo-aware behavior where relevant

If your change affects product behavior, update the relevant docs in `docs/` in the same pull request.

## Contribution Workflow

1. Read the relevant spec and architecture docs for the area you want to change.
2. Create a focused branch.
3. Make the smallest change that fully solves the problem.
4. Add or update tests when behavior changes.
5. Update docs when user-facing behavior or architecture changes.
6. Open a pull request with enough context for a reviewer to understand the intent quickly.

## Commit Messages

Use Conventional Commits whenever possible. Examples:

- `feat: add init preset parsing`
- `fix: preserve local config changes during update`
- `docs: clarify monorepo package manager detection`
- `test: cover doctor fix for missing husky hooks`

Keep commits small and reviewable. A series of focused commits is preferred over one large mixed commit.

## Pull Request Expectations

A good pull request should:

- Explain the problem being solved.
- Summarize the approach taken.
- Call out any tradeoffs or follow-up work.
- Mention which docs or sprint items were affected.
- Include test coverage or explain why tests were not added.

If the change updates CLI behavior, include example output or a short note describing the new UX.

## Testing

As the codebase grows, contributors should prefer tests that verify behavior rather than implementation details.

Prioritize:

- Integration tests for CLI flows
- Template generation tests
- Merge and conflict handling tests
- Monorepo detection and workspace discovery tests
- Regression tests for previously reported bugs

If a change is difficult to test automatically, explain the manual verification steps in the pull request.

## Documentation Changes

Documentation is part of the product here, not an afterthought.

Please update documentation when you change:

- Supported stacks or variants
- Generated files or template structure
- CLI flags or command behavior
- State file schema
- Versioning or package manager behavior

## Design Guidelines

When making implementation decisions, prefer:

- Predictable behavior over magic
- Explicit prompts over risky assumptions
- Structural merges over broad file rewrites
- Backward-compatible schema evolution where possible
- Clear errors that tell the user what to do next

## Review Guidelines

When reviewing contributions, prioritize:

- User-facing correctness
- Safety of file writes and updates
- Preservation of team-owned config changes
- Monorepo compatibility
- Test coverage for edge cases
- Clarity of docs and CLI output

## Questions and Proposals

If you want to propose a larger change, start by opening a discussion or updating the relevant spec doc that explains:

- The problem
- Why the current design is insufficient
- The proposed change
- Migration or compatibility concerns

Early alignment is much better than large surprise pull requests.

## Code of Conduct

By participating in this project, you agree to follow the expectations in `CODE_OF_CONDUCT.md`.
