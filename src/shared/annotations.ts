import { fixed } from "./art.js";
import type { ChainDigest } from "./digest.js";

/** Embedded line lettering keeps SVG/PNG labels independent of installed fonts. */
const letters: Record<string, string> = {
  A: "M0 6L2 0L4 6M1 3H3",
  B: "M0 6V0H3L4 1V2L3 3H0M3 3L4 4V5L3 6H0",
  C: "M4 1L3 0H1L0 1V5L1 6H3L4 5",
  D: "M0 6V0H2L4 2V4L2 6Z",
  E: "M4 0H0V6H4M0 3H3",
  F: "M4 0H0V6M0 3H3",
  G: "M4 1L3 0H1L0 1V5L1 6H4V3H2",
  H: "M0 0V6M4 0V6M0 3H4",
  I: "M0 0H4M2 0V6M0 6H4",
  J: "M0 0H4V5L3 6H1L0 5",
  K: "M0 0V6M4 0L0 3L4 6",
  L: "M0 0V6H4",
  M: "M0 6V0L2 3L4 0V6",
  N: "M0 6V0L4 6V0",
  O: "M1 0H3L4 1V5L3 6H1L0 5V1Z",
  P: "M0 6V0H3L4 1V2L3 3H0",
  Q: "M1 0H3L4 1V5L3 6H1L0 5V1ZM2 4L4 6",
  R: "M0 6V0H3L4 1V2L3 3H0M2 3L4 6",
  S: "M4 0H1L0 1V2L1 3H3L4 4V5L3 6H0",
  T: "M0 0H4M2 0V6",
  U: "M0 0V5L1 6H3L4 5V0",
  V: "M0 0L2 6L4 0",
  W: "M0 0V6L2 3L4 6V0",
  X: "M0 0L4 6M4 0L0 6",
  Y: "M0 0L2 3L4 0M2 3V6",
  Z: "M0 0H4L0 6H4",
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
  ".": "M2 5V6",
  ",": "M2 6L1 8",
  "-": "M0 3H4",
  "/": "M0 6L4 0",
  ":": "M2 1V2M2 4V5",
  "|": "M2 0V6",
  "#": "M1 0V6M3 0V6M0 2H4M0 4H4",
};
const escape = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export const countLabel = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export function xchLabel(mojos: string): string {
  const digits = mojos.replace(/^0+(?=\d)/, "").padStart(13, "0");
  const fraction = digits.slice(-12).replace(/0+$/, "");
  return `${digits.slice(0, -12)}${fraction ? `.${fraction}` : ""} XCH`;
}

export type Annotation = {
  id: string;
  key: string;
  label: string;
  value: string;
  count: number;
};
export type Marker = {
  entry: Annotation;
  anchor: readonly [number, number];
  /** The shape sits behind another face: its callout is drawn dashed. */
  hidden?: boolean;
};

/** Reserve only the rows that carry information, including a clear bottom margin. */
export function annotationFooterHeight(
  digest: ChainDigest,
  entryCount: number,
): number {
  if (digest.spends > 0 || entryCount > 0)
    return (
      (digest.timestamp === null ? 62 : 84) +
      Math.ceil(entryCount / 2) * 20 +
      21
    );
  return (digest.timestamp === null ? 54 : 72) + 12;
}
export function lineText(
  label: string,
  x: number,
  y: number,
  size: number,
  ink: string,
): string {
  const scale = size / 6;
  const advance = scale * 6;
  return `<g aria-label="${escape(label)}" fill="none" stroke="${ink}" stroke-width="${fixed(0.65 / scale)}" stroke-linecap="round" stroke-linejoin="round">${[...label.toUpperCase()].map((c, i) => (letters[c] ? `<path transform="translate(${fixed(x + i * advance)} ${fixed(y)}) scale(${fixed(scale)})" d="${letters[c]}"/>` : "")).join("")}</g>`;
}

/** Keep callouts ordered and separated along the two side rails. */
export function placeMarkers(
  markers: Marker[],
  top: number,
  bottom: number,
): (Marker & { x: number; y: number })[] {
  const result: (Marker & { x: number; y: number })[] = [];
  for (const side of [-1, 1]) {
    const lane = markers
      .filter((m) => (m.anchor[0] < 500 ? -1 : 1) === side)
      .sort(
        (a, b) =>
          a.anchor[1] - b.anchor[1] || Number(a.entry.id) - Number(b.entry.id),
      );
    const spacing = Math.min(34, (bottom - top) / Math.max(1, lane.length - 1));
    const ys = lane.map((m, i) =>
      Math.max(
        top + i * spacing,
        Math.min(bottom - (lane.length - i - 1) * spacing, m.anchor[1]),
      ),
    );
    for (let i = 1; i < ys.length; i++)
      ys[i] = Math.max(ys[i]!, ys[i - 1]! + spacing);
    for (let i = ys.length - 2; i >= 0; i--)
      ys[i] = Math.min(ys[i]!, ys[i + 1]! - spacing);
    lane.forEach((m, i) =>
      result.push({ ...m, x: side < 0 ? 78 : 922, y: ys[i]! }),
    );
  }
  return result;
}

export function annotationLayer(input: {
  mode: "markers" | "explained";
  markers: Marker[];
  entries: Annotation[];
  digest: ChainDigest;
  ink: string;
  paper: string;
  top: number;
  bottom: number;
}): string {
  const { mode, entries, digest, ink, paper, top, bottom } = input;
  const placed = placeMarkers(input.markers, top + 16, bottom - 16);
  const visible = new Set(placed.map((m) => m.entry.id));
  const parts = [`<g data-annotations="${mode}">`];
  for (const { entry, anchor, x, y, hidden } of placed) {
    const dash = hidden ? ' stroke-dasharray="3 2.5"' : "";
    const inner = x < 500 ? x + 18 : x - 18;
    parts.push(
      `<g data-marker="${entry.id}" data-kind="${entry.key}" data-count="${entry.count}"${hidden ? ' data-hidden="true"' : ""}><title>${escape(`${entry.label}: ${entry.value}${hidden ? " (hidden in this view)" : ""}`)}</title><path d="M${fixed(anchor[0])},${fixed(anchor[1])} L${inner},${fixed(y)} L${x},${fixed(y)}" fill="none" stroke="${ink}" stroke-opacity="0.7" stroke-width="0.8"${dash}/><circle cx="${fixed(anchor[0])}" cy="${fixed(anchor[1])}" r="2" ${hidden ? `fill="${paper}" stroke="${ink}" stroke-width="0.8"` : `fill="${ink}"`}/><circle cx="${x}" cy="${fixed(y)}" r="12" fill="${paper}" stroke="${ink}" stroke-width="0.9"${dash}/>${lineText(entry.id, x - 10, y - 5, 10, ink)}</g>`,
    );
  }
  if (mode === "explained") {
    const left = 52;
    let y = bottom + 25;
    parts.push(
      `<g data-block-legend="true"><rect x="36" y="${bottom + 12}" width="928" height="${annotationFooterHeight(digest, entries.length) - 12}" fill="${paper}"/><path d="M52,${fixed(y - 7)} H948" stroke="${ink}" stroke-width="0.7" fill="none"/>`,
    );
    parts.push(
      lineText(
        `BLOCK #${countLabel(digest.height)} / ${digest.transactionBlock ? "TRANSACTION" : "NON-TRANSACTION"}`,
        left,
        y,
        11,
        ink,
      ),
    );
    y += 19;
    parts.push(
      lineText(
        [
          digest.spends > 0
            ? `COIN SPENDS ${countLabel(digest.spends)}`
            : "NO COIN SPENDS IN THIS BLOCK",
          ...(digest.tokens > 0
            ? [`CAT TOKENS ${countLabel(digest.tokens)}`]
            : []),
          ...(/[1-9]/.test(digest.fees)
            ? [`FEES ${xchLabel(digest.fees)}`]
            : []),
        ].join(" | "),
        left,
        y,
        10,
        ink,
      ),
    );
    y += 18;
    if (digest.timestamp !== null) {
      parts.push(
        lineText(
          new Date(digest.timestamp * 1000)
            .toISOString()
            .replace("T", " ")
            .slice(0, 19) + " UTC",
          left,
          y,
          10,
          ink,
        ),
      );
      y += 22;
    }
    entries.forEach((entry, i) => {
      const label = `${visible.has(entry.id) ? entry.id : "--"} ${entry.label} / ${entry.value}`;
      parts.push(
        `<g data-entry="${entry.key}" data-count="${entry.count}">${lineText(label, left + (i % 2) * 454, y + Math.floor(i / 2) * 20, 10, ink)}</g>`,
      );
    });
    y += Math.ceil(entries.length / 2) * 20;
    if (digest.spends > 0 || entries.length > 0)
      parts.push(
        lineText(
          digest.spends === 0
            ? "SHAPES ARE SYMBOLS"
            : "SPEND COUNTS ARE CLASSIFICATIONS / SHAPES ARE SYMBOLS",
          left,
          y,
          9,
          ink,
        ),
      );
    parts.push("</g>");
  }
  parts.push("</g>");
  return parts.join("");
}
