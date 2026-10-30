# Tool reference

Backdoor registers **35 tools**: 26 diagnostics, eight durable mod-management tools and one full Core API tool under **Mod: Backdoor**. All top-level input schemas reject additional properties; the generic API tool accepts arbitrary header names and any JSON request body. Tools are discoverable as mod-authorized tools; Core still checks the trusted caller on every call. See [agent access](access.md) and [diagnostic limits](diagnostics.md).

Required arguments are marked **required**. Other arguments are optional. No arguments means `{}`. Bounds below describe the advertised schema; Core may apply additional validation, scoping, pagination, and technical resource limits. Diagnostic output limits do not apply as a Backdoor filter on full API results.

## Diagnostic tools

### burrow_brains_status

Read scoped saved-memory counts and embedding configuration/index status; no memory content or credentials.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |

### burrow_list_brain_memories

List caller-authorized saved-memory metadata; excludes titles, content, source refs and legacy snapshots.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `limit` | integer | optional; minimum: 1; maximum: 9007199254740991 |
| `cursor` | string | optional; minLength: 1 |

### burrow_list_brain_embedding_jobs

List caller-authorized embedding retry metadata and sanitized failure codes.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `limit` | integer | optional; minimum: 1; maximum: 9007199254740991 |
| `cursor` | string | optional; minLength: 1 |

### burrow_postgres_status

Read PostgreSQL connectivity, server major and pgvector availability without connection details.

No arguments.

### burrow_list_forge_jobs

List sanitized Forge jobs when the caller has global diagnostic scope.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `limit` | integer | optional; minimum: 1; maximum: 100 |
| `cursor` | string | optional; pattern: `^[1-9]\d*$` |

### burrow_get_forge_job

Read one sanitized Forge job when the caller has global diagnostic scope.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `jobId` | string | **required**; format: uuid |

### burrow_inventory

Read safe count-only MCP and mod inventory.

No arguments.

### burrow_metrics

Read host process, configured-runtime-filesystem and load metrics.

No arguments.

### burrow_list_mods

List installed mod lifecycle and diagnostic support.

No arguments.

### burrow_list_mod_jobs

List sanitized mod jobs when the caller has global diagnostic scope.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `limit` | integer | optional; minimum: 1; maximum: 100 |
| `cursor` | string | optional; maxLength: 256 |

### burrow_mod_pending_operations

Read current Core-hosted mod capability operations when the caller has global diagnostic scope.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

### burrow_get_mod_job

Inspect one sanitized mod job when the caller has global diagnostic scope.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `jobId` | string | **required**; pattern: `^[A-Za-z0-9_-]{1,128}$` |

### burrow_health

Read Burrow runtime health and build identity.

No arguments.

### burrow_runtime_status

Read runtime, release, model-selection, policy, retention and trace-observability status for an authorized agent.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |

### burrow_list_agents

List Burrow agent identities and execution assignments.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `includeDisabled` | boolean | optional |

### burrow_agent_status

Read current status for an authorized agent session.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |

### burrow_list_sessions

List compact session summaries for an authorized agent.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `archived` | boolean | optional |
| `limit` | integer | optional; minimum: 1; maximum: 200 |

### burrow_get_session

Read a bounded recent session tail for an authorized agent. Use conversation reading for complete history. Compact source-authored delegation markers are preserved where valid; the metadata projection omits arbitrary metadata and task/result payloads. Turn content remains a bounded preview.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | **required**; minLength: 1 |
| `limit` | integer | optional; minimum: 1; maximum: 100 |
| `maxContentChars` | integer | optional; minimum: 1; maximum: 9007199254740991 |

### burrow_active_runs

List bounded active-run and subagent summaries for an authorized agent and optional session.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |

### burrow_list_traces

List a bounded page of trace runs for an authorized agent session.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |
| `limit` | integer | optional; minimum: 1; maximum: 100 |
| `cursor` | string | optional; minLength: 1 |

### burrow_get_trace

Read a summarized trace for an authorized agent; tool output is omitted by default.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `runId` | string | **required**; minLength: 1 |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |
| `includeToolOutput` | boolean | optional |

### burrow_get_trace_authority

Explain authority evidence for one authorized trace.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `runId` | string | **required**; minLength: 1 |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |

### burrow_list_run_proofs

List archived runtime proofs for an authorized agent/session.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |
| `limit` | integer | optional; minimum: 1; maximum: 200 |
| `cursor` | string | optional; minLength: 1 |

### burrow_get_run_proof

Read one archived runtime proof for an authorized agent.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `runId` | string | **required**; minLength: 1 |
| `agentId` | string | optional; minLength: 1 |

### burrow_get_session_context

Read a scalar context-composition summary for an authorized agent session; transcript and evidence bodies are excluded.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |

### burrow_context_status

Read bounded context-window, live usage and compression status for an authorized agent session.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `agentId` | string | optional; minLength: 1 |
| `sessionId` | string | optional; minLength: 1 |

## Administrative tools

All eight tools require administrative access and the approved `mod-management-v1` capability, including inventory and operation lookup. The separate `core-api-v1` grant is not required by these tools. Mutation receipts require [later verification](operations.md).

### burrow_mod_management_inventory

List sanitized configured sources and installable/installed mods. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `offset` | integer | optional; minimum: 0; maximum: 9007199254740991 |
| `limit` | integer | optional; minimum: 1; maximum: 100 |

### burrow_refresh_mod_sources

Queue a durable refresh of configured mod sources. Requires Backdoor administrative access.

No arguments.

### burrow_install_mod

Queue a durable mod installation through Core. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `version` | string | optional; maxLength: 128; pattern: `^v?(?:\d{4}\.\d{2}\.\d{2}(?:\.\d+)?&#124;\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$` |

### burrow_update_mod

Queue a durable mod update through Core. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `version` | string | optional; maxLength: 128; pattern: `^v?(?:\d{4}\.\d{2}\.\d{2}(?:\.\d+)?&#124;\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$` |

### burrow_enable_mod

Queue a durable mod enable operation through Core. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

### burrow_disable_mod

Queue a durable mod disable operation through Core. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

### burrow_uninstall_mod

Queue a durable mod uninstall operation through Core. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `modId` | string | **required**; maxLength: 128; pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |

### burrow_get_mod_operation

Inspect one durable Backdoor-submitted lifecycle operation. Requires Backdoor administrative access.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `operationId` | string | **required**; format: uuid |

## Full Core API tool

### burrow_api_request

Call any home Burrow Core `/api` route through the same request handler used by HTTP. Requires the trusted active caller to be in Core's existing `adminAgentIds` list and the separate `core-api-v1` capability to be effective and currently approved. Neither global diagnostics nor mod-management approval grants this access. There is no per-tool or per-route grant.

!!! danger "Powerful writes and private data"
    This tool is not a diagnostic projection. It can change settings, run work, delete data, and read complete private API responses. Backdoor does not truncate, redact or select fields. Review route, method and body before writes, follow operator instructions, and protect both inputs and outputs from unintended disclosure.

| Argument | Type | Requirement and constraints |
| --- | --- | --- |
| `method` | string | optional; defaults to `GET`; Core validates method syntax; no Backdoor verb allowlist |
| `path` | string | **required**; relative `/api` path including any query string; Core rejects absolute/network-relative URLs and escapes outside `/api` |
| `headers` | object | optional; any header names with string or array-of-string values; Core validates HTTP syntax |
| `body` | any JSON value | optional; object, array, scalar or null; exclusive with the two raw-body formats |
| `bodyText` | string | optional; raw UTF-8 request body; exclusive with `body` and `bodyBase64` |
| `bodyBase64` | string | optional; base64-encoded request bytes; exclusive with `body` and `bodyText` |

Core validates body formats and rejects conflicting representations instead of silently choosing one. Backdoor forwards headers without a safe-header subset; they are request data, never caller authority. No browser cookies, API token or external login is needed for internal dispatch, and supplying one cannot replace the Core grant/admin checks. External HTTP authentication remains unchanged.

#### Discover the running API

Use this same tool; there is no redundant endpoint catalog or discovery tool:

```json
{"method":"GET","path":"/api/openapi.json"}
```

Inspect the returned schemas for the running Core before selecting a route. Any `/api` route, including Archive, operator/settings routes, mod routes and new endpoints, automatically uses the shared handler without a Backdoor tool update or an endpoint/verb allowlist. Native endpoint validation and pagination still apply. Relative `/api` access is not arbitrary-network access; endpoint actions may nevertheless start work or use configured integrations.

For a route that accepts JSON, supply its documented method/path and `body`. For raw text or bytes, set the appropriate content-type header and use only `bodyText` or `bodyBase64`. Preserve the complete query string and encoded parameter values.

#### Result

The tool returns the complete Core response object unchanged:

| Field | Meaning |
| --- | --- |
| `ok` | Core's response success indicator; inspect `status` and body for the operation outcome |
| `status` | Raw HTTP-style Core status, including non-success statuses |
| `headers` | Full response header object; values are strings or arrays of strings |
| `body` | Parsed JSON, UTF-8 text, base64-encoded bytes, or null for an empty response |
| `encoding` | `json`, `utf8`, or `base64` |
| `byteLength` | Original response byte count, before base64 expansion or JSON parsing |

Binary results use `encoding: "base64"`; decode the body as bytes, not UTF-8. Finite NDJSON is returned as complete UTF-8 text with its line boundaries, after the response ends. This is an aggregate tool result, **not real-time browser streaming**. An endless event stream cannot produce a completed aggregate. Core transport/resource limits can fail a request; Backdoor never converts an oversized response into truncated success.

When Core does not expose `context.coreApi`, activation still succeeds and this tool returns `{"ok":false,"error":"core_api_unavailable"}`. Check compatibility, the explicit capability grant and the required Core restart. API response errors remain raw response statuses/bodies; transport, cancellation, validation and authority failures may fail the tool call.

Caller cancellation is forwarded to Core. A cancelled/failed call or a lost response does not establish that a write was rolled back. Inspect current state before retrying. Generic requests do not automatically gain durable receipt, restart recovery or caller-settlement guarantees: use the **eight mod-management tools for lifecycle changes**, especially Backdoor self-update, disable or uninstall. See [operations and recovery](operations.md).

## Input conventions

`agentId` selects a target, never caller identity. Cursors should be passed through exactly as returned. Mod IDs use lowercase letters/digits separated by hyphens; Core reserves `mod-data`. An explicit version must match the currently inspected source latest version; this is a guard, not historical release selection. Use the UUID from the returned management receipt for operation lookup.
