/** Immutable renderer blockheight-1. Changing emitted bytes requires a new version. */
import { formatHeight } from "./format.js";
export const paletteIds = ["mineral", "lichen", "clay"] as const;
export type ArtParams = {
  palette: (typeof paletteIds)[number];
  density: "quiet" | "layered" | "dense";
  composition: "single" | "chain";
};
export type Artwork = {
  seed: string;
  blockHeight: number;
  rendererVersion: "blockheight-1";
  params: ArtParams;
};

export function validateParams(value: unknown): ArtParams {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid art parameters");
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !== "composition,density,palette" ||
    !paletteIds.some((id) => id === record.palette) ||
    !["quiet", "layered", "dense"].some((id) => id === record.density) ||
    !["single", "chain"].some((id) => id === record.composition)
  )
    throw new Error("Invalid art parameters");
  // Return only primitives in fixed key order; never preserve the input prototype.
  return {
    palette: record.palette as ArtParams["palette"],
    density: record.density as ArtParams["density"],
    composition: record.composition as ArtParams["composition"],
  };
}

type Point = readonly [number, number, number];
type Cell = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: number;
  kind: number;
  alpha: number;
};
const palettes = {
  mineral: {
    paper: "#d9d9cf",
    ink: "#3f4940",
    colors: ["#d5be9f", "#af654c", "#edd16b", "#8ca9a0", "#6f8e87"],
  },
  lichen: {
    paper: "#dad9d2",
    ink: "#344637",
    colors: ["#75816a", "#43583c", "#5595ae", "#7fac91", "#b98f82"],
  },
  clay: {
    paper: "#e5dbce",
    ink: "#57483f",
    colors: ["#c29b82", "#a96451", "#d6b57a", "#9ba79e", "#857c70"],
  },
} as const;

// xoshiro128**: all 256 seed bits are folded into the four 32-bit state words.
// This is an artistic PRNG, not the cryptographic source of mint seeds.
export function randomSource(seed: string, height: number): () => number {
  const words = [0, 0, 0, 0];
  for (let i = 0; i < 8; i++)
    words[i % 4] =
      (Math.imul(
        (words[i % 4] ?? 0) ^ Number.parseInt(seed.slice(i * 8, i * 8 + 8), 16),
        0x85ebca6b,
      ) +
        i) >>>
      0;
  let a = (words[0] ?? 0) ^ 0x9e3779b9;
  let b = (words[1] ?? 0) ^ height;
  let c = (words[2] ?? 0) ^ Math.floor(height / 0x100000000);
  let d = (words[3] ?? 0) ^ 0x243f6a88;
  if ((a | b | c | d) === 0) a = 1;
  const rotate = (v: number, n: number): number => (v << n) | (v >>> (32 - n));
  return () => {
    const result = Math.imul(rotate(Math.imul(b, 5), 7), 9) >>> 0;
    const temporary = b << 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= temporary;
    d = rotate(d, 11);
    return result;
  };
}

export const fixed = (value: number): string =>
  (Math.round(value * 100) / 100).toFixed(2);
const project = ([x, y, z]: Point): string =>
  `${fixed(500 + (x - z) * 0.71)},${fixed(565 + (x + z) * 0.355 - y * 0.87)}`;

/** The SVG contains no script, text fonts, remote resources, IDs, or user markup. */
export function renderSvg(art: Artwork): string {
  const params = validateParams(art.params);
  if (
    !/^[0-9a-f]{64}$/.test(art.seed) ||
    !Number.isSafeInteger(art.blockHeight) ||
    art.blockHeight < 1 ||
    art.rendererVersion !== "blockheight-1"
  )
    throw new Error("Invalid artwork");
  const palette = palettes[params.palette];
  const random = randomSource(art.seed, art.blockHeight);
  const pick = (n: number): number => random() % n;
  const cells: Cell[] = [];
  const layers =
    params.density === "quiet" ? 4 : params.density === "layered" ? 6 : 9;
  const depths = params.density === "dense" ? 5 : 3;
  for (let z = 0; z < depths; z++) {
    for (let y = 0; y < layers; y++) {
      const columns = 1 + pick(params.density === "quiet" ? 3 : 4);
      // Unequal but exact partitions, preserving the original wall/band approach.
      let remaining = 300;
      let x = -150;
      for (let column = 0; column < columns; column++) {
        const rest = columns - column - 1;
        const width =
          rest === 0
            ? remaining
            : Math.max(30, Math.floor(remaining / (rest + 1)) - 15 + pick(31));
        cells.push({
          x,
          y: (y * 300) / layers,
          z: -150 + (z * 300) / depths,
          w: width,
          h: 300 / layers,
          d: 300 / depths,
          color: pick(5),
          kind: pick(5),
          alpha: pick(10) < 4 ? 0.13 : 0.96,
        });
        x += width;
        remaining -= width;
      }
    }
  }
  if (params.composition === "chain") {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        cells.push({
          x: side * (270 + i * 115) - 38,
          y: 90,
          z: -38,
          w: 76,
          h: 38,
          d: 76,
          color: pick(5),
          kind: 0,
          alpha: 0.96,
        });
        cells.push({
          x: side * (270 + i * 115) - 38,
          y: 128,
          z: -38,
          w: 76,
          h: 38,
          d: 76,
          color: pick(5),
          kind: 0,
          alpha: 0.96,
        });
      }
    }
  }
  cells.sort(
    (a, b) =>
      a.x +
      a.z +
      a.y +
      (a.w + a.d + a.h) / 2 -
      (b.x + b.z + b.y + (b.w + b.d + b.h) / 2),
  );
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" role="img" aria-label="BlockHeight artwork at block height ${art.blockHeight}">`,
    `<title>BlockHeight — Block ${art.blockHeight}</title><rect width="1000" height="1000" fill="${palette.paper}"/>`,
    `<rect x="14" y="14" width="972" height="972" fill="none" stroke="${palette.ink}" stroke-width="1.4"/>`,
    `<g stroke="${palette.ink}" stroke-width="1.05" stroke-linejoin="round">`,
  ];
  const polygon = (points: Point[], color: string, alpha: number): void => {
    parts.push(
      `<polygon points="${points.map(project).join(" ")}" fill="${color}" fill-opacity="${fixed(alpha)}"/>`,
    );
  };
  const line = (a: Point, b: Point): void => {
    parts.push(`<path d="M${project(a)} L${project(b)}" fill="none"/>`);
  };
  if (params.composition === "chain") {
    line([-420, 128, 0], [-150, 128, 0]);
    line([150, 128, 0], [420, 128, 0]);
    line([-420, 123, 3], [-150, 123, 3]);
    line([150, 123, 3], [420, 123, 3]);
  }
  for (const cell of cells) {
    const { x, y, z, w, h, d, alpha, kind } = cell;
    const color = palette.colors[cell.color] ?? palette.colors[0];
    const shade = palette.colors[(cell.color + 1) % 5] ?? palette.colors[1];
    const a: Point = [x, y, z];
    const b: Point = [x + w, y, z];
    const c: Point = [x + w, y, z + d];
    const e: Point = [x, y, z + d];
    const A: Point = [x, y + h, z];
    const B: Point = [x + w, y + h, z];
    const C: Point = [x + w, y + h, z + d];
    const E: Point = [x, y + h, z + d];
    if (alpha < 0.5) {
      polygon([a, b, B, A], color, 0.05);
      polygon([a, e, E, A], color, 0.05);
      const inset = Math.min(w, h) * 0.12;
      if (kind === 1 || kind === 2) {
        const p: Point = [x + inset, y + inset, z + d - 3];
        const q: Point = [x + w - inset, y + inset, z + d - 3];
        const r: Point = [x + w / 2, y + h - inset, z + d - 3];
        const P: Point = [p[0], p[1], z + 3];
        const Q: Point = [q[0], q[1], z + 3];
        const R: Point = [r[0], r[1], z + 3];
        polygon([P, Q, R], color, 0.22);
        polygon([q, Q, R, r], shade, 0.36);
        polygon([p, q, r], color, 0.52);
        line(p, P);
      } else if (kind === 3) {
        for (let slab = 1; slab <= 3; slab++) {
          const level = y + (h * slab) / 5;
          polygon(
            [
              [x + 3, level, z + 3],
              [x + w - 3, level, z + 3],
              [x + w - 3, level, z + d - 3],
              [x + 3, level, z + d - 3],
            ],
            shade,
            0.55,
          );
        }
      } else if (kind === 4) {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const front: Point[] = [
          [cx - w * 0.22, cy - h * 0.35, z + d - 3],
          [cx + w * 0.22, cy - h * 0.35, z + d - 3],
          [cx + w * 0.4, cy, z + d - 3],
          [cx + w * 0.22, cy + h * 0.35, z + d - 3],
          [cx - w * 0.22, cy + h * 0.35, z + d - 3],
          [cx - w * 0.4, cy, z + d - 3],
        ];
        const back = front.map(([px, py]): Point => [px, py, z + 3]);
        polygon(back, shade, 0.15);
        for (let i = 0; i < front.length; i++) line(front[i]!, back[i]!);
        polygon(front, color, 0.65);
      }
    }
    polygon([e, c, C, E], color, alpha);
    polygon([b, c, C, B], shade, alpha);
    polygon([A, B, C, E], color, alpha < 0.5 ? 0.1 : 0.91);
  }
  parts.push("</g>");
  parts.push(
    caption(`BLOCKHEIGHT ${formatHeight(art.blockHeight)}`, palette.ink),
  );
  parts.push("</svg>");
  return parts.join("");
}

// Single-line architectural lettering, embedded as vector paths for archival fidelity.
const glyphs: Record<string, string> = {
  B: "M0 0V6H3L4 5V4L3 3H0M3 3L4 2V1L3 0H0",
  L: "M0 0V6H4",
  O: "M1 0H3L4 1V5L3 6H1L0 5V1Z",
  C: "M4 1L3 0H1L0 1V5L1 6H3L4 5",
  K: "M0 0V6M4 0L0 3L4 6",
  H: "M0 0V6M4 0V6M0 3H4",
  E: "M4 0H0V6H4M0 3H3",
  I: "M0 0H4M2 0V6M0 6H4",
  G: "M4 1L3 0H1L0 1V5L1 6H4V3H2",
  T: "M0 0H4M2 0V6",
  "0": "M1 0H3L4 1V5L3 6H1L0 5V1ZM0 5L4 1",
  "1": "M1 1L2 0V6M0 6H4",
  "2": "M0 1L1 0H3L4 1V2L0 6H4",
  "3": "M0 0H3L4 1V2L3 3H1M3 3L4 4V5L3 6H0",
  "4": "M3 6V0L0 4H4",
  "5": "M4 0H0V3H3L4 4V5L3 6H0",
  "6": "M4 0H1L0 1V5L1 6H3L4 5V4L3 3H0",
  "7": "M0 0H4L1 6",
  "8": "M1 3L0 2V1L1 0H3L4 1V2L3 3H1L0 4V5L1 6H3L4 5V4L3 3",
  "9": "M4 3H1L0 2V1L1 0H3L4 1V5L3 6H0",
  ",": "M2 6L1 8",
};
/**
 * blockheight-4: the same lettering, sized to read on a phone (glyphs about 6 px tall at 350 px) but
 * kept quiet: a note beside the artwork, not a headline. Drawn at reduced opacity; the ink itself
 * still passes 4.5:1 against the paper.
 */
export function largeCaption(label: string, ink: string, y = 856): string {
  const advance = 17;
  const origin = 500 - (label.length * advance) / 2;
  return `<g fill="none" stroke="${ink}" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.65">${[...label].map((letter, i) => (glyphs[letter] ? `<path transform="translate(${fixed(origin + i * advance)} ${y}) scale(2.6)" d="${glyphs[letter]}"/>` : "")).join("")}</g>`;
}
/**
 * The caption turned by 90 degrees along the left or right edge, its start at the top corner:
 * left reads upwards and right downwards, so the letters' tops face the outside. It sits inside
 * the frame (`inset`) and moves nothing else.
 */
export function cornerCaption(
  label: string,
  ink: string,
  side: "left" | "right",
  inset: number,
): string {
  const advance = 17;
  const scale = 2.6;
  const length = label.length * advance - (advance - 4 * scale);
  const edge = inset + 24;
  const top = inset + 24;
  const placement =
    side === "left"
      ? `translate(${fixed(edge)} ${fixed(top + length)}) rotate(-90)`
      : `translate(${fixed(1000 - edge)} ${fixed(top)}) rotate(90)`;
  return `<g transform="${placement}" fill="none" stroke="${ink}" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.65">${[...label].map((letter, i) => (glyphs[letter] ? `<path transform="translate(${fixed(i * advance)} 0) scale(${scale})" d="${glyphs[letter]}"/>` : "")).join("")}</g>`;
}
export function caption(label: string, ink: string, y = 856): string {
  const origin = 500 - label.length * 6;
  return `<g fill="none" stroke="${ink}" stroke-width="0.42" stroke-linecap="round" stroke-linejoin="round" opacity="0.84">${[...label].map((letter, i) => (glyphs[letter] ? `<path transform="translate(${origin + i * 12} ${y}) scale(1.6)" d="${glyphs[letter]}"/>` : "")).join("")}</g>`;
}
