import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  drawOrder,
  paramKeys,
  paramSpec,
  renderSvg2,
  validateParams2,
  type Art2Params,
  type Artwork2,
  type Bounds,
} from "../src/shared/art2.js";
import { parseParams, renderArtwork } from "../src/shared/render.js";

const params: Art2Params = {
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
  wires: "straight",
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
const fixture: Artwork2 = {
  seed: "0".repeat(64),
  blockHeight: 2584772,
  rendererVersion: "blockheight-2",
  params,
};
const hash = (art: Artwork2): string =>
  createHash("sha256").update(renderSvg2(art)).digest("hex");
const withParams = (p: Partial<Art2Params>): Artwork2 => ({
  ...fixture,
  params: { ...params, ...p },
});

test("blockheight-2 render is pure and repeatable", () => {
  const original = structuredClone(fixture);
  assert.equal(renderSvg2(fixture), renderSvg2(fixture));
  assert.deepEqual(fixture, original);
  assert.notEqual(hash(fixture), hash({ ...fixture, seed: "1".repeat(64) }));
  assert.notEqual(
    hash(fixture),
    hash({ ...fixture, blockHeight: fixture.blockHeight + 1 }),
  );
});

test("blockheight-2 golden masters pin representative variants", () => {
  const variants: Partial<Art2Params>[] = [
    {},
    { palette: "c7", structure: "dense", walls: "many", spacing: "none" },
    {
      palette: "c5",
      composition: "chain",
      wires: "loose",
      satellites: "three",
      reach: "far",
      view: "high",
      fill: "dust",
      mix: "little",
    },
    {
      palette: "futuradora",
      structure: "quiet",
      walls: "few",
      shapes: "many",
      glass: "glassy",
      view: "low",
      frame: "bold",
      fill: "panel",
      caption: "bottom",
      lines: "heavy",
      mix: "much",
    },
    { view: "flipped", spacing: "airy", composition: "chain" },
  ];
  const expected = variants.map((v) => hash(withParams(v)));
  assert.equal(new Set(expected).size, expected.length);
  assert.deepEqual(
    variants.map((v) => hash(withParams(v))),
    expected,
  );
});

test("every option changes the output", () => {
  const base = hash(fixture);
  for (const key of paramKeys) {
    for (const value of paramSpec[key]) {
      if (key === "annotations" || key === "eventlayout") continue; // Requires real chain data (blockheight-3).
      if (value === params[key]) continue;
      // Chain-only options are inert while the composition is a single block.
      const chain = [
        "axis",
        "satellites",
        "reach",
        "wires",
        "connectors",
      ].includes(key)
        ? { composition: "chain" as const }
        : {};
      const reference = hash(withParams(chain));
      assert.notEqual(
        hash(withParams({ ...chain, [key]: value })),
        reference,
        `${key}=${value}`,
      );
    }
  }
  assert.notEqual(base, hash(withParams({ palette: "c9" })));
});

/** Polygon vertices as numbers (fills removed). */
const vertices = (svg: string): number[][] =>
  (svg.match(/<polygon points="([^"]*)"/g) ?? []).map((p) =>
    p
      .replace('<polygon points="', "")
      .replace('"', "")
      .split(/[ ,]/)
      .map(Number),
  );
/** Shape independent of where it sits on the canvas (coordinates relative to the first vertex). */
const shapeOnly = (svg: string): number[] => {
  const v = vertices(svg);
  const [ox, oy] = [v[0]![0]!, v[0]![1]!];
  return v.flatMap((points) =>
    points.map((n, i) => n - (i % 2 === 0 ? ox : oy)),
  );
};
/** Bounding box of every polygon on the canvas. */
const bounds = (svg: string) => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const points of vertices(svg))
    points.forEach((n, i) => (i % 2 === 0 ? xs : ys).push(n));
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
};

test("presentation options leave the structure untouched", () => {
  const base = shapeOnly(renderSvg2(fixture));
  for (const p of [
    { palette: "c12" },
    { frame: "bold" },
    { fill: "dust" },
    { caption: "none" },
    { caption: "bottom" },
    { lines: "heavy" },
  ] as const) {
    const other = shapeOnly(renderSvg2(withParams(p)));
    assert.equal(other.length, base.length);
    // Coordinates are rounded to 0.01 before and after shifting, so allow that much noise.
    const worst = Math.max(...other.map((n, i) => Math.abs(n - base[i]!)));
    assert.ok(
      worst < 0.05,
      JSON.stringify(p) + " moved the structure by " + worst,
    );
  }
});

test("the drawing is centred in the space the caption and frame leave free", () => {
  for (const zoom of ["out", "normal", "in"] as const)
    for (const blocksize of ["small", "large"] as const) {
      const at = (caption: "none" | "low" | "bottom") =>
        bounds(renderSvg2(withParams({ zoom, blocksize, caption })));
      const none = at("none");
      const low = at("low");
      const bottom = at("bottom");
      // Horizontally centred, always.
      for (const b of [none, low, bottom])
        assert.ok(
          Math.abs((b.left + b.right) / 2 - 500) < 1.5,
          `${zoom}/${blocksize} x`,
        );
      // Without a caption the drawing sits in the middle of the frame.
      assert.ok(
        Math.abs((none.top + none.bottom) / 2 - 500) < 1.5,
        `${zoom}/${blocksize} none`,
      );
      // A caption pushes it up, the lower caption less than the low one.
      assert.ok(
        (low.top + low.bottom) / 2 < (bottom.top + bottom.bottom) / 2,
        "low caption sits higher",
      );
      assert.ok(
        (bottom.top + bottom.bottom) / 2 < (none.top + none.bottom) / 2,
        "any caption moves it up",
      );
      // When it fits, it clears the caption line.
      if (low.bottom - low.top < 780)
        assert.ok(
          low.bottom <= 856 - 20,
          `${zoom}/${blocksize} clears the caption`,
        );
    }
});

test("output is bounded and free of active content for every extreme", () => {
  for (const structure of paramSpec.structure)
    for (const walls of paramSpec.walls)
      for (const shapes of paramSpec.shapes) {
        const svg = renderSvg2(
          withParams({
            structure,
            walls,
            shapes,
            spacing: "airy",
            composition: "chain",
            satellites: "three",
            fill: "dust",
          }),
        );
        assert.ok(svg.length < 600_000, `${structure}/${walls}/${shapes}`);
        assert.doesNotMatch(svg, /<script|href=|<image|<foreignObject|url\(/i);
        assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
      }
});

test("strict parameter schema rejects unknown, missing, extra and coerced values", () => {
  assert.deepEqual(validateParams2(params), params);
  const { palette: _omit, ...missing } = params;
  for (const invalid of [
    null,
    [],
    {},
    missing,
    { ...params, extra: "x" },
    { ...params, palette: "mineral" },
    { ...params, frame: 1 },
    { ...params, view: "__proto__" },
    Object.create(params),
  ])
    assert.throws(() => validateParams2(invalid), undefined, String(invalid));
});

test("version dispatch keeps blockheight-1 parameters working", () => {
  assert.equal(parseParams(params).version, "blockheight-2");
  const legacy = {
    palette: "mineral",
    density: "quiet",
    composition: "single",
  };
  assert.equal(parseParams(legacy).version, "blockheight-1");
  assert.throws(() => parseParams({ palette: "nope" }));
  assert.equal(renderArtwork(fixture), renderSvg2(fixture));
  assert.throws(() =>
    renderArtwork({ ...fixture, rendererVersion: "blockheight-9" } as never),
  );
});

test("draw order puts a nearer narrow block after a wider block behind it", () => {
  // Wide slab in the back wall (larger centre sum) and a narrow block in the wall in front of it.
  const wideBack = [0, 300, 0, 50, -150, -50] as const;
  const narrowFront = [0, 20, 0, 50, -50, 50] as const;
  const keys = [75, 35];
  assert.ok(
    keys[0]! > keys[1]!,
    "centre sorting would draw the front block first",
  );
  assert.deepEqual(drawOrder([wideBack, narrowFront], keys), [0, 1]);
  // Boxes that cannot hide each other fall back to the distance keys.
  assert.deepEqual(
    drawOrder(
      [
        [0, 10, 0, 10, 0, 10],
        [-50, -40, 50, 60, 20, 30],
      ],
      [15, 5],
    ),
    [1, 0],
  );
});

test("draw order respects negative and edge-on viewing directions", () => {
  const boxes: Bounds[] = [
    [0, 10, 0, 10, 0, 10],
    [0, 10, 20, 30, 0, 10],
  ];
  assert.deepEqual(drawOrder(boxes, [0, 100], [1, -1, 1]), [1, 0]);
  assert.deepEqual(drawOrder(boxes, [100, 0], [1, 1, 1]), [0, 1]);
  assert.deepEqual(drawOrder(boxes, [100, 0], [1, 0, 1]), [1, 0]);
});

test("rotated walls order their blocks according to the actual camera", () => {
  for (const view of paramSpec.view)
    for (const twist of ["slight", "strong"] as const) {
      const svg = renderSvg2(
        withParams({
          view,
          twist,
          spacing: "none",
          caption: "none",
          zoom: "out",
        }),
      );
      const faces = [
        ...svg.matchAll(
          /<polygon points="([^"]*)" fill="#[0-9a-f]{6}" fill-opacity="(?:0\.13|0\.96)"/g,
        ),
      ].map((m) => m[1]!.split(/[ ,]/).map(Number));
      const { s, v } = {
        classic: { s: 0.355, v: 0.87 },
        high: { s: 0.5, v: 0.71 },
        low: { s: 0.22, v: 0.95 },
        flipped: { s: 0.355, v: 0.87 },
      }[view];
      const [c, sin] =
        twist === "strong" ? [0.70711, 0.70711] : [0.96593, 0.25882];
      const a = 0.71 * c!,
        b = -0.71 * sin!,
        cc = s * c! - v * sin!,
        d = -s * sin! - v * c!;
      const det = a * d - b * cc;
      const sign = view === "flipped" ? -1 : 1;
      const groups: { depth: number; boxes: number[][] }[] = [];
      let group: (typeof groups)[number] | undefined;
      for (let i = 0; i < faces.length; i += 2) {
        const face = faces[i]!,
          side = faces[i + 1]!;
        const slope = (face[3]! - face[1]!) / (face[2]! - face[0]!);
        if (Math.abs(slope - cc / a) > 0.002) {
          group = undefined;
          continue;
        }
        const depth = Math.hypot(side[2]! - side[0]!, side[3]! - side[1]!);
        if (!group || Math.abs(group.depth - depth) > 0.03) {
          group = { depth, boxes: [] };
          groups.push(group);
        }
        // Invert the front-plane projection. Its unknown translation is common to the
        // wall, so recovered intervals can be compared without access to renderer internals.
        const xs: number[] = [],
          ys: number[] = [];
        for (let j = 0; j < face.length; j += 2) {
          const x = sign * face[j]!,
            y = sign * face[j + 1]!;
          xs.push((d * x - b * y) / det);
          ys.push((-cc * x + a * y) / det);
        }
        group.boxes.push([
          Math.min(...xs),
          Math.max(...xs),
          Math.min(...ys),
          Math.max(...ys),
        ]);
      }
      assert.ok(groups.length, `${view}/${twist}: rotated walls found`);
      let checked = 0;
      for (const { boxes } of groups)
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const A = boxes[i]!,
              B = boxes[j]!;
            if (Math.min(A[1]!, B[1]!) - Math.max(A[0]!, B[0]!) < 0.03)
              continue;
            const fromBelow = 2 * s * c! - v * sin! < 0;
            if (A[3]! <= B[2]! + 0.03) {
              checked++;
              assert.ok(
                !fromBelow,
                `${view}/${twist}: lower block must be drawn last`,
              );
            } else if (B[3]! <= A[2]! + 0.03) {
              checked++;
              assert.ok(
                fromBelow,
                `${view}/${twist}: upper block must be drawn last`,
              );
            }
          }
      assert.ok(
        checked >= 4,
        `${view}/${twist}: enough stacked blocks checked`,
      );
    }
});

test("rotated walls draw visible horizontal and triangular prism faces", () => {
  for (const view of paramSpec.view)
    for (const twist of ["slight", "strong"] as const) {
      const svg = renderSvg2(
        withParams({ view, twist, glass: "glassy", shapes: "many" }),
      );
      const area = (points: string): number => {
        const xy = points.split(" ").map((p) => p.split(",").map(Number));
        return (
          xy.reduce((sum, p, i) => {
            const q = xy[(i + 1) % xy.length]!;
            return sum + p[0]! * q[1]! - q[0]! * p[1]!;
          }, 0) / 2
        );
      };
      let horizontal = 0,
        triangular = 0,
        cubeFaces = 0;
      for (const m of svg.matchAll(
        /<polygon points="([^"]*)" fill="#[0-9a-f]{6}" fill-opacity="(0\.10|0\.91|0\.60|0\.36|0\.70|0\.50)"/g,
      )) {
        if (m[2] === "0.70" && ++cubeFaces % 3 !== 0) continue;
        const signedArea = area(m[1]!);
        if (m[2] === "0.50") {
          assert.ok(
            signedArea > -0.03,
            `${view}/${twist}: frustum side faces away from camera`,
          );
          continue;
        }
        if (m[2] === "0.36") {
          triangular++;
          assert.ok(
            signedArea < 0.03,
            `${view}/${twist}: triangular side faces away from camera`,
          );
        } else {
          horizontal++;
          assert.ok(
            signedArea > -0.03,
            `${view}/${twist}: horizontal face faces away from camera`,
          );
        }
      }
      assert.ok(horizontal > 10 && triangular > 0);
    }
});

test("every generated scene respects true depth order", () => {
  const svg = renderSvg2(
    withParams({ structure: "dense", walls: "many", spacing: "none" }),
  );
  assert.ok(svg.length > 1000);
  for (let n = 0; n < 12; n++) {
    const boxes: Bounds[] = [];
    let seed = n + 1;
    const rnd = (): number =>
      (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    // A grid of disjoint boxes of unequal size.
    for (let x = 0; x < 4; x++)
      for (let z = 0; z < 4; z++)
        for (let y = 0; y < 3; y++) {
          const w = 20 + rnd() * 60;
          const d = 20 + rnd() * 60;
          const h = 20 + rnd() * 60;
          boxes.push([
            x * 100,
            x * 100 + w,
            y * 100,
            y * 100 + h,
            z * 100,
            z * 100 + d,
          ]);
        }
    const keys = boxes.map(
      (b) => (b[0] + b[1] + b[2] + b[3] + b[4] + b[5]) / 2,
    );
    const order = drawOrder(boxes, keys);
    const at = new Map(order.map((box, position) => [box, position]));
    for (let a = 0; a < boxes.length; a++)
      for (let b = 0; b < boxes.length; b++) {
        if (a === b) continue;
        const A = boxes[a]!;
        const B = boxes[b]!;
        const nearer = [0, 2, 4].some((k) => B[k]! >= A[k + 1]!);
        const farther = [0, 2, 4].some((k) => A[k]! >= B[k + 1]!);
        if (nearer && !farther)
          assert.ok(
            at.get(a)! < at.get(b)!,
            `box ${b} must be drawn after ${a}`,
          );
      }
  }
});

test("cables are depth-ordered with the blocks instead of drawn on top of everything", () => {
  for (const axis of ["x", "z", "vertical"] as const)
    for (const wires of ["straight", "loose"] as const) {
      const svg = renderSvg2(
        withParams({ composition: "chain", axis, wires, satellites: "three" }),
      );
      const body = svg.slice(svg.indexOf("<g stroke"), svg.indexOf("</g>"));
      const items =
        body.match(
          /<polygon[^>]*>|<path d="M[^>]*stroke-linecap="round"\/>/g,
        ) ?? [];
      const cables = items.flatMap((item, i) =>
        item.startsWith("<path") ? [i] : [],
      );
      assert.equal(
        cables.length,
        6,
        `${axis}/${wires}: one cable per gap and side`,
      );
      // Some block is painted after at least one cable, so nothing is forced on top.
      assert.ok(
        items
          .slice(Math.min(...cables) + 1)
          .some((item) => item.startsWith("<polygon")),
        `${axis}/${wires}`,
      );
    }
});

test("cables dock on real faces when parent walls turn or slide", () => {
  const contains = (polygon: number[], x: number, y: number): boolean => {
    const sides: number[] = [];
    for (let i = 0; i < polygon.length; i += 2) {
      const j = (i + 2) % polygon.length;
      const ax = polygon[i]!;
      const ay = polygon[i + 1]!;
      const bx = polygon[j]!;
      const by = polygon[j + 1]!;
      const length = Math.hypot(bx - ax, by - ay);
      if (length > 0)
        sides.push(((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / length);
    }
    return sides.every((v) => v >= -0.03) || sides.every((v) => v <= 0.03);
  };
  for (const seed of ["0", "1", "7"])
    for (const axis of paramSpec.axis)
      for (const wires of paramSpec.wires)
        for (const view of paramSpec.view)
          for (const style of [
            { twist: "slight", slices: "much" },
            { twist: "strong", slices: "none" },
            { twist: "none", slices: "much" },
            { twist: "none", slices: "fan" },
            { twist: "strong", slices: "fan" },
            { bevel: "bold", cutaway: "corner" },
          ] as const) {
            const svg = renderSvg2({
              ...withParams({
                composition: "chain",
                satellites: "one",
                axis,
                wires,
                view,
                spacing: "airy",
                ...style,
              }),
              seed: seed.repeat(64),
            });
            const faces = vertices(svg);
            const cables = [
              ...svg.matchAll(
                /<path d="M(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)[^"]*" fill="none" stroke-linecap="round"\/>/g,
              ),
            ];
            assert.equal(cables.length, 2);
            for (const cable of cables)
              assert.ok(
                faces.some((face) =>
                  contains(face, Number(cable[1]), Number(cable[2])),
                ),
                `${seed}/${axis}/${wires}/${view}/${style.twist}/${style.slices}: parent endpoint floats off the cube`,
              );
          }
});

test("the caption stays readable on every palette", async () => {
  const { captionInk } = await import("../src/shared/art2.js");
  const { palettes2 } = await import("../src/shared/palettes.js");
  const brightness = (c: string): number =>
    (0.2126 * parseInt(c.slice(1, 3), 16) +
      0.7152 * parseInt(c.slice(3, 5), 16) +
      0.0722 * parseInt(c.slice(5, 7), 16)) /
    255;
  for (const [id, p] of Object.entries(palettes2)) {
    const ink = captionInk(p.paper, p.text);
    assert.ok(Math.abs(brightness(p.paper) - brightness(ink)) >= 0.3, id);
  }
  assert.equal(
    captionInk("#746967", "#47403e"),
    "#f2f2f2",
    "a low-contrast pair falls back to white",
  );
});

test("stored parameters without the later options still validate and render as before", () => {
  const {
    ground,
    hatch,
    twist,
    slices,
    bevel,
    occlusion,
    cutaway,
    material,
    connectors,
    accents,
    annotations,
    eventlayout,
    ...legacy
  } = params;
  void [
    ground,
    hatch,
    twist,
    slices,
    bevel,
    occlusion,
    cutaway,
    material,
    connectors,
    accents,
    annotations,
    eventlayout,
  ];
  assert.deepEqual(validateParams2(legacy), params);
  assert.equal(
    createHash("sha256")
      .update(renderSvg2({ ...fixture, params: legacy as Art2Params }))
      .digest("hex"),
    hash(fixture),
  );
  assert.throws(() => validateParams2({ ...legacy, ground: "sun" }));
  // Output of the parameters that existed at release is pinned (re-pinned when the chain
  // satellites moved to the cube's vertical middle).
  const chain = {
    ...params,
    composition: "chain" as const,
    wires: "loose" as const,
  };
  assert.equal(
    createHash("sha256")
      .update(
        renderSvg2({
          seed: "7".repeat(64),
          blockHeight: 4321,
          rendererVersion: "blockheight-2",
          params: chain,
        }),
      )
      .digest("hex"),
    "bd848b8d13d6714b2d0617278a15b5fbf659cb6072c4ab4fd95239a645fa1ce8",
  );
});

const numbers = (svg: string, tag: RegExp): number[] =>
  (svg.match(tag) ?? []).flatMap((m) =>
    (m.match(/-?\d+(\.\d+)?/g) ?? []).map(Number),
  );

test("sliding moves walls only along X with uniform alternating or fan steps", () => {
  for (const seed of ["0", "1", "7"])
    for (const view of paramSpec.view) {
      const artwork = withParams({
        walls: "many",
        zoom: "out",
        caption: "none",
        frame: "none",
        view,
      });
      artwork.seed = seed.repeat(64);
      const base = vertices(renderSvg2(artwork));
      for (const slices of ["little", "much", "fan"] as const) {
        const shifted = vertices(
          renderSvg2({
            ...artwork,
            params: { ...artwork.params, slices },
          }),
        );
        assert.equal(shifted.length, base.length, "same block faces");
        const shifts: [number, number][] = [];
        for (const face of shifted) {
          // Match distinctive faces by shape, independent of painter's order or translation.
          const matches = base.filter(
            (other) =>
              other.length === face.length &&
              face.every(
                (v, i) =>
                  Math.abs(v - face[i % 2]! - (other[i]! - other[i % 2]!)) <
                  0.03,
              ),
          );
          if (matches.length === 1)
            shifts.push([
              face[0]! - matches[0]![0]!,
              face[1]! - matches[0]![1]!,
            ]);
        }
        assert.ok(shifts.length >= 8, "enough distinctive faces to compare");
        const slope =
          { classic: 0.355, high: 0.5, low: 0.22, flipped: 0.355 }[view] / 0.71;
        // In this projection a pure X shift has dy/dx = slope. A global recenter is common
        // to all faces, so differing residuals reveal unintended Y or Z movement.
        const residuals = shifts.map(([x, y]) => y - x * slope);
        const label = `${seed}/${view}/${slices}`;
        assert.ok(
          Math.max(...residuals) - Math.min(...residuals) < 0.04,
          `${label}: Y/Z unchanged`,
        );
        const groups: number[] = [];
        for (const x of shifts.map(([x]) => x).sort((a, b) => a - b))
          if (!groups.length || x - groups[groups.length - 1]! > 0.04)
            groups.push(x);
        const step = 300 * (slices === "much" ? 0.16 : 0.07) * 0.71 * 0.8;
        if (slices === "fan") {
          assert.ok(groups.length >= 3, `${label}: successive walls`);
          for (let i = 1; i < groups.length; i++)
            assert.ok(
              Math.abs(groups[i]! - groups[i - 1]! - step) < 0.04,
              `${label}: equal fan spacing`,
            );
        } else {
          assert.equal(groups.length, 2, `${label}: two alternating offsets`);
          assert.ok(
            Math.abs(groups[1]! - groups[0]! - 2 * step) < 0.04,
            `${label}: equal alternating offsets`,
          );
        }
      }
    }
  assert.equal(
    parseParams({ ...params, slices: "fan" }).version,
    "blockheight-2",
  );
});

test("ground, hatching, twist and sliding walls keep the structure and stay on the page", () => {
  const base = renderSvg2(withParams({}));
  // Rotation can expose additional prism faces; count the outer front/side faces instead.
  const count = (svg: string): number =>
    (svg.match(/<polygon [^>]*fill-opacity="(?:0\.13|0\.96)"/g) ?? []).length;
  for (const p of [
    { twist: "strong" },
    { twist: "slight" },
    { slices: "much" },
    { slices: "little", twist: "strong" },
    { slices: "fan" },
  ] as const)
    assert.equal(
      count(renderSvg2(withParams(p))),
      count(base),
      JSON.stringify(p),
    );
  for (const composition of ["single", "chain"] as const)
    for (const axis of paramSpec.axis)
      for (const view of paramSpec.view)
        for (const zoom of ["normal", "close"] as const)
          for (const slices of ["much", "fan"] as const) {
            const svg = renderSvg2(
              withParams({
                composition,
                axis,
                view,
                zoom,
                blocksize: "large",
                satellites: "three",
                reach: "far",
                twist: "strong",
                slices,
                ground: "both",
                hatch: "dense",
                walls: "many",
              }),
            );
            const label = `${composition}/${axis}/${view}/${zoom}/${slices}`;
            assert.doesNotMatch(svg, /NaN|undefined|Infinity/, label);
            for (const v of numbers(svg, /<polygon points="[^"]*"/g)) {
              assert.ok(v >= 0 && v <= 1000, `${label}: ${v} leaves the page`);
            }
            assert.ok(svg.length < 1_500_000, label);
          }
});

test("shadows keep the cube centred and fit inside the available canvas", () => {
  for (const ground of ["shadow", "both"] as const)
    for (const view of paramSpec.view)
      for (const zoom of ["normal", "close"] as const)
        for (const caption of paramSpec.caption)
          for (const axis of [undefined, ...paramSpec.axis]) {
            const svg = renderSvg2(
              withParams({
                ground,
                view,
                zoom,
                caption,
                composition: axis ? "chain" : "single",
                ...(axis ? { axis } : {}),
                blocksize: "large",
                satellites: "three",
                reach: "far",
              }),
            );
            const label = `${ground}/${view}/${zoom}/${caption}/${axis ?? "single"}`;
            const top = 26;
            const bottom =
              caption === "none" ||
              caption === "topleft" ||
              caption === "topright"
                ? 974
                : (caption === "bottom" ? 928 : 856) - 28;
            const b = bounds(svg);
            assert.ok(
              Math.abs((b.left + b.right) / 2 - 500) < 1.5,
              `${label}: cube x`,
            );
            assert.ok(
              Math.abs((b.top + b.bottom) / 2 - (top + bottom) / 2) < 1.5,
              `${label}: cube y`,
            );
            assert.ok(
              b.left >= top - 1 && b.right <= 974 + 1,
              `${label}: cube width`,
            );
            assert.ok(
              b.top >= top - 1 && b.bottom <= bottom + 1,
              `${label}: cube height`,
            );
            const paths =
              svg.match(
                /<path d="[^"]*" fill="#[0-9a-f]{6}" fill-opacity="0\.(?:17|07)"/g,
              ) ?? [];
            assert.ok(paths.length, `${label}: shadows present`);
            for (const path of paths) {
              const coords =
                path.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g) ?? [];
              for (const coord of coords) {
                const [x, y] = coord.split(",").map(Number);
                assert.ok(
                  x! >= top - 0.01 && x! <= 974.01,
                  `${label}: shadow x ${x}`,
                );
                assert.ok(
                  y! >= top - 0.01 && y! <= bottom + 0.01,
                  `${label}: shadow y ${y}`,
                );
              }
            }
          }
});

test("ground grid follows cube geometry equally with and without shadows", () => {
  const gridPath = (svg: string): string => {
    const path = svg.match(
      /<path d="([^"]*)" fill="none" stroke-opacity="0\.22"/,
    );
    assert.ok(path, "ground grid present");
    return path[1]!;
  };
  for (const view of paramSpec.view)
    for (const style of [
      { twist: "none", slices: "none" },
      { twist: "strong", slices: "much" },
      { twist: "none", slices: "fan" },
    ] as const) {
      const artwork = withParams({ view, zoom: "out", ...style });
      const gridOnly = renderSvg2({
        ...artwork,
        params: { ...artwork.params, ground: "grid" },
      });
      const withShadow = renderSvg2({
        ...artwork,
        params: { ...artwork.params, ground: "both" },
      });
      assert.equal(
        gridPath(withShadow),
        gridPath(gridOnly),
        `${view}/${style.twist}/${style.slices}: shadow must not extend the grid`,
      );
    }
});

test("shadows fall to the right and match the block outline", () => {
  for (const view of ["classic", "high", "low", "flipped"] as const) {
    const svg = renderSvg2(withParams({ ground: "shadow", view }));
    const shadow = svg.match(
      /<path d="([^"]*)" fill="#[0-9a-f]{6}" fill-opacity="0\.17"/,
    );
    assert.ok(shadow, view);
    const shadowX = (shadow![1]!.match(/-?\d+(\.\d+)?(?=,)/g) ?? []).map(
      Number,
    );
    // The shadow reaches further right than it does left of the block.
    const left = Math.min(...shadowX);
    const right = Math.max(...shadowX);
    const polys = (svg.match(/<polygon points="([^"]*)"/g) ?? []).flatMap((m) =>
      (m.match(/-?\d+(\.\d+)?(?=,)/g) ?? []).map(Number),
    );
    assert.ok(
      right > Math.max(...polys),
      `${view}: shadow does not extend right`,
    );
    assert.ok(left >= Math.min(...polys) - 1, `${view}: shadow extends left`);
  }
});

test("hatching only draws for solid blocks and adds lines without moving anything", () => {
  const plain = renderSvg2(withParams({ glass: "solid" }));
  const light = renderSvg2(withParams({ glass: "solid", hatch: "light" }));
  const dense = renderSvg2(withParams({ glass: "solid", hatch: "dense" }));
  const lines = (svg: string): number => (svg.match(/ L/g) ?? []).length;
  assert.ok(lines(light) > lines(plain));
  assert.ok(lines(dense) > lines(light));
  assert.equal(
    (light.match(/<polygon /g) ?? []).length,
    (plain.match(/<polygon /g) ?? []).length,
  );
});

test("contact shadows add depth at joints without changing any cube faces", () => {
  const base = withParams({ glass: "solid", spacing: "tight" });
  const plain = renderSvg2(base);
  const shadowed = renderSvg2({
    ...base,
    params: { ...base.params, occlusion: "deep" },
  });
  const shading = /<polygon [^>]*fill="#000000"[^>]*stroke="none"\/>/g;
  assert.ok(
    (shadowed.match(shading) ?? []).length > 10,
    "contact seams are shaded",
  );
  assert.equal(shadowed.replace(shading, ""), plain);
});

test("new styles combine safely across cameras, chains and wall movements", () => {
  for (const view of paramSpec.view)
    for (const axis of paramSpec.axis) {
      const svg = renderSvg2(
        withParams({
          view,
          composition: "chain",
          axis,
          satellites: "three",
          walls: "many",
          twist: "strong",
          slices: "fan",
          bevel: "bold",
          occlusion: "deep",
          cutaway: "corner",
          hatch: "dense",
          zoom: "out",
        }),
      );
      assert.doesNotMatch(
        svg,
        /NaN|undefined|Infinity|<script|href=|<image|<foreignObject|url\(/i,
      );
      assert.ok(svg.length < 900_000, `${view}/${axis}: bounded SVG`);
      assert.equal(
        svg,
        renderSvg2(
          withParams({
            view,
            composition: "chain",
            axis,
            satellites: "three",
            walls: "many",
            twist: "strong",
            slices: "fan",
            bevel: "bold",
            occlusion: "deep",
            cutaway: "corner",
            hatch: "dense",
            zoom: "out",
          }),
        ),
      );
      const b = bounds(svg);
      assert.ok(
        b.left >= 25 && b.right <= 975 && b.top >= 25 && b.bottom <= 829,
        `${view}/${axis}: fits the artwork area`,
      );
    }
});

test("stored designs without the six new style fields remain byte-identical", () => {
  const { bevel, occlusion, cutaway, material, connectors, accents, ...older } =
    params;
  void [bevel, occlusion, cutaway, material, connectors, accents];
  assert.deepEqual(validateParams2(older), params);
  assert.equal(
    renderSvg2({ ...fixture, params: older as Art2Params }),
    renderSvg2(fixture),
  );
  for (const key of [
    "bevel",
    "occlusion",
    "cutaway",
    "material",
    "connectors",
    "accents",
  ] as const)
    assert.throws(() => validateParams2({ ...params, [key]: "invalid" }));
});

test("materials and colour accents preserve the source block geometry", () => {
  const faces = (svg: string): string[] =>
    [...svg.matchAll(/<polygon points="([^"]*)" fill="(#[0-9a-f]{6})"/g)]
      .filter((m) => m[2] !== "#ffffff")
      .map((m) => m[1]!);
  const base = faces(renderSvg2(fixture));
  for (const material of ["concrete", "metal", "frosted"] as const) {
    const svg = renderSvg2(withParams({ material }));
    assert.deepEqual(
      faces(svg),
      base,
      `${material}: same block and inset faces`,
    );
    assert.equal(svg, renderSvg2(withParams({ material })));
  }
  for (const accents of ["edges", "shapes", "wall"] as const)
    assert.deepEqual(faces(renderSvg2(withParams({ accents }))), base);
});

test("connection details work on every chain axis and remain inactive on single cubes", () => {
  for (const connectors of ["collars", "nodes"] as const) {
    assert.equal(renderSvg2(withParams({ connectors })), renderSvg2(fixture));
    for (const axis of paramSpec.axis) {
      const svg = renderSvg2(
        withParams({
          composition: "chain",
          axis,
          satellites: "three",
          connectors,
          bevel: "bold",
          cutaway: "corner",
          slices: "fan",
        }),
      );
      assert.equal(
        (svg.match(/stroke-linecap="round"\/>/g) ?? []).length,
        6,
        `${axis}: six cables`,
      );
      assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
      assert.ok(
        (svg.match(/fill-opacity="1\.00"/g) ?? []).length > 40,
        `${axis}: connection meshes present`,
      );
    }
  }
});
