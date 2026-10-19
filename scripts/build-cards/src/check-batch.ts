/**
 * Validates the content files of one writing batch without rebuilding the catalog:
 *   npm run check-batch -- <batch.json>
 * A batch is a JSON array of { wikidataId, sensitive, statTotal } (extra fields ignored).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { STAT_KEYS, validateContent } from './content.ts';

type BatchEntry = { wikidataId: string; sensitive: boolean; statTotal: number; name?: { en?: string } };

const batchPath = process.argv[2];
if (!batchPath) {
  console.error('usage: npm run check-batch -- <batch.json>');
  process.exit(2);
}
const contentDir = join(import.meta.dirname, '..', '..', '..', 'data', 'content');
const batch = JSON.parse(readFileSync(batchPath, 'utf8')) as BatchEntry[];

let missing = 0;
let invalid = 0;
for (const entry of batch) {
  const file = join(contentDir, `${entry.wikidataId}.json`);
  const label = `${entry.wikidataId} (${entry.name?.en ?? '?'})`;
  if (!existsSync(file)) {
    missing += 1;
    console.log(`MISSING ${label}`);
    continue;
  }
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    invalid += 1;
    console.log(`INVALID ${label}: ${(error as Error).message}`);
    continue;
  }
  const errors = validateContent(value, entry.wikidataId, entry.sensitive);
  const stats = (value as { stats?: Record<string, number> }).stats;
  if (stats) {
    const sum = STAT_KEYS.reduce((total, key) => total + (stats[key] ?? 0), 0);
    if (sum !== entry.statTotal) errors.push(`stats: sum ${sum}, expected statTotal ${entry.statTotal}`);
  }
  if (errors.length > 0) {
    invalid += 1;
    console.log(`INVALID ${label}:\n  - ${errors.join('\n  - ')}`);
  }
}
console.log(`\n${batch.length - missing - invalid}/${batch.length} valid, ${missing} missing, ${invalid} invalid`);
process.exit(missing + invalid > 0 ? 1 : 0);
