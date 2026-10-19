/**
 * Converts the downloaded Commons portraits (data/portraits/) into the small WebP files the
 * mobile app bundles (mobile/assets/portraits/<cardId>.webp). Reads the manifest so only
 * cards with a portrait are converted; truncated downloads are decoded as far as possible.
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { PATHS, PORTRAIT_WEB } from './config.ts';

type ManifestEntry = { cardId: string; localFile: string | null };

export async function portraitsWeb(): Promise<void> {
  const manifest = JSON.parse(readFileSync(PATHS.portraitsManifest, 'utf8')) as { portraits: ManifestEntry[] };
  mkdirSync(PATHS.portraitsWeb, { recursive: true });

  let converted = 0;
  let bytes = 0;
  const missing: string[] = [];
  for (const entry of manifest.portraits) {
    if (!entry.localFile) continue;
    const source = path.join(PATHS.portraitsDir, path.basename(entry.localFile));
    const target = path.join(PATHS.portraitsWeb, `${entry.cardId}.webp`);
    try {
      await sharp(source, { failOn: 'none' })
        .rotate()
        .resize({ width: PORTRAIT_WEB.maxWidth, height: PORTRAIT_WEB.maxHeight, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: PORTRAIT_WEB.quality, effort: 6 })
        .toFile(target);
    } catch (error) {
      missing.push(`${entry.cardId}: ${(error as Error).message}`);
      continue;
    }
    converted += 1;
    bytes += statSync(target).size;
  }

  console.log(`Converted ${converted} portraits to ${PATHS.portraitsWeb} (${(bytes / 1024 / 1024).toFixed(1)} MiB)`);
  if (missing.length > 0) {
    console.log(`Failed (${missing.length}). Run \`npm run build -- portraits\` first:\n  ${missing.join('\n  ')}`);
    process.exitCode = 1;
  }
}
