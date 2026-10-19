import { CARD_FINISHES } from '@/types/card';

import { cardLayout, type Box } from '../cardLayout';
import { cardMetrics, type CardSize } from '../cardMetrics';

const SIZES: CardSize[] = ['thumb', 'grid', 'large', 'hero'];

function inside(box: Box, width: number, height: number) {
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(height + 0.5);
}

function above(top: Box, bottom: Box) {
  expect(top.y + top.height).toBeLessThanOrEqual(bottom.y + 0.5);
}

describe('cardLayout', () => {
  it.each(SIZES.flatMap((size) => CARD_FINISHES.map((finish) => [size, finish] as const)))(
    'keeps every block inside the card without overlaps (%s, %s)',
    (size, finish) => {
      const metrics = cardMetrics(size);
      const layout = cardLayout(metrics, finish);
      for (const box of [layout.art, layout.header, layout.body, layout.footer]) {
        if (box) inside(box, metrics.width, metrics.height);
      }
      expect(layout.art.height).toBeGreaterThan(metrics.height * 0.3);
      if (finish !== 'full_art') {
        if (layout.header) above(layout.header, layout.art);
        above(layout.art, layout.body ?? layout.footer);
        if (layout.body) above(layout.body, layout.footer);
      } else if (layout.header && layout.body) {
        above(layout.header, layout.body);
        above(layout.body, layout.footer);
      }
    },
  );

  it('never prints text below the readable minimums', () => {
    for (const size of SIZES) {
      const { type } = cardLayout(cardMetrics(size), 'standard');
      expect(type.name).toBeGreaterThanOrEqual(11);
      expect(type.role).toBeGreaterThanOrEqual(10);
      expect(type.abilityText).toBeGreaterThanOrEqual(9.5);
      expect(type.statLabel).toBeGreaterThanOrEqual(8);
      expect(type.number).toBeGreaterThanOrEqual(8);
    }
  });

  it('drops secondary text on small cards instead of shrinking it', () => {
    const thumb = cardLayout(cardMetrics('thumb'), 'standard');
    expect(thumb.header).toBeNull();
    expect(thumb.shows.number).toBe(false);
    const grid = cardLayout(cardMetrics('grid'), 'holo');
    expect(grid.body).toBeNull();
    expect(grid.shows.finishLabel).toBe(false);
    const hero = cardLayout(cardMetrics('hero'), 'holo');
    expect(hero.body).not.toBeNull();
    expect(hero.shows.finishLabel).toBe(true);
  });
});
