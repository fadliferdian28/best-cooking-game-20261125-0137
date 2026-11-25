// Hand-in program for Sizzle Shift. It mirrors game/ and screenshots/ into the
// output directory and writes the dossier the judge reads.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's gate.json limits. They only reject; text_max_bytes shapes bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function mirror(name: string) {
  const src = join(root, name);
  const dst = join(outDir, name);
  if (!existsSync(src)) return false;
  rmSync(dst, { recursive: true, force: true });
  cpSync(src, dst, { recursive: true });
  return true;
}

mkdirSync(outDir, { recursive: true });

// A missing or empty game/ would still produce a dossier, so fail loudly here.
if (!existsSync(join(root, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing; nothing to hand in');
}

for (const name of ['game', 'screenshots']) {
  if (!mirror(name)) console.warn(`warning: no ${name}/ beside main.ts`);
}

const shots = existsSync(join(outDir, 'screenshots'))
  ? readdirSync(join(outDir, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f)).length
  : 0;
if (shots < 3) console.warn(`warning: only ${shots} screenshot(s); the gate wants 3 or 4`);

const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

const bytes = Buffer.byteLength(dossier);
console.log(`handed in game/ + ${shots} screenshot(s) to ${outDir}`);
console.log(`dossier written: ${join(outDir, 'dossier.json')} (${bytes} bytes)`);
