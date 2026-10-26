// Usage: npm run render [-- input.json [output.svg]]
// Without arguments, renders the built-in example to examples/example.svg.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { renderArtwork } from '../src/shared/render.js';
import { studioDefaults } from '../src/shared/studio-defaults.js';

const [input, output = 'examples/example.svg'] = process.argv.slice(2);
const recipe = output.replace(/\.svg$/i, '') + '.json';
const artwork = input
  ? JSON.parse(await readFile(input, 'utf8'))
  : { seed: 'ab'.repeat(32), blockHeight: 2814440,
      rendererVersion: 'blockheight-4', params: studioDefaults };
const svg = renderArtwork(artwork);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, svg);
await writeFile(recipe, JSON.stringify(artwork, null, 2) + '\n');
console.log(`Wrote ${output} and ${recipe}`);
