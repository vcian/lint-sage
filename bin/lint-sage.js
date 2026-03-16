#!/usr/bin/env node

import('../dist/cli.js')
  .then(({ run }) => run(process.argv))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(
      error instanceof Error ? `Error: ${error.message}` : 'An unexpected error occurred.',
    );
    process.exitCode = 1;
  });
