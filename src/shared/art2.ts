/** Renderers blockheight-2, -3 and -4: the original prototype's full vocabulary. Changing emitted bytes requires a new version. */
import {
  caption,
  cornerCaption,
  fixed,
  largeCaption,
  randomSource,
} from "./art.js";
import { formatHeight } from "./format.js";
import { eventObjects, type EventObject } from "./event-layout.js";
import { palettes2, palette2Ids, type Palette2Id } from "./palettes.js";
import {
  bevelMesh,
  closestOnMesh,
  connectorMesh,
  cutCorner,
  type Face,
} from "./geometry.js";
import {
  annotationLayer,
  annotationFooterHeight,
  countLabel,
  xchLabel,
  type Annotation,
  type Marker,
} from "./annotations.js";

export { palette2Ids };
import { paletteNames } from "./palettes.js";
export { paletteNames };
import { validateDigest, type ChainDigest } from "./digest.js";
export type { Palette2Id };

/** Trait names that are not simply the capitalised option key. */
const traitNames: Record<string, string> = {
  blocksize: "Block size",
  eventlayout: "Event layout",
};
/** The name of an option as an NFT trait. */
export const traitLabel = (key: string): string =>
  traitNames[key] ?? key[0]!.toUpperCase() + key.slice(1);
/** The value of an option as an NFT trait: a palette shows its name, not its internal id. */
export const traitValue = (key: string, value: string): string =>
  key === "palette" ? (paletteNames[value as Palette2Id] ?? value) : value;

/** Every option, in fixed order. Used for validation, the studio UI and NFT traits. */
export const paramSpec = {
  palette: palette2Ids,
  mix: ["none", "little", "much"],
  structure: ["quiet", "layered", "dense"],
  walls: ["few", "some", "many"],
  spacing: ["none", "tight", "airy"],
  shapes: ["few", "balanced", "many"],
  glass: ["solid", "mixed", "glassy"],
  lines: ["fine", "regular", "heavy"],
  blocksize: ["small", "medium", "large"],
  zoom: ["out", "normal", "in", "close"],
  view: ["classic", "high", "low", "flipped"],
  composition: ["single", "chain"],
  axis: ["x", "z", "vertical"],
  satellites: ["one", "two", "three"],
  reach: ["near", "mid", "far"],
  wires: ["straight", "loose"],
  frame: ["none", "thin", "bold"],
  fill: ["none", "dust", "panel"],
  // "topleft" and "topright" turn the lettering by 90 degrees; the drawing stays where "none" puts it.
  caption: ["low", "bottom", "topleft", "topright", "none"],
  // Added after release: absent in older stored parameters, which then mean "none".
  ground: ["none", "grid", "shadow", "both"],
  hatch: ["none", "light", "dense"],
  twist: ["none", "slight", "strong"],
  slices: ["none", "little", "much", "fan"],
  bevel: ["none", "subtle", "bold"],
  occlusion: ["none", "soft", "deep"],
  cutaway: ["none", "corner"],
  material: ["none", "concrete", "metal", "frosted"],
  connectors: ["none", "collars", "nodes"],
  accents: ["none", "edges", "shapes", "wall"],
  // "markers" and "explained" are frozen for saved artworks; "full" (the studio's choice) also
  // keeps a dashed callout for shapes hidden behind other faces.
  annotations: ["none", "markers", "explained", "full"],
  eventlayout: ["none", "elongated", "tiled", "stacked"],
} as const;
/** Options added after the first release; stored parameters may omit them (= "none"). */
const optionalKeys = [
  "ground",
  "hatch",
  "twist",
  "slices",
  "bevel",
  "occlusion",
  "cutaway",
  "material",
  "connectors",
  "accents",
  "annotations",
  "eventlayout",
] as const;
export type ParamKey = keyof typeof paramSpec;
export const paramKeys = Object.keys(paramSpec) as ParamKey[];
/** Values that saved artworks may carry but the studio no longer offers. */
const retiredValues: Partial<Record<ParamKey, readonly string[]>> = {
  annotations: ["markers", "explained"],
};
/** The values the studio offers for a control. */
export const offeredValues = (key: ParamKey): readonly string[] =>
  paramSpec[key].filter((v) => !retiredValues[key]?.includes(v));
export type Art2Params = { [K in ParamKey]: (typeof paramSpec)[K][number] };
export type Artwork2 = {
  seed: string;
  blockHeight: number;
  rendererVersion: "blockheight-2";
  params: Art2Params;
};

/** Plain 0..1 brightness (no powers, so the result is identical on every engine). */
const brightness = (color: string): number =>
  (0.2126 * Number.parseInt(color.slice(1, 3), 16) +
    0.7152 * Number.parseInt(color.slice(3, 5), 16) +
    0.0722 * Number.parseInt(color.slice(5, 7), 16)) /
  255;
/** Palette text colour, unless it would disappear into the paper; then black or white. */
export function captionInk(paper: string, text: string): string {
  if (Math.abs(brightness(paper) - brightness(text)) >= 0.3) return text;
  return brightness(paper) > 0.5 ? "#1f1f1f" : "#f2f2f2";
}

/**
 * blockheight-4: issued since Paket C. The same design controls; with `chain` the inner shapes come
 * from a real block as in blockheight-3. Colours and the inner shapes draw from streams of their
 * own, so a colour mix, glass or shape option changes only itself and never the walls; the caption
 * is large and keeps a contrast of at least 4.5:1 to the paper.
 */
export type Artwork4 = {
  seed: string;
  blockHeight: number;
  rendererVersion: "blockheight-4";
  params: Art2Params;
  chain?: ChainDigest;
  /** Present on new real-chain artwork; absent from historical, unproven artwork. */
  artworkChainId?: string;
};

/**
 * Approximate WCAG luminance: squares instead of the 2.4 power, so the result is identical on every
 * engine. Close enough to pick a readable ink; the tests check the real ratio.
 */
const luminance = (color: string): number => {
  const channel = (i: number): number => {
    const v = Number.parseInt(color.slice(i, i + 2), 16) / 255;
    return v * v;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
/** blockheight-4: palette text colour when it reads clearly on the paper, else black or white. */
export function readableInk(paper: string, text: string): string {
  if (contrast(paper, text) >= 4.5) return text;
  return contrast(paper, "#1f1f1f") >= contrast(paper, "#f2f2f2")
    ? "#1f1f1f"
    : "#f2f2f2";
}

/** blockheight-3: the same design controls as blockheight-2, with the inner shapes derived from a real block. */
export type Artwork3 = {
  seed: string;
  blockHeight: number;
  rendererVersion: "blockheight-3";
  params: Art2Params;
  chain: ChainDigest;
  artworkChainId?: string;
};

export function validateParams2(value: unknown): Art2Params {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid art parameters");
  const record = value as Record<string, unknown>;
  const required = paramKeys.filter(
    (k) => !(optionalKeys as readonly string[]).includes(k),
  );
  const given = Object.keys(record).filter(
    (k) => !(optionalKeys as readonly string[]).includes(k),
  );
  if (
    given.sort().join(",") !== [...required].sort().join(",") ||
    Object.keys(record).some((k) => !(paramKeys as string[]).includes(k))
  )
    throw new Error("Invalid art parameters");
  const out: Record<string, string> = {};
  for (const key of paramKeys) {
    const v =
      record[key] ??
      ((optionalKeys as readonly string[]).includes(key) ? "none" : undefined);
    if (
      typeof v !== "string" ||
      !(paramSpec[key] as readonly string[]).includes(v)
    )
      throw new Error("Invalid art parameters");
    out[key] = v;
  }
  return out as Art2Params;
}

type Point = readonly [number, number, number];
/** x0, x1, y0, y1, z0, z1 */
export type Bounds = readonly [number, number, number, number, number, number];

/**
 * Painter's order for disjoint axis-aligned boxes, viewed along `direction` (default +x,+y,+z).
 * Box b can hide box a only when, on every axis that separates them, b lies on the viewer's
 * side; sorting by centre distance gets this wrong for boxes of different sizes (a wide box
 * in a back wall then paints over a narrower box in front of it). Returns indices, farthest
 * first; `keys` only break ties between unrelated boxes.
 */
export function drawOrder(
  bounds: readonly Bounds[],
  keys: readonly number[],
  direction: Point = [1, 1, 1],
): number[] {
  const eps = 1e-6;
  const n = bounds.length;
  const after: number[][] = Array.from({ length: n }, () => []);
  const waiting = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const a = bounds[i]!;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const b = bounds[j]!;
      let nearer = false;
      let farther = false;
      for (let k = 0; k < 6; k += 2) {
        const sign = direction[k / 2]!;
        if (Math.abs(sign) < eps) continue;
        const bBeyondA = b[k]! >= a[k + 1]! - eps;
        const aBeyondB = a[k]! >= b[k + 1]! - eps;
        if (sign > 0 ? bBeyondA : aBeyondB) nearer = true;
        if (sign > 0 ? aBeyondB : bBeyondA) farther = true;
      }
      if (nearer && !farther) {
        after[i]!.push(j);
        waiting[j]!++;
      }
    }
  }
  const byKey = Array.from({ length: n }, (_, i) => i).sort(
    (x, y) => keys[x]! - keys[y]!,
  );
  const done = new Array<boolean>(n).fill(false);
  const order: number[] = [];
  while (order.length < n) {
    let pick = byKey.find((i) => !done[i] && waiting[i] === 0);
    // Disjoint boxes cannot form a cycle; if numeric noise ever does, fall back to distance.
    if (pick === undefined) pick = byKey.find((i) => !done[i])!;
    done[pick] = true;
    order.push(pick);
    for (const j of after[pick]!) waiting[j]!--;
  }
  return order;
}
type Cell = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  kind: number;
  glass: boolean;
  top: string;
  front: string;
  side: string;
  a: string;
  b: string;
  c: string;
  /** blockheight-3: this cell hosts the shapes of one kind of chain event. */
  cluster?: Cluster;
  /** Index of the wall (slab along depth) the cell belongs to; satellites have none. */
  wall?: number;
  /** Positive-axis surfaces exposed by the architectural corner cut. */
  cutFaces?: { x?: boolean; y?: boolean; z?: boolean };
  accent?: boolean;
};
type ClusterShape =
  | "oval"
  | "coins"
  | "band"
  | "cube"
  | "hex"
  | "tri"
  | "ring"
  | "pair"
  | "slabs"
  | "tower"
  | "diamond"
  | "channel"
  | "pentagon"
  | "shield"
  | "ticket"
  | "wire";
type Cluster = {
  shape: ClusterShape;
  count: number;
  scale: number;
  annotation?: Annotation;
};

type Pt = [number, number];
// 16-gon on the unit circle, literal so every engine emits identical bytes.
const ring16: Pt[] = [
  [1, 0],
  [0.92388, 0.38268],
  [0.70711, 0.70711],
  [0.38268, 0.92388],
  [0, 1],
  [-0.38268, 0.92388],
  [-0.70711, 0.70711],
  [-0.92388, 0.38268],
  [-1, 0],
  [-0.92388, -0.38268],
  [-0.70711, -0.70711],
  [-0.38268, -0.92388],
  [0, -1],
  [0.38268, -0.92388],
  [0.70711, -0.70711],
  [0.92388, -0.38268],
];
const scaled = (pts: Pt[], sx: number, sy: number): Pt[] =>
  pts.map(([u, v]) => [u * sx, v * sy]);
const unitShapes: Record<string, Pt[]> = {
  // Each new protocol family gets its own extruded silhouette.
  channel: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.22, 0],
    [0.5, 0.5],
    [-0.5, 0.5],
    [-0.22, 0],
  ],
  pentagon: [
    [-0.5, -0.2],
    [-0.3, -0.5],
    [0.3, -0.5],
    [0.5, -0.2],
    [0, 0.5],
  ],
  shield: [
    [0, -0.5],
    [0.5, -0.1],
    [0.5, 0.5],
    [-0.5, 0.5],
    [-0.5, -0.1],
  ],
  ticket: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, -0.15],
    [0.35, 0],
    [0.5, 0.15],
    [0.5, 0.5],
    [-0.5, 0.5],
    [-0.5, 0.15],
    [-0.35, 0],
    [-0.5, -0.15],
  ],
  cube: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ],
  wire: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ],
  hex: [
    [-0.25, -0.5],
    [0.25, -0.5],
    [0.5, 0],
    [0.25, 0.5],
    [-0.25, 0.5],
    [-0.5, 0],
  ],
  tri: [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0, 0.5],
  ],
  diamond: [
    [0, -0.5],
    [0.5, 0],
    [0, 0.5],
    [-0.5, 0],
  ],
  tower: [
    [-0.22, -0.5],
    [0.22, -0.5],
    [0.22, 0.5],
    [-0.22, 0.5],
  ],
  oval: scaled(ring16, 0.5, 0.32),
  ring: scaled(ring16, 0.5, 0.36),
};

// Fixed orthographic constants (horizontal, depth slope, vertical): literals avoid libm differences.
const views = {
  classic: { h: 0.71, s: 0.355, v: 0.87, flip: false },
  high: { h: 0.71, s: 0.5, v: 0.71, flip: false },
  low: { h: 0.71, s: 0.22, v: 0.95, flip: false },
  flipped: { h: 0.71, s: 0.355, v: 0.87, flip: true },
} as const;

/** The SVG contains no script, fonts, remote resources, IDs or user markup. */
export function renderSvg2(art: Artwork2): string {
  if (art.rendererVersion !== "blockheight-2")
    throw new Error("Invalid artwork");
  return renderScene(art, undefined);
}
export function renderSvg3(art: Artwork3): string {
  if (art.rendererVersion !== "blockheight-3")
    throw new Error("Invalid artwork");
  const chain = validateDigest(art.chain);
  if (chain.height !== art.blockHeight) throw new Error("Invalid artwork");
  return renderScene(art, chain);
}
export function renderSvg4(art: Artwork4): string {
  if (art.rendererVersion !== "blockheight-4")
    throw new Error("Invalid artwork");
  if (art.chain === undefined) return renderScene(art, undefined, 4);
  const chain = validateDigest(art.chain);
  if (chain.height !== art.blockHeight) throw new Error("Invalid artwork");
  return renderScene(art, chain, 4);
}

/** One column of one band of one wall, as laid out before any shape, glass or colour is chosen. */
export type Slot = {
  z: number;
  depth: number;
  y: number;
  height: number;
  x: number;
  width: number;
};
/**
 * The block's walls, bands and columns: what the structure options decide. Tests compare it to show
 * which options keep the structure; the artwork itself is drawn as usual and not changed.
 */
export function wallLayout(art: Artwork2 | Artwork3 | Artwork4): Slot[] {
  const slots: Slot[] = [];
  const digest = "chain" in art ? art.chain : undefined;
  renderScene(
    art,
    digest,
    art.rendererVersion === "blockheight-4" ? 4 : 2,
    slots,
  );
  return slots;
}

function renderScene(
  art: { seed: string; blockHeight: number; params: unknown },
  digest: ChainDigest | undefined,
  /** 2 for blockheight-2 and -3, whose bytes never change; 4 for blockheight-4. */
  revision: 2 | 4 = 2,
  layout?: Slot[],
): string {
  const params = validateParams2(art.params);
  const annotated = digest !== undefined && params.annotations !== "none";
  const annotationEntries: Annotation[] = [];
  if (
    !/^[0-9a-f]{64}$/.test(art.seed) ||
    !Number.isSafeInteger(art.blockHeight) ||
    art.blockHeight < 1
  )
    throw new Error("Invalid artwork");
  const pal = palettes2[params.palette];
  // Caption and annotation lettering.
  const ink =
    revision >= 4
      ? readableInk(pal.paper, pal.text)
      : captionInk(pal.paper, pal.text);
  const view = views[params.view];
  const size = { small: 210, medium: 300, large: 390 }[params.blocksize];
  const zoom = { out: 0.8, normal: 1, in: 1.35, close: 1.8 }[params.zoom];
  const random = randomSource(art.seed, art.blockHeight);
  const pick = (n: number): number => random() % n;
  const between = (lo: number, hi: number): number =>
    lo + Math.floor((random() / 4294967296) * (hi - lo + 1));
  // blockheight-4: colours and the cells' glass and inner shapes draw from streams of their own, so
  // the walls, bands and columns are the same whatever those options say. Earlier versions draw
  // everything from one stream and keep doing so.
  const own = (salt: number): (() => number) =>
    revision >= 4 ? randomSource(art.seed, art.blockHeight ^ salt) : random;
  const colourRandom = own(0x434f4c52);
  const detailRandom = own(0x53484150);
  const colourPick = (n: number): number => colourRandom() % n;
  const detailPick = (n: number): number => detailRandom() % n;
  const detailChance = (p: number): boolean => detailRandom() / 4294967296 < p;
  const gap = { none: 0, tight: 4, airy: 10 }[params.spacing];
  const shapeChance = { few: 0.22, balanced: 0.5, many: 0.85 }[params.shapes];
  const glassChance = { solid: 0.05, mixed: 0.4, glassy: 0.8 }[params.glass];
  const strokeWidth = { fine: 0.55, regular: 1.05, heavy: 1.9 }[params.lines];
  const heights = {
    quiet: [75, 100, 150],
    layered: [30, 60, 120],
    dense: [20, 30, 45, 60],
  }[params.structure];
  const depthRange = {
    few: [100, 150],
    some: [60, 110],
    many: [38, 70],
  }[params.walls] as [number, number];

  // Colour: 'none' keeps each shape family in its own group; the mixes borrow across groups.
  const groups = pal.groups;
  const shade = (family: number, tone: number): string => {
    let g = family;
    let t = tone;
    if (params.mix === "little") g = colourPick(3);
    if (params.mix === "much") {
      g = colourPick(4);
      t = colourPick(3);
    }
    return (groups[g] ?? groups[0])[t] ?? "#000000";
  };

  const cells: Cell[] = [];
  const maxCells = 700;
  type Bare = Omit<Cell, "top" | "front" | "side" | "a" | "b" | "c">;
  const make = (cell: Bare, family: number): Cell => {
    const inner = Math.min(gap, cell.w / 3, cell.h / 3, cell.d / 3);
    return {
      ...cell,
      x: cell.x + inner / 2,
      y: cell.y + inner / 2,
      z: cell.z + inner / 2,
      w: cell.w - inner,
      h: cell.h - inner,
      d: cell.d - inner,
      top: shade(0, 0),
      front: shade(0, 1),
      side: shade(0, 2),
      a: shade(family, 1),
      b: shade(family, 2),
      c: shade(family, 0),
    };
  };
  const push = (cell: Bare, family: number): void => {
    if (cells.length < maxCells) cells.push(make(cell, family));
  };

  // Walls along depth. The first wall fixes the band heights, later walls reshuffle them,
  // so horizontal bands stay aligned across the block as in the original.
  let bandPool: number[] = [];
  const bands: number[] = [];
  let z = -size / 2;
  let firstWall = true;
  let wallCount = 0;
  while (z < size / 2 - 1 && cells.length < maxCells) {
    let depth = between(depthRange[0], depthRange[1]);
    if (size / 2 - (z + depth) < 30) depth = size / 2 - z;
    if (firstWall) {
      let acc = 0;
      while (acc < size) {
        const bh = Math.min(heights[pick(heights.length)] ?? 60, size - acc);
        bands.push(bh);
        acc += bh;
      }
    } else {
      if (bandPool.length === 0) bandPool = [...bands];
      const order: number[] = [];
      const pool = [...bands];
      while (pool.length) order.push(pool.splice(pick(pool.length), 1)[0]!);
      bandPool = order;
    }
    const wallBands = firstWall ? bands : bandPool;
    let y = 0;
    const wallStart = cells.length;
    for (const bh of wallBands) {
      const columns = 1 + pick(params.structure === "quiet" ? 2 : 3);
      let x = -size / 2;
      let remaining = size;
      for (let column = 0; column < columns; column++) {
        const rest = columns - column - 1;
        const width =
          rest === 0
            ? remaining
            : Math.max(30, Math.floor(remaining / (rest + 1)) - 15 + pick(31));
        layout?.push({ z, depth, y, height: bh, x, width });
        const glass = detailChance(glassChance);
        if (detailChance(shapeChance) && bh >= 30 && width >= 40) {
          // Stacked sub-blocks, each carrying an inset shape.
          const stacks = bh >= 60 ? 1 + detailPick(3) : 1;
          const sh = bh / stacks;
          for (let s = 0; s < stacks; s++)
            push(
              {
                x,
                y: y + s * sh,
                z,
                w: width,
                h: sh,
                d: depth,
                kind: 1 + detailPick(6),
                glass: detailChance(Math.min(0.95, glassChance + 0.25)),
              },
              detailPick(4),
            );
        } else {
          push({ x, y, z, w: width, h: bh, d: depth, kind: 0, glass }, 0);
        }
        x += width;
        remaining -= width;
      }
      y += bh;
    }
    for (let i = wallStart; i < cells.length; i++) cells[i]!.wall = wallCount;
    wallCount++;
    z += depth;
    firstWall = false;
  }

  // Wall movements (blockheight-2 options added later; all inactive = identical to the earlier output):
  // every second wall may be turned about the depth axis, and walls may slide like slices.
  type Move = { c: number; s: number; ox: number; oy: number };
  const twistOn = params.twist !== "none";
  const moveOn = twistOn || params.slices !== "none";
  const [tc, ts] = (
    {
      none: [1, 0],
      slight: [0.96593, 0.25882],
      strong: [0.70711, 0.70711],
    } as Record<string, [number, number]>
  )[params.twist]!;
  const slideStep =
    { none: 0, little: 0.07, much: 0.16, fan: 0.07 }[params.slices] * size;
  const slideReach =
    params.slices === "fan" ? (slideStep * (wallCount - 1)) / 2 : slideStep;
  const twistReach = twistOn ? ((tc + ts - 1) / 2) * size : 0;
  const moves: Move[] = [];
  for (let w = 0; w < wallCount; w++) {
    const turned = twistOn && w % 2 === 1;
    // Sliding changes X only. Fan offsets progress by one equal step per depth wall;
    // centring the sequence keeps the parent in place relative to its satellites.
    const ox =
      params.slices === "fan"
        ? (w - (wallCount - 1) / 2) * slideStep
        : (w % 2 ? 1 : -1) * slideStep;
    moves.push({ c: turned ? tc : 1, s: turned ? ts : 0, ox, oy: 0 });
  }
  const turnedWall = (w: number): boolean => twistOn && w % 2 === 1;
  /** Room the moved walls need beyond the nominal block (axis x and vertical chains). */
  const bulge = Math.ceil(twistReach + slideReach);
  const moveOf = (cell: Cell): Move | undefined =>
    moveOn && cell.wall !== undefined ? moves[cell.wall] : undefined;
  const bevelOf = (cell: Cell): number =>
    cell.glass || params.bevel === "none"
      ? 0
      : Math.min(
          params.bevel === "bold" ? 6 : 2.5,
          cell.w / 4,
          cell.h / 4,
          cell.d / 4,
        );
  // The projection's viewing ray is (v, 2s, v); flipping both screen axes leaves it unchanged.
  // Express that ray in a wall's own frame for ordering and visible-face selection.
  const cameraOf = (m: Move | undefined): Point => {
    if (!m) return [view.v, 2 * view.s, view.v];
    const norm = m.c * m.c + m.s * m.s;
    return [
      (m.c * view.v + m.s * 2 * view.s) / norm,
      (-m.s * view.v + m.c * 2 * view.s) / norm,
      view.v,
    ];
  };
  const moved = (point: Point, m: Move | undefined): Point => {
    if (!m) return point;
    const yy = point[1] - size / 2;
    return [
      point[0] * m.c - yy * m.s + m.ox,
      size / 2 + point[0] * m.s + yy * m.c + m.oy,
      point[2],
    ];
  };

  if (params.cutaway === "corner") {
    // Cut before wall movement, retaining the palette and random stream of the original cells.
    // Partial panes expose the section; complete panes retain their inset shapes.
    const section = cells.flatMap((cell) =>
      cutCorner(cell, size / 2).map((part) =>
        part.cutFaces ? { ...part, kind: 0 } : part,
      ),
    );
    cells.splice(0, cells.length, ...section);
  }

  // blockheight-3: replace the random inner shapes with the shapes of the block's real events. One cell
  // hosts each kind of event that occurred; an empty block therefore stays hollow.
  if (digest) {
    for (const cell of cells) cell.kind = 0;
    const wanted: {
      shape: ClusterShape;
      count: number;
      scale: number;
      family: number;
      annotation: Annotation;
    }[] = [];
    const add = (
      shape: ClusterShape,
      count: number,
      scale: number,
      family: number,
      key: string,
      label: string,
      value = `${countLabel(count)} ${count === 1 ? "SPEND" : "SPENDS"}`,
    ): void => {
      if (count > 0) {
        const annotation = {
          id: String(wanted.length + 1).padStart(2, "0"),
          key,
          label,
          count,
          value,
        };
        annotationEntries.push(annotation);
        wanted.push({ shape, count, scale, family, annotation });
      }
    };
    const e = digest.events;
    add("tri", e.nft, 1, 2, "nft", "NFT");
    add("ring", e.did, 1, 3, "did", "DID");
    add("slabs", e.datalayer, 1, 1, "datalayer", "DATALAYER");
    add("pair", e.offer, 1, 0, "offer", "OFFER");
    add("hex", e.cat, 1, 1, "cat", "CAT");
    add("cube", e.xch, 1, 0, "xch", "XCH");
    add("tower", e.pool, 1, 2, "pool", "POOL");
    add("diamond", e.service, 0.8, 3, "service", "SERVICE");
    add("wire", e.unknown, 1, 0, "unknown", "OTHER");
    add("channel", e.channel ?? 0, 1, 1, "channel", "GAMING / CHANNELS");
    add("pentagon", e.dao ?? 0, 1, 2, "dao", "DAO");
    add("shield", e.credential ?? 0, 1, 3, "credential", "CREDENTIAL");
    add("ticket", e.contract ?? 0, 1, 0, "contract", "CONTRACT");
    add(
      "oval",
      digest.rewards.farmer,
      0.7,
      1,
      "farmer",
      "FARMER",
      `${countLabel(digest.rewards.farmer)} REWARD ${digest.rewards.farmer === 1 ? "COIN" : "COINS"}`,
    );
    add(
      "coins",
      digest.rewards.pool,
      1,
      2,
      "reward_pool",
      "POOL REWARD",
      `${countLabel(digest.rewards.pool)} REWARD ${digest.rewards.pool === 1 ? "COIN" : "COINS"}`,
    );
    add(
      "band",
      /[1-9]/.test(digest.fees) ? 1 : 0,
      1,
      0,
      "fees",
      "FEES",
      xchLabel(digest.fees),
    );
    // Shapes are drawn on a cell's front plane, so hosts are taken from the front wall first,
    // where a viewer can actually see them; other cells only fill up if there are many kinds.
    const roomy = cells.filter(
      (c) => !c.cutFaces && c.w >= 36 && c.h >= 22 && c.d >= 22,
    );
    const frontZ = Math.max(...cells.map((c) => c.z + c.d));
    const shuffle = <T>(list: T[]): T[] => {
      for (let i = list.length - 1; i > 0; i--) {
        const j = pick(i + 1);
        [list[i], list[j]] = [list[j]!, list[i]!];
      }
      return list;
    };
    const eligible = [
      ...shuffle(roomy.filter((c) => c.z + c.d >= frontZ - 0.01)),
      ...shuffle(roomy.filter((c) => c.z + c.d < frontZ - 0.01)),
    ];
    // A small or airy structure may have fewer roomy cells than the block has kinds of event.
    // Rather than drop the last kinds (rewards, fees), take smaller cells, front wall first;
    // the shapes then simply come out smaller. Blocks with enough roomy cells are unaffected.
    for (const [w, h, d] of [
      [24, 16, 16],
      [14, 10, 10],
    ] as const) {
      if (eligible.length >= wanted.length) break;
      const taken = new Set(eligible);
      const spare = cells.filter(
        (c) => !taken.has(c) && !c.cutFaces && c.w >= w && c.h >= h && c.d >= d,
      );
      eligible.push(
        ...shuffle(spare.filter((c) => c.z + c.d >= frontZ - 0.01)),
        ...shuffle(spare.filter((c) => c.z + c.d < frontZ - 0.01)),
      );
    }
    wanted.slice(0, eligible.length).forEach((w, i) => {
      const cell = eligible[i]!;
      cell.glass = true;
      cell.cluster = {
        shape: w.shape,
        count: w.count,
        scale: w.scale,
        annotation: w.annotation,
      };
      cell.a = shade(w.family, 1);
      cell.b = shade(w.family, 2);
      cell.c = shade(w.family, 0);
    });
  }

  // Decorative choices use no random draws, so the source structure stays unchanged.
  cells.forEach((cell, i) => {
    if (params.accents === "shapes") {
      [cell.c, cell.a, cell.b] = [...pal.groups[1]];
    }
    if (params.accents === "wall" && cell.wall === wallCount - 1) {
      [cell.top, cell.front, cell.side] = [...pal.groups[1]];
    }
    cell.accent = params.accents === "edges" && i % 7 === 0;
  });

  // Chain: wired satellite cubes on both sides, along X, along Z or stacked vertically.
  const satelliteCells: Cell[] = [];
  type Item = {
    key: number;
    box: Bounds;
    cell?: Cell;
    /** A turned wall: drawn as one unit, cells in their own order. */
    group?: Cell[];
    wire?: () => string;
    connector?: Face[];
  };
  const wireItems: Item[] = [];
  // The whole drawing is shifted so it sits centred in the space the caption and frame leave free.
  let fit = 1;
  let dx = 0;
  let dy = 0;
  const baseXY = ([px, py, pz]: Point): [number, number] => {
    let sx = 500 + (px - pz) * view.h;
    let sy = 435 + (px + pz) * view.s - (py - size / 2) * view.v;
    if (view.flip) {
      sx = 1000 - sx;
      sy = 870 - sy;
    }
    return [500 + (sx - 500) * zoom * fit, 435 + (sy - 435) * zoom * fit];
  };
  const projectXY = (point: Point): [number, number] => {
    const [sx, sy] = baseXY(point);
    return [sx + dx, sy + dy];
  };
  let current: Move | undefined;
  const project = (point: Point): string => {
    const [sx, sy] = projectXY(moved(point, current));
    return `${fixed(sx)},${fixed(sy)}`;
  };
  if (params.composition === "chain") {
    // Satellite spacing uses the enclosing cube, but a cable must dock on a real block.
    // Clamp the satellite-facing point into each block's local frame, then choose the
    // nearest surface point. This also handles gaps, shifted walls and rotated faces.
    const dockOnCells = (target: Point, candidates: Cell[] = cells): Point => {
      let nearest: Point = target;
      let distance = Infinity;
      for (const cell of candidates) {
        const m = moveOf(cell);
        const c = m?.c ?? 1;
        const s = m?.s ?? 0;
        const norm = c * c + s * s;
        const tx = target[0] - (m?.ox ?? 0);
        const ty = target[1] - size / 2 - (m?.oy ?? 0);
        const clamp = (v: number, lo: number, span: number): number =>
          Math.max(lo, Math.min(lo + span, v));
        const local: Point = [
          (c * tx + s * ty) / norm,
          size / 2 + (-s * tx + c * ty) / norm,
          target[2],
        ];
        const bevel = bevelOf(cell);
        const point = moved(
          bevel > 0
            ? closestOnMesh(bevelMesh(cell, bevel), local)
            : [
                clamp(local[0], cell.x, cell.w),
                clamp(local[1], cell.y, cell.h),
                clamp(local[2], cell.z, cell.d),
              ],
          m,
        );
        const d = point.reduce((sum, v, k) => sum + (v - target[k]!) ** 2, 0);
        if (d < distance) {
          nearest = point;
          distance = d;
        }
      }
      return nearest;
    };
    const vertical = params.axis === "vertical";
    const count = { one: 1, two: 2, three: 3 }[params.satellites];
    const sat = vertical ? 60 : 76;
    const between2 = vertical ? 34 : 54;
    const gapDist = (
      vertical
        ? { near: 40, mid: 60, far: 85 }
        : { near: 75, mid: 105, far: 140 }
    )[params.reach];
    const middle = vertical ? size / 2 : 0;
    const extra =
      params.axis === "x" ? bulge : vertical ? Math.ceil(twistReach) : 0;
    // Satellites and their cable sit at the cube's vertical middle, whatever the block size.
    const bandY = size / 2 - sat / 2;
    for (const side of [-1, 1]) {
      let previousEdge = middle + side * (size / 2 + extra);
      for (let i = 0; i < count; i++) {
        const t =
          middle +
          side * (size / 2 + extra + gapDist + sat / 2 + i * (sat + between2));
        for (let layer = 0; layer < 2; layer++) {
          const base = vertical ? t - sat / 2 : bandY;
          satelliteCells.push(
            make(
              {
                x: params.axis === "x" ? t - sat / 2 : -sat / 2,
                y: base + layer * (sat / 2),
                z: params.axis === "z" ? t - sat / 2 : -sat / 2,
                w: sat,
                h: sat / 2,
                d: sat,
                kind: 0,
                glass: false,
              },
              0,
            ),
          );
        }
        const from = previousEdge;
        const to = t - (side * sat) / 2;
        const wireY = bandY + sat / 2;
        // One cable per gap, centred on the blocks it joins.
        const pointAt = (u: number, lateral: number, lift: number): Point =>
          params.axis === "x"
            ? [u, wireY + lift, lateral]
            : params.axis === "z"
              ? [lateral, wireY + lift, u]
              : [lateral, u, lift];
        const target = pointAt(to, 0, 0);
        const b =
          params.connectors === "none"
            ? target
            : dockOnCells(target, satelliteCells.slice(-2));
        const adjustDock =
          params.connectors !== "none" ||
          (i === 0 &&
            (moveOn || params.bevel !== "none" || params.cutaway !== "none"));
        const a = adjustDock
          ? dockOnCells(
              i === 0 ? b : pointAt(from, 0, 0),
              i === 0 ? cells : satelliteCells.slice(-4, -2),
            )
          : pointAt(from, 0, 0);
        // Random swings are drawn now (keeps the random stream independent of draw order); the
        // path itself is built when drawing, once the final position is known.
        const n = Math.max(
          3,
          Math.min(8, Math.round(Math.abs(to - from) / 16)),
        );
        const swings: [number, number][] = [];
        if (params.wires === "loose")
          for (let k = 0; k <= n; k++)
            swings.push(
              k === 0 || k === n ? [0, 0] : [between(4, 10), between(-3, 3)],
            );
        const cable = (): string => {
          if (params.wires !== "loose") return `M${project(a)} L${project(b)}`;
          // A slack, rippling cable: alternating sideways/up-down swings between fixed ends.
          const pts: [number, number][] = swings.map(([swing, jitter], k) => {
            const lateral = (k % 2 === 0 ? 1 : -1) * swing * 0.7 + jitter;
            const lift = -(k % 2 === 0 ? 1 : -1) * swing;
            const point = pointAt(from + ((to - from) * k) / n, lateral, lift);
            if (adjustDock) {
              const offset = pointAt(0, lateral, lift);
              const origin = pointAt(0, 0, 0);
              const at = (j: 0 | 1 | 2): number =>
                a[j] + ((b[j] - a[j]) * k) / n + offset[j] - origin[j];
              return projectXY([at(0), at(1), at(2)]);
            }
            return projectXY(point);
          });
          const mid = (p: [number, number], q: [number, number]): string =>
            `${fixed((p[0] + q[0]) / 2)},${fixed((p[1] + q[1]) / 2)}`;
          let d = `M${fixed(pts[0]![0])},${fixed(pts[0]![1])}`;
          for (let k = 1; k < n; k++)
            d += ` Q${fixed(pts[k]![0])},${fixed(pts[k]![1])} ${mid(pts[k]!, pts[k + 1]!)}`;
          return d + ` L${fixed(pts[n]![0])},${fixed(pts[n]![1])}`;
        };
        // Cables take part in the same depth ordering as the blocks: nearer blocks (and the
        // parent, for cables behind it) hide them, and they hide whatever lies behind them.
        // Loose cables swing up to ~10 units sideways, so their bounds are padded on those axes.
        const pad = params.wires === "loose" ? 10 : 0;
        const lateral = [
          params.axis === "x" ? 0 : pad,
          params.axis === "z" ? 0 : pad,
        ];
        wireItems.push({
          key: (a[0] + b[0] + a[1] + b[1] + a[2] + b[2]) / 2,
          box: [
            Math.min(a[0], b[0]) - lateral[0]!,
            Math.max(a[0], b[0]) + lateral[0]!,
            Math.min(a[1], b[1]) - (vertical ? 0 : pad),
            Math.max(a[1], b[1]) + (vertical ? 0 : pad),
            Math.min(a[2], b[2]) - lateral[1]!,
            Math.max(a[2], b[2]) + lateral[1]!,
          ],
          wire: () =>
            `<path d="${cable()}" fill="none" stroke-linecap="round"/>`,
        });
        if (params.connectors !== "none") {
          for (const [endpoint, other] of [
            [a, b],
            [b, a],
          ] as const) {
            const mesh = connectorMesh(endpoint, other, params.connectors);
            const points = mesh.flatMap((face) => face.points);
            if (points.length === 0) continue;
            wireItems.push({
              key:
                points.reduce((sum, p) => sum + p[0] + p[1] + p[2], 0) /
                points.length,
              box: [
                Math.min(...points.map((p) => p[0])),
                Math.max(...points.map((p) => p[0])),
                Math.min(...points.map((p) => p[1])),
                Math.max(...points.map((p) => p[1])),
                Math.min(...points.map((p) => p[2])),
                Math.max(...points.map((p) => p[2])),
              ],
              connector: mesh,
            });
          }
        }
        previousEdge = t + (side * sat) / 2;
      }
    }
  }
  // One painter's-order list: cables sit behind nearer blocks and in front of farther ones.
  const cornersOf = (cell: Cell): Point[] => {
    const m = moveOf(cell);
    const out: Point[] = [];
    for (const px of [cell.x, cell.x + cell.w])
      for (const py of [cell.y, cell.y + cell.h])
        for (const pz of [cell.z, cell.z + cell.d])
          out.push(moved([px, py, pz], m));
    return out;
  };
  const boxOf = (cell: Cell): Bounds => {
    const m = moveOf(cell);
    if (m?.s) {
      const points = cornersOf(cell);
      return [
        Math.min(...points.map((p) => p[0])),
        Math.max(...points.map((p) => p[0])),
        Math.min(...points.map((p) => p[1])),
        Math.max(...points.map((p) => p[1])),
        Math.min(...points.map((p) => p[2])),
        Math.max(...points.map((p) => p[2])),
      ];
    }
    const ox = m?.ox ?? 0;
    const oy = m?.oy ?? 0;
    return [
      cell.x + ox,
      cell.x + cell.w + ox,
      cell.y + oy,
      cell.y + cell.h + oy,
      cell.z,
      cell.z + cell.d,
    ];
  };
  const keyOf = (cell: Cell): number =>
    cell.x + cell.z + cell.y + (cell.w + cell.d + cell.h) / 2;
  const single = [...cells, ...satelliteCells].filter(
    (cell) => cell.wall === undefined || !turnedWall(cell.wall),
  );
  const items: Item[] = [
    ...single.map((cell) => ({ key: keyOf(cell), box: boxOf(cell), cell })),
    ...wireItems,
  ];
  // A turned wall is seen from another direction in its own frame: order its cells by the
  // viewer's local direction (an axis the viewer is square to cannot hide anything).
  for (let w = 0; w < wallCount; w++) {
    if (!turnedWall(w)) continue;
    const members = cells.filter((cell) => cell.wall === w);
    if (members.length === 0) continue;
    const m = moves[w]!;
    const direction = cameraOf(m);
    const local = members.map(
      (cell): Bounds => [
        cell.x,
        cell.x + cell.w,
        cell.y,
        cell.y + cell.h,
        cell.z,
        cell.z + cell.d,
      ],
    );
    const keys = members.map(
      (cell) =>
        (cell.x + cell.w / 2) * direction[0] +
        (cell.y + cell.h / 2) * direction[1] +
        (cell.z + cell.d / 2) * direction[2],
    );
    const order = drawOrder(local, keys, direction).map((i) => members[i]!);
    const boxes = members.map(boxOf);
    items.push({
      key: members.reduce((sum, cell) => sum + keyOf(cell), 0) / members.length,
      box: [
        Math.min(...boxes.map((b) => b[0])),
        Math.max(...boxes.map((b) => b[1])),
        Math.min(...boxes.map((b) => b[2])),
        Math.max(...boxes.map((b) => b[3])),
        Math.min(...boxes.map((b) => b[4])),
        Math.max(...boxes.map((b) => b[5])),
      ],
      group: order,
    });
  }
  const drawn = drawOrder(
    items.map((item) => item.box),
    items.map((item) => item.key),
  ).map((i) => items[i]!);

  // Ground: a plane under everything, light from the left. Shadows are the outline of each
  // block's eight corners slid along the light direction onto the plane.
  const everyCell = [...cells, ...satelliteCells];
  const cellCorners = everyCell.map(cornersOf);
  const groundY = Math.min(...cellCorners.flat().map((p) => p[1]));
  const wantGrid = params.ground === "grid" || params.ground === "both";
  const wantShadow = params.ground === "shadow" || params.ground === "both";
  // Screen-right whichever way the camera is mirrored; 0.4 ground units per unit of height.
  const lean = view.flip ? -0.4 : 0.4;
  const shadows: { hull: Point[]; glass: boolean }[] = [];
  if (wantShadow) {
    everyCell.forEach((cell, i) => {
      const flat = cellCorners[i]!.map((p): [number, number] => [
        p[0] + lean * (p[1] - groundY),
        p[2] - lean * (p[1] - groundY),
      ]);
      flat.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (
        o: [number, number],
        a: [number, number],
        b: [number, number],
      ): number =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const half = (points: [number, number][]): [number, number][] => {
        const chain: [number, number][] = [];
        for (const pt of points) {
          while (
            chain.length >= 2 &&
            cross(chain[chain.length - 2]!, chain[chain.length - 1]!, pt) <=
              1e-9
          )
            chain.pop();
          chain.push(pt);
        }
        chain.pop();
        return chain;
      };
      const hull = [...half(flat), ...half([...flat].reverse())];
      if (hull.length >= 3)
        shadows.push({
          hull: hull.map(([px, pz]): Point => [px, groundY, pz]),
          glass: cell.glass,
        });
    });
  }
  const gridStep = Math.round(size / 10);
  let grid: { x0: number; x1: number; z0: number; z1: number } | undefined;
  if (wantGrid) {
    // The grid follows the cube geometry; cast shadows must not enlarge its footprint.
    const xs = cellCorners.flat();
    const margin = size * 0.2;
    const snap = (v: number, up: boolean): number =>
      (up ? Math.ceil(v / gridStep) : Math.floor(v / gridStep)) * gridStep;
    grid = {
      x0: snap(Math.min(...xs.map((p) => p[0])) - margin, false),
      x1: snap(Math.max(...xs.map((p) => p[0])) + margin, true),
      z0: snap(Math.min(...xs.map((p) => p[2])) - margin, false),
      z1: snap(Math.max(...xs.map((p) => p[2])) + margin, true),
    };
  }

  const inset = params.frame === "bold" ? 22 : 14;
  const sceneTop = inset + 12;
  const annotationFooter =
    annotated && params.annotations !== "markers"
      ? annotationFooterHeight(digest!, annotationEntries.length)
      : 0;
  const visibleCaption =
    annotated && params.annotations !== "markers" ? "none" : params.caption;
  const sceneBottom =
    (visibleCaption === "none" ||
    visibleCaption === "topleft" ||
    visibleCaption === "topright"
      ? 1000 - inset - 12
      : (visibleCaption === "bottom" ? 928 : 856) - 28) - annotationFooter;
  // Centre the cubes in the area left over by the frame and the caption. Shadows affect only
  // the scale needed to fit; the ground grid may run off the edge.
  {
    const cubeCorners = cellCorners.flat();
    const reach = [...cubeCorners, ...shadows.flatMap((shadow) => shadow.hull)];
    const measure = (points: Point[]): [number, number, number, number] => {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const point of points) {
        const [sx, sy] = baseXY(point);
        minX = Math.min(minX, sx);
        maxX = Math.max(maxX, sx);
        minY = Math.min(minY, sy);
        maxY = Math.max(maxY, sy);
      }
      return [minX, maxX, minY, maxY];
    };
    const top = sceneTop;
    const bottom = sceneBottom;
    let [minX, maxX, minY, maxY] = measure(cubeCorners);
    if (moveOn || params.ground !== "none" || annotated) {
      // New options only: shrink to fit rather than run off the page (older output is unchanged).
      const [left, right, upper, lower] = measure(reach);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      // Reserve equal room on both sides of the cube's centre, including the cast shadow.
      const f = Math.min(
        1,
        (1000 - 2 * (inset + 12 + (annotated ? 108 : 0))) /
          (2 * Math.max(cx - left, right - cx)),
        (bottom - top) / (2 * Math.max(cy - upper, lower - cy)),
      );
      if (f < 1) {
        fit = f;
        [minX, maxX, minY, maxY] = measure(cubeCorners);
      }
    }
    dx = 500 - (minX + maxX) / 2;
    dy = (top + bottom) / 2 - (minY + maxY) / 2;
  }
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" role="img" aria-label="BlockHeight artwork at block height ${art.blockHeight}">`,
    `<title>BlockHeight — Block ${art.blockHeight}</title>${
      digest
        ? `<desc>${digest.transactionBlock ? "Transaction block" : "Non-transaction block"} with ${digest.spends} coin spends: ${
            Object.entries(digest.events)
              .filter(([, n]) => n > 0)
              .map(([k, n]) => `${n} ${k}`)
              .join(", ") || "none"
          }.</desc>`
        : ""
    }<rect width="1000" height="1000" fill="${pal.paper}"/>`,
  ];
  if (params.fill === "panel")
    parts.push(
      `<rect x="${inset}" y="${inset}" width="${1000 - 2 * inset}" height="${1000 - 2 * inset}" fill="#ffffff" fill-opacity="0.22"/>`,
    );
  if (params.fill === "dust") {
    // A separate stream keeps the structure identical whether or not dust is enabled.
    const dust = randomSource(
      art.seed.split("").reverse().join(""),
      art.blockHeight,
    );
    const span = 1000 - 2 * inset - 4;
    let d = "";
    for (let i = 0; i < 900; i++) {
      const px = inset + 2 + Math.floor(((dust() >>> 0) / 4294967296) * span);
      const py = inset + 2 + Math.floor(((dust() >>> 0) / 4294967296) * span);
      d += `M${px} ${py}h1.4v1.4h-1.4z`;
    }
    parts.push(`<path d="${d}" fill="${pal.stroke}" fill-opacity="0.4"/>`);
  }
  if (params.frame !== "none")
    parts.push(
      `<rect x="${inset}" y="${inset}" width="${1000 - 2 * inset}" height="${1000 - 2 * inset}" fill="none" stroke="${pal.frame}" stroke-width="${params.frame === "bold" ? 3.6 : 1.4}"/>`,
    );
  parts.push(
    `<g stroke="${pal.stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round">`,
  );
  let paintOrder = 0;
  const markerCandidates: (Marker & { order: number })[] = [];
  const opaqueFaces: { points: [number, number][]; order: number }[] = [];
  const polygon = (points: Point[], color: string, alpha: number): void => {
    if (annotated && alpha >= 0.9)
      opaqueFaces.push({
        points: points.map((p) => projectXY(moved(p, current))),
        order: paintOrder,
      });
    parts.push(
      `<polygon points="${points.map(project).join(" ")}" fill="${color}" fill-opacity="${fixed(alpha)}"/>`,
    );
  };
  const tint = (color: string, toward: number, amount: number): string =>
    `#${[1, 3, 5]
      .map((i) => {
        const channel = Number.parseInt(color.slice(i, i + 2), 16);
        return Math.round(channel + (toward - channel) * amount)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")}`;
  const sectionColor = pal.groups[2][1];
  const materialColor = (color: string, glass: boolean): string =>
    params.material === "metal" && !glass
      ? tint(color, 0, 0.55)
      : params.material === "concrete" && !glass
        ? tint(color, 190, 0.3)
        : params.material === "frosted" && glass
          ? tint(color, 255, 0.28)
          : color;
  const materialDetails = (cell: Cell, bevel: number): void => {
    const { x, y, z, w, h, d, glass } = cell;
    const front = (u: number, v: number): Point => [
      x + bevel + u * (w - 2 * bevel),
      y + bevel + v * (h - 2 * bevel),
      z + d,
    ];
    const side = (u: number, v: number): Point => [
      x + w,
      y + bevel + v * (h - 2 * bevel),
      z + bevel + u * (d - 2 * bevel),
    ];
    const patch = (points: Point[], alpha: number): void => {
      parts.push(
        `<polygon points="${points.map(project).join(" ")}" fill="#ffffff" fill-opacity="${fixed(alpha)}" stroke="none"/>`,
      );
    };
    if (params.material === "metal" && !glass) {
      for (const at of [front, side]) {
        patch(
          [at(0.22, 0.05), at(0.34, 0.05), at(0.34, 0.95), at(0.22, 0.95)],
          0.17,
        );
        patch(
          [at(0.36, 0.05), at(0.39, 0.05), at(0.39, 0.95), at(0.36, 0.95)],
          0.3,
        );
      }
    } else if (params.material === "concrete" && !glass) {
      const key =
        Math.imul(Math.round(x * 4), 73856093) ^
        Math.imul(Math.round(y * 4), 19349663) ^
        Math.imul(Math.round(z * 4), 83492791);
      for (const at of [front, side])
        for (let i = 0; i < 12; i++) {
          const hash = (Math.imul(key ^ (i + 1), 1664525) + 1013904223) >>> 0;
          const u = 0.08 + ((hash % 997) / 997) * 0.84;
          const v = 0.08 + (((hash >>> 12) % 991) / 991) * 0.84;
          const [cx, cy] = projectXY(moved(at(u, v), current));
          parts.push(
            `<circle cx="${fixed(cx)}" cy="${fixed(cy)}" r="${fixed(0.45 + (hash % 4) * 0.16)}" fill="${pal.stroke}" fill-opacity="0.22" stroke="none"/>`,
          );
        }
    } else if (params.material === "frosted" && glass) {
      patch(
        [
          front(0.08, 0.05),
          front(0.16, 0.05),
          front(0.74, 0.95),
          front(0.66, 0.95),
        ],
        0.2,
      );
      patch(
        [side(0.12, 0.05), side(0.18, 0.05), side(0.76, 0.95), side(0.7, 0.95)],
        0.16,
      );
    }
  };
  const contacts = new Map<Cell, { below: boolean; left: boolean }>();
  if (params.occlusion !== "none") {
    const overlap = (
      a: number,
      spanA: number,
      b: number,
      spanB: number,
    ): boolean => Math.min(a + spanA, b + spanB) - Math.max(a, b) > 1;
    for (const cell of everyCell) {
      if (cell.glass) continue;
      let below = false,
        left = false;
      for (const neighbor of everyCell) {
        if (neighbor === cell || neighbor.glass || neighbor.wall !== cell.wall)
          continue;
        const dy = cell.y - (neighbor.y + neighbor.h);
        const dx = cell.x - (neighbor.x + neighbor.w);
        if (
          dy >= -0.01 &&
          dy <= gap + 0.1 &&
          overlap(cell.x, cell.w, neighbor.x, neighbor.w) &&
          overlap(cell.z, cell.d, neighbor.z, neighbor.d)
        )
          below = true;
        if (
          dx >= -0.01 &&
          dx <= gap + 0.1 &&
          overlap(cell.y, cell.h, neighbor.y, neighbor.h) &&
          overlap(cell.z, cell.d, neighbor.z, neighbor.d)
        )
          left = true;
      }
      contacts.set(cell, { below, left });
    }
  }
  const contactShadow = (cell: Cell, bevel: number): void => {
    const touch = contacts.get(cell);
    if (!touch || (!touch.below && !touch.left)) return;
    const { x, y, z, w, h, d } = cell;
    const width = Math.min(
      params.occlusion === "deep" ? 7 : 4,
      (w - 2 * bevel) / 5,
      (h - 2 * bevel) / 5,
      (d - 2 * bevel) / 5,
    );
    const opacity = params.occlusion === "deep" ? 0.22 : 0.11;
    const shade = (points: Point[], alpha: number): void => {
      parts.push(
        `<polygon points="${points.map(project).join(" ")}" fill="#000000" fill-opacity="${fixed(alpha)}" stroke="none"/>`,
      );
    };
    for (const scale of [1, 0.4]) {
      const t = width * scale;
      const alpha = scale === 1 ? opacity * 0.5 : opacity;
      if (touch.below) {
        shade(
          [
            [x + bevel, y + bevel, z + d],
            [x + w - bevel, y + bevel, z + d],
            [x + w - bevel, y + bevel + t, z + d],
            [x + bevel, y + bevel + t, z + d],
          ],
          alpha,
        );
        shade(
          [
            [x + w, y + bevel, z + bevel],
            [x + w, y + bevel, z + d - bevel],
            [x + w, y + bevel + t, z + d - bevel],
            [x + w, y + bevel + t, z + bevel],
          ],
          alpha,
        );
      }
      if (touch.left)
        shade(
          [
            [x + bevel, y + bevel, z + d],
            [x + bevel + t, y + bevel, z + d],
            [x + bevel + t, y + h - bevel, z + d],
            [x + bevel, y + h - bevel, z + d],
          ],
          alpha,
        );
    }
  };
  const line = (a: Point, b: Point): void => {
    parts.push(`<path d="M${project(a)} L${project(b)}" fill="none"/>`);
  };
  const prism = (
    pts: Pt[],
    cx: number,
    cy: number,
    sz: number,
    front: number,
    back: number,
    cell: Cell,
    filled = true,
    solid = false,
  ): void => {
    const f = pts.map(([u, v]): Point => [cx + u * sz, cy + v * sz, front]);
    const b = pts.map(([u, v]): Point => [cx + u * sz, cy + v * sz, back]);
    if (solid) {
      const direction = cameraOf(current);
      const sides = (
        outline: Pt[],
        inverse = false,
        emit: (points: Point[], color: string, alpha: number) => void = polygon,
      ): void => {
        for (let i = 0; i < outline.length; i++) {
          const a = outline[i]!;
          const next = outline[(i + 1) % outline.length]!;
          const nx = (next[1] - a[1]) * (inverse ? -1 : 1);
          const ny = (a[0] - next[0]) * (inverse ? -1 : 1);
          if (nx * direction[0] + ny * direction[1] <= 1e-6) continue;
          emit(
            [
              [cx + a[0] * sz, cy + a[1] * sz, back],
              [cx + next[0] * sz, cy + next[1] * sz, back],
              [cx + next[0] * sz, cy + next[1] * sz, front],
              [cx + a[0] * sz, cy + a[1] * sz, front],
            ],
            ny > 0 ? cell.c : cell.b,
            ny > 0 ? 0.91 : 0.96,
          );
        }
      };
      if (filled) {
        sides(pts);
        polygon(direction[2] >= 0 ? f : b, cell.a, 0.96);
      } else {
        // Solid DID rings and unknown frames retain their opening instead of becoming disks.
        const inner = scaled(
          pts,
          pts.length > 8 ? 0.55 : 0.82,
          pts.length > 8 ? 0.55 : 0.82,
        );
        // Outer and inner walls overlap in projection: paint them far to near, otherwise the
        // inside of the tube covers its outer skin. The end face is nearest and goes last.
        const walls: { points: Point[]; color: string; alpha: number }[] = [];
        const queue = (points: Point[], color: string, alpha: number): void => {
          walls.push({ points, color, alpha });
        };
        sides(pts, false, queue);
        sides(inner, true, queue);
        const nearness = (points: Point[]): number =>
          points.reduce(
            (sum, p) =>
              sum +
              p[0] * direction[0] +
              p[1] * direction[1] +
              p[2] * direction[2],
            0,
          ) / points.length;
        walls.sort((a, b) => nearness(a.points) - nearness(b.points));
        for (const wall of walls) polygon(wall.points, wall.color, wall.alpha);
        const depth = direction[2] >= 0 ? front : back;
        for (let i = 0; i < pts.length; i++) {
          const j = (i + 1) % pts.length;
          polygon(
            [pts[i]!, pts[j]!, inner[j]!, inner[i]!].map(
              ([u, v]): Point => [cx + u * sz, cy + v * sz, depth],
            ),
            cell.a,
            0.96,
          );
        }
      }
      return;
    }
    polygon(b, cell.b, filled ? 0.18 : 0);
    const stride = pts.length > 8 ? 4 : 1;
    for (let i = 0; i < pts.length; i += stride) line(f[i]!, b[i]!);
    polygon(f, cell.a, filled ? 0.85 : 0);
  };
  const drawCluster = (cell: Cell): void => {
    const cluster = cell.cluster!;
    const cap = { few: 2, balanced: 4, many: 6 }[params.shapes];
    if (params.eventlayout !== "none") {
      // Separate deterministic stream: glass choices never change the host architecture,
      // nor depend on the order in which a camera paints these objects.
      const salt = [...cluster.annotation!.key].reduce(
        (hash, c) => (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0,
        0,
      );
      const material = randomSource(
        art.seed,
        art.blockHeight ^ salt ^ 0x534f4c49,
      );
      const objects = eventObjects(
        params.eventlayout,
        cluster.count,
        cell,
        cluster.scale,
        cap,
      ).map((object) => ({
        ...object,
        solid: material() / 4294967296 >= glassChance,
      }));
      const direction = cameraOf(current);
      objects.sort(
        (a, b) =>
          (a.x - b.x) * direction[0] +
          (a.y - b.y) * direction[1] +
          (a.front - b.front) * direction[2],
      );
      const at = (
        object: EventObject,
        u: number,
        v: number,
        depth = object.front,
      ): Point => [
        object.x + u * object.width,
        object.y + v * object.height,
        depth,
      ];
      const stretched = (shape: Pt[], object: EventObject): Pt[] => {
        const width =
          Math.max(...shape.map((p) => p[0])) -
          Math.min(...shape.map((p) => p[0]));
        const height =
          Math.max(...shape.map((p) => p[1])) -
          Math.min(...shape.map((p) => p[1]));
        return scaled(shape, object.width / width, object.height / height);
      };
      parts.push(
        `<g data-event-layout="${params.eventlayout}" data-event-kind="${cluster.annotation!.key}" data-symbols="${objects.length}" data-count="${cluster.count}" data-solid-symbols="${objects.filter((o) => o.solid).length}">`,
      );
      for (const object of objects) {
        const { x, y, width, height, front, back } = object;
        switch (cluster.shape) {
          case "band":
            prism(
              scaled(unitShapes.cube!, width, height * 0.18),
              x,
              y,
              1,
              front,
              back,
              cell,
              true,
              object.solid,
            );
            break;
          case "coins": {
            // A short stack of discs: the pool's reward is many farmer coins' worth.
            const thick = (front - back) / 4;
            for (let level = 2; level >= 0; level--) {
              const depth = front - (level * (front - back)) / 3;
              prism(
                stretched(unitShapes.oval!, object),
                x,
                y,
                1,
                depth,
                depth - thick,
                cell,
                true,
                object.solid,
              );
            }
            break;
          }
          case "pair":
            for (const offset of [-0.27, 0.27])
              prism(
                scaled(unitShapes.cube!, width * 0.42, height),
                x + offset * width,
                y,
                1,
                front,
                back,
                cell,
                true,
                object.solid,
              );
            line(at(object, -0.06, 0), at(object, 0.06, 0));
            break;
          case "slabs":
            for (const level of [-0.25, 0, 0.25]) {
              if (object.solid)
                prism(
                  scaled(unitShapes.cube!, width, height * 0.08),
                  x,
                  y + level * height,
                  1,
                  front,
                  back,
                  cell,
                  true,
                  true,
                );
              else
                polygon(
                  [
                    at(object, -0.5, level, back),
                    at(object, 0.5, level, back),
                    at(object, 0.5, level),
                    at(object, -0.5, level),
                  ],
                  cell.b,
                  0.55,
                );
            }
            break;
          default: {
            const shape = stretched(
              unitShapes[cluster.shape] ?? unitShapes.cube!,
              object,
            );
            const filled = cluster.shape !== "ring" && cluster.shape !== "wire";
            prism(shape, x, y, 1, front, back, cell, filled, object.solid);
            if (cluster.shape === "ring" && !object.solid)
              prism(
                scaled(shape, 0.55, 0.55),
                x,
                y,
                1,
                front,
                front - Math.min(2, front - back),
                cell,
                false,
              );
          }
        }
      }
      parts.push("</g>");
      if (annotated && cluster.annotation) {
        const frontmost = Math.max(...objects.map((o) => o.front));
        const object = objects.find((o) => o.front >= frontmost - 1e-6)!;
        let anchor = at(object, 0, 0);
        if (cluster.shape === "ring" || cluster.shape === "wire")
          anchor = at(object, 0.5, 0);
        if (cluster.shape === "pair") anchor = at(object, -0.27, 0);
        if (cluster.shape === "slabs")
          anchor = at(
            object,
            0,
            (direction[1] >= 0 ? 1 : -1) * (object.solid ? 0.29 : 0.25),
            (object.front + object.back) / 2,
          );
        markerCandidates.push({
          entry: cluster.annotation,
          anchor: projectXY(moved(anchor, current)),
          order: paintOrder,
        });
      }
      return;
    }
    const n = Math.min(cluster.count, cap);
    const cols = n <= 2 ? n : n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const pad = Math.min(cell.w, cell.h) * 0.12;
    const cw = (cell.w - 2 * pad) / cols;
    const ch = (cell.h - 2 * pad) / rows;
    const sz = Math.min(cw, ch, cell.d) * 0.95 * cluster.scale;
    const front = cell.z + cell.d - 3;
    const back = front - Math.max(3, Math.min(sz * 0.6, cell.d - 8));
    if (annotated && cluster.annotation) {
      let anchor: Point = [cell.x + pad + cw / 2, cell.y + pad + ch / 2, front];
      if (cluster.shape === "ring" || cluster.shape === "wire")
        anchor = [anchor[0] + sz / 2, anchor[1], front];
      if (cluster.shape === "pair")
        anchor = [anchor[0] - sz * 0.32, anchor[1], front];
      if (cluster.shape === "slabs")
        anchor = [
          anchor[0],
          anchor[1] + ((cameraOf(current)[1] >= 0 ? 1 : -1) * sz) / 4,
          (front + back) / 2,
        ];
      markerCandidates.push({
        entry: cluster.annotation,
        anchor: projectXY(moved(anchor, current)),
        order: paintOrder,
      });
    }
    for (let i = 0; i < n; i++) {
      const cx = cell.x + pad + cw * ((i % cols) + 0.5);
      const cy = cell.y + pad + ch * (Math.floor(i / cols) + 0.5);
      switch (cluster.shape) {
        case "ring":
          prism(unitShapes.ring!, cx, cy, sz, front, back, cell, false);
          prism(
            scaled(unitShapes.ring!, 0.55, 0.55),
            cx,
            cy,
            sz,
            front,
            front - 2,
            cell,
            false,
          );
          break;
        case "wire":
          prism(unitShapes.wire!, cx, cy, sz, front, back, cell, false);
          break;
        case "band":
          // A flat ribbon across the cell: the fee taken from the block.
          prism(
            scaled(unitShapes.cube!, Math.min(2.4, (cw * 0.95) / sz), 0.18),
            cx,
            cy,
            sz,
            front,
            back,
            cell,
          );
          break;
        case "coins": {
          const thick = (front - back) / 4;
          for (let level = 2; level >= 0; level--) {
            const depth = front - (level * (front - back)) / 3;
            prism(unitShapes.oval!, cx, cy, sz, depth, depth - thick, cell);
          }
          break;
        }
        case "pair":
          prism(
            unitShapes.cube!,
            cx - sz * 0.32,
            cy,
            sz * 0.5,
            front,
            back,
            cell,
          );
          prism(
            unitShapes.cube!,
            cx + sz * 0.32,
            cy,
            sz * 0.5,
            front,
            back,
            cell,
          );
          line([cx - sz * 0.07, cy, front], [cx + sz * 0.07, cy, front]);
          break;
        case "slabs":
          for (let slab = 1; slab <= 3; slab++) {
            const level = cy - sz / 2 + (sz * slab) / 4;
            polygon(
              [
                [cx - sz / 2, level, back],
                [cx + sz / 2, level, back],
                [cx + sz / 2, level, front],
                [cx - sz / 2, level, front],
              ],
              cell.b,
              0.55,
            );
          }
          break;
        default:
          prism(
            unitShapes[cluster.shape] ?? unitShapes.cube!,
            cx,
            cy,
            sz,
            front,
            back,
            cell,
          );
      }
    }
  };
  if (grid) {
    let d = "";
    for (let gx = grid.x0; gx <= grid.x1; gx += gridStep)
      d += `M${project([gx, groundY, grid.z0])} L${project([gx, groundY, grid.z1])}`;
    for (let gz = grid.z0; gz <= grid.z1; gz += gridStep)
      d += `M${project([grid.x0, groundY, gz])} L${project([grid.x1, groundY, gz])}`;
    parts.push(
      `<path d="${d}" fill="none" stroke-opacity="0.22" stroke-width="${fixed(strokeWidth * 0.7)}"/>`,
    );
  }
  for (const glass of [false, true]) {
    const list = shadows.filter((s) => s.glass === glass);
    if (list.length === 0) continue;
    const d = list.map((s) => `M${s.hull.map(project).join(" L")}Z`).join("");
    parts.push(
      `<path d="${d}" fill="${pal.stroke}" fill-opacity="${glass ? "0.07" : "0.17"}" stroke="none"/>`,
    );
  }
  // Hatching: parallel diagonals on the face turned away from the light (and, when dense,
  // on the lit face as well, running the other way).
  const hatchStep = { none: 0, light: 8, dense: 5 }[params.hatch];
  const hatch = (
    origin: Point,
    along: Point,
    up: Point,
    w1: number,
    w2: number,
    mirror: boolean,
  ): void => {
    let d = "";
    for (let t = hatchStep; t < w1 + w2; t += hatchStep) {
      const uLo = Math.max(0, t - w2);
      const uHi = Math.min(t, w1);
      const at = (u: number, v: number): Point => {
        const uu = mirror ? w1 - u : u;
        return [
          origin[0] + along[0] * uu + up[0] * v,
          origin[1] + along[1] * uu + up[1] * v,
          origin[2] + along[2] * uu + up[2] * v,
        ];
      };
      d += `M${project(at(uLo, t - uLo))} L${project(at(uHi, t - uHi))}`;
    }
    if (d)
      parts.push(
        `<path d="${d}" fill="none" stroke-opacity="0.5" stroke-width="${fixed(strokeWidth * 0.7)}"/>`,
      );
  };
  const drawCell = (cell: Cell): void => {
    paintOrder++;
    current = moveOf(cell);
    const direction = cameraOf(current);
    const below = direction[1] < -1e-6;
    const { x, y, z, w, h, d, kind, glass } = cell;
    const a: Point = [x, y, z];
    const b: Point = [x + w, y, z];
    const c: Point = [x + w, y, z + d];
    const e: Point = [x, y, z + d];
    const A: Point = [x, y + h, z];
    const B: Point = [x + w, y + h, z];
    const C: Point = [x + w, y + h, z + d];
    const E: Point = [x, y + h, z + d];
    if (glass) {
      polygon([a, b, B, A], cell.front, 0.05);
      polygon([a, e, E, A], cell.side, 0.05);
      const pad = Math.min(w, h) * 0.12;
      const front = z + d - 3;
      const back = z + 3;
      if (cell.cutFaces) {
        // Inset objects stay in complete panes; partial panes show the actual section.
      } else if (cell.cluster) {
        drawCluster(cell);
      } else if (digest) {
        // Hollow pane: nothing happened here.
      } else if (kind === 1 || kind === 2) {
        // Triangular prism.
        const p: Point = [x + pad, y + pad, front];
        const q: Point = [x + w - pad, y + pad, front];
        const r: Point = [x + w / 2, y + h - pad, front];
        const P: Point = [p[0], p[1], back];
        const Q: Point = [q[0], q[1], back];
        const R: Point = [r[0], r[1], back];
        polygon([P, Q, R], cell.a, 0.22);
        if (current?.s) {
          const frontPoints = [p, q, r];
          const backPoints = [P, Q, R];
          for (let i = 0; i < 3; i++) {
            const j = (i + 1) % 3;
            const a = frontPoints[i]!;
            const b = frontPoints[j]!;
            // Outward XY normal of each edge of the counter-clockwise triangular cap.
            if (
              (b[1] - a[1]) * direction[0] - (b[0] - a[0]) * direction[1] >
              1e-6
            )
              polygon(
                [a, backPoints[i]!, backPoints[j]!, b],
                i === 0 ? cell.c : cell.b,
                0.36,
              );
          }
        } else polygon([q, Q, R, r], cell.b, 0.36);
        polygon([p, q, r], cell.a, 0.52);
        line(p, P);
      } else if (kind === 3) {
        // Thin slab stack.
        for (let slab = 1; slab <= 3; slab++) {
          const level = y + (h * slab) / 5;
          polygon(
            [
              [x + 3, level, back],
              [x + w - 3, level, back],
              [x + w - 3, level, front],
              [x + 3, level, front],
            ],
            cell.b,
            0.55,
          );
        }
      } else if (kind === 4) {
        // Hexagonal prism.
        const cx = x + w / 2;
        const cy = y + h / 2;
        const f: Point[] = [
          [cx - w * 0.22, cy - h * 0.35, front],
          [cx + w * 0.22, cy - h * 0.35, front],
          [cx + w * 0.4, cy, front],
          [cx + w * 0.22, cy + h * 0.35, front],
          [cx - w * 0.22, cy + h * 0.35, front],
          [cx - w * 0.4, cy, front],
        ];
        const k = f.map(([px, py]): Point => [px, py, back]);
        polygon(k, cell.b, 0.15);
        for (let i = 0; i < f.length; i++) line(f[i]!, k[i]!);
        polygon(f, cell.a, 0.65);
      } else if (kind === 5) {
        // Frustum: a smaller top face floating inside the pane.
        const t = Math.min(w, d) * 0.28;
        const top: Point[] = [
          [x + t, y + h - pad, z + t],
          [x + w - t, y + h - pad, z + t],
          [x + w - t, y + h - pad, z + d - t],
          [x + t, y + h - pad, z + d - t],
        ];
        const base: Point[] = [
          [x + pad, y + pad, z + pad],
          [x + w - pad, y + pad, z + pad],
          [x + w - pad, y + pad, z + d - pad],
          [x + pad, y + pad, z + d - pad],
        ];
        const height = top[2]![1] - base[2]![1];
        if (
          !current?.s ||
          height * direction[2] + (base[2]![2] - top[2]![2]) * direction[1] >
            1e-6
        )
          polygon([base[2]!, base[3]!, top[3]!, top[2]!], cell.a, 0.5);
        if (
          !current?.s ||
          height * direction[0] + (base[1]![0] - top[1]![0]) * direction[1] >
            1e-6
        )
          polygon([base[1]!, base[2]!, top[2]!, top[1]!], cell.b, 0.5);
        polygon(below ? [...base].reverse() : top, cell.c, 0.6);
      } else {
        // A small array of cubes.
        const n = w > 90 ? 3 : 2;
        const s = Math.min((w - 8) / n - 3, h * 0.6, d * 0.6);
        for (let i = 0; i < n; i++) {
          const cx = x + 4 + i * (s + 3);
          const cz = z + d / 2 - s / 2;
          const cy = y + h / 2 - s / 2;
          polygon(
            [
              [cx, cy, cz + s],
              [cx + s, cy, cz + s],
              [cx + s, cy + s, cz + s],
              [cx, cy + s, cz + s],
            ],
            cell.a,
            0.7,
          );
          polygon(
            [
              [cx + s, cy, cz],
              [cx + s, cy, cz + s],
              [cx + s, cy + s, cz + s],
              [cx + s, cy + s, cz],
            ],
            cell.b,
            0.7,
          );
          polygon(
            [
              [cx, below ? cy : cy + s, below ? cz + s : cz],
              [cx + s, below ? cy : cy + s, below ? cz + s : cz],
              [cx + s, below ? cy : cy + s, below ? cz : cz + s],
              [cx, below ? cy : cy + s, below ? cz : cz + s],
            ],
            cell.c,
            0.7,
          );
        }
      }
    }
    const alpha = glass ? (params.material === "frosted" ? 0.3 : 0.13) : 0.96;
    const bevel = bevelOf(cell);
    if (bevel > 0) {
      for (const face of bevelMesh(cell, bevel)) {
        if (
          face.normal.reduce((sum, n, i) => sum + n * direction[i]!, 0) <= 1e-6
        )
          continue;
        const cut =
          face.side === 1 &&
          (face.axis === 0
            ? cell.cutFaces?.x
            : face.axis === 1
              ? cell.cutFaces?.y
              : face.axis === 2
                ? cell.cutFaces?.z
                : false);
        if (face.axis !== undefined) {
          polygon(
            face.points,
            cut
              ? sectionColor
              : materialColor(
                  face.axis === 0
                    ? cell.side
                    : face.axis === 1
                      ? cell.top
                      : cell.front,
                  glass,
                ),
            face.axis === 1 ? 0.91 : alpha,
          );
        } else {
          const m = current;
          const nx =
            face.normal[0] * (m?.c ?? 1) - face.normal[1] * (m?.s ?? 0);
          const ny =
            face.normal[0] * (m?.s ?? 0) + face.normal[1] * (m?.c ?? 1);
          const light = -nx + ny + face.normal[2] * 0.4;
          polygon(
            face.points,
            tint(cell.front, light > 0 ? 255 : 0, light > 0 ? 0.42 : 0.24),
            1,
          );
        }
      }
    } else {
      polygon(
        [e, c, C, E],
        cell.cutFaces?.z ? sectionColor : materialColor(cell.front, glass),
        cell.cutFaces?.z ? 0.96 : alpha,
      );
      polygon(
        [b, c, C, B],
        cell.cutFaces?.x ? sectionColor : materialColor(cell.side, glass),
        cell.cutFaces?.x ? 0.96 : alpha,
      );
      polygon(
        below ? [e, c, b, a] : [A, B, C, E],
        !below && cell.cutFaces?.y
          ? sectionColor
          : materialColor(cell.top, glass),
        !below && cell.cutFaces?.y
          ? 0.96
          : glass
            ? params.material === "frosted"
              ? 0.2
              : 0.1
            : 0.91,
      );
    }
    materialDetails(cell, bevel);
    contactShadow(cell, bevel);
    if (hatchStep > 0 && !glass) {
      // Side face: along depth (z), up (y). Front face: along x, up.
      hatch(
        [x + w, y + bevel, z + bevel],
        [0, 0, 1],
        [0, 1, 0],
        d - 2 * bevel,
        h - 2 * bevel,
        false,
      );
      if (params.hatch === "dense")
        hatch(
          [x + bevel, y + bevel, z + d],
          [1, 0, 0],
          [0, 1, 0],
          w - 2 * bevel,
          h - 2 * bevel,
          true,
        );
    }
    // Sparse diagonal marks identify the newly exposed solid sections independently of hatching.
    if (cell.cutFaces) {
      const step = Math.max(6, size / 40);
      const mark = (
        origin: Point,
        along: Point,
        up: Point,
        width: number,
        height: number,
      ): void => {
        let path = "";
        for (let t = step; t < width + height; t += step) {
          const lo = Math.max(0, t - height),
            hi = Math.min(t, width);
          const at = (u: number): Point => [
            origin[0] + along[0] * u + up[0] * (t - u),
            origin[1] + along[1] * u + up[1] * (t - u),
            origin[2] + along[2] * u + up[2] * (t - u),
          ];
          path += `M${project(at(lo))} L${project(at(hi))}`;
        }
        parts.push(
          `<path d="${path}" fill="none" stroke-opacity="0.4" stroke-width="${fixed(strokeWidth * 0.65)}"/>`,
        );
      };
      if (cell.cutFaces.x)
        mark(
          [x + w, y + bevel, z + bevel],
          [0, 0, 1],
          [0, 1, 0],
          d - 2 * bevel,
          h - 2 * bevel,
        );
      if (cell.cutFaces.z)
        mark(
          [x + bevel, y + bevel, z + d],
          [1, 0, 0],
          [0, 1, 0],
          w - 2 * bevel,
          h - 2 * bevel,
        );
      if (cell.cutFaces.y && !below)
        mark(
          [x + bevel, y + h, z + bevel],
          [1, 0, 0],
          [0, 0, 1],
          w - 2 * bevel,
          d - 2 * bevel,
        );
    }
    if (cell.accent) {
      const height = below ? y : y + h;
      parts.push(
        `<path d="M${project([x + bevel, height, z + d - bevel])} L${project([x + w - bevel, height, z + d - bevel])}" fill="none" stroke="${pal.groups[1][1]}" stroke-width="${fixed(Math.max(1.8, strokeWidth * 2.2))}" stroke-linecap="round"/>`,
      );
    }
    current = undefined;
  };
  for (const item of drawn) {
    if (item.connector) {
      paintOrder++;
      for (const face of item.connector) {
        const direction: Point = [view.v, 2 * view.s, view.v];
        if (
          face.normal.reduce((sum, n, i) => sum + n * direction[i]!, 0) > 1e-6
        )
          polygon(
            face.points,
            tint(pal.groups[1][1], face.normal[1] > 0 ? 255 : 0, 0.2),
            1,
          );
      }
    } else if (item.wire !== undefined) parts.push(item.wire());
    else if (item.group) for (const cell of item.group) drawCell(cell);
    else drawCell(item.cell!);
  }
  parts.push("</g>");
  if (annotated && digest) {
    const contains = (
      points: [number, number][],
      p: readonly [number, number],
    ): boolean => {
      const signs = points.map((a, i) => {
        const b = points[(i + 1) % points.length]!;
        return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      });
      const area = points.reduce((sum, a, i) => {
        const b = points[(i + 1) % points.length]!;
        return sum + a[0] * b[1] - b[0] * a[1];
      }, 0);
      return (
        Math.abs(area) > 0.1 &&
        (signs.every((v) => v >= -0.01) || signs.every((v) => v <= 0.01))
      );
    };
    const isHidden = (m: Marker & { order: number }): boolean =>
      opaqueFaces.some(
        (face) => face.order > m.order && contains(face.points, m.anchor),
      );
    // Older modes drop hidden callouts; "full" keeps them, drawn dashed.
    const visible =
      params.annotations === "full"
        ? markerCandidates.map((m) => ({ ...m, hidden: isHidden(m) }))
        : markerCandidates.filter((m) => !isHidden(m));
    parts.push(
      annotationLayer({
        mode: params.annotations === "markers" ? "markers" : "explained",
        markers: visible,
        entries: annotationEntries,
        digest,
        ink: ink,
        paper: pal.paper,
        top: sceneTop,
        bottom: sceneBottom,
      }),
    );
  }
  if (visibleCaption === "topleft" || visibleCaption === "topright")
    parts.push(
      cornerCaption(
        `BLOCKHEIGHT ${formatHeight(art.blockHeight)}`,
        ink,
        visibleCaption === "topleft" ? "left" : "right",
        inset,
      ),
    );
  else if (visibleCaption !== "none")
    parts.push(
      (revision >= 4 ? largeCaption : caption)(
        `BLOCKHEIGHT ${formatHeight(art.blockHeight)}`,
        ink,
        params.caption === "bottom" ? 928 : 856,
      ),
    );
  parts.push("</svg>");
  return parts.join("");
}
