import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const websiteRoot = path.resolve(import.meta.dirname, '..');
const source = path.resolve(websiteRoot, '../asset-site/public/previews');
const destination = path.resolve(websiteRoot, 'public/previews');

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true, force: true });
process.stdout.write('Staged asset-site previews for the combined website.\n');
