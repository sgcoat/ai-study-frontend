import { mkdir, readdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output' || !args[1])) throw new Error('Usage: pnpm frontend:export [--output work/frontend-publish]');
const output = resolve(root, args[1] ?? 'work/frontend-publish');
const work = resolve(root, 'work');
const relativeOutput = relative(work, output);
if (relativeOutput.startsWith('..') || output === work) throw new Error('Choose a new directory inside work/.');

const files = ['App.tsx', 'index.ts', 'app.json', 'app.config.js', 'eas.json', 'tsconfig.json',
  'pnpm-lock.yaml', '.env.example', '.gitignore', '.easignore',
  'scripts/prepare-mobile.mjs', 'scripts/export-frontend.mjs',
  'supabase/projects.json', 'supabase/scripts/connect-app.mjs', 'supabase/scripts/start-app.mjs',
  'docs/MOBILE_DEPLOYMENT.md', 'docs/FRONTEND_README.md'];
async function collect(directory) {
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    const name = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${name}`);
    if (entry.isFile() && entry.name === '.gitkeep') continue;
    if (entry.isDirectory()) await collect(name);
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(name);
    else throw new Error(`Unexpected source entry: ${name}`);
  }
}
await collect('src');
const contents = [];
for (const name of files.sort()) {
  if (!(await lstat(resolve(root, name))).isFile()) throw new Error(`Expected regular file: ${name}`);
  contents.push([name, await readFile(resolve(root, name))]);
}
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
manifest.scripts = {
  dev: 'node supabase/scripts/start-app.mjs', start: 'expo start', android: 'expo start --android', ios: 'expo start --ios',
  typecheck: 'tsc --noEmit', 'dev:cloud': 'node supabase/scripts/start-app.mjs',
  'cloud:connect': 'node supabase/scripts/connect-app.mjs', 'mobile:prepare': 'node scripts/prepare-mobile.mjs',
  'frontend:export': 'node scripts/export-frontend.mjs',
};
manifest.engines = { node: '>=24.0.0' };
manifest.packageManager = 'pnpm@12.4.2';
await mkdir(dirname(output), { recursive: true });
await mkdir(output); // Never overwrite an earlier export or Git checkout.
for (const [name, content] of contents) {
  const target = resolve(output, name);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, { flag: 'wx' });
}
await writeFile(resolve(output, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
await writeFile(resolve(output, 'README.md'), await readFile(resolve(root, 'docs/FRONTEND_README.md')), { flag: 'wx' });
console.log(`Prepared ${files.length + 2} frontend files in ${relative(root, output)}/`);
console.log('No server implementation, credentials, runtime environment, database, photos, or build output was copied.');
