import { execSync } from 'node:child_process';
import type { NodeVersion } from '../types.js';

export function detectNodeVersion(): NodeVersion {
  const raw = execSync('node --version', { encoding: 'utf-8' }).trim();
  const match = raw.match(/^v(\d+)\.(\d+)\.(\d+)/);

  if (!match) {
    throw new Error(`Could not parse Node.js version from: ${raw}`);
  }

  const version: NodeVersion = {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };

  if (version.major < 18) {
    console.error(
      `\n❌ Node.js v${version.major}.${version.minor}.${version.patch} is not supported.\n` +
        `   Lint Sage requires Node.js 18 or later.\n` +
        `   Please upgrade: https://nodejs.org/\n`,
    );
    process.exit(1);
  }

  return version;
}
