import { Skia, type SkPath, type SkPathBuilder } from '@shopify/react-native-skia';

/** Booster proportions shared by every pack size. */
export const BOOSTER_RATIO = 1.62;

export type BoosterGeometry = {
  width: number;
  height: number;
  /** Height of the crimped (heat-sealed) band at the top and bottom. */
  crimp: number;
  /** Y of the perforated tear seam that separates the top strip. */
  seamY: number;
  /** Full pack silhouette with serrated top and bottom edges. */
  outline: SkPath;
  /** Zigzag seam from left to right, trimmed to draw the tear as it progresses. */
  seam: SkPath;
  /** Area above the seam (the strip that gets torn off). */
  stripClip: SkPath;
  /** Area below the seam (the body that stays). */
  bodyClip: SkPath;
  /** Guilloche rosettes printed in the middle of the foil. */
  guilloche: SkPath;
  rosetteCenter: { x: number; y: number };
  rosetteRadius: number;
};

const TOOTH_WIDTH = 7;
const TOOTH_DEPTH = 4;
const SEAM_STEP = 9;
const SEAM_AMPLITUDE = 2.5;

function zigzagY(index: number, base: number, amplitude: number): number {
  return base + (index % 2 === 0 ? -amplitude : amplitude);
}

function hypotrochoid(path: SkPathBuilder, cx: number, cy: number, radius: number, R: number, r: number, d: number) {
  const scale = radius / (R - r + d);
  // The curve closes after r / gcd(R, r) turns; small integers keep it short.
  const turns = r;
  const steps = 720;
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const k = (R - r) / r;
    const x = cx + scale * ((R - r) * Math.cos(t) + d * Math.cos(k * t));
    const y = cy + scale * ((R - r) * Math.sin(t) - d * Math.sin(k * t));
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.close();
}

export function boosterGeometry(width: number): BoosterGeometry {
  const height = Math.round(width * BOOSTER_RATIO);
  const crimp = Math.round(height * 0.055);
  const seamY = Math.round(height * 0.13);

  const outline = Skia.PathBuilder.Make();
  const teeth = Math.max(2, Math.round(width / TOOTH_WIDTH));
  const toothWidth = width / teeth;
  outline.moveTo(0, TOOTH_DEPTH);
  for (let i = 0; i < teeth; i += 1) {
    outline.lineTo(toothWidth * (i + 0.5), 0);
    outline.lineTo(toothWidth * (i + 1), TOOTH_DEPTH);
  }
  outline.lineTo(width, height - TOOTH_DEPTH);
  for (let i = teeth; i > 0; i -= 1) {
    outline.lineTo(toothWidth * (i - 0.5), height);
    outline.lineTo(toothWidth * (i - 1), height - TOOTH_DEPTH);
  }
  outline.close();

  const seamPoints = Math.max(2, Math.round(width / SEAM_STEP));
  const seamStep = width / seamPoints;
  const seam = Skia.PathBuilder.Make();
  seam.moveTo(0, zigzagY(0, seamY, SEAM_AMPLITUDE));
  for (let i = 1; i <= seamPoints; i += 1) {
    seam.lineTo(seamStep * i, zigzagY(i, seamY, SEAM_AMPLITUDE));
  }

  const stripClip = Skia.PathBuilder.Make();
  stripClip.moveTo(-1, -1);
  stripClip.lineTo(width + 1, -1);
  for (let i = seamPoints; i >= 0; i -= 1) {
    stripClip.lineTo(seamStep * i, zigzagY(i, seamY, SEAM_AMPLITUDE));
  }
  stripClip.close();

  const bodyClip = Skia.PathBuilder.Make();
  bodyClip.moveTo(-1, height + 1);
  bodyClip.lineTo(width + 1, height + 1);
  for (let i = seamPoints; i >= 0; i -= 1) {
    bodyClip.lineTo(seamStep * i, zigzagY(i, seamY, SEAM_AMPLITUDE));
  }
  bodyClip.close();

  const rosetteCenter = { x: width / 2, y: height * 0.47 };
  const rosetteRadius = width * 0.36;
  const guilloche = Skia.PathBuilder.Make();
  // Two interleaved security-print rosettes, like the ones on passports and banknotes.
  hypotrochoid(guilloche, rosetteCenter.x, rosetteCenter.y, rosetteRadius, 7, 3, 2.6);
  hypotrochoid(guilloche, rosetteCenter.x, rosetteCenter.y, rosetteRadius * 0.72, 9, 5, 3.4);

  return {
    width,
    height,
    crimp,
    seamY,
    outline: outline.detach(),
    seam: seam.detach(),
    stripClip: stripClip.detach(),
    bodyClip: bodyClip.detach(),
    guilloche: guilloche.detach(),
    rosetteCenter,
    rosetteRadius,
  };
}
