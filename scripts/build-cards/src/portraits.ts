import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PATHS } from './config.ts';
import { getBinary, getJson, mapConcurrent } from './http.ts';
import type { Card } from './types.ts';
import { sparql } from './wikidata.ts';

/**
 * Reference portraits from Wikimedia Commons, with license metadata. Only the Wikidata image
 * (P18) is used: no other image is guessed. Not consumed by the app.
 */

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const THUMB_WIDTH = 1024;
const P18_BATCH = 150;
const COMMONS_BATCH = 50;
const DOWNLOAD_CONCURRENCY = 4;

export type LicenseCategory = 'public_domain' | 'cc_by' | 'cc_by_sa' | 'other' | 'missing';
export const LICENSE_CATEGORIES: readonly LicenseCategory[] = ['public_domain', 'cc_by', 'cc_by_sa', 'other', 'missing'];

export type PortraitEntry = {
  cardId: string;
  wikidataId: string;
  name: string;
  sensitive: boolean;
  /** Commons title, "File:…", or null when the card has no P18 (or the file is gone). */
  file: string | null;
  sourcePage: string | null;
  thumbUrl: string | null;
  /** Repo-relative path of the downloaded thumbnail (gitignored), or null. */
  localFile: string | null;
  /** Pixel size of the local file when downloaded, else the size reported by the API. */
  width: number | null;
  height: number | null;
  license: string | null;
  licenseUrl: string | null;
  usageTerms: string | null;
  artist: string | null;
  credit: string | null;
  attributionRequired: boolean | null;
  copyrighted: boolean | null;
  dateTimeOriginal: string | null;
  objectName: string | null;
  publicDomain: boolean;
  category: LicenseCategory;
};

// ---------------------------------------------------------------------------------------------
// Pure parsing helpers (tested)

type ExtMetadataField = { value?: unknown; source?: string; hidden?: string };
export type ExtMetadata = Record<string, ExtMetadataField | undefined>;

export type CommonsImageInfo = {
  url?: string;
  descriptionurl?: string;
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  width?: number;
  height?: number;
  mime?: string;
  extmetadata?: ExtMetadata;
};

export type CommonsPage = { title: string; missing?: boolean; invalid?: boolean; imageinfo?: CommonsImageInfo[] };

export type CommonsQueryResponse = {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: CommonsPage[];
  };
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const VOID_TAGS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'wbr']);

/**
 * Removes elements hidden with `display: none` and their content: Commons templates use them
 * for machine-readable duplicates ("Unknown author" twice, "date QS:P571,+1937-…").
 */
function dropHiddenElements(html: string): string {
  let out = '';
  let hiddenDepth = 0; // > 0 while inside a hidden element
  let last = 0;
  for (const match of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/gi)) {
    const [tag, closing, rawName, selfClosing] = match;
    const name = (rawName ?? '').toLowerCase();
    const index = match.index ?? 0;
    if (hiddenDepth === 0) out += html.slice(last, index);
    last = index + tag.length;
    if (VOID_TAGS.has(name) || selfClosing) {
      if (hiddenDepth === 0) out += tag;
      continue;
    }
    if (closing) {
      if (hiddenDepth > 0) hiddenDepth--;
      else out += tag;
    } else if (hiddenDepth > 0) {
      hiddenDepth++;
    } else if (/style\s*=\s*["'][^"']*display\s*:\s*none/i.test(tag)) {
      hiddenDepth = 1;
    } else {
      out += tag;
    }
  }
  return hiddenDepth === 0 ? out + html.slice(last) : out;
}

/** Plain text from an extmetadata HTML snippet: tags dropped, entities decoded, spaces collapsed. */
export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = dropHiddenElements(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] === '#') {
        const n = code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
        return Number.isFinite(n) ? String.fromCodePoint(n) : match;
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    })
    .replace(/[\s ]+/g, ' ')
    .trim();
  return text || null;
}

/** An extmetadata value as a string (multilingual values: English, else the first one). */
export function extValue(meta: ExtMetadata | undefined, key: string): string | null {
  const value = meta?.[key]?.value;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const map = value as Record<string, unknown>;
    const pick = map.en ?? Object.values(map).find((v) => typeof v === 'string');
    return typeof pick === 'string' ? pick.trim() || null : null;
  }
  return null;
}

const parseBool = (value: string | null): boolean | null => {
  const v = value?.toLowerCase();
  return v === 'true' ? true : v === 'false' ? false : null;
};

/**
 * Buckets a Commons license. Public domain wins (PD-* tags, CC0, "Public domain" variants),
 * then CC BY-SA, then CC BY. NC/ND, GFDL-only, FAL, custom "Attribution" terms… are "other".
 * A file that Commons marks as not copyrighted with no CC license is treated as public domain.
 */
export function categorizeLicense(input: {
  shortName: string | null;
  url: string | null;
  code?: string | null;
  copyrighted?: boolean | null;
}): Exclude<LicenseCategory, 'missing'> {
  const name = `${input.shortName ?? ''} ${input.code ?? ''}`.toLowerCase();
  const url = (input.url ?? '').toLowerCase();
  if (/public[ -]?domain|(^|[\s(])pd($|[\s-])|\bcc0\b|cc-zero/.test(name) || url.includes('publicdomain')) {
    return 'public_domain';
  }
  if (/\bcc[- ]by[- ]sa\b/.test(name) || url.includes('/by-sa/')) return 'cc_by_sa';
  if (/\bcc[- ]by\b(?![- ]?(nc|nd|sa)\b)/.test(name) || /\/licenses\/by\/\d/.test(url)) return 'cc_by';
  if (/\bcc[- ]by\b/.test(name) || url.includes('creativecommons.org/licenses/')) return 'other';
  if (input.copyrighted === false) return 'public_domain';
  return 'other';
}

/** Drops Wikimedia's tracking parameters (utm_*) from a URL. */
export function cleanUrl(url: string): string {
  const u = new URL(url);
  for (const key of [...u.searchParams.keys()]) if (key.startsWith('utm_')) u.searchParams.delete(key);
  return u.toString();
}

export type ParsedImage = Pick<
  PortraitEntry,
  | 'file'
  | 'sourcePage'
  | 'thumbUrl'
  | 'width'
  | 'height'
  | 'license'
  | 'licenseUrl'
  | 'usageTerms'
  | 'artist'
  | 'credit'
  | 'attributionRequired'
  | 'copyrighted'
  | 'dateTimeOriginal'
  | 'objectName'
  | 'publicDomain'
  | 'category'
> & { mime: string | null };

/** Turns one Commons page into license + thumbnail facts; null when the file is missing. */
export function parseCommonsPage(page: CommonsPage): ParsedImage | null {
  const info = page.imageinfo?.[0];
  if (page.missing || page.invalid || !info) return null;
  const meta = info.extmetadata;
  const license = stripHtml(extValue(meta, 'LicenseShortName'));
  const licenseUrl = extValue(meta, 'LicenseUrl');
  const copyrighted = parseBool(extValue(meta, 'Copyrighted'));
  const category = categorizeLicense({ shortName: license, url: licenseUrl, code: extValue(meta, 'License'), copyrighted });
  const thumb = info.thumburl ?? info.url;
  return {
    file: page.title,
    sourcePage: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    thumbUrl: thumb ? cleanUrl(thumb) : null,
    width: info.thumbwidth ?? info.width ?? null,
    height: info.thumbheight ?? info.height ?? null,
    license,
    licenseUrl,
    usageTerms: stripHtml(extValue(meta, 'UsageTerms')),
    artist: stripHtml(extValue(meta, 'Artist')),
    credit: stripHtml(extValue(meta, 'Credit')),
    attributionRequired: parseBool(extValue(meta, 'AttributionRequired')),
    copyrighted,
    dateTimeOriginal: stripHtml(extValue(meta, 'DateTimeOriginal')),
    objectName: stripHtml(extValue(meta, 'ObjectName')),
    publicDomain: category === 'public_domain',
    category,
    mime: info.mime ?? null,
  };
}

/** Maps each requested title to its page, following API normalization and redirects. */
export function pagesByRequestedTitle(titles: readonly string[], res: CommonsQueryResponse): Map<string, CommonsPage> {
  const normalized = new Map((res.query?.normalized ?? []).map((n) => [n.from, n.to]));
  const redirects = new Map((res.query?.redirects ?? []).map((r) => [r.from, r.to]));
  const pages = new Map((res.query?.pages ?? []).map((p) => [p.title, p]));
  const out = new Map<string, CommonsPage>();
  for (const title of titles) {
    const norm = normalized.get(title) ?? title;
    const page = pages.get(redirects.get(norm) ?? norm);
    if (page) out.set(title, page);
  }
  return out;
}

/** "http://commons.wikimedia.org/wiki/Special:FilePath/Foo%20bar.jpg" → "File:Foo bar.jpg". */
export function commonsTitleFromFilePath(value: string): string | null {
  const match = value.match(/Special:FilePath\/(.+)$/);
  if (!match?.[1]) return null;
  return `File:${decodeURIComponent(match[1]).replace(/_/g, ' ')}`;
}

/** Picks the P18 value Wikidata would show: preferred rank first, then by title for stability. */
export function pickImage(values: ReadonlyArray<{ title: string; preferred: boolean }>): string | null {
  const sorted = [...values].sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.title.localeCompare(b.title));
  return sorted[0]?.title ?? null;
}

const EXT_BY_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export function extensionFor(contentType: string, url: string): string {
  const fromMime = EXT_BY_MIME[contentType.toLowerCase()];
  if (fromMime) return fromMime;
  const fromUrl = new URL(url).pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return fromUrl === 'jpeg' ? 'jpg' : (fromUrl ?? 'bin');
}

/** Pixel size from a JPEG, PNG, GIF or WebP header; null if unrecognized. */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1] as number;
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        i += 2;
        continue;
      }
      const length = buf.readUInt16BE(i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      i += 2 + length;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Network steps

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Wikidata P18 (non-deprecated) per QID, as Commons titles. */
async function fetchP18(qids: readonly string[]): Promise<{ images: Map<string, string>; multiple: string[] }> {
  const values = new Map<string, Array<{ title: string; preferred: boolean }>>();
  for (const batch of chunk([...new Set(qids)].sort(), P18_BATCH)) {
    const rows = await sparql(`
      SELECT ?p ?img ?rank WHERE {
        VALUES ?p { ${batch.map((q) => `wd:${q}`).join(' ')} }
        ?p p:P18 ?st . ?st ps:P18 ?img ; wikibase:rank ?rank .
        FILTER(?rank != wikibase:DeprecatedRank)
      }`);
    for (const row of rows) {
      const qid = row.p?.value.match(/(Q\d+)$/)?.[1];
      const title = row.img ? commonsTitleFromFilePath(row.img.value) : null;
      if (!qid || !title) continue;
      const list = values.get(qid) ?? [];
      if (!list.some((v) => v.title === title)) list.push({ title, preferred: (row.rank?.value ?? '').endsWith('PreferredRank') });
      values.set(qid, list);
    }
  }
  const images = new Map<string, string>();
  const multiple: string[] = [];
  for (const [qid, list] of values) {
    const title = pickImage(list);
    if (title) images.set(qid, title);
    if (list.length > 1 && !list.some((v) => v.preferred)) multiple.push(qid);
  }
  return { images, multiple: multiple.sort() };
}

async function fetchCommonsInfo(titles: readonly string[]): Promise<Map<string, CommonsPage>> {
  const out = new Map<string, CommonsPage>();
  for (const batch of chunk([...new Set(titles)].sort(), COMMONS_BATCH)) {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      redirects: '1',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|size|mime',
      iiurlwidth: String(THUMB_WIDTH),
      iiextmetadatalanguage: 'en',
      iiextmetadatafilter:
        'LicenseShortName|LicenseUrl|License|UsageTerms|Artist|Credit|AttributionRequired|Copyrighted|DateTimeOriginal|ObjectName',
      titles: batch.join('|'),
    });
    const res = await getJson<CommonsQueryResponse>('commons', `${COMMONS_API}?${params}`);
    for (const [title, page] of pagesByRequestedTitle(batch, res)) out.set(title, page);
  }
  return out;
}

/** Local files are keyed by Wikidata QID, which is stable when cards are renumbered. */
async function existingLocalFile(qid: string): Promise<string | null> {
  let names: string[];
  try {
    names = await readdir(PATHS.portraitsDir);
  } catch {
    return null;
  }
  const name = names.find((n) => n.startsWith(`${qid}.`));
  return name ? path.join(PATHS.portraitsDir, name) : null;
}

/** Downloads the thumbnail unless a file for the person already exists (the file is the cache). */
async function download(qid: string, url: string): Promise<{ file: string; bytes: number; size: { width: number; height: number } | null }> {
  const existing = await existingLocalFile(qid);
  if (existing) {
    const buf = await readFile(existing);
    return { file: existing, bytes: buf.length, size: imageSize(buf) };
  }
  const { body, contentType } = await getBinary('upload', url);
  const file = path.join(PATHS.portraitsDir, `${qid}.${extensionFor(contentType, url)}`);
  await writeFile(file, body);
  return { file, bytes: body.length, size: imageSize(body) };
}

const progress = (label: string) => (done: number, total: number) => {
  if (done === total || done % Math.max(1, Math.floor(total / 10)) === 0) console.log(`  ${label} ${done}/${total}`);
};

const MISSING: Omit<PortraitEntry, 'cardId' | 'wikidataId' | 'name' | 'sensitive'> = {
  file: null,
  sourcePage: null,
  thumbUrl: null,
  localFile: null,
  width: null,
  height: null,
  license: null,
  licenseUrl: null,
  usageTerms: null,
  artist: null,
  credit: null,
  attributionRequired: null,
  copyrighted: null,
  dateTimeOriginal: null,
  objectName: null,
  publicDomain: false,
  category: 'missing',
};

export async function portraits(): Promise<void> {
  const catalog = JSON.parse(await readFile(PATHS.cardsOut, 'utf8')) as { season: number; version: string; cards: Card[] };
  const cards = catalog.cards;

  console.log(`Fetching Wikidata images (P18) for ${cards.length} cards…`);
  const { images, multiple } = await fetchP18(cards.map((c) => c.wikidataId));
  console.log(`  ${images.size} cards with an image`);

  console.log('Fetching Commons license metadata…');
  const pages = await fetchCommonsInfo([...images.values()]);

  await mkdir(PATHS.portraitsDir, { recursive: true });
  console.log('Downloading thumbnails…');
  let totalBytes = 0;
  const failures: string[] = [];
  const entries = await mapConcurrent(
    cards,
    DOWNLOAD_CONCURRENCY,
    async (card): Promise<PortraitEntry> => {
      const base = { cardId: card.id, wikidataId: card.wikidataId, name: card.name.en, sensitive: card.sensitive };
      const title = images.get(card.wikidataId);
      const page = title ? pages.get(title) : undefined;
      const parsed = page ? parseCommonsPage(page) : null;
      if (!title) return { ...base, ...MISSING };
      if (!parsed) return { ...base, ...MISSING, file: title }; // P18 points to a missing file
      const { mime: _mime, ...facts } = parsed;
      let localFile: string | null = null;
      let { width, height } = facts;
      if (facts.thumbUrl) {
        try {
          const result = await download(card.wikidataId, facts.thumbUrl);
          totalBytes += result.bytes;
          localFile = path.relative(PATHS.root, result.file).split(path.sep).join('/');
          if (result.size) ({ width, height } = result.size);
        } catch (error) {
          failures.push(`${card.id} ${card.name.en}: ${error instanceof Error ? error.message : error}`);
        }
      }
      return { ...base, ...facts, localFile, width, height };
    },
    progress('portraits'),
  );

  await writeFile(
    PATHS.portraitsManifest,
    `${JSON.stringify({ season: catalog.season, cardsVersion: catalog.version, portraits: entries }, null, 2)}\n`,
  );
  console.log(`Wrote ${path.relative(PATHS.root, PATHS.portraitsManifest)}`);
  printSummary(entries, totalBytes, multiple, failures);
}

function printSummary(entries: readonly PortraitEntry[], totalBytes: number, multiple: readonly string[], failures: readonly string[]): void {
  const count = (pred: (e: PortraitEntry) => boolean) => entries.filter(pred).length;
  console.log('\nPortraits summary');
  for (const category of LICENSE_CATEGORIES) console.log(`  ${category.padEnd(14)} ${count((e) => e.category === category)}`);
  console.log(`  no P18          ${count((e) => e.file === null)}`);
  console.log(`  P18 file gone   ${count((e) => e.file !== null && e.category === 'missing')}`);
  console.log(`  downloaded      ${count((e) => e.localFile !== null)} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MiB`);
  if (multiple.length) console.log(`  several P18 values without a preferred one (first by title kept): ${multiple.join(', ')}`);

  const other = new Map<string, number>();
  for (const e of entries) if (e.category === 'other') other.set(e.license ?? '(none)', (other.get(e.license ?? '(none)') ?? 0) + 1);
  if (other.size) {
    console.log('\n"other" licenses:');
    for (const [license, n] of [...other].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${license}`);
  }

  const sensitive = entries.filter((e) => e.sensitive);
  console.log(`\nSensitive cards (${sensitive.length}) — downloaded but flagged: no heroic imagery, decision pending:`);
  for (const e of sensitive) console.log(`  ${e.cardId} ${e.name} [${e.category}] ${e.file ?? '(no P18)'}`);

  if (failures.length) {
    console.log(`\nDownload failures (${failures.length}):`);
    for (const f of failures) console.log(`  ${f}`);
    process.exitCode = 1;
  }
}
