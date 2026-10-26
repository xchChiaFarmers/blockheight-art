# Agent guide

Read `README.md`, `docs/getting-started.md`, `docs/art-engine.md` and this file before changing code. This is a standalone, offline generative SVG engine extracted from BlockHeight. The goal is to make the artwork understandable, reusable and easy to extend.

## Project naming

Use **BlockHeight** consistently as the project name in documentation, examples and user-facing text. Preserve source provenance through stable repository IDs and recorded Git hashes.

## Scope and architecture

- `src/shared/render.ts`: public version dispatcher (`renderArtwork`) and parameter parsing.
- `src/shared/art.ts`: renderer 1 plus PRNG, glyph and formatting helpers reused by later versions.
- `src/shared/art2.ts`: renderers 2–4, parameter schema (`paramSpec`), validation and scene construction. Despite the filename, this contains the current renderer.
- `palettes.ts`, `geometry.ts`, `annotations.ts`, `event-layout.ts`: palette, mesh, label and event placement helpers.
- `digest.ts`: supplied block-data contract and structural validation. It does not authenticate blockchain data.
- `studio-defaults.ts`: options used by the runnable example.
- `scripts/render.mjs`: JSON recipe to SVG file (`npm run render -- input.json [output.svg]`); `scripts/typescript-loader.mjs`: Node 24 import resolver for upstream `.js` specifiers targeting `.ts` sources.
- `docs/provenance.json`: original upstream tree and Git blob IDs. These identify the extraction baseline, not future edited contents.

No wallet, RPC client, database, payment, minting, server, PNG rasterizer or browser studio is included. `composition: chain` means connected visual blocks; it does not enable blockchain access. Version 3 requires a digest; version 4 accepts one optionally.

## Commands and validation

Use Node 24 or newer and npm. No installation, credentials, build or dependency downloads are needed.

```sh
npm test
npm run render
npm run render -- examples/synthetic-digest.json examples/synthetic-digest.svg
git diff --exit-code -- examples/
git diff --check
```

The example diff should be empty for changes that preserve default rendering. Inspect intentional differences rather than accepting regenerated files automatically. Tests use Node's native TypeScript stripping; this is runtime execution, **not TypeScript type checking**. There is currently no tsc, lint or browser-test gate. Run individual tests with `node --import ./scripts/typescript-loader.mjs tests/versions.test.ts`.

## Rendering contracts

Existing renderer versions are immutable: preserve exact SVG bytes for existing valid inputs. Golden hashes are regression evidence; never replace them just to make a test pass. A deliberate output change requires a new renderer version, dispatch support and tests retaining old behavior. Shared helpers and palettes affect multiple versions: changing them in place can break archival output.

Keep rendering pure, bounded and deterministic. Do not introduce ambient randomness, time, locale-sensitive formatting, remote assets or platform fonts. Validate new parameters at the runtime boundary; TypeScript types alone do not validate JSON. Keep rendering modules free of Node/browser-specific APIs so downstream consumers can reuse them.

For a new option, review schema/defaults, validation, versioned behavior, documentation and behavioral/golden coverage together. Optional historical fields must preserve prior defaults. Keep synthetic test digests clearly labeled; they are not evidence of real chain events.

## Test coverage and extraction limits

The copied tests cover versions 1 and 2, annotations, geometry, event layout and formatting. `tests/versions.test.ts` adds the upstream version-4 plain golden hash and synthetic digest tests for versions 3 and 4. The original comprehensive art3/art4 suites depended on upstream chain classification and raw block fixtures and were not extracted. Do not claim equivalent coverage or full upstream verification.

The old browser prototype, branding/reference images and all private application history were excluded. Consult `docs/extraction-plan.md` for extraction scope. `private: true` in package.json prevents accidental npm publication; it does not prevent a public GitHub repository. MIT applies to this repository's code, docs and example outputs, not automatically to other BlockHeight assets or trademarks.
