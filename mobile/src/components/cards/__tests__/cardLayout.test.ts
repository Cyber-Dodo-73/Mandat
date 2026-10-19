import { CARD_FINISHES } from '@/types/card';

import { cardLayout, type Box, type CardLayout } from '../cardLayout';
import { CARD_REFERENCE_WIDTH, cardMetrics, type CardSize } from '../cardMetrics';

const SIZES: CardSize[] = ['thumb', 'grid', 'large', 'hero'];

function inside(box: Box, width: number, height: number) {
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 0.01);
  expect(box.y + box.height).toBeLessThanOrEqual(height + 0.01);
}

function above(top: Box, bottom: Box) {
  expect(top.y + top.height).toBeLessThanOrEqual(bottom.y + 0.01);
}

/** Every box of a layout divided by the card width: identical for every width if proportional. */
function normalized(layout: CardLayout, width: number) {
  const scale = (box: Box) => [box.x, box.y, box.width, box.height].map((value) => +(value / width).toFixed(6));
  return {
    art: scale(layout.art),
    header: scale(layout.header),
    body: scale(layout.body),
    footer: scale(layout.footer),
    type: Object.values(layout.type).map((value) => +(value / width).toFixed(6)),
    chip: +(layout.chipHeight / width).toFixed(6),
    padding: +(layout.platePadding / width).toFixed(6),
    radius: +(layout.innerRadius / width).toFixed(6),
  };
}

describe('cardLayout', () => {
  it.each(SIZES.flatMap((size) => CARD_FINISHES.map((finish) => [size, finish] as const)))(
    'keeps every block inside the card without overlaps (%s, %s)',
    (size, finish) => {
      const metrics = cardMetrics(size);
      const layout = cardLayout(metrics, finish);
      for (const box of [layout.art, layout.header, layout.body, layout.footer]) inside(box, metrics.width, metrics.height);
      expect(layout.art.height).toBeGreaterThan(metrics.height * 0.3);
      if (finish !== 'full_art') {
        above(layout.header, layout.art);
        above(layout.art, layout.body);
      } else {
        above(layout.header, layout.body);
      }
      above(layout.body, layout.footer);
    },
  );

  it.each(CARD_FINISHES)('is the same composition at every width (%s): a thumb is a scaled hero', (finish) => {
    const widths = [72, 108, 240, CARD_REFERENCE_WIDTH];
    const [reference, ...others] = widths.map((width) => normalized(cardLayout(cardMetrics('hero', width), finish), width));
    for (const other of others) expect(other).toEqual(reference);
  });

  it('matches the reference metrics snapshot', () => {
    const snapshot = [90, 160, 300].map((width) => {
      const layout = cardLayout(cardMetrics('hero', width), 'standard');
      return { width, ...normalized(layout, width), lowDetail: layout.lowDetail };
    });
    expect(snapshot).toMatchSnapshot();
  });

  it('only simplifies plate content (not the composition) on very small cards', () => {
    expect(cardLayout(cardMetrics('thumb'), 'standard').lowDetail).toBe(true);
    expect(cardLayout(cardMetrics('grid'), 'standard').lowDetail).toBe(false);
    expect(cardLayout(cardMetrics('hero'), 'holo').lowDetail).toBe(false);
  });
});
