import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderArtwork } from '../src/shared/render.js';
import { studioDefaults } from '../src/shared/studio-defaults.js';
import { eventCategories } from '../src/shared/digest.js';

test('current renderer retains the upstream plain golden hash', () => {
  const art = {seed: '0'.repeat(64), blockHeight: 2814440,
    rendererVersion: 'blockheight-4', params: studioDefaults};
  const svg = renderArtwork(art);
  assert.equal(createHash('sha256').update(svg).digest('hex'),
    '3d3fdf86f82b8ee34d2b156e0f0050326df0d59b369493fef19bf5b763ca41e5');
  assert.equal(svg, renderArtwork(structuredClone(art)));
});

test('chain renderers accept offline synthetic digests and reject height mismatches', () => {
  const chain = {version: 2, height: 100, headerHash: 'ab'.repeat(32),
    transactionBlock: true, timestamp: 1700000000, fees: '123',
    rewards: {farmer: 1, pool: 1}, spends: 13, tokens: 1,
    events: Object.fromEntries(eventCategories.map(key => [key, 1]))};
  for (const rendererVersion of ['blockheight-3', 'blockheight-4']) {
    const art = {seed: 'ab'.repeat(32), blockHeight: 100, rendererVersion,
      params: {...studioDefaults, annotations: 'full', eventlayout: 'tiled'}, chain};
    const svg = renderArtwork(art);
    assert.match(svg, /<svg/);
    assert.equal(svg, renderArtwork(structuredClone(art)));
    assert.throws(() => renderArtwork({...art, blockHeight: 101}));
  }
});
