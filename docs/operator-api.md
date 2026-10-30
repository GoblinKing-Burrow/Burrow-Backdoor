# Operator API

This is the Core-owned settings contract used by Backdoor’s operator UI. Agent administration uses [tools](tools.md), not a browser token or a second external API connection.

## Read access

`GET /api/operator/mods/burrow-backdoor/access`

Returns `grants`, `adminAgentIds`, `diagnosticAgentIds`, `declaredCapabilities`, and `restartRequired`. The first four fields are arrays of unique nonempty strings; `restartRequired` is boolean.

## Replace access

`PUT /api/operator/mods/burrow-backdoor/access`

The JSON body is a complete replacement of the writable authority fields:

```json
{
  "grants": ["mod-management-v1", "core-api-v1"],
  "adminAgentIds": ["your-admin-agent-id"],
  "diagnosticAgentIds": ["your-diagnostic-agent-id"]
}
```

This illustration approves **both** independent capabilities; omit `core-api-v1` unless the admin list should have unrestricted Core API reads/writes. `mod-management-v1` alone still authorizes only the eight management tools. Both capabilities use the existing `adminAgentIds` list; there is no per-tool grant. It is not a command to overwrite your configuration. Preserve unrelated grants and the other panel’s assignment list. Refresh the current record immediately before saving. Concurrent saves are last-writer-wins, not a merge protocol.

On Core builds containing the mod-access authentication fix, these routes follow Core’s operator-action contract:

- With authentication enabled, Core must verify an authenticated operator request.
- With `authMode: none`, direct UI requests are accepted without a separate operator login.
- API-token requests are rejected in both modes. Missing Core-verified authentication context is also rejected.

This changes the settings login gate only. Core-owned capability grants, agent assignments, input validation, and per-call authority checks still apply. The settings host injects a restricted `accessApi` adapter; the UI must not route these requests through the mod-owned `/api/mods/:modId/*` namespace or receive an arbitrary Core API client. Older Core builds can still reject no-auth settings access; see [settings troubleshooting](troubleshooting.md#settings-say-access-is-unavailable).

Newly granted host capabilities require a Core restart. In the current Core contract, a successful PUT reports `restartRequired: true`, while GET reports `false`; this is a save-time signal, not persistent tracking of whether you restarted. A later GET returning false does not prove the running host received the grant. Revocation is checked on Core admission and before a queued management mutation starts. A saved grant is not proof that an existing host has gained that capability before restart.

## Internal API access does not change external authentication

`burrow_api_request` is a separate server-side facade available only to a trusted active admin caller with effective, currently approved `core-api-v1`. It dispatches relative `/api` requests through the shared Core handler without browser cookies or tokens. It can reach operator routes as an authorized internal administrator; this does not make those routes anonymous to external HTTP clients. The UI adapter remains restricted to access settings, not an arbitrary API client. API results are not sanitized diagnostic projections.
