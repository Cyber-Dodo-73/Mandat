import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  categorizeLicense,
  cleanUrl,
  type CommonsQueryResponse,
  commonsTitleFromFilePath,
  extensionFor,
  extValue,
  imageSize,
  pagesByRequestedTitle,
  parseCommonsPage,
  pickImage,
  stripHtml,
} from '../src/portraits.ts';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/commons-imageinfo.json', import.meta.url), 'utf8'),
) as CommonsQueryResponse;

const requested = [
  'File:Nelson_Mandela_1994.jpg',
  'File:Donald Trump official portrait.jpg',
  'File:Nope missing.jpg',
  'File:Old name.jpg',
];
const pages = pagesByRequestedTitle(requested, fixture);
const parsed = (title: string) => parseCommonsPage(pages.get(title)!);

describe('pagesByRequestedTitle', () => {
  it('follows normalization and redirects back to the requested titles', () => {
    expect(pages.get('File:Nelson_Mandela_1994.jpg')?.title).toBe('File:Nelson Mandela 1994.jpg');
    expect(pages.get('File:Old name.jpg')?.title).toBe('File:New name.png');
    expect(pages.get('File:Nope missing.jpg')?.missing).toBe(true);
  });
});

describe('parseCommonsPage', () => {
  it('parses a public-domain file', () => {
    expect(parsed('File:Donald Trump official portrait.jpg')).toMatchObject({
      file: 'File:Donald Trump official portrait.jpg',
      sourcePage: 'https://commons.wikimedia.org/wiki/File:Donald_Trump_official_portrait.jpg',
      thumbUrl:
        'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Donald_Trump_official_portrait.jpg/1280px-Donald_Trump_official_portrait.jpg',
      width: 1024,
      height: 1297,
      license: 'Public domain',
      licenseUrl: null,
      artist: 'Shealeah Craighead',
      attributionRequired: false,
      copyrighted: false,
      dateTimeOriginal: '2017-10-06',
      objectName: 'Donald Trump official portrait',
      publicDomain: true,
      category: 'public_domain',
    });
    expect(parsed('File:Donald Trump official portrait.jpg')?.credit).toBe(
      "This image is available from the United States Library of Congress's Prints and Photographs division under the digital ID ppbd.00608.",
    );
  });

  it('parses a CC BY-SA file and strips HTML from artist and credit', () => {
    expect(parsed('File:Nelson_Mandela_1994.jpg')).toMatchObject({
      license: 'CC BY-SA 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
      usageTerms: 'Creative Commons Attribution-Share Alike 2.0',
      artist: 'Kingkongphoto & www.celebrity-photos.com from Laurel',
      credit: 'Flickr: NELSON MANDELA',
      attributionRequired: true,
      dateTimeOriginal: 'Taken on 4 October 1994',
      publicDomain: false,
      category: 'cc_by_sa',
    });
  });

  it('falls back to the original when no thumbnail is served and reads multilingual values', () => {
    expect(parsed('File:Old name.jpg')).toMatchObject({
      thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/New_name.png',
      width: 600,
      height: 800,
      artist: 'Jane "JD" Doe',
      category: 'cc_by',
      credit: null,
    });
  });

  it('returns null for a missing file', () => {
    expect(parsed('File:Nope missing.jpg')).toBeNull();
  });
});

describe('categorizeLicense', () => {
  it.each([
    [{ shortName: 'Public domain', url: null }, 'public_domain'],
    [{ shortName: 'PD-US', url: null }, 'public_domain'],
    [{ shortName: 'PD-old-100', url: null }, 'public_domain'],
    [{ shortName: 'CC0', url: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en' }, 'public_domain'],
    [{ shortName: 'Public Domain Mark', url: null }, 'public_domain'],
    [{ shortName: 'No restrictions', url: null, copyrighted: false }, 'public_domain'],
    [{ shortName: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0' }, 'cc_by_sa'],
    [{ shortName: 'CC BY-SA 3.0 de', url: null }, 'cc_by_sa'],
    [{ shortName: 'CC BY 2.0', url: 'https://creativecommons.org/licenses/by/2.0' }, 'cc_by'],
    [{ shortName: 'CC BY 3.0 br', url: null }, 'cc_by'],
    [{ shortName: 'CC BY-NC 2.0', url: 'https://creativecommons.org/licenses/by-nc/2.0' }, 'other'],
    [{ shortName: 'CC BY-ND 2.0', url: null }, 'other'],
    [{ shortName: 'GFDL', url: 'http://www.gnu.org/copyleft/fdl.html' }, 'other'],
    [{ shortName: 'Attribution', url: null, copyrighted: true }, 'other'],
    [{ shortName: null, url: null }, 'other'],
  ] as const)('%o → %s', (input, expected) => {
    expect(categorizeLicense(input)).toBe(expected);
  });

  it('uses the license template code as a fallback signal', () => {
    expect(categorizeLicense({ shortName: null, url: null, code: 'pd' })).toBe('public_domain');
    expect(categorizeLicense({ shortName: null, url: null, code: 'cc-by-sa-3.0' })).toBe('cc_by_sa');
  });
});

describe('helpers', () => {
  it('stripHtml decodes entities and collapses whitespace', () => {
    expect(stripHtml('<b>A</b>&nbsp;&#233;t&#xE9; <br/>&lt;x&gt;')).toBe('A été <x>');
    expect(stripHtml('<span></span>')).toBeNull();
    expect(stripHtml(undefined)).toBeNull();
  });

  it('stripHtml drops display:none duplicates added by Commons templates', () => {
    expect(stripHtml('<div class="fn value">\nUnknown author<span style="display: none;">Unknown author</span></div>')).toBe(
      'Unknown author',
    );
    expect(stripHtml('20 April 1937<div style="display: none;">date QS:P571,+1937-04-20T00:00:00Z/11</div>')).toBe('20 April 1937');
    expect(stripHtml('a<div style="display:none"><span>x</span><br>y</div> b')).toBe('a b');
  });

  it('extValue handles strings, numbers, multilingual maps and absent keys', () => {
    expect(extValue({ A: { value: ' x ' } }, 'A')).toBe('x');
    expect(extValue({ A: { value: 3 } }, 'A')).toBe('3');
    expect(extValue({ A: { value: { de: 'Hallo' } } }, 'A')).toBe('Hallo');
    expect(extValue({}, 'A')).toBeNull();
  });

  it('cleanUrl drops utm parameters only', () => {
    expect(cleanUrl('https://x.org/a.jpg?utm_source=s&utm_content=c')).toBe('https://x.org/a.jpg');
    expect(cleanUrl('https://x.org/a.jpg?v=2&utm_source=s')).toBe('https://x.org/a.jpg?v=2');
  });

  it('commonsTitleFromFilePath decodes Wikidata image values', () => {
    expect(commonsTitleFromFilePath('http://commons.wikimedia.org/wiki/Special:FilePath/Nelson%20Mandela_1994.jpg')).toBe(
      'File:Nelson Mandela 1994.jpg',
    );
    expect(commonsTitleFromFilePath('garbage')).toBeNull();
  });

  it('pickImage prefers preferred rank, then title order', () => {
    expect(pickImage([{ title: 'File:B.jpg', preferred: false }, { title: 'File:C.jpg', preferred: true }])).toBe('File:C.jpg');
    expect(pickImage([{ title: 'File:B.jpg', preferred: false }, { title: 'File:A.jpg', preferred: false }])).toBe('File:A.jpg');
    expect(pickImage([])).toBeNull();
  });

  it('extensionFor maps served content types, falling back to the URL', () => {
    expect(extensionFor('image/jpeg', 'https://x.org/a.tif')).toBe('jpg');
    expect(extensionFor('image/webp', 'https://x.org/a.jpg')).toBe('webp');
    expect(extensionFor('', 'https://x.org/a.JPEG')).toBe('jpg');
  });

  it('imageSize reads PNG and JPEG headers', () => {
    const png = Buffer.alloc(24);
    png.writeUInt32BE(0x89504e47, 0);
    png.writeUInt32BE(1024, 16);
    png.writeUInt32BE(1300, 20);
    expect(imageSize(png)).toEqual({ width: 1024, height: 1300 });

    // SOI, APP0 (length 4), SOF0 with height 700 / width 500.
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0xbc, 0x01, 0xf4, 0x03, 0, 0, 0, 0]);
    expect(imageSize(jpeg)).toEqual({ width: 500, height: 700 });
    expect(imageSize(Buffer.from('nope'))).toBeNull();
  });
});
