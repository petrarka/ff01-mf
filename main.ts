import { cpSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

// Package only our static frontend and real screenshots. No clock or network is used.
const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
mkdirSync(output, { recursive: true });
const actualOutput = realpathSync(output);
for (const name of ['app', 'screenshots']) {
  const source = realpathSync(resolve(root, name));
  const inside = relative(source, actualOutput);
  if (inside === '' || (!inside.startsWith('..') && !isAbsolute(inside))) {
    throw new Error('MAKEFUN_OUTPUT_DIR must be outside app/ and screenshots/.');
  }
}
if (actualOutput === realpathSync(root)) throw new Error('MAKEFUN_OUTPUT_DIR must not be the repository root.');
for (const name of ['app', 'screenshots']) {
  // Replace generated trees so an older export cannot add unrelated files.
  rmSync(resolve(output, name), { recursive: true, force: true });
  cpSync(resolve(root, name), resolve(output, name), { recursive: true });
}
const { buildDossier } = await import('./vendor/makefun-frontend.ts');
const bytes = buildDossier(output, {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 256 * 1024 },
  app_max_files: 993,
  app_max_bytes: 16 * 1024 * 1024,
  app_path_max_bytes: 1000
});
writeFileSync(resolve(output, 'dossier.json'), bytes);
const dossier = JSON.parse(new TextDecoder().decode(bytes));
console.log(dossier.text.split('\n').find((line: string) => line.startsWith('Totals:')));
