import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings, settingsSections } from '../ui/settings.js';

class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.listeners = new Map();
    this.textContent = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.dataset = {};
    this.style = {};
  }
  append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
  replaceChildren(...items) { this.children = []; this.append(...items); }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type, fn) { if (this.listeners.get(type) === fn) this.listeners.delete(type); }
  descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
  fire(type) { return this.listeners.get(type)?.({ preventDefault() {} }); }
}

const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
const defaultAccess = {
  ok: true,
  modId: 'burrow-backdoor',
  grants: ['mod-management-v1'],
  modManagementAgentIds: ['agent-a'],
  coreApiAgentIds: ['agent-b'],
  diagnosticAgentIds: ['agent-b'],
  declaredCapabilities: ['mod-management-v1', 'core-api-v1'],
  restartRequired: false,
};

async function fixture({
  section = 'global-access',
  access = defaultAccess,
  refreshedAccess,
  agents,
  saveResult,
  provideAccessApi = true,
  host = {},
  request,
} = {}, run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: tag => new Element(tag) };
  const calls = [];
  let reads = 0;
  const primary = { replace(node) { this.node = node; }, clear() { this.node = null; } };
  const overflow = { clear() { this.cleared = true; } };
  const accessApi = async (init = {}) => {
    calls.push(init);
    if (request) return request(init, calls.length);
    if (init.method === 'PUT') {
      const replacement = JSON.parse(init.body);
      return saveResult ?? { ...defaultAccess, ...replacement, restartRequired: true };
    }
    reads += 1;
    return reads > 1 && refreshedAccess ? refreshedAccess : access;
  };
  let draft;
  const cleanup = mountSettings({
    section,
    setDraft(value) { draft = value; }, navigate(proceed) { proceed(); }, confirm: async () => true,
    primary,
    overflow,
    agents: agents ?? [{ id: 'agent-a', name: 'Agent A' }, { id: 'agent-b', name: 'Agent B' }],
    ...(provideAccessApi ? { accessApi } : {}),
    ...host,
  });
  try { await flush(); await run({ primary, overflow, calls, root: primary.node, draft: () => draft, cleanup }); }
  finally { cleanup(); globalThis.document = previous; }
}

function inputs(root) {
  return root.descendants().filter(node => node.tagName === 'input');
}
function agentInputs(root, key) {
  const scope = key ? root.descendants().find(node => node['aria-label'] === ({
    modManagementAgentIds: 'Agents with mod management access',
    coreApiAgentIds: 'Agents with Core API access',
  })[key]) : root;
  return inputs(scope).filter(input => input.value);
}
function capabilityInput(root, index = 0) {
  return inputs(root).filter(input => !input.value)[index];
}
function copy(root) {
  return root.descendants().map(node => node.textContent).join(' ');
}

test('exposes separate Global, Admin and Core API Access settings menu items', () => {
  assert.deepEqual(settingsSections, [
    { id: 'global-access', label: 'Global Access', layout: 'form' },
    { id: 'admin-access', label: 'Admin Access', layout: 'form' },
    { id: 'core-api-access', label: 'Core API Access', layout: 'form' },
  ]);
});

test('global panel renders only Core diagnostic assignments', async () => fixture({}, async ({ root, calls }) => {
  assert.equal(root.descendants().find(node => node.tagName === 'div' && node['aria-label'])['aria-label'], 'Agents with global diagnostic access');
  assert.deepEqual(agentInputs(root).map(input => [input.value, input.checked]), [['agent-a', false], ['agent-b', true]]);
  assert.match(copy(root), /does not grant or imply Burrow administrative access/);
  assert.doesNotMatch(copy(root), /Approve Backdoor mod management/);
  assert.equal(calls.length, 1);
}));

test('admin panel renders assignments and explicit declared capability approval', async () => fixture({ section: 'admin-access' }, async ({ root }) => {
  assert.deepEqual(agentInputs(root, 'modManagementAgentIds').map(input => [input.value, input.checked]), [['agent-a', true], ['agent-b', false]]);
  assert.equal(root.descendants().some(node => node['aria-label'] === 'Agents with Core API access'), false);
  assert.equal(capabilityInput(root).checked, true);
  assert.match(copy(root), /Approve Backdoor mod management/);
  assert.equal(inputs(root).filter(input => !input.value).length, 1);
  assert.doesNotMatch(copy(root), /Approve Backdoor Core API access/);
  assert.match(copy(root), /does not grant or imply global diagnostic access/);
}));

test('global save refreshes Core authority and preserves concurrent grants and admin assignments', async () => fixture({
  refreshedAccess: {
    ...defaultAccess,
    grants: ['mod-management-v1', 'future-capability-v1'],
    modManagementAgentIds: ['agent-b'],
    coreApiAgentIds: ['agent-a'],
  },
}, async ({ root, calls }) => {
  const controls = agentInputs(root);
  controls[0].checked = true;
  controls[1].checked = false;
  await root.fire('submit');
  await flush();
  assert.equal(calls.length, 3);
  assert.equal(calls[0].method, undefined);
  assert.equal(calls[1].method, undefined);
  assert.deepEqual(JSON.parse(calls[2].body), {
    grants: ['mod-management-v1', 'future-capability-v1'],
    modManagementAgentIds: ['agent-b'],
    coreApiAgentIds: ['agent-a'],
    diagnosticAgentIds: ['agent-a'],
  });
  assert.match(copy(root), /Global access saved/);
  assert.match(copy(root), /Restart Core/);
}));

test('admin save preserves fresh diagnostics and can revoke only Backdoor management approval', async () => fixture({
  section: 'admin-access',
  refreshedAccess: {
    ...defaultAccess,
    grants: ['mod-management-v1', 'future-capability-v1'],
    diagnosticAgentIds: ['agent-a'],
  },
}, async ({ root, calls }) => {
  capabilityInput(root).checked = false;
  const controls = agentInputs(root, 'modManagementAgentIds');
  controls[0].checked = false;
  controls[1].checked = true;
  await root.fire('submit');
  await flush();
  assert.deepEqual(JSON.parse(calls.at(-1).body), {
    grants: ['future-capability-v1'],
    modManagementAgentIds: ['agent-b'],
    coreApiAgentIds: ['agent-b'],
    diagnosticAgentIds: ['agent-a'],
  });
}));

test('preserves a stale assignment in the active panel so the operator can remove it', async () => fixture({
  access: { ...defaultAccess, diagnosticAgentIds: ['missing-global'], modManagementAgentIds: ['missing-admin'], coreApiAgentIds: ['missing-api'] },
}, async ({ root, calls }) => {
  const stale = agentInputs(root).find(input => input.value === 'missing-global');
  assert.equal(stale.checked, true);
  assert.equal(stale.disabled, false);
  assert.equal(stale.parent.children[1].children[1].textContent, 'Unavailable agent assignment');
  assert.equal(agentInputs(root).some(input => input.value === 'missing-admin'), false);
  stale.checked = false;
  await root.fire('submit');
  await flush();
  assert.deepEqual(JSON.parse(calls.at(-1).body), {
    grants: ['mod-management-v1'],
    modManagementAgentIds: ['missing-admin'], coreApiAgentIds: ['missing-api'],
    diagnosticAgentIds: [],
  });
}));

test('rejects malformed Core responses without replacing controls', async () => fixture({
  access: { ...defaultAccess, modManagementAgentIds: 'all' },
}, async ({ root, calls }) => {
  assert.equal(calls.length, 1);
  assert.equal(inputs(root).length, 0);
  const alert = root.descendants().find(node => node.role === 'alert');
  assert.match(alert.textContent, /invalid Backdoor access response/);
}));

test('fails clearly when the UI host does not provide Core-owned access', async () => fixture({ provideAccessApi: false }, async ({ root }) => {
  const alert = root.descendants().find(node => node.role === 'alert');
  assert.match(alert.textContent, /does not support Core-owned mod access/);
  assert.equal(inputs(root).length, 0);
}));


test('Core API save independently approves Core API and preserves refreshed unknown grants and diagnostics', async () => fixture({
  section: 'core-api-access',
  refreshedAccess: { ...defaultAccess, grants: ['mod-management-v1', 'future-capability-v1'], diagnosticAgentIds: ['agent-a'] },
}, async ({ root, calls }) => {
  capabilityInput(root).checked = true;
  await root.fire('submit');
  await flush();
  assert.equal(calls.length, 3);
  assert.deepEqual(JSON.parse(calls.at(-1).body), {
    grants: ['mod-management-v1', 'future-capability-v1', 'core-api-v1'],
    modManagementAgentIds: ['agent-a'],
    coreApiAgentIds: ['agent-b'], diagnosticAgentIds: ['agent-a'],
  });
}));

test('undeclared capability is not offered and an existing grant is preserved', async () => fixture({
  section: 'admin-access',
  access: { ...defaultAccess, grants: ['core-api-v1'], declaredCapabilities: [] },
}, async ({ root, calls }) => {
  assert.match(copy(root), /does not currently declare mod-management-v1/);
  assert.equal(inputs(root).filter(input => !input.value).length, 0);
  agentInputs(root, 'modManagementAgentIds')[1].checked = true;
  await root.fire('submit');
  assert.deepEqual(JSON.parse(calls.at(-1).body).grants, ['core-api-v1']);
}));


test('registers dirty, revert and discard through one shared draft scope', async () => fixture({}, async ({ root, draft }) => {
  const checkbox = agentInputs(root)[0];
  assert.equal(draft().dirty, false);
  checkbox.checked = true;
  root.fire('change');
  assert.equal(draft().dirty, true);
  checkbox.checked = false;
  root.fire('change');
  assert.equal(draft().dirty, false);
  checkbox.checked = true;
  root.fire('change');
  draft().discard();
  assert.equal(draft().dirty, false);
  assert.equal(agentInputs(root)[0].checked, false);
}));

test('failed shared Save preserves assignments and retry succeeds cleanly', async () => {
  let fail = true;
  await fixture({ request: async init => {
    if (init.method === 'PUT') {
      if (fail) throw new Error('Service unavailable');
      return { ...defaultAccess, ...JSON.parse(init.body) };
    }
    return defaultAccess;
  } }, async ({ root, draft, calls }) => {
    agentInputs(root)[0].checked = true;
    root.fire('change');
    assert.equal(await draft().save(), false);
    assert.equal(draft().dirty, true);
    assert.equal(draft().busy, false);
    assert.equal(agentInputs(root)[0].checked, true);
    assert.match(copy(root), /Service unavailable/);
    fail = false;
    assert.equal(await draft().save(), true);
    assert.equal(draft().dirty, false);
    assert.equal(draft().busy, false);
    const count = calls.length;
    await root.fire('submit');
    assert.equal(calls.length, count, 'unchanged submission does not write');
  });
});

test('busy navigation snapshot prevents duplicates and disposal cancels before PUT', async () => {
  let release;
  await fixture({ request: (init, count) => count === 1 ? defaultAccess : new Promise(resolve => { release = resolve; }) }, async ({ root, draft, calls, cleanup }) => {
    agentInputs(root)[0].checked = true;
    root.fire('change');
    const pending = draft().save();
    assert.equal(draft().busy, true);
    assert.equal(agentInputs(root)[0].disabled, true);
    assert.equal(await draft().save(), false);
    cleanup();
    release(defaultAccess);
    assert.equal(await pending, false);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].signal.aborted, true);
    assert.equal(draft(), null);
  });
});

test('requires all shared guard APIs before rendering an editable form', async () => {
  for (const name of ['setDraft', 'navigate', 'confirm']) await fixture({ host: { [name]: undefined } }, async ({ root, calls }) => {
    assert.equal(inputs(root).length, 0);
    assert.equal(calls.length, 0);
    assert.match(copy(root), /Update Burrow UI/);
  });
});

test('17 agents use compact native checkboxes in a bounded single form, not cards or selects', async () => fixture({
  agents: Array.from({ length: 17 }, (_, i) => ({ id: `agent-${i}`, name: `Long agent name ${i}` })),
  access: { ...defaultAccess, diagnosticAgentIds: [] },
}, async ({ root }) => {
  assert.equal(agentInputs(root).length, 17);
  assert.equal(root.descendants().some(node => ['select', 'style'].includes(node.tagName)), false);
  const list = root.descendants().find(node => node.className?.includes('backdoor-agent-list'));
  assert.equal(list.style.overflowY, 'auto');
  assert.equal(root.descendants().filter(node => node.className === 'settings-checkbox-row').length, 17);
}));

test('late PUT completion after disposal cannot publish a new draft or remount controls', async () => {
  let release;
  await fixture({ request: init => init.method === 'PUT' ? new Promise(resolve => { release = resolve; }) : defaultAccess }, async ({ root, draft, cleanup, primary }) => {
    agentInputs(root)[0].checked = true;
    root.fire('change');
    const pending = draft().save();
    await flush();
    cleanup();
    release({ ...defaultAccess, diagnosticAgentIds: ['agent-a', 'agent-b'] });
    assert.equal(await pending, false);
    assert.equal(draft(), null);
    assert.equal(primary.node, null);
  });
});

test('empty agent catalogs remain usable and do not invent assignments', async () => fixture({
  agents: [], access: { ...defaultAccess, diagnosticAgentIds: [] },
}, async ({ root, draft, calls }) => {
  assert.match(copy(root), /No agents are available/);
  assert.equal(agentInputs(root).length, 0);
  assert.equal(draft().dirty, false);
  await root.fire('submit');
  assert.equal(calls.length, 1);
}));

for (const key of ['modManagementAgentIds', 'coreApiAgentIds']) {
  for (const invalid of [undefined, 'all', ['agent-a', 'agent-a'], [''], [1]]) {
    test(`rejects invalid ${key}: ${JSON.stringify(invalid)}`, async () => fixture({
      access: { ...defaultAccess, [key]: invalid, adminAgentIds: ['agent-a'] },
    }, async ({ root, calls }) => {
      assert.equal(inputs(root).length, 0);
      assert.match(copy(root), /invalid Backdoor access response/);
      assert.equal(calls.length, 1, 'legacy assignments are never used as a fallback');
      assert.equal(root.descendants().find(node => node.tagName === 'button').disabled, true);
    }));
  }
}


for (const [section, key, grant, otherKey] of [
  ['admin-access', 'modManagementAgentIds', 'mod-management-v1', 'coreApiAgentIds'],
  ['core-api-access', 'coreApiAgentIds', 'core-api-v1', 'modManagementAgentIds'],
]) {
  test(`${section} exposes only its own controls and preserves the other scope on save`, async () => fixture({
    section, refreshedAccess: { ...defaultAccess, [otherKey]: ['concurrent-agent'], grants: ['future-v1'] },
  }, async ({ root, calls }) => {
    assert.equal(inputs(root).filter(input => !input.value).length, 1);
    assert.equal(root.descendants().filter(node => node.role === 'group').length, 1);
    assert.equal(root.descendants().some(node => node.className === 'settings-section-pair'), false);
    capabilityInput(root).checked = true;
    agentInputs(root, key)[0].checked = true;
    agentInputs(root, key)[1].checked = true;
    await root.fire('submit');
    const payload = JSON.parse(calls.at(-1).body);
    assert.deepEqual(payload[key], ['agent-a', 'agent-b']);
    assert.deepEqual(payload[otherKey], ['concurrent-agent']);
    assert.deepEqual(payload.grants, ['future-v1', grant]);
    assert.deepEqual(payload.diagnosticAgentIds, defaultAccess.diagnosticAgentIds);
  }));
  test(`${section} preserves and removes unavailable assignments independently`, async () => fixture({
    section, access: { ...defaultAccess, [key]: ['missing-active'], [otherKey]: ['missing-other'] },
  }, async ({ root, calls }) => {
    const stale = agentInputs(root, key).find(input => input.value === 'missing-active');
    assert.equal(stale.checked, true);
    assert.equal(agentInputs(root, key).some(input => input.value === 'missing-other'), false);
    stale.checked = false;
    await root.fire('submit');
    const body = JSON.parse(calls.at(-1).body);
    assert.deepEqual(body[key], []);
    assert.deepEqual(body[otherKey], ['missing-other']);
  }));
  test(`${section} empty catalog keeps its one approval visible`, async () => fixture({
    section, agents: [], access: { ...defaultAccess, [key]: [] },
  }, async ({ root }) => {
    assert.equal(inputs(root).length, 1);
    assert.equal(copy(root).split('No agents are available.').length - 1, 1);
  }));
}
