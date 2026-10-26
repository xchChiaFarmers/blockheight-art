/**
 * The studio's starting options (blockheight-2 to -4). The browser opens with them, and the server draws
 * its pre-rendered example with them, so the controls match the picture a visitor first sees.
 * `eventlayout` is "tiled" instead when real block data is enabled.
 */
export const studioDefaults: Readonly<Record<string, string>> = {
  palette: "c1",
  mix: "none",
  structure: "layered",
  walls: "some",
  spacing: "tight",
  shapes: "balanced",
  glass: "mixed",
  lines: "regular",
  blocksize: "medium",
  zoom: "normal",
  view: "classic",
  composition: "single",
  axis: "x",
  satellites: "two",
  reach: "mid",
  wires: "loose",
  frame: "thin",
  fill: "none",
  caption: "low",
  ground: "none",
  hatch: "none",
  twist: "none",
  slices: "none",
  bevel: "none",
  occlusion: "none",
  cutaway: "none",
  material: "none",
  connectors: "none",
  accents: "none",
  annotations: "none",
  eventlayout: "none",
};
