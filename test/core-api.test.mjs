import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { activate } from '../src/mod.mjs';

function registered(coreApi) {
  const tools = new Map();
  activate({ tools: { register: tool => tools.set(tool.name, tool) }, ...(coreApi === undefined ? {} : { coreApi }) });
  return tools;
}

function response(body, encoding = 'json', status = 200, headers = { 'content-type': 'application/json' }) {
  return { ok: status >= 200 && status < 400, status, headers, body, encoding,
    byteLength: Buffer.byteLength(encoding === 'json' ? JSON.stringify(body) : body, encoding === 'base64' ? 'base64' : 'utf8') };
}

test('Backdoor declares both system capabilities and retains its 34 tools alongside one generic tool', async () => {
  const manifest = JSON.parse(await readFile(new URL('../burrow.mod.json', import.meta.url), 'utf8'));
  assert.equal(manifest.system, true);
  assert.deepEqual(manifest.systemCapabilities, ['mod-management-v1', 'core-api-v1']);
  const tools = registered();
  assert.equal(tools.size, 35);
  assert.ok(tools.has('burrow_health'));
  assert.ok(tools.has('burrow_update_mod'));
  assert.ok([...tools.values()].every(tool => tool.availability === 'mod-authorized'));
  const api = tools.get('burrow_api_request');
  assert.equal(api.inputSchema.additionalProperties, false);
  assert.deepEqual(api.inputSchema.required, ['path']);
  assert.deepEqual(Object.keys(api.inputSchema.properties), ['method', 'path', 'headers', 'body', 'bodyText', 'bodyBase64']);
  assert.equal(api.inputSchema.properties.method.type, 'string');
  assert.equal(api.inputSchema.properties.method.default, 'GET');
  assert.equal(api.inputSchema.properties.method.enum, undefined);
  assert.equal(api.inputSchema.properties.body.type, undefined, 'JSON bodies are not restricted to objects');
  const path = new RegExp(api.inputSchema.properties.path.pattern);
  for (const value of ['/api', '/api?query=one', '/api/openapi.json', '/api/archive/future-endpoint?cursor=opaque%2Bcursor']) assert.ok(path.test(value), value);
  for (const value of ['https://elsewhere.invalid/api/health', '//elsewhere.invalid/api/health', '/apiculture', '/not-api']) assert.equal(path.test(value), false, value);
});

test('activation succeeds without Core API and the tool reports core_api_unavailable explicitly', async () => {
  for (const coreApi of [undefined, null, {}]) {
    const tools = registered(coreApi);
    assert.equal(tools.size, 35);
    assert.deepEqual(await tools.get('burrow_api_request').handler({ path: '/api/health' }, {}), { ok: false, error: 'core_api_unavailable' });
  }
});

test('generic requests forward arbitrary methods, routes, query strings, and headers to Core without a catalog', async () => {
  const calls = [];
  const result = response({ ok: true });
  const tools = registered({ request: async (input, options) => (calls.push({ input, options }), result) });
  const signal = new AbortController().signal;
  const invoke = input => tools.get('burrow_api_request').handler(input, { agentId: 'admin', sessionId: 'session', signal });
  const discover = { path: '/api/openapi.json' };
  assert.strictEqual(await invoke(discover), result);
  assert.deepEqual(calls[0].input, discover, 'Core owns the omitted-method GET default');
  const request = {
    method: 'FUTURE-VERB', path: '/api/archive/new-endpoint?cursor=opaque%2Bcursor&flag=1&flag=2',
    headers: { 'x-custom': ['one', 'two'], authorization: 'fixture-not-a-credential', cookie: 'fixture-only', 'content-type': 'application/custom+json' },
    body: { arbitrary: { nested: ['private data', null, 7] }, futureField: true },
  };
  assert.strictEqual(await invoke(request), result);
  assert.deepEqual(calls[1].input, request);
  assert.deepEqual(calls[1].options, { signal });
  assert.strictEqual(calls[1].options.signal, signal);
});

test('all JSON values, UTF-8 text and binary bodies pass through intact; Core owns exclusive-format validation', async () => {
  const calls = [];
  const conflict = Object.assign(new Error('core_api_conflicting_bodies'), { code: 'core_api_conflicting_bodies' });
  const tools = registered({ request: async input => {
    calls.push(input);
    if (Object.hasOwn(input, 'body') && Object.hasOwn(input, 'bodyText')) throw conflict;
    return response(null);
  } });
  const invoke = input => tools.get('burrow_api_request').handler(input, {});
  for (const body of [null, false, 0, 'hello', ['one', 2], { nested: { keep: true } }]) {
    const input = { method: 'POST', path: '/api/future/json', body };
    await invoke(input);
    assert.deepEqual(calls.at(-1), input);
  }
  for (const input of [
    { method: 'PUT', path: '/api/future/text', bodyText: 'α\nline two\u0000' },
    { method: 'PATCH', path: '/api/future/binary', headers: { 'content-type': 'application/octet-stream' }, bodyBase64: 'AP+A/w==' },
  ]) {
    await invoke(input);
    assert.deepEqual(calls.at(-1), input);
  }
  const input = { method: 'POST', path: '/api/future/json', body: {}, bodyText: 'conflict' };
  await assert.rejects(invoke(input), error => error === conflict);
  assert.deepEqual(calls.at(-1), input, 'the mod must not silently pick a body format');
});

test('Core JSON, UTF-8, binary, NDJSON and non-success responses are returned without sanitization or truncation', async () => {
  const sensitive = 'fixture-private-'.repeat(12_000);
  const results = [
    response({ title: sensitive, content: sensitive, sourceRefs: ['/fixture/source'], futureField: { untouched: true } }, 'json', 201, { 'x-new-header': ['one', 'two'], 'set-cookie': ['fixture=one', 'fixture=two'] }),
    response(`α\n${sensitive}`, 'utf8', 200, { 'content-type': 'text/plain; charset=utf-8' }),
    response(Buffer.from([0, 255, 128, 0, 1]).toString('base64'), 'base64', 200, { 'content-type': 'application/octet-stream' }),
    response('{"event":"first"}\n{"event":"last"}\n', 'utf8', 200, { 'content-type': 'application/x-ndjson' }),
    response({ ok: false, error: 'fixture_core_error', details: sensitive }, 'json', 409),
    { ok: true, status: 204, headers: { 'x-empty': 'preserved' }, body: null, encoding: 'utf8', byteLength: 0 },
  ];
  let next = 0;
  const api = registered({ request: async () => results[next++] }).get('burrow_api_request');
  for (const expected of results) {
    const actual = await api.handler({ path: '/api/future/output' }, {});
    assert.strictEqual(actual, expected, 'direct handler returns the Core result itself, not a filtered reconstruction');
    assert.deepEqual(Object.keys(actual), ['ok', 'status', 'headers', 'body', 'encoding', 'byteLength']);
  }
});

test('caller cancellation reaches the Core API request and Core errors are not rewritten', async () => {
  const controller = new AbortController();
  const reason = new Error('fixture_caller_cancelled');
  const api = registered({ request: (_input, { signal }) => new Promise((_resolve, reject) => {
    assert.strictEqual(signal, controller.signal);
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }) }).get('burrow_api_request');
  const pending = api.handler({ method: 'POST', path: '/api/future/work', body: { start: true } }, { signal: controller.signal });
  controller.abort(reason);
  await assert.rejects(pending, error => error === reason);
});
