# Artwork engine

The engine turns an explicit input record into SVG. Its geometry draws from an architectural vocabulary of divided walls, unequal cells, stacked forms, inset shapes, frames, captions, and optional linked blocks. A fixed isometric projection and embedded line glyphs keep the output independent of browser fonts and GPU rendering.

## Input and output

An artwork input contains a lowercase 64-character hexadecimal seed, a positive safe integer block height, an exact renderer version, and a validated parameter object. Version 3 requires a validated `ChainDigest` value; version 4 optionally accepts one as plain data. The height is an artwork identifier and input to the artistic pseudorandom sequence; by itself it does not prove that the corresponding blockchain block was read.

The renderer returns UTF-8 SVG text. The renderer does not rasterize PNGs, read chain data, issue seeds, access a database, contact a mint provider, or persist assets. A caller may provide a digest obtained elsewhere; the engine only validates and draws it.

## Deterministic rendering

The renderer uses explicit integer pseudorandom operations and fixed numeric formatting. The complete validated input determines the SVG bytes. SVG output uses fixed element and attribute ordering and does not embed scripts, remote resources, external fonts, filters, or caller-provided markup.

The artistic pseudorandom generator exists for reproducible composition, not security. Seed creation and authorization must be handled by an application with an appropriate cryptographic source. A different seed is not a promise of a mathematically unique-looking image.

The current version, `blockheight-4`, isolates color and cell-material choices from the wall-layout random stream. Changes to palette, mix, glass, and inner-shape choices therefore leave the wall arrangement stable. Structure, wall count, and block size are among the controls that can change the arrangement. Caption ink targets a contrast ratio of at least 4.5:1 against the paper color.

## Version history

- `blockheight-1` is the smaller three-option renderer in `src/shared/art.ts`.
- `blockheight-2` added the broader design controls in `src/shared/art2.ts`.
- `blockheight-3` added rendering of a supplied block digest and event forms.
- `blockheight-4` is the current renderer. It keeps material and color choices independent of the wall layout and draws a quieter, readable caption. It can render a caller-supplied digest using the same event-shape model as version 3.

Previously issued versions remain available through `renderArtwork` in `src/shared/render.ts`. Treat their emitted bytes as immutable. Any intentional byte change needs a new version and retained support for earlier inputs; do not silently update expected output for work already distributed.

## Block data

`src/shared/digest.ts` defines and validates the compact data shape that versions 3 and 4 can consume. It describes counts and categories already computed by a caller. It contains no RPC code. Event shapes are symbolic: they visualize supplied categories and counts, rather than reproducing every transaction or coin spend.

The `eventlayout` option controls how symbols occupy their host pane: `elongated` stretches a symbol along the pane, `tiled` distributes up to 48, and `stacked` distributes up to 96 over as many as three depth layers. `none` retains the classic event layout when a digest is supplied; it does not disable event shapes. Without a digest, version 4 draws a purely generative design. Actual symbol counts are bounded by the provided digest and the layout capacity.

## Related files

- `src/shared/art.ts` — `blockheight-1` and common deterministic drawing helpers
- `src/shared/art2.ts` — versions 2 through 4 and their design controls
- `src/shared/render.ts` — dispatch by the version stored in the input
- `src/shared/geometry.ts` — mesh and shape geometry helpers
- `src/shared/event-layout.ts` — layout for symbolic event shapes
- `src/shared/annotations.ts` — block callouts and explanatory labels
- `src/shared/digest.ts` — validated digest data contract
- `src/shared/palettes.ts` — palette definitions
- `src/shared/studio-defaults.ts` — default current option values
- `tests/` — deterministic output and behavior checks
