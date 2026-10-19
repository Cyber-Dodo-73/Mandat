/**
 * Imports the art pack (docs/ART_PROMPTS.md) into the app:
 *   cd scripts/build-cards && npm run art:import -- <pack>/mobile/assets   (or from mobile/: npm run art:import -- <pack>/mobile/assets)
 * App icons, splash and favicon are copied as PNG (native build inputs). In-app images
 * (brand, onboarding, avatars, banners, badges) are resized and re-encoded as WebP so the
 * JS bundle stays small; alpha is kept. Then run `npm run sync:cards` to refresh the registry.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
// Lives in scripts/build-cards (which owns sharp) and writes into the mobile app's assets.
const assetsDir = join(here, '..', '..', '..', 'mobile', 'assets');

/** Native inputs (app.config.ts): kept as PNG, copied untouched. */
const NATIVE_FILES = [
  'icon.png',
  'android-icon-foreground.png',
  'android-icon-background.png',
  'android-icon-monochrome.png',
  'splash-icon.png',
  'favicon.png',
];

type WebpTarget = { dir: string; width: number; height: number; quality: number };

/** In-app images: max box (fit inside, never enlarged) and WebP quality. */
const WEBP_TARGETS: WebpTarget[] = [
  { dir: 'images/avatars', width: 512, height: 512, quality: 80 },
  { dir: 'images/badges', width: 512, height: 512, quality: 80 },
  { dir: 'images/banners', width: 1500, height: 500, quality: 76 },
  { dir: 'images/onboarding', width: 1080, height: 1350, quality: 78 },
  { dir: 'brand', width: 1024, height: 1024, quality: 82 },
];

const kib = (bytes: number) => `${(bytes / 1024).toFixed(0)} KiB`;

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source || !existsSync(source)) {
    console.error('usage: npm run art:import -- <pack>/mobile/assets');
    process.exit(2);
  }

  for (const file of NATIVE_FILES) {
    const from = join(source, file);
    if (!existsSync(from)) continue;
    copyFileSync(from, join(assetsDir, file));
    console.log(`png   ${file}`);
  }

  let total = 0;
  for (const target of WEBP_TARGETS) {
    const from = join(source, target.dir);
    if (!existsSync(from)) continue;
    const to = join(assetsDir, target.dir);
    mkdirSync(to, { recursive: true });
    for (const file of readdirSync(from).sort()) {
      if (extname(file).toLowerCase() !== '.png') continue;
      const out = join(to, `${basename(file, '.png')}.webp`);
      await sharp(join(from, file))
        .resize(target.width, target.height, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: target.quality, alphaQuality: 90, effort: 6 })
        .toFile(out);
      total += statSync(out).size;
    }
    console.log(`webp  ${target.dir}`);
  }

  // Vector wordmarks stay as SVG references for design work (not bundled by the app).
  for (const file of ['logo-wordmark.svg', 'logo-wordmark-dark.svg']) {
    const from = join(source, 'brand', file);
    if (existsSync(from)) copyFileSync(from, join(assetsDir, 'brand', file));
  }

  console.log(`\nIn-app WebP total: ${kib(total)}`);
}

void main();
