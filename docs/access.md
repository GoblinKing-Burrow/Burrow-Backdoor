# Agent access

## Diagnostic scope and two administrative grants

| Access | Who has it | What it allows |
| --- | --- | --- |
| Own diagnostics | Agents using enabled Backdoor | Caller-authorized agent/session records, shared health/inventory summaries, and the agent identity/execution-assignment directory |
| Global diagnostics | Agents selected in **Global Access** | Cross-agent diagnostics plus installation-wide Forge/mod job and pending-operation diagnostics |
| Mod administration | Agents selected in **Admin Access**, with `mod-management-v1` approved | The eight sanitized inventory, refresh, lifecycle and durable operation tools |
| Full Core API | The same **Admin Access** agents, with `core-api-v1` separately approved | `burrow_api_request`: all home-Core API routes and methods, including private data, writes and newly added endpoints |

Global diagnostics do not grant administration. Neither administrative grant adds global scope to the diagnostic tools, and mod-management approval does **not** implicitly approve full API access. Selecting an `agentId` in tool arguments never establishes caller identity. However, an agent granted full API access can read private cross-agent data through the API; diagnostic scoping is not a restriction on this broader capability.

!!! danger "Full API is not another diagnostic permission"
    `core-api-v1` allows powerful writes, settings changes, data deletion and unsanitized private API reads. Every agent in the shared admin list can use each approved administrative capability. There is no separate per-tool or per-endpoint grant. Grant full API only when all selected administrators should have that responsibility.

## Set access

Open **Settings → Backdoor → Global Access**. Check the agents that should see cross-agent diagnostics, then choose **Save global access**.

Open **Admin Access**. Select trusted agents and approve **mod management** for the durable lifecycle tools. Separately approve **full Core API access** only if the same agents should use the unrestricted API tool, then save. Newly granted host capabilities require a Core restart; follow the panel's restart notice. Agent assignments and capability grants are separate parts of the authority record. The restart flag is a save-time signal, not persistent restart tracking; see the [operator API](operator-api.md).

To revoke access, uncheck the relevant assignment or capability and save. Core checks authority on each API admission and again before starting queued management mutations. Revoking access does not undo a completed change; a request or operation already in progress may have committed. A saved new grant does not retroactively create `context.coreApi` in an existing host.

Unavailable agent assignments remain visible so operators can deliberately retain or remove them. Each panel refreshes before saving and preserves the other panel's fields and unrelated grants. Updates are complete replacements and last-writer-wins; coordinate simultaneous operator edits.

Backdoor loads on a compatible Core even without either administrative grant. If Core does not expose the effective API capability, `burrow_api_request` returns `{"ok":false,"error":"core_api_unavailable"}`. Ordinary diagnostics remain available. Tool discovery is not proof of authorization or of an effective host grant.

## Trusted caller identity

Core supplies the active agent, session, conversation, and run identity. This identity determines authorization and is recorded on management operations. The agent cannot impersonate another caller through tool arguments, headers or request bodies. Browser cookies, operator login, bearer tokens, and Node Goblin target selection are not the authority source for internal agent tool calls.

The Settings page itself uses Core's operator access API and follows Core's configured external authentication mode. API tokens do not grant operator access. The internal API tool does not weaken those external authentication rules or give the settings UI an arbitrary API client. See the [operator API reference](operator-api.md).

## Shared agent directory

`burrow_list_agents` exposes agent identities and execution assignments without global diagnostic access. Disabled agents are included by default; set `includeDisabled: false` to filter them. This directory visibility does not grant access to other agents' sessions or records.
