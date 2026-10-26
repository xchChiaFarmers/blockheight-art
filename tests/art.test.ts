import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  renderSvg,
  validateParams,
  paletteIds,
  type Artwork,
} from "../src/shared/art.js";

const fixture: Artwork = {
  seed: "0".repeat(64),
  blockHeight: 2584772,
  rendererVersion: "blockheight-1",
  params: { palette: "mineral", density: "quiet", composition: "single" },
};
const hash = (art: Artwork): string =>
  createHash("sha256").update(renderSvg(art)).digest("hex");

test("blockheight-1 golden masters pin all palette and density variants", () => {
  const expected = [
    "cddd99a1510ade214416319609311eb17b9ad992024f078e6237ca01d8a136aa",
    "1db6ee964592ccb252d8cbee77abf403ce48ab706ed4f0f400ae3333fb2b040a",
    "cf546245ca0b59e876b2933ac40875c97b582701c2f26bb00d2a0ecf23ccf006",
  ];
  paletteIds.forEach((palette, i) =>
    assert.equal(
      hash({
        ...fixture,
        seed: String(i).repeat(64),
        params: {
          palette,
          density: i === 0 ? "quiet" : i === 1 ? "layered" : "dense",
          composition: i === 1 ? "chain" : "single",
        },
      }),
      expected[i],
    ),
  );
});

test("render is pure, repeatable and independent of call order", () => {
  const original = structuredClone(fixture);
  const svg = renderSvg(fixture);
  renderSvg({ ...fixture, seed: "f".repeat(64) });
  assert.equal(renderSvg(fixture), svg);
  assert.deepEqual(fixture, original);
  assert.notEqual(hash(fixture), hash({ ...fixture, seed: "1".repeat(64) }));
  assert.notEqual(
    hash(fixture),
    hash({ ...fixture, blockHeight: fixture.blockHeight + 1 }),
  );
});

test("strict parameter schema rejects arbitrary fields, prototype values and coercion", () => {
  assert.deepEqual(validateParams(fixture.params), fixture.params);
  for (const invalid of [
    null,
    [],
    {},
    { ...fixture.params, url: "https://example.com" },
    { ...fixture.params, seed: "custom" },
    { ...fixture.params, palette: "neon" },
    { ...fixture.params, density: { toString: () => "quiet" } },
    Object.create(fixture.params),
  ])
    assert.throws(() => validateParams(invalid));
});

test("art identifiers cannot become SVG markup or invalid coordinates", () => {
  for (const seed of [
    "",
    "<script>",
    "A".repeat(64),
    "0".repeat(63),
    "0".repeat(65),
  ])
    assert.throws(() => renderSvg({ ...fixture, seed }));
  for (const blockHeight of [
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.throws(() => renderSvg({ ...fixture, blockHeight }));
  assert.throws(() =>
    renderSvg({
      ...fixture,
      rendererVersion: "unknown" as Artwork["rendererVersion"],
    }),
  );
});

test("every allowed composition is self-contained vector art with bounded output", () => {
  for (const palette of paletteIds)
    for (const density of ["quiet", "layered", "dense"] as const)
      for (const composition of ["single", "chain"] as const) {
        const svg = renderSvg({
          ...fixture,
          params: { palette, density, composition },
        });
        assert.match(svg, /^<svg /);
        assert.match(svg, /<title>BlockHeight/);
        assert.doesNotMatch(
          svg,
          /<(script|image|foreignObject|text)\b|href=|style=|NaN|Infinity/,
        );
        assert.ok(svg.length < 200_000);
        assert.ok((svg.match(/<polygon /g)?.length ?? 0) > 50);
      }
});
