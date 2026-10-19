import { PATHS } from './config.ts';
import { build, fetchRaw } from './pipeline.ts';
import { portraits } from './portraits.ts';
import { report } from './report.ts';

const USAGE = `Usage: npm run build -- <command> [options]

Commands:
  fetch     Query Wikidata (cached) and store raw candidates
  build     Resolve, score, select and write data/candidates.season1.json + data/cards.season1.json
  report    Print distribution, top 40 and sensitive cards from data/candidates.season1.json
  all       build then report
  portraits Download Wikidata (P18) portraits from Commons into data/portraits/ and write
            data/portraits.manifest.json with license metadata (not used by the app)

Options:
  --allow-missing-content   Emit placeholder content for cards without data/content/<QID>.json
  --as-of YYYY-MM-DD        Reference date for the 24-month pageview window (default: today)
  --refetch                 Rebuild raw candidates from (cached) Wikidata queries
Cache: ${PATHS.cache} (delete it to re-download everything)`;

function parseAsOf(args: string[]): Date {
  const i = args.indexOf('--as-of');
  if (i === -1) return new Date();
  const value = args[i + 1];
  const date = value ? new Date(`${value}T00:00:00Z`) : new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid --as-of value: ${value}`);
  return date;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const options = {
    asOf: parseAsOf(args),
    allowMissingContent: args.includes('--allow-missing-content'),
    refetch: args.includes('--refetch'),
  };
  switch (command) {
    case 'fetch':
      await fetchRaw();
      break;
    case 'build':
      await build(options);
      break;
    case 'report':
      await report();
      break;
    case 'portraits':
      await portraits();
      break;
    case 'all':
      await build(options);
      await report();
      break;
    default:
      console.log(USAGE);
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
