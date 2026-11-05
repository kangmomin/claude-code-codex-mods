import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { discoverModels, registerModels } from '../mods.mjs';
import { MODELS } from '../vendor/cc-multi-cli-plugin/plugins/multi-openai/src/models.ts';
import { prepareOpenAIRequest } from '../vendor/cc-multi-cli-plugin/plugins/multi-openai/src/gateway-request.ts';

test('live catalog handles handshake, pagination, and hidden models', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'mods-models-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const executable = join(dir, 'codex');
  await writeFile(executable, `#!/usr/bin/env node
const rl = require('node:readline').createInterface({ input: process.stdin });
rl.on('line', line => {
  const r = JSON.parse(line);
  if (r.method === 'initialize') console.log(JSON.stringify({ id: r.id, result: {} }));
  if (r.method === 'model/list') {
    if (r.params.includeHidden !== false) process.exit(2);
    const page = r.params.cursor
      ? { data: [{ model: 'gpt-live-b' }, { model: 'gpt-hidden', hidden: true }], nextCursor: null }
      : { data: [{ model: 'gpt-live-a', isDefault: true }], nextCursor: 'page2' };
    console.log(JSON.stringify({ id: r.id, result: page }));
  }
});
`, { mode: 0o700 });
  const models = await discoverModels(executable);
  assert.deepEqual(models.map(m => m.model), ['gpt-live-a', 'gpt-live-b']);
});

test('discovery failure is explicit and never returns stale fixed models', async () => {
  await assert.rejects(discoverModels('/missing/codex'), /unavailable/);
});

test('the same live registry admits requests and removes stale IDs', () => {
  const saved = { ...MODELS };
  try {
    registerModels(MODELS, [{ model: 'gpt-live-a' }]);
    const input = { method: 'POST', pathname: '/v1/messages/count_tokens',
      body: { model: 'multi/openai/gpt-live-a', max_tokens: 32,
        messages: [{ role: 'user', content: 'hello' }] }, fallbackSession: 'unit-test' };
    assert.equal(prepareOpenAIRequest(input, 'multi/openai/gpt-live-a', '/unused/auth.json').label, 'OpenAI');
    assert.throws(() => prepareOpenAIRequest(input, 'multi/openai/gpt-6-astra', '/unused/auth.json'), /Unknown/);
  } finally {
    for (const key of Object.keys(MODELS)) delete MODELS[key];
    Object.assign(MODELS, saved);
  }
});
