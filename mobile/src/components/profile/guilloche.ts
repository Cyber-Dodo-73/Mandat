import { Skia, type SkPath } from '@shopify/react-native-skia';

/**
 * Banknote-style rosette: a circle whose radius oscillates `petals` times, drawn `rings`
 * times with a phase shift. Built once per emblem size (memoize at the call site).
 */
export function rosettePath(cx: number, cy: number, radius: number, petals: number, rings: number, seed: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  const steps = 180;
  for (let ring = 0; ring < rings; ring += 1) {
    const phase = seed * Math.PI * 2 + (ring * Math.PI) / rings;
    for (let step = 0; step <= steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2;
      const r = radius * (0.86 + 0.14 * Math.sin(petals * angle + phase));
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (step === 0) builder.moveTo(x, y);
      else builder.lineTo(x, y);
    }
    builder.close();
  }
  return builder.detach();
}

/** Horizontal engraving waves for banners. */
export function wavesPath(width: number, height: number, lines: number, seed: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  const amplitude = height / (lines * 1.6);
  for (let line = 0; line < lines; line += 1) {
    const baseY = ((line + 0.5) / lines) * height;
    const phase = seed * Math.PI * 2 + line * 0.7;
    for (let x = 0; x <= width; x += 6) {
      const y = baseY + amplitude * Math.sin((x / width) * Math.PI * 4 + phase);
      if (x === 0) builder.moveTo(x, y);
      else builder.lineTo(x, y);
    }
  }
  return builder.detach();
}
