# Security and trust

!!! danger "Choose administrative agents and grants deliberately"
    Mod administration changes executable code and service availability. Full Core API access additionally permits every API read and write, including private data, settings changes and deletion. Global diagnostics widens diagnostic scope. Select trusted agents, approve the two administrative capabilities separately, and keep access as small as your workflow needs.

## Boundaries Core enforces

- The trusted caller comes from Core, not `agentId`, a header or other model-supplied arguments. Admission requires an active invocation.
- Diagnostic scope and administrative authority are independently Core-owned. Full API uses the existing `adminAgentIds` list plus the explicitly granted `core-api-v1` capability. Existing `mod-management-v1` approval is not API approval.
- Backdoor declares both capabilities; system status alone grants neither. There is no per-tool or per-endpoint grant.
- Diagnostic reads use `context.runtimeDiagnostics.read`; durable management uses `context.modManagement`. Only an effective API capability exposes `context.coreApi.request` to the host.
- Full API dispatch calls the same home-Core request handler as HTTP, in process. It is not a loopback listener, browser session, token login or a copied route implementation.
- Paths must remain in the relative `/api` namespace. Absolute URLs, network-relative targets and escapes outside `/api` are invalid. This is not an arbitrary-network fetch facade, although API actions can themselves start work or use integrations.
- Lifecycle management tools reuse Core's distribution and recovery behavior. Use those tools for Backdoor self-update, disable or uninstall, not a generic request that might retire its own caller before the result returns.
- Mod diagnostics require the target mod's dedicated opt-in diagnostic interface; they do not proxy arbitrary mod routes. The separately approved API tool can reach API-served mod routes and is not constrained to diagnostic projections.
- Backdoor has no raw controller filesystem/process or database facade. That does not mean full API output is credential-free: it returns whatever data and headers the requested endpoint exposes.
- External HTTP clients still use Core's existing operator/token authentication and route rules. Internal caller authorization does not make external HTTP anonymous. The settings UI still receives only a restricted access-settings adapter.

## Raw API results are private

The 26 diagnostics keep their existing scoped, bounded projections. Session-turn metadata preserves compact source-authored delegation/parent-child markers where valid, not arbitrary metadata or raw minion task/result payloads; turn content remains a bounded preview. Read-only diagnostic results still require review before publication.

`burrow_api_request` is different: it does **not** redact, truncate, remove response headers or select a safe subset. Complete conversations, memory/evidence bodies, exports, configuration and endpoint error details may be returned. Request headers, query strings and bodies can be sensitive too. The caller is responsible for choosing appropriate reads/writes, controlling downstream disclosure, and redacting public reports.

JSON, UTF-8 and binary/base64 results are complete aggregates. Finite NDJSON is not a real-time browser stream. Core resource limits can reject a request rather than return a clipped successful result; native endpoint pagination and validation still apply.

## Outcomes and recovery

A trusted administrator can make a disruptive but permitted change. Backdoor does not promise per-call confirmation or automatic rollback. A returned API status must be inspected; a successful transport result is not proof that an asynchronous job finished. A timeout, cancellation or lost response is not proof that a write did not commit. Reconcile state before retrying.

The eight lifecycle tools provide durable receipts and [operation status](operations.md), including unknown outcomes. Generic API calls do not automatically provide those semantics. Keep operator access available for recovery.

Node Goblin and Backdoor solve different jobs: Node Goblin selects execution on another machine; Backdoor observes/administers the home Burrow. Changing the remote target does not move Backdoor's authority to that remote host.

Disabling or uninstalling Backdoor removes its live routing. Core-owned grants/assignments are independent of the mod lifecycle; do not treat uninstall as a substitute for reviewing or revoking authority. Already accepted operations or writes may continue; revocation is not rollback.
