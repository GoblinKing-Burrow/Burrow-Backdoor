import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const core = path.resolve(process.env.BURROW_CORE_ROOT || fileURLToPath(new URL('../../../Burrow-HC/Burrow-Backend/', import.meta.url)));
const runtimePath = path.join(core, 'src', 'mod-runtime.mjs');
// Explicit paths and CI are contracts, not optional local discovery.
if (!existsSync(runtimePath) && (process.env.CI || process.env.BURROW_CORE_ROOT)) {
  throw new Error(`Required Burrow Core checkout unavailable at ${core}`);
}

function managementFixture(calls) {
  return Object.fromEntries(['inventory', 'submit', 'operation'].map(method => [method, async (input, options) => {
    calls.push({ method, input, options });
    return method === 'inventory' ? { ok: true, mods: [], sources: [], pagination: { nextOffset: null } }
      : { ok: true, operation: { id: '00000000-0000-4000-8000-000000000001', status: method === 'operation' ? 'succeeded' : 'queued' } };
  }]));
}

test('actual Core loads Backdoor with caller-scoped diagnostics and independently authorized management and full API', { skip: !existsSync(runtimePath) && `Burrow Core checkout unavailable at ${core}` }, async (t) => {
  const { loadMods, cleanupMods, createModRoute } = await import(runtimePath);
  const root = await mkdtemp(path.join(os.tmpdir(), 'backdoor-mod-'));
  const modRoot = path.join(root, 'mods', 'burrow-backdoor');
  await mkdir(modRoot, { recursive: true });
  for (const entry of ['burrow.mod.json', 'src', 'ui']) await cp(new URL(`../${entry}`, import.meta.url), path.join(modRoot, entry), { recursive: true });
  const settings = new Map([['unrelated', { preserved: true }]]);
  const diagnosticAgentIds = ['diagnostic'];
  const adminAgentIds = ['admin'];
  const grants = ['mod-management-v1', 'core-api-v1'];
  const modAuthority = {
    read: async () => ({ grants, adminAgentIds, diagnosticAgentIds }),
    allowed: async (_modId, capability, agentId) => capability === 'diagnostics-global' ? diagnosticAgentIds.includes(agentId) : grants.includes(capability) && adminAgentIds.includes(agentId),
    assertAllowed: async (_modId, capability, agentId) => {
      if (grants.includes(capability) && adminAgentIds.includes(agentId)) return;
      throw new Error('mod_authority_forbidden');
    },
  };
  const diagnosticCalls = [];
  const managementCalls = [];
  const apiCalls = [];
  const apiBody = { privateContent: 'fixture-private-'.repeat(5000), futureField: true };
  const apiResult = { ok: true, status: 200, headers: { 'content-type': 'application/json', 'x-future-header': ['one', 'two'] }, body: apiBody, encoding: 'json', byteLength: Buffer.byteLength(JSON.stringify(apiBody)) };
  const apiResponses = new Map();
  const mods = await loadMods({
    runtimeRoot: root,
    enabledModIds: async () => ['burrow-backdoor'],
    modStoreFactory: async () => ({
      get: async (name, fallback) => settings.has(name) ? settings.get(name) : fallback,
      set: async (name, value) => (settings.set(name, value), value),
      delete: async (name) => settings.delete(name),
      close: async () => {},
    }),
    modCatalogWriter: async () => {},
    resolveAgentRuntime: async (id) => ({ agentId: id }),
    stores: {
      agents: { get: async (id) => ({ id, enabled: true }), list: async () => [{ id: 'one', name: 'One', enabled: true }, { id: 'diagnostic', name: 'Diagnostic', enabled: true }, { id: 'admin', name: 'Admin', enabled: true }] },
      models: {}, scheduledJobs: {}, conversations: {},
    },
    runtimeDiagnostics: { read: async (input, options) => (diagnosticCalls.push({ input, options }), { effectiveAgentId: input.agentId || options.caller.agentId, global: options.global }) },
    modManagement: managementFixture(managementCalls),
    coreApi: { request: async (input, options) => (apiCalls.push({ input, options }), apiResponses.get(input.path) || apiResult) },
    modAuthority,
    logger: { warn() {}, error() {} },
  });
  t.after(async () => { await cleanupMods(mods); await rm(root, { recursive: true, force: true }); });
  const mod = mods[0];
  assert.equal(mod.status, 'loaded', mod.error);
  assert.equal(mod.manifest.name, 'Backdoor');
  assert.equal(mod.manifest.contributions.settings[0].navigation.title, 'Backdoor');
  assert.equal(mod.manifest.contributions.settings[0].primary.title, 'Backdoor');
  assert.equal(mod.manifest.system, true);
  assert.deepEqual(mod.systemCapabilities, ['mod-management-v1', 'core-api-v1']);
  assert.equal(mod.tools.length, 35);
  assert.ok(mod.tools.every((tool) => tool.availability === 'mod-authorized'));

  assert.deepEqual(await mod.host.invokeTool('burrow_list_sessions', {}, { agentId: 'one', sessionId: 'own' }), { effectiveAgentId: 'one', global: false });
  assert.deepEqual(await mod.host.invokeTool('burrow_list_sessions', { agentId: 'two' }, { agentId: 'diagnostic', sessionId: 'own' }), { effectiveAgentId: 'two', global: true });
  assert.deepEqual(diagnosticCalls.map(({ options }) => [options.caller.agentId, options.global]), [['one', false], ['diagnostic', true]]);

  // Host schema validation rejects before any diagnostic, distribution or Core API capability runs.
  for (const [tool, input] of [
    ['burrow_inventory', { operation: 'trace', runId: 'other' }],
    ['burrow_list_sessions', { limit: '10' }],
    ['burrow_list_sessions', { limit: 201 }],
    ['burrow_get_trace', {}],
    ['burrow_install_mod', { modId: 'fixture', action: 'uninstall' }],
    ['burrow_update_mod', { modId: 'fixture', action: 'install' }],
    ['burrow_install_mod', { modId: 'fixture', version: 'not-a-version' }],
    ['burrow_mod_management_inventory', { limit: -1 }],
    ['burrow_get_mod_operation', { operationId: 'not-a-uuid' }],
    ['burrow_api_request', {}],
    ['burrow_api_request', { path: '/api/health', agentId: 'forged-admin' }],
    ['burrow_api_request', { method: 1, path: '/api/health' }],
    ['burrow_api_request', { path: 'https://outside.invalid/api/health' }],
    ['burrow_api_request', { path: '/apiculture' }],
    ['burrow_api_request', { path: '/api/health', headers: { invalid: 1 } }],
    ['burrow_api_request', { path: '/api/health', headers: { invalid: ['valid', 1] } }],
    ['burrow_api_request', { path: '/api/health', bodyText: {} }],
  ]) {
    const before = [diagnosticCalls.length, managementCalls.length, apiCalls.length];
    await assert.rejects(mod.host.invokeTool(tool, input, { agentId: 'admin', sessionId: 'own' }), (error) => error.statusCode === 400, tool);
    assert.deepEqual([diagnosticCalls.length, managementCalls.length, apiCalls.length], before, tool);
  }
  const cursor = 'opaque-proof-cursor';
  await mod.host.invokeTool('burrow_list_run_proofs', { limit: 2, cursor }, { agentId: 'one', sessionId: 'own' });
  assert.deepEqual(diagnosticCalls.at(-1).input, { operation: 'run-proofs', limit: 2, cursor });


  await assert.rejects(mod.host.invokeTool('burrow_mod_management_inventory', {}, { agentId: 'diagnostic', sessionId: 'own' }), /mod_route_failed/);
  assert.equal(managementCalls.length, 0);
  const actor = { agentId: 'admin', sessionId: 'session', conversationId: 'conversation', runId: 'run' };
  for (const agentId of ['one', 'diagnostic']) {
    await assert.rejects(mod.host.invokeTool('burrow_api_request', { path: '/api/openapi.json' }, { agentId }), /mod_route_failed/);
  }
  assert.equal(apiCalls.length, 0, 'global diagnostic scope is not full API administration');
  const requests = [
    { path: '/api/openapi.json' },
    { method: 'FUTURE-VERB', path: '/api/archive/future-endpoint?cursor=opaque%2Bcursor&flag=1&flag=2', headers: { 'x-custom': ['one', 'two'] }, body: { arbitrary: { nested: [1, null, true] } } },
    { method: 'POST', path: '/api/future/json', body: null },
    { method: 'PUT', path: '/api/future/text', bodyText: 'α\ncomplete text' },
    { method: 'PATCH', path: '/api/future/binary', bodyBase64: 'AP+A/w==' },
  ];
  for (const input of requests) assert.deepEqual(await mod.host.invokeTool('burrow_api_request', input, actor), apiResult);
  assert.deepEqual(apiCalls.map(({ input }) => input), requests);
  assert.ok(apiCalls.every(({ options }) => options.ownerModId === 'burrow-backdoor' && options.caller.agentId === 'admin' && options.caller.runId === 'run' && options.signal instanceof AbortSignal));
  for (const [name, result] of [
    ['text', { ok: true, status: 200, headers: { 'content-type': 'text/plain' }, body: 'α\nfull text', encoding: 'utf8', byteLength: 12 }],
    ['binary', { ok: true, status: 200, headers: { 'content-type': 'application/octet-stream' }, body: 'AP+A/w==', encoding: 'base64', byteLength: 4 }],
    ['ndjson', { ok: true, status: 200, headers: { 'content-type': 'application/x-ndjson' }, body: '{"event":"first"}\n{"event":"last"}\n', encoding: 'utf8', byteLength: 33 }],
    ['error', { ok: false, status: 409, headers: { 'x-error-header': ['one', 'two'] }, body: { ok: false, error: 'fixture_private_details', details: apiBody }, encoding: 'json', byteLength: 75000 }],
  ]) {
    const requestPath = `/api/future/${name}`;
    if (result.encoding === 'utf8') result.byteLength = Buffer.byteLength(result.body);
    if (result.encoding === 'json') result.byteLength = Buffer.byteLength(JSON.stringify(result.body));
    apiResponses.set(requestPath, result);
    assert.deepEqual(await mod.host.invokeTool('burrow_api_request', { path: requestPath }, actor), result);
  }
  const admitted = apiCalls.length;
  grants.splice(grants.indexOf('core-api-v1'), 1);
  await assert.rejects(mod.host.invokeTool('burrow_api_request', { path: '/api/health' }, actor), /mod_route_failed/);
  assert.equal(apiCalls.length, admitted, 'revocation is checked on the next Core admission');
  grants.push('core-api-v1');
  adminAgentIds.splice(0, 1);
  await assert.rejects(mod.host.invokeTool('burrow_api_request', { path: '/api/health' }, actor), /mod_route_failed/);
  assert.equal(apiCalls.length, admitted, 'assignment revocation is independent of the capability grant');
  adminAgentIds.push('admin');
  assert.equal((await mod.host.invokeTool('burrow_mod_management_inventory', {}, actor)).ok, true);
  const accepted = [];
  for (const [tool, input] of [
    ['burrow_refresh_mod_sources', {}],
    ['burrow_install_mod', { modId: 'fixture', version: '2026.10.18' }],
    ['burrow_update_mod', { modId: 'burrow-backdoor', version: '2026.10.18' }],
    ['burrow_enable_mod', { modId: 'fixture' }],
    ['burrow_disable_mod', { modId: 'fixture' }],
    ['burrow_uninstall_mod', { modId: 'fixture' }],
  ]) {
    const receipt = await mod.host.invokeTool(tool, input, actor);
    assert.equal(receipt.operation.status, 'queued', tool);
    accepted.push(receipt);
  }
  assert.equal((await mod.host.invokeTool('burrow_get_mod_operation', { operationId: accepted[2].operation.id }, actor)).operation.status, 'succeeded');
  assert.deepEqual(managementCalls.map(({ method, input }) => [method, input]), [
    ['inventory', {}],
    ['submit', { action: 'refresh' }],
    ['submit', { action: 'install', modId: 'fixture', version: '2026.10.18' }],
    ['submit', { action: 'update', modId: 'burrow-backdoor', version: '2026.10.18' }],
    ['submit', { action: 'enable', modId: 'fixture' }],
    ['submit', { action: 'disable', modId: 'fixture' }],
    ['submit', { action: 'uninstall', modId: 'fixture' }],
    ['operation', { operationId: accepted[2].operation.id }],
  ]);
  assert.ok(managementCalls.every(({ options }) => options.ownerModId === 'burrow-backdoor' && options.caller.agentId === 'admin'));
  await Promise.all(managementCalls.map(({ options }) => options.waitForCaller));

  assert.deepEqual(mod.routes, []);
  const replies = [];
  const route = createModRoute({ mods, readJsonBody: async () => assert.fail('removed access route must not read a body'), sendJson: (_res, status, body) => replies.push({ status, body }) });
  for (const method of ['GET', 'PUT']) {
    await route({ req: { method, headers: {}, burrowVerifiedAuth: { enabled: true, authenticated: true } }, res: {}, url: new URL('http://fixture/api/mods/burrow-backdoor/access') });
    assert.deepEqual(replies.at(-1), { status: 404, body: { ok: false, error: 'mod_route_not_found' } });
  }
  assert.deepEqual([...settings], [['unrelated', { preserved: true }]]);
});

for (const grants of [[], ['mod-management-v1'], ['core-api-v1']]) {
  test(`Backdoor loads with independent capability grants: ${grants.join(', ') || 'neither'}`, { skip: !existsSync(runtimePath) && `Burrow Core checkout unavailable at ${core}` }, async (t) => {
    const { loadMods, cleanupMods } = await import(runtimePath);
    const root = await mkdtemp(path.join(os.tmpdir(), 'backdoor-independent-grants-'));
    const modRoot = path.join(root, 'mods', 'burrow-backdoor');
    await mkdir(modRoot, { recursive: true });
    for (const entry of ['burrow.mod.json', 'src', 'ui']) await cp(new URL(`../${entry}`, import.meta.url), path.join(modRoot, entry), { recursive: true });
    const managementCalls = [];
    const apiCalls = [];
    const apiResult = { ok: true, status: 200, headers: {}, body: { full: true }, encoding: 'json', byteLength: 13 };
    const mods = await loadMods({
      runtimeRoot: root, enabledModIds: async () => ['burrow-backdoor'],
      modStoreFactory: async () => ({ get: async (_name, fallback) => fallback, close: async () => {} }),
      modCatalogWriter: async () => {}, resolveAgentRuntime: async () => ({}),
      stores: { agents: {}, models: {}, scheduledJobs: {}, conversations: {} },
      runtimeDiagnostics: { read: async () => ({ ok: true }) },
      modManagement: managementFixture(managementCalls),
      coreApi: { request: async (input, options) => (apiCalls.push({ input, options }), apiResult) },
      modAuthority: {
        read: async () => ({ grants, adminAgentIds: ['admin'], diagnosticAgentIds: [] }),
        allowed: async (_modId, capability, agentId) => grants.includes(capability) && agentId === 'admin',
        assertAllowed: async (_modId, capability, agentId) => {
          if (!grants.includes(capability) || agentId !== 'admin') throw Error('mod_authority_forbidden');
        },
      },
      logger: { warn() {}, error() {} },
    });
    t.after(async () => { await cleanupMods(mods); await rm(root, { recursive: true, force: true }); });
    const mod = mods[0];
    assert.equal(mod.status, 'loaded', mod.error);
    assert.equal(mod.tools.length, 35);
    assert.deepEqual(await mod.host.invokeTool('burrow_health', {}, { agentId: 'ordinary' }), { ok: true });
    if (grants.includes('mod-management-v1')) {
      assert.equal((await mod.host.invokeTool('burrow_mod_management_inventory', {}, { agentId: 'admin' })).ok, true);
      assert.equal(managementCalls.length, 1);
    } else {
      await assert.rejects(mod.host.invokeTool('burrow_mod_management_inventory', {}, { agentId: 'admin' }), /mod_route_failed/);
      assert.equal(managementCalls.length, 0);
    }
    const result = await mod.host.invokeTool('burrow_api_request', { path: '/api/health' }, { agentId: 'admin' });
    assert.deepEqual(result, grants.includes('core-api-v1') ? apiResult : { ok: false, error: 'core_api_unavailable' });
    assert.equal(apiCalls.length, grants.includes('core-api-v1') ? 1 : 0);
  });
}
