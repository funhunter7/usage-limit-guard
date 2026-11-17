import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldBlockStop } from '../lib/stopGuard.mjs';

function fakeFs() {
  const store = { data: undefined };
  return {
    store,
    readFile: () => { if (store.data === undefined) throw new Error('ENOENT'); return store.data; },
    writeFile: (_p, data) => { store.data = data; },
    path: '/fake/marker.json',
  };
}

test('shouldBlockStop: first time for a window -> block and record', () => {
  const fs = fakeFs();
  assert.equal(shouldBlockStop('2026-05-31T15:00:00Z', fs), true);
  assert.match(fs.store.data, /2026-05-31T15:00:00Z/);
});

test('shouldBlockStop: same window again -> allow (no re-block)', () => {
  const fs = fakeFs();
  shouldBlockStop('W1', fs);
  assert.equal(shouldBlockStop('W1', fs), false);
});

test('shouldBlockStop: a new window -> block again', () => {
  const fs = fakeFs();
  shouldBlockStop('W1', fs);
  assert.equal(shouldBlockStop('W2', fs), true);
});

test('shouldBlockStop: unreadable marker -> block', () => {
  const fs = fakeFs(); // readFile throws (no data)
  assert.equal(shouldBlockStop('W1', fs), true);
});

test('shouldBlockStop: two interleaved keys (concurrent sessions) each block only once', () => {
  const fs = fakeFs();
  assert.equal(shouldBlockStop('A', fs), true);
  assert.equal(shouldBlockStop('B', fs), true);
  assert.equal(shouldBlockStop('A', fs), false);
  assert.equal(shouldBlockStop('B', fs), false);
});

test('shouldBlockStop: marker is bounded to the 20 most recent keys', () => {
  const fs = fakeFs();
  for (let i = 0; i < 25; i++) shouldBlockStop(`K${i}`, fs);
  const keys = JSON.parse(fs.store.data).keys;
  assert.equal(keys.length, 20);
  assert.equal(keys[19], 'K24');
});

test('shouldBlockStop: legacy single-window marker is still honoured', () => {
  const fs = fakeFs();
  fs.store.data = JSON.stringify({ window: 'OLD' });
  assert.equal(shouldBlockStop('OLD', fs), false);
  assert.equal(shouldBlockStop('NEW', fs), true);
});
