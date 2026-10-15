import http from 'node:http';
import fs from 'node:fs';
import { cp, copyFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import next from 'next';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.env.BACKEND_INTERNAL_URL = 'http://localhost:3153/api';
process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:3153/api';
process.env.NEXT_PUBLIC_MEDIA_HOSTS = 'http://localhost:3153';
const previewDirectory = path.join(directory, 'e2e/platform-cinematic/app');
// Next route discovery ignores a symlinked src tree. Mirror source bytes into this
// task-owned preview and keep them current; auth and API code are copied unchanged.
for (const name of ['src', 'messages']) {
  const destination = path.join(previewDirectory, name);
  if (fs.lstatSync(destination).isSymbolicLink()) await unlink(destination);
  await cp(path.join(directory, name), destination, { recursive: true });
  fs.watch(path.join(directory, name), { recursive: true }, async (_event, filename) => {
    if (!filename || filename.includes('..')) return;
    const source = path.join(directory, name, filename);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) return;
    const target = path.join(destination, filename);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  });
}
const app = next({ dev: true, dir: previewDirectory, port: 3152 });
await app.prepare();
const handler = app.getRequestHandler();
http.createServer((request, response) => handler(request, response)).listen(3152, 'localhost', () => {
  process.stdout.write('Isolated cinematic platform preview: http://localhost:3152\n');
});
