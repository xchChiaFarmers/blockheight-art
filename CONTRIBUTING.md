# Contributing

Thanks for helping improve BlockHeight Artwork. Keep changes focused on the standalone artwork package and its deterministic SVG output.

## Requirements

- Node.js 24 or newer (CI uses 24; 26 has also been checked)
- npm

The package has no runtime or development dependencies. Its test command uses Node's built-in test runner and a local loader that resolves the source's relative `.js` import specifiers to TypeScript files.

## Before submitting a change

Run the suite and regenerate the example when you change the renderer:

```sh
npm test
npm run render
npm run render -- examples/synthetic-digest.json examples/synthetic-digest.svg
git diff --exit-code -- examples/
```

CI runs the same commands. For changes that keep existing output, the example diff must be empty. Review each example SVG and its JSON recipe together. The input record makes the generated output reproducible and reviewable.

## Renderer changes

Treat each renderer version as an immutable byte-level contract. If a change alters SVG bytes for existing input, add a new renderer version and retain old-version behavior. Update meaningful tests for the intended behavior and make any output change explicit in the review description.

Keep the engine deterministic across machines: avoid font-dependent drawing, locale-sensitive formatting, ambient randomness, timestamps, and network access. Validate caller-provided data at the rendering boundary. A block digest may be supplied as data, but chain access, seed issuance, minting, persistence, and application security belong in the calling application.

## Scope and license

This repository packages the artwork engine, its documentation, tests, and generated examples. Do not add application services or upstream operational configuration as part of an artwork change. Contributions to code, docs, and output examples are offered under the MIT License.

Read [AGENTS.md](AGENTS.md) for module responsibilities, renderer-version rules and test coverage limits. For a first run, see [getting started](docs/getting-started.md). Native TypeScript execution strips types; it does not perform static type checking.
