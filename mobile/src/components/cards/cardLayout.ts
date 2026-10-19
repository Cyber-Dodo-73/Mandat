import type { CardFinish } from '@/types/card';

import type { CardMetrics } from './cardMetrics';

export type Box = { x: number; y: number; width: number; height: number };

/** Font sizes of the printed text, never below what stays readable on a phone. */
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
 * Explicit geometry of a card face. Text lives on opaque plates drawn ABOVE the foil, so the
 * holo, glitter and moving light only ever touch the frame and the artwork.
 */
export type CardLayout = {
  /** Artwork window (the whole inner face on full art prints). */
  art: Box;
  /** Name plate; absent on minimal (thumb) cards. */
  header: Box | null;
  /** Role, stats and ability; only on full-detail cards. */
  body: Box | null;
  /** Rarity pips and collector number. */
  footer: Box;
  /** Inner padding of every plate. */
  platePadding: number;
  /** Corner radius of the artwork window and the plates. */
  innerRadius: number;
  type: CardTypeScale;
  /** Which printed elements fit at this size (secondary text is dropped, never shrunk). */
  shows: { name: boolean; number: boolean; flag: boolean; lifespan: boolean; finishLabel: boolean };
};

const MIN = { name: 11, role: 10, statValue: 13, statLabel: 8, abilityName: 10, abilityText: 9.5, number: 8 };

function typeScale(metrics: CardMetrics): CardTypeScale {
  const unit = metrics.width / 300;
  const full = metrics.detail === 'full';
  const name = full ? Math.max(MIN.name, 23 * unit) : Math.max(MIN.name, 26 * unit);
  return {
    name,
    nameLine: Math.round(name * 1.18),
    role: Math.max(MIN.role, 13 * unit),
    statValue: Math.max(MIN.statValue, 20 * unit),
    statLabel: Math.max(MIN.statLabel, 9.5 * unit),
    abilityName: Math.max(MIN.abilityName, 13 * unit),
    abilityText: Math.max(MIN.abilityText, 11.5 * unit),
    number: Math.max(MIN.number, 10.5 * unit),
  };
}

/** Height the body plate needs: role, stats row, ability name and two lines of ability text. */
function bodyHeight(type: CardTypeScale, pad: number, gap: number): number {
  const role = type.role * 1.3;
  const stats = type.statValue * 1.15 + type.statLabel * 1.3 + pad;
  const abilityName = type.abilityName * 1.3;
  const abilityText = type.abilityText * 1.3 * 2;
  return Math.ceil(pad * 2 + role + gap + stats + gap + abilityName + abilityText);
}

export function cardLayout(metrics: CardMetrics, finish: CardFinish): CardLayout {
  const { width, height, detail, radius } = metrics;
  const unit = width / 300;
  const type = typeScale(metrics);
  const fullArt = finish === 'full_art';
  const frame = fullArt ? Math.max(2, Math.round(metrics.frame * 0.6)) : metrics.frame;
  const inset = fullArt ? frame : frame + metrics.padding;
  const gap = Math.max(2, Math.round(6 * unit));
  const platePadding = Math.max(3, Math.round(8 * unit));
  const innerRadius = Math.max(2, Math.round(radius * 0.45));
  const innerWidth = width - inset * 2;

  const shows = {
    name: detail !== 'minimal',
    number: width >= 100,
    flag: detail === 'full',
    lifespan: detail === 'full',
    finishLabel: detail === 'full' && finish !== 'standard',
  };

  const footerHeight = detail === 'minimal' ? Math.max(9, Math.round(14 * unit * 1.6)) : Math.max(13, Math.round(type.number * 1.9));
  const headerHeight = shows.name ? Math.round(type.nameLine + platePadding * 1.4) : 0;

  if (fullArt) {
    // The illustration covers the face; name, body and footer share one strong bottom plate.
    const art: Box = { x: inset, y: inset, width: innerWidth, height: height - inset * 2 };
    const body = detail === 'full' ? bodyHeight(type, platePadding, gap) : 0;
    const bandHeight = headerHeight + (body ? body + gap : 0) + footerHeight + platePadding;
    const bandTop = height - inset - bandHeight;
    const header = shows.name ? { x: inset, y: bandTop, width: innerWidth, height: headerHeight } : null;
    const bodyBox = body ? { x: inset, y: bandTop + headerHeight, width: innerWidth, height: body } : null;
    const footer = { x: inset, y: height - inset - footerHeight - platePadding / 2, width: innerWidth, height: footerHeight };
    return { art, header, body: bodyBox, footer, platePadding, innerRadius, type, shows };
  }

  const header = shows.name ? { x: inset, y: inset, width: innerWidth, height: headerHeight } : null;
  const artTop = inset + (header ? headerHeight + gap : 0);
  const footer = { x: inset, y: height - inset - footerHeight, width: innerWidth, height: footerHeight };

  if (detail !== 'full') {
    const art = { x: inset, y: artTop, width: innerWidth, height: footer.y - gap - artTop };
    return { art, header, body: null, footer, platePadding, innerRadius, type, shows };
  }

  const body = bodyHeight(type, platePadding, gap);
  const bodyTop = footer.y - gap - body;
  const art = { x: inset, y: artTop, width: innerWidth, height: bodyTop - gap - artTop };
  return {
    art,
    header,
    body: { x: inset, y: bodyTop, width: innerWidth, height: body },
    footer,
    platePadding,
    innerRadius,
    type,
    shows,
  };
}
