import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activate } from '../src/mod.mjs';

test('direct handlers only forward advertised fields and retain fixed operation/action', async () => {
  const tools = new Map();
  const diagnostics = [];
  const management = [];
  activate({
    tools: { register: tool => tools.set(tool.name, tool) },
    runtimeDiagnostics: { read: async input => diagnostics.push(input) },
    modManagement: Object.fromEntries(['inventory', 'submit', 'refresh', 'operation'].map(method => [method, async input => management.push({ method, input })])),
  });
  await tools.get('burrow_inventory').handler({ operation: 'trace', runId: 'private' }, {});
  assert.deepEqual(diagnostics, [{ operation: 'inventory' }]);
  for (const action of ['install', 'update']) {
    await tools.get(`burrow_${action}_mod`).handler({ modId: 'fixture', version: '1.2.3', action: 'uninstall', sourceUrl: 'forbidden' });
    assert.deepEqual(management.at(-1), { method: 'submit', input: { action, modId: 'fixture', version: '1.2.3' } });
  }
  await tools.get('burrow_mod_management_inventory').handler({ limit: 3, action: 'install', sourceUrl: 'forbidden' });
  assert.deepEqual(management.at(-1), { method: 'inventory', input: { limit: 3 } });
});

test('generic API handler only forwards request fields, never model-supplied authority or transport options', async () => {
  const tools = new Map();
  const calls = [];
  activate({
    tools: { register: tool => tools.set(tool.name, tool) },
    coreApi: { request: async (input, options) => calls.push({ input, options }) },
  });
  const signal = new AbortController().signal;
  const input = { method: 'POST', path: '/api/future/route?query=preserved', headers: { 'x-custom': ['one', 'two'] }, body: { nested: { agentId: 'ordinary-route-data' } } };
  await tools.get('burrow_api_request').handler({
    ...input, agentId: 'forged-admin', caller: { agentId: 'forged-admin' }, ownerModId: 'other-mod',
    signal: 'forged-signal', global: true, assertCallerActive: false, maxResponseBytes: 1,
    url: 'https://outside.invalid', operation: 'unrelated',
  }, { agentId: 'trusted-caller', signal });
  assert.deepEqual(calls, [{ input, options: { signal } }]);
  assert.strictEqual(calls[0].input.body, input.body, 'arbitrary JSON route data is not sanitized');
});
