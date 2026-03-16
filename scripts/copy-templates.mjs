import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDirectory, '..');
const sourceDirectory = path.join(projectRoot, 'src', 'templates');
const destinationDirectory = path.join(projectRoot, 'dist', 'templates');

await rm(destinationDirectory, { force: true, recursive: true });
await mkdir(path.dirname(destinationDirectory), { recursive: true });
await cp(sourceDirectory, destinationDirectory, { recursive: true });
