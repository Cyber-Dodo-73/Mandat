import { RARITIES, rarityStyles } from '@/theme/rarity';

import { availableFinishes, isFinishAvailable } from '../finishes';
import { revealTimeline, suspenseTicks } from '../revealConfig';

describe('suspense before the flip', () => {
  it('holds rare and better cards longer, the rarer the longer', () => {
    const holds = (['rare', 'epic', 'legendary', 'mythic'] as const).map((rarity) => revealTimeline(rarity).suspenseMs);
    expect(holds[0]).toBeGreaterThanOrEqual(400);
    for (let i = 1; i < holds.length; i += 1) expect(holds[i]).toBeGreaterThan(holds[i - 1] ?? 0);
  });

  it('builds accelerating haptic ticks for rare and up only', () => {
    expect(revealTimeline('common').suspenseTicksMs).toEqual([]);
    expect(revealTimeline('uncommon').suspenseTicksMs).toEqual([]);
    const ticks = suspenseTicks(1200, 5);
    const gaps = ticks.slice(1).map((tick, index) => tick - (ticks[index] ?? 0));
    for (let i = 1; i < gaps.length; i += 1) expect(gaps[i]).toBeLessThanOrEqual(gaps[i - 1] ?? 0);
    expect(Math.max(...ticks)).toBeLessThan(1200);
  });

  it('drops the ticks with reduce motion', () => {
    expect(revealTimeline('mythic', { reduceMotion: true }).suspenseTicksMs).toEqual([]);
  });
});

describe('reveal timeline', () => {
  it('grows longer and more dramatic with rarity', () => {
    const totals = RARITIES.map((rarity) => revealTimeline(rarity).totalMs);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    expect(revealTimeline('common').effects).toMatchObject({ flash: false, burst: false, particles: 0, dim: false });
    expect(revealTimeline('rare').effects.flash).toBe(true);
    expect(revealTimeline('epic').effects).toMatchObject({ burst: true, particles: 40 });
    expect(revealTimeline('legendary').effects).toMatchObject({ rays: true, dim: true, spin: true });
    expect(revealTimeline('mythic').effects).toMatchObject({ prism: true, particles: 160, spin: true });
  });

  it('keeps the mythic sequence between 3 and 4 seconds', () => {
    const mythic = revealTimeline('mythic');
    expect(mythic.totalMs).toBeGreaterThanOrEqual(3000);
    expect(mythic.totalMs).toBeLessThanOrEqual(4000);
  });

  it('uses the haptic and sound of each rarity', () => {
    for (const rarity of RARITIES) {
      const timeline = revealTimeline(rarity);
      expect(timeline.haptic).toBe(rarityStyles[rarity].haptic);
      expect(timeline.sound).toBe(rarityStyles[rarity].sound);
    }
  });

  it('plays the sober variant without celebration for sensitive cards', () => {
    const sober = revealTimeline('mythic', { sober: true });
    expect(sober.effects).toMatchObject({ particles: 0, rays: false, prism: false, burst: false });
    expect(sober.sound).toBe('flip');
    // Same rhythm as the rarity: the pause and dim stay.
    expect(sober.suspenseMs).toBe(revealTimeline('mythic').suspenseMs);
    expect(sober.effects.dim).toBe(true);
  });

  it('cannot be skipped the first time a rarity is pulled', () => {
    expect(revealTimeline('epic').skippable).toBe(true);
    expect(revealTimeline('epic', { firstTimeForRarity: true }).skippable).toBe(false);
  });

  it('drops effects with reduce motion', () => {
    const reduced = revealTimeline('legendary', { reduceMotion: true });
    expect(reduced.flipMs).toBe(0);
    expect(reduced.effects).toMatchObject({ flash: false, rays: false, particles: 0, spin: false });
    expect(reduced.totalMs).toBeLessThan(revealTimeline('legendary').totalMs);
  });

  it('adds a beat for non-standard finishes, a longer one for gold', () => {
    expect(revealTimeline('rare').finishBeat).toBeNull();
    const holo = revealTimeline('rare', { finish: 'holo' });
    const gold = revealTimeline('rare', { finish: 'gold' });
    expect(holo.finishBeat).toMatchObject({ kind: 'foil', particles: 0, celebrate: true });
    expect(gold.finishBeat).toMatchObject({ kind: 'gold', celebrate: true });
    expect(gold.finishBeat!.particles).toBeGreaterThan(0);
    expect(gold.totalMs).toBeGreaterThan(holo.totalMs);
    expect(holo.totalMs).toBeGreaterThan(revealTimeline('rare').totalMs);
    expect(holo.finishBeat!.atMs).toBeGreaterThanOrEqual(holo.suspenseMs + holo.flipMs);
  });

  it('keeps gold sober for sensitive cards', () => {
    const beat = revealTimeline('legendary', { finish: 'gold', sober: true }).finishBeat;
    expect(beat).toMatchObject({ kind: 'gold', particles: 0, celebrate: false });
  });
});

describe('finishes', () => {
  it('reserves full art for rare and above', () => {
    expect(availableFinishes('common')).toEqual(['standard', 'holo', 'gold']);
    expect(availableFinishes('uncommon')).not.toContain('full_art');
    expect(availableFinishes('rare')).toEqual(['standard', 'holo', 'full_art', 'gold']);
    expect(isFinishAvailable('mythic', 'full_art')).toBe(true);
    expect(isFinishAvailable('common', 'gold')).toBe(true);
  });
});
