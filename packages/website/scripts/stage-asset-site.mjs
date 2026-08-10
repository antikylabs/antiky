import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const websiteRoot = path.resolve(import.meta.dirname, '..');
const source = path.resolve(websiteRoot, '../asset-catalog/dist/previews');
const destination = path.resolve(websiteRoot, 'public/previews');

await mkdir(destination, { recursive: true });
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true, force: true });
process.stdout.write('Staged asset-catalog previews for the combined website.\n');
