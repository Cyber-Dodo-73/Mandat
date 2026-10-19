import { rarityStyles, type ThemeColors } from '@/theme';

import type { CalendarStatus } from './calendar';

/** Streak colors: hot flame tones for kept days, ice for frozen ones (same on both themes). */
export const streakPalette = {
  flame: '#FF7A1A',
  flameEdge: '#B4400A',
  flameHot: rarityStyles.legendary.color,
  ice: '#5CC8FF',
  iceEdge: '#1E7FB8',
  onFlame: '#1A0A02',
  onIce: '#03131F',
} as const;

export type DayTone = { fill: string; edge: string; label: string; border?: string };

/** Fill, 3D edge and label color of a calendar bubble. */
export function dayTone(status: CalendarStatus, colors: ThemeColors): DayTone {
  switch (status) {
    case 'active':
      return { fill: streakPalette.flame, edge: streakPalette.flameEdge, label: streakPalette.onFlame };
    case 'frozen':
      return { fill: streakPalette.ice, edge: streakPalette.iceEdge, label: streakPalette.onIce };
    case 'missed':
      return { fill: colors.surfaceRaised, edge: colors.dangerEdge, label: colors.danger };
    case 'today':
      return { fill: colors.surface, edge: colors.accentEdge, label: colors.text, border: streakPalette.flame };
    default:
      return { fill: colors.surfaceRaised, edge: colors.neutralButtonEdge, label: colors.textMuted };
  }
}
