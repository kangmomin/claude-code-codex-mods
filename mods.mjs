import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('./', import.meta.url);
const provider = new URL('vendor/cc-multi-cli-plugin/plugins/multi-openai/src/models.ts', root);

// Read model availability through Codex's own logged-in app-server, never OAuth files.
export async function discoverModels(executable = 'codex') {
  const child = spawn(executable, ['app-server'], { stdio: ['pipe', 'pipe', 'ignore'] });
  const lines = createInterface({ input: child.stdout });
  const stop = () => { lines.close(); child.kill(); };
  child.on('error', stop);
  child.stdin.on('error', stop);
  let bytes = 0;
  child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 1024 * 1024) stop(); });
  const timer = setTimeout(stop, 20000);
  const send = message => child.stdin.write(JSON.stringify(message) + '\n');
  send({ id: 1, method: 'initialize', params: {
    clientInfo: { name: 'claude_chatgpt_models', version: '0.1.0' },
  }});
  const models = new Map();
  let requestId = 2;
  const seenCursors = new Set();
  try {
    for await (const line of lines) {
      const message = JSON.parse(line);
      if (message.error) throw new Error('Codex model/list failed; check codex login and connection.');
      if (message.id === 1 && message.result) {
        send({ method: 'initialized' });
        send({ id: requestId, method: 'model/list', params: { limit: 100, includeHidden: false } });
      } else if (message.id === requestId && message.result) {
        for (const model of message.result.data) {
          if (!model.hidden && typeof model.model === 'string' && model.model.startsWith('gpt-')) {
            models.set(model.model, model);
          }
        }
        const cursor = message.result.nextCursor;
        if (!cursor) {
          if (!models.size) throw new Error('Codex returned no visible GPT models.');
          return [...models.values()];
        }
        if (seenCursors.has(cursor)) throw new Error('Codex returned a repeated pagination cursor.');
        seenCursors.add(cursor);
        send({ id: ++requestId, method: 'model/list', params: { limit: 100, includeHidden: false, cursor } });
      }
    }
    throw new Error('Codex model/list unavailable or timed out; run codex login and retry.');
  } finally {
    clearTimeout(timer);
    child.stdin.destroy();
    stop();
  }
}

export function registerModels(registry, models) {
  // The pinned upstream exports one registry used by BOTH its picker and request allowlist.
  // Fill that same object before loading its launcher, so newly available IDs can run.
  for (const key of Object.keys(registry)) delete registry[key];
  for (const model of models) registry[model.model] = model.model;
}

async function main() {
  const models = await discoverModels();
  await mkdir(new URL('.state/', root), { recursive: true, mode: 0o700 });
  await writeFile(new URL('.state/codex-models.json', root), JSON.stringify({
    fetchedAt: new Date().toISOString(), source: 'codex app-server model/list', models,
  }, null, 2) + '\n', { mode: 0o600 });
  if (process.argv[2] === '--list') {
    for (const model of models) {
      console.log(`${model.model}${model.isDefault ? ' (Codex default)' : ''}`);
    }
    return;
  }
  const { MODELS } = await import(provider.href);
  registerModels(MODELS, models);
  const args = process.argv.slice(2);
  const chosen = models.find(model => model.isDefault) ?? models[0];
  if (!args.some(arg => arg === '--model' || arg.startsWith('--model=') || arg === '-m')) {
    args.push('--model', `multi/openai/${chosen.model}`);
  }
  console.error(`Live Codex catalog: ${models.length} GPT models. Claude Mods integration active.`);
  process.env.MULTI_ENABLED_PROVIDERS = 'openai';
  process.env.MULTI_MODELS = 'all';
  const launcher = new URL('vendor/cc-multi-cli-plugin/plugins/multi-core/src/launcher.ts', root);
  process.argv = [process.execPath, fileURLToPath(launcher), ...args];
  await import(launcher.href);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
