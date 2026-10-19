import type { Era } from '@/types/card';

/**
 * Procedural "banknote" engravings drawn behind the monogram, as SVG path strings.
 * Pure geometry, cached per size: grids of thumbnails never recompute them.
 */

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Guilloché rosette: several hypotrochoid rings, like the security pattern of a banknote.
 * `rings` concentric loops, each with `petals` lobes.
 */
export function guillochePath(cx: number, cy: number, radius: number, petals = 18, rings = 3): string {
  const parts: string[] = [];
  for (let ring = 0; ring < rings; ring += 1) {
    const outer = radius * (1 - ring * 0.22);
    const inner = outer / petals;
    const offset = inner * (2.2 + ring * 0.6);
    const steps = petals * 24;
    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * Math.PI * 2;
      const k = (outer - inner) / inner;
      const x = cx + (outer - inner) * Math.cos(t) + offset * Math.cos(k * t);
      const y = cy + (outer - inner) * Math.sin(t) - offset * Math.sin(k * t);
      parts.push(`${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`);
    }
    parts.push('Z');
  }
  return parts.join(' ');
}

/** Greek key (meander) frieze: antiquity. */
function meander(width: number, y: number, height: number): string {
  const unit = height;
  const parts: string[] = [];
  for (let x = 0; x < width; x += unit) {
    const u = unit;
    parts.push(
      `M${round(x)} ${round(y + u)} L${round(x)} ${round(y)} L${round(x + u * 0.75)} ${round(y)} ` +
        `L${round(x + u * 0.75)} ${round(y + u * 0.75)} L${round(x + u * 0.25)} ${round(y + u * 0.75)} ` +
        `L${round(x + u * 0.25)} ${round(y + u * 0.25)} L${round(x + u * 0.5)} ${round(y + u * 0.25)} ` +
        `L${round(x + u * 0.5)} ${round(y + u * 0.5)} M${round(x + u * 0.75)} ${round(y + u)} L${round(x + u)} ${round(y + u)}`,
    );
  }
  return parts.join(' ');
}

/** Row of lancet arches with quatrefoils: medieval. */
function arches(width: number, y: number, height: number): string {
  const step = height * 0.9;
  const parts: string[] = [];
  for (let x = 0; x < width; x += step) {
    const mid = x + step / 2;
    parts.push(
      `M${round(x)} ${round(y + height)} Q${round(x)} ${round(y)} ${round(mid)} ${round(y)} ` +
        `Q${round(x + step)} ${round(y)} ${round(x + step)} ${round(y + height)}`,
    );
    const r = step * 0.14;
    const cy = y + height * 0.55;
    for (const [dx, dy] of [
      [0, -r],
      [r, 0],
      [0, r],
      [-r, 0],
    ] as const) {
      const px = mid + dx;
      const py = cy + dy;
      parts.push(
        `M${round(px + r * 0.6)} ${round(py)} A${round(r * 0.6)} ${round(r * 0.6)} 0 1 0 ${round(px - r * 0.6)} ${round(py)} ` +
          `A${round(r * 0.6)} ${round(r * 0.6)} 0 1 0 ${round(px + r * 0.6)} ${round(py)}`,
      );
    }
  }
  return parts.join(' ');
}

/** Copperplate wavy hatching: modern era (1500–1900). */
function copperplate(width: number, y: number, height: number): string {
  const lines = 6;
  const parts: string[] = [];
  for (let line = 0; line < lines; line += 1) {
    const baseY = y + (height / (lines - 1)) * line;
    const amplitude = height * 0.08;
    const segments = Math.ceil(width / 6);
    for (let i = 0; i <= segments; i += 1) {
      const x = (width / segments) * i;
      const yy = baseY + Math.sin(x / (height * 0.35) + line * 0.9) * amplitude;
      parts.push(`${i === 0 ? 'M' : 'L'}${round(x)} ${round(yy)}`);
    }
  }
  return parts.join(' ');
}

/** Diagonal grid and nested squares: contemporary. */
function geometric(width: number, y: number, height: number): string {
  const step = height * 0.5;
  const parts: string[] = [];
  for (let x = -height; x < width + height; x += step) {
    parts.push(`M${round(x)} ${round(y + height)} L${round(x + height)} ${round(y)}`);
  }
  const box = height * 0.7;
  for (let x = height * 0.4; x < width; x += height * 2.2) {
    for (let k = 0; k < 3; k += 1) {
      const inset = (box / 6) * k;
      const top = y + (height - box) / 2 + inset;
      const left = x + inset;
      const side = box - inset * 2;
      parts.push(`M${round(left)} ${round(top)} h${round(side)} v${round(side)} h${round(-side)} Z`);
    }
  }
  return parts.join(' ');
}

const MOTIFS: Record<Era, (width: number, y: number, height: number) => string> = {
  antiquity: meander,
  medieval: arches,
  modern: copperplate,
  contemporary: geometric,
};

/** Era frieze spanning `width`, drawn in a band of `height` starting at `y`. */
export function eraMotifPath(era: Era, width: number, y: number, height: number): string {
  return MOTIFS[era](width, y, height);
}

const cache = new Map<string, { rosette: string; motif: string }>();

/** Engraving paths for one artwork window size, memoized across cards. */
export function engravingPaths(era: Era, width: number, height: number): { rosette: string; motif: string } {
  const key = `${era}:${width}x${height}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const band = Math.max(6, Math.round(height * 0.12));
  const paths = {
    rosette: guillochePath(width * 0.62, height * 0.42, Math.min(width, height) * 0.62, width < 120 ? 12 : 18, width < 120 ? 2 : 3),
    motif: eraMotifPath(era, width, height - band - Math.max(2, height * 0.03), band),
  };
  cache.set(key, paths);
  return paths;
}
