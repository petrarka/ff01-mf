// Entry point for the makefun-frontend-01 bounty (Node 22, standard library only).
//
// The frontend is the static app/ folder beside this file: index.html, ES modules, one
// stylesheet, no build step, no dependencies. This program hands it in by copying app/ and
// screenshots/ into the output directory and writing dossier.json with the kit's own
// buildDossier, which the scorer re-runs byte for byte. Nothing is fetched: the program only
// reads local files, so two runs over the same repository produce identical bytes.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(out, { recursive: true });

// Copy each tree the dossier reads. Replace what is there so a stale file never survives
// into the output and changes the hash of the result.
for (const name of ['app', 'screenshots']) {
  const from = join(here, name);
  const to = join(out, name);
  if (!existsSync(from)) continue;
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

// The scorer's caps, from this bounty's reference/gate.json: only text_max_bytes shapes the
// dossier's bytes; the rest refuse an entry the scorer would refuse (more than 3 screenshots,
// one over 256 KiB, more than 993 entries or 16 MiB under app/).
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
};

const dossier = buildDossier(out, caps);
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`wrote ${join(out, 'dossier.json')} (${dossier.length} bytes)`);