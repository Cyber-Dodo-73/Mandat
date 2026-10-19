import type { CardFinish } from '@/types/card';

import type { CardMetrics } from './cardMetrics';

export type Box = { x: number; y: number; width: number; height: number };

/** Font sizes of the printed text (reference sizes times the card unit, no floor). */
export type CardTypeScale = {
  name: number;
  nameLine: number;
  role: number;
  statValue: number;
  statLabel: number;
  abilityName: number;
  abilityText: number;
  number: number;
};

/**
 * Explicit geometry of a card face, identical at every size (scaled from the 300 px reference).
 * Text lives on opaque plates drawn ABOVE the foil, so the holo and the moving light only ever
 * touch the frame and the artwork.
 */
export type CardLayout = {
  /** Artwork window (the whole inner face on full art prints). */
  art: Box;
  /** Name plate. */
  header: Box;
  /** Role, stats and ability. */
  body: Box;
  /** Rarity gems and collector number. */
  footer: Box;
  /** Corner chips (flag, life span) inside the artwork. */
  chipHeight: number;
  /** Inner padding of every plate. */
  platePadding: number;
  /** Corner radius of the artwork window and the plates. */
  innerRadius: number;
  /** Plate hairline width. */
  stroke: number;
  type: CardTypeScale;
  /**
   * Below 100 px, plates keep their place and size but print simplified content (stat values
   * without the ability text) so the card stays the same object, only less detailed.
   */
  lowDetail: boolean;
};

/** The reference card, 300 px wide (419 px high). */
const REF = {
  type: { name: 25, role: 13, statValue: 20, statLabel: 9.5, abilityName: 13, abilityText: 11.5, number: 10.5 },
  gap: 6,
  platePadding: 8,
  innerRadius: 8,
  header: 40,
  footer: 22,
  chip: 18,
  fullArtFrame: 6,
} as const;

/** Body height at the reference size: role, stats row, ability name and two ability lines. */
function referenceBodyHeight(): number {
  const { type, platePadding: pad, gap } = REF;
  const role = type.role * 1.3;
  const stats = type.statValue * 1.15 + type.statLabel * 1.3 + pad;
  const abilityName = type.abilityName * 1.3;
  const abilityText = type.abilityText * 1.3 * 2;
  return pad * 2 + role + gap + stats + gap + abilityName + abilityText;
}

const REF_BODY = referenceBodyHeight();

export function cardLayout(metrics: CardMetrics, finish: CardFinish): CardLayout {
  const { width, height, unit } = metrics;
  const s = (value: number) => value * unit;
  const fullArt = finish === 'full_art';

  const type: CardTypeScale = {
    name: s(REF.type.name),
    nameLine: s(REF.type.name * 1.18),
    role: s(REF.type.role),
    statValue: s(REF.type.statValue),
    statLabel: s(REF.type.statLabel),
    abilityName: s(REF.type.abilityName),
    abilityText: s(REF.type.abilityText),
    number: s(REF.type.number),
  };
  const inset = fullArt ? s(REF.fullArtFrame) : metrics.frame + metrics.padding;
  const gap = s(REF.gap);
  const innerWidth = width - inset * 2;
  const headerHeight = s(REF.header);
  const footerHeight = s(REF.footer);
  const bodyHeight = s(REF_BODY);

  const footer: Box = { x: inset, y: height - inset - footerHeight, width: innerWidth, height: footerHeight };
  const body: Box = { x: inset, y: footer.y - gap - bodyHeight, width: innerWidth, height: bodyHeight };

  if (fullArt) {
    // The illustration covers the face; name, body and footer sit on one bottom band.
    const header: Box = { x: inset, y: body.y - headerHeight, width: innerWidth, height: headerHeight };
    const art: Box = { x: inset, y: inset, width: innerWidth, height: height - inset * 2 };
    return {
      art,
      header,
      body,
      footer,
      chipHeight: s(REF.chip),
      platePadding: s(REF.platePadding),
      innerRadius: s(REF.innerRadius),
      stroke: Math.max(0.5, s(1)),
      type,
      lowDetail: metrics.detail === 'minimal',
    };
  }

  const header: Box = { x: inset, y: inset, width: innerWidth, height: headerHeight };
  const artTop = header.y + headerHeight + gap;
  const art: Box = { x: inset, y: artTop, width: innerWidth, height: body.y - gap - artTop };
  return {
    art,
    header,
    body,
    footer,
    chipHeight: s(REF.chip),
    platePadding: s(REF.platePadding),
    innerRadius: s(REF.innerRadius),
    stroke: Math.max(0.5, s(1)),
    type,
    lowDetail: metrics.detail === 'minimal',
  };
}
