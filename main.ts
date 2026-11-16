import {cpSync, mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';

const repository = fileURLToPath(new URL('.', import.meta.url));
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
if (output === resolve(repository) || resolve(repository).startsWith(output + '/')) {
  throw new Error('Choose an output directory separate from the repository and its parents.');
}
mkdirSync(output, {recursive: true});
for (const name of ['app', 'screenshots']) {
  cpSync(join(repository, name), join(output, name), {recursive: true});
}
const {buildDossier} = await import('./vendor/makefun-frontend.ts');
const bytes = buildDossier(output, {
  text_max_bytes: 163840,
  screenshots: {max: 3, max_bytes: 262144},
  app_max_files: 993,
  app_max_bytes: 16777216
});
writeFileSync(join(output, 'dossier.json'), bytes);
const dossier = JSON.parse(new TextDecoder().decode(bytes));
function printTotals(value: unknown): void {
  if (typeof value === 'string') {
    const line = value.split('\n').find(line => line.startsWith('Totals:'));
    if (line) console.log(line);
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) printTotals(child);
  }
}
printTotals(dossier);
