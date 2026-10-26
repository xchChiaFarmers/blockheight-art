# Make your first artwork

You need Node.js **24 or newer** (which includes npm), a terminal, a text editor and a browser. Check the version with `node --version`. There are no dependencies to install and no accounts, API keys or blockchain tools to configure.

## 1. Open the project

Clone the public repository, then open a terminal in its root directory (the directory containing `package.json`). Git is required for cloning; alternatively download the ZIP from GitHub and extract it.

```sh
git clone https://github.com/xchChiaFarmers/blockheight-art.git
cd blockheight-art
node --version
npm test
npm run render
```

If you downloaded the project elsewhere, use that directory instead. A successful render prints `Wrote examples/example.svg and examples/example.json`.

## 2. See the image

Open `examples/example.svg` in your browser, either by dragging it into the browser window or using File → Open. SVG is an editable vector image: it remains sharp when enlarged. The README also shows the committed example.

The accompanying `examples/example.json` is its recipe. Keep the recipe, SVG and renderer version together if you want to reproduce an image later. No web server or build is required.

## 3. Change the recipe

Copy `examples/example.json` to `my-artwork.json` using your file manager or editor. In the copy, change values inside `params`, for example:

```json
"palette": "c7",
"composition": "chain",
"ground": "grid"
```

These lines are edits within the existing object, not a complete JSON file. Keep all other fields. JSON requires double quotes and does not allow comments or trailing commas. Then run:

```sh
npm run render -- my-artwork.json out/my-artwork.svg
```

This writes `out/my-artwork.svg` and a copy of the recipe used, `out/my-artwork.json`. The `out/` folder is ignored by Git. Open the SVG in your browser and refresh it after each render. Use a new output name for every image you want to keep; rendering to an existing name overwrites it.

If you leave out the output name (`npm run render -- my-artwork.json`), the command overwrites the committed `examples/example.svg` and `examples/example.json`. Running `npm run render` without any input restores the built-in example.

Explore the option table in [README](../README.md). Start with palette, frame, view and composition. To change the underlying structure, try `structure`, `walls` or `blocksize`. A seed is a string of exactly 64 lowercase hexadecimal characters (`0`–`9`, `a`–`f`); keeping the seed and other inputs identical reproduces the same SVG. Block height must be a positive safe integer. It influences the design but does not fetch blockchain data.

## 4. Build on the code

The simplest entry point is `renderArtwork` in `src/shared/render.ts`. It returns an SVG string. `scripts/render.mjs` shows a complete working integration. Run your own script from the repository root with:

```sh
node --import ./scripts/typescript-loader.mjs your-script.mjs
```

The [README](../README.md#use-the-engine-from-code) has a short script you can copy. To draw real block events, see [render with block data](../README.md#render-with-block-data) and `examples/synthetic-digest.json`. Keep the `.js` import specifiers shown in the examples: the loader resolves them to TypeScript source files. Node strips TypeScript types at runtime. A browser or another build system needs its own TypeScript compilation/bundling; this repo is not a prebuilt browser application or published npm package.

Read [engine design](art-engine.md), [contributing](../CONTRIBUTING.md) and [agent guide](../AGENTS.md) before changing renderer behavior. You can use, modify and distribute the code under [MIT](../LICENSE), including commercially, while retaining its required notice.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `node` or `npm` not found | Install Node 24 or newer and open a new terminal. |
| `package.json` not found | Run commands from this repository's root. |
| Import/hook/TypeScript error | Check `node --version`; use the npm scripts or the documented `--import` command. |
| Input file not found | The recipe path is relative to your terminal's current directory. |
| JSON parsing error | Check quotes, commas and braces; start again from the generated recipe. |
| `Invalid artwork`, `Invalid art parameters` or `Invalid chain digest` | Check seed, height, renderer version and option values; keep all default fields. A digest's `height` must equal `blockHeight`. |
| No block annotations | A generic design has no digest. Add a `chain` digest (see `examples/synthetic-digest.json`) and set `annotations` to `full`; this project does not fetch block data. |
| Image appears unchanged | Refresh the browser and check you opened the output file named by the command. |

Tests run offline. They do not check TypeScript types or verify a live blockchain connection. See [validation](validation.md) for the actual verification scope.
