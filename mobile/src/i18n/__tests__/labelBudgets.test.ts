import en from '../locales/en.json';
import fr from '../locales/fr.json';

/**
 * Labels that sit in fixed-width slots (tabs, segments, 2x2 action grids, chips, buttons).
 * The budget is the longest text the slot shows without truncating on a 320 pt wide screen,
 * counted after interpolating `{{count}}` with three digits. Lengthening a label past its budget
 * fails here instead of shipping an ellipsis.
 */
const BUDGETS: Record<string, number> = {
  'tabs.home': 10,
  'tabs.collection': 10,
  'tabs.play': 10,
  'tabs.missions': 10,
  'tabs.profile': 10,
  'seasonPass.tab': 8,
  'profile.actions.editShowcase': 10,
  'profile.actions.copyCode': 10,
  'profile.actions.shareLink': 10,
  'profile.actions.shareImage': 10,
  'profile.cardActions.addToShowcase': 10,
  'profile.cardActions.removeFromShowcase': 10,
  'profile.cardActions.setFavorite': 10,
  'profile.cardActions.favorite': 10,
  'collection.filters.all': 12,
  'collection.filters.owned': 12,
  'collection.filters.missing': 12,
  'collection.filters.reset': 14,
  'collection.filters.show_other': 18,
  'collection.sort.owned': 10,
  'collection.sort.number': 10,
  'collection.sort.rarity': 10,
  'collection.sort.obtained': 10,
  'home.noPack.quiz': 16,
  'home.noPack.missions': 10,
  'card.title': 12,
};

type Tree = { [key: string]: string | Tree };

function lookup(tree: Tree, path: string): string | undefined {
  let node: string | Tree | undefined = tree;
  for (const part of path.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

const interpolate = (label: string) => label.replace(/\{\{\s*count\s*\}\}/g, '500');

describe.each([
  ['fr', fr as Tree],
  ['en', en as Tree],
])('%s compact labels', (_language, tree) => {
  it.each(Object.entries(BUDGETS))('%s fits in %i characters', (key, budget) => {
    const label = lookup(tree, key);
    expect(label).toBeDefined();
    expect(interpolate(label!).length).toBeLessThanOrEqual(budget);
  });
});

it('keeps the short French labels the screens were designed around', () => {
  const tree = fr as Tree;
  expect(lookup(tree, 'seasonPass.tab')).toBe('Pass');
  expect(lookup(tree, 'profile.actions.editShowcase')).toBe('Vitrine');
  expect(lookup(tree, 'profile.cardActions.setFavorite')).toBe('Favori');
  expect(lookup(tree, 'collection.rarityNote')).toBe('La rareté reflète la notoriété mondiale actuelle.');
});
