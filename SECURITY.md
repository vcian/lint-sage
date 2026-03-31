# Security Policy

## Supported Versions

Security fixes are expected to land in the latest supported release line.

| Version | Supported |
| --- | --- |
| `3.x` | Yes |
| `< 3.0.0` | No |

## Scope

Please report vulnerabilities that affect the safety or integrity of Lint Sage itself, including:

- The CLI execution flow
- Dependency installation behavior
- File writes and overwrite handling
- `package.json` patching
- Framework detection and template resolution
- Generated templates and GitHub workflow files

Examples of issues that are in scope:

- Arbitrary file write or path traversal
- Command injection through package-manager or shell execution
- Unexpected modification of files outside the target project
- Vulnerabilities introduced by generated workflow or hook templates
- Disclosure of sensitive information through logs or prompts

## How to Report a Vulnerability

Please do not open a public GitHub issue, pull request, or discussion with vulnerability details.

Preferred path:

1. Use GitHub's private vulnerability reporting for the repository if it is available.
2. If that path is unavailable, contact the maintainers through a private ViitorCloud channel.
3. If you do not already have a private route, post a minimal public note asking for one, without including exploit details, affected files, payloads, or proof-of-concept steps.

Include as much of the following as you can:

- Affected version or commit
- Description of the issue and possible impact
- Reproduction steps or proof of concept
- Any mitigations or workarounds you have identified

## What to Expect

The maintainers aim to:

- Acknowledge reports within 5 business days
- Validate and assess the issue
- Work on a fix or mitigation for supported versions
- Coordinate disclosure once users have a reasonable path to update

Response times may vary depending on report quality, severity, and maintainer availability.

## Disclosure Guidelines

Please allow time for investigation and remediation before sharing details publicly. Once a fix is available, the maintainers may disclose the issue in release notes, changelog entries, or a security advisory.

## Security Notes for Contributors

When contributing to Lint Sage, please keep these project-specific risks in mind:

- Detection should remain read-only
- Writes should stay within the intended project directory
- Overwrites should require explicit user confirmation
- Package-manager commands should avoid unsafe string interpolation
- Templates and workflows should not encourage unsafe defaults or leak secrets

If you are unsure whether something is a security issue, report it anyway.
