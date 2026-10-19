import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { diffKeys } from '../src/i18n/keyDiff';

const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales');
const REFERENCE = 'fr';
const OTHERS = ['en'];

const load = (language: string) => JSON.parse(readFileSync(join(LOCALES_DIR, `${language}.json`), 'utf8'));

const reference = load(REFERENCE);
let failed = false;

for (const language of OTHERS) {
  const { missing, extra } = diffKeys(reference, load(language));
  for (const key of missing) console.error(`[${language}] missing key: ${key}`);
  for (const key of extra) console.error(`[${language}] extra key: ${key}`);
  if (missing.length > 0 || extra.length > 0) failed = true;
}

if (failed) {
  process.exit(1);
}
console.log(`i18n OK: ${OTHERS.join(', ')} match ${REFERENCE}.`);
