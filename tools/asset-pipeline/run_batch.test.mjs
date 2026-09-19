import assert from 'node:assert/strict';
import { test } from 'vitest';
import { runBatch } from './run_batch.mjs';

const options = { root: '/repo', statePath: '/state.json' };
function fake(status) {
  const state = { credits_per_asset: 30, assets: { tree: { status } } };
  const calls = [];
  return { state, calls, bridge: {
    async command(args) {
      const command = args[2];
      if (command === 'show') return JSON.stringify(state);
      if (command === 'verified') return JSON.stringify(state.assets.tree);
      if (command === 'reserve') {
        state.assets.tree.status = 'SUBMISSION_UNCERTAIN';
        return JSON.stringify({ tool: 'meshy_image_to_3d', arguments: {} });
      }
      throw new Error(`Unexpected command ${command}`);
    },
    async call(name) {
      calls.push(name);
      if (name === 'meshy_check_balance') return { balance: 970 };
      throw new Error('Transport disconnected after server may have accepted request');
    },
    async progress() {},
  } };
}

test('default run never spends, even when assets are READY', async () => {
  const f = fake('READY'); await runBatch(f.bridge, options); assert.deepEqual(f.calls, []);
});
test('uncertain submission is never retried on resume', async () => {
  const f = fake('READY');
  await assert.rejects(runBatch(f.bridge, { ...options, allowGeneration: true }), /Transport/);
  await assert.rejects(runBatch(f.bridge, { ...options, allowGeneration: true }), /uncertain/);
  assert.equal(f.calls.filter(n => n === 'meshy_image_to_3d').length, 1);
});
test('completed batch replay invokes no Meshy or Blender calls', async () => {
  const f = fake('VERIFIED'); await runBatch(f.bridge, { ...options, allowGeneration: true });
  assert.deepEqual(f.calls, []);
});
test('failed task is reported, never regenerated', async () => {
  const f = fake('FAILED');
  await assert.rejects(runBatch(f.bridge, { ...options, allowGeneration: true }), /no regeneration/);
  assert.deepEqual(f.calls, []);
});
