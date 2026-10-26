# Validation record

Initial import verified locally on 2026-10-24 with Node v24.19.0. Re-checked on 2026-10-25 with Node v24.22.1 and v26.12.1: all 44 tests passed and both examples rendered byte for byte.

## Executed checks

- All **44 individual tests** in seven files passed when run directly with the TypeScript loader: annotations (3), renderer 1 (5), renderer 2 (28), event layout (1), format (1), geometry (4), version dispatch/current renderer (2).
- `npm test` passed in a fresh temporary copy with no installed dependencies.
- `npm run render` in that copy reproduced the committed default SVG byte for byte.
- The beginner workflow was exercised: copy the default recipe, change palette to `c7`, composition to `chain` and ground to `grid`, then render the custom input. The SVG changed and its accompanying JSON matched the supplied recipe. Rendering without arguments restored the original SVG bytes.
- All 16 copied source/test files match the original Git blob IDs recorded in `provenance.json`.
- Relative Markdown links resolve to existing local files.
- `examples/synthetic-digest.json` renders a `blockheight-4` artwork with made-up digest data, annotations and the tiled event layout; its SVG was checked visually in Chromium.

Node's test-runner output in this environment summarizes seven test files. Running the files directly also verified the 44 individual test cases within them.

## Limits

Runtime tests use Node's native TypeScript stripping. They do not perform static TypeScript checking. No `tsc`, linter, PNG pipeline, browser rendering/accessibility suite or live blockchain test is configured in this standalone repository. The example was generated and its bytes checked; no visual browser acceptance is claimed.

Original upstream art3/art4 integration suites depended on chain classification and raw block fixtures and were not included. Standalone coverage includes the original version-4 plain SVG golden hash and synthetic digest tests for versions 3/4, but is not equivalent to those larger upstream suites. Synthetic digests are test data, not authenticated block records.

GitHub Actions runs `npm test`, renders both examples and fails if they differ from the committed files. The first run on `main` passed. CI uses Node 24 only. No upstream application files or private Git history are included.
