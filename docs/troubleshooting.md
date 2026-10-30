# Troubleshooting

## No Backdoor tool group

Check **Settings → Mods**: Backdoor must be installed, enabled, and successfully loaded. Fresh installations start disabled. Confirm Core recognizes both declared system capabilities and that Core/Backdoor releases are compatible. Disabling, unloading, or uninstalling Backdoor removes live tool routing.

## Own diagnostics work, another agent is forbidden

That is the default boundary. Assign the caller in **Global Access** only if cross-agent inspection is intended. Passing another `agentId`, selecting a Node Goblin target, or granting administration does not grant global diagnostics.

## Administration is forbidden

Confirm the calling agent is in **Admin Access** and the relevant capability is checked: **mod management** for the eight durable management tools, or **full Core API access** for `burrow_api_request`. These approvals are independent; global diagnostics never grants either. Follow any Core restart notice after a new capability grant. Core also rechecks authority immediately before queued work starts; access revoked after submission can make an operation fail.

## Full API reports core_api_unavailable

Backdoor can load without the effective full API capability. Check that Core supports `core-api-v1`, that it has been separately approved, and that Core was restarted after a new host grant. A saved authority record or a visible tool does not prove that the running host received `context.coreApi`. Do not add cookies, tokens or a service URL to work around it.

For forbidden API calls, verify the current caller's admin assignment and current capability grant; revocation is checked at admission. Native API validation errors and non-success statuses must also be inspected in the complete returned response. Discover the running schema with `GET /api/openapi.json` through the same tool.

Full API results are not truncated diagnostic subsets. Binary data uses `encoding: "base64"`; decode it as bytes. Finite NDJSON arrives only after completion; this tool is not a real-time browser/event stream, and an endless stream has no completed aggregate. Core resource/transport failures are errors rather than clipped successful output. After cancellation or a lost reply, inspect state before retrying a write.

## Settings say access is unavailable

The settings host must support the Core-owned access adapter. Update to a compatible UI/Core pair if it reports that Core-owned mod access is unsupported.

On Core builds containing the mod-access authentication fix, use a verified operator login when authentication is enabled. With `authMode: none`, direct UI access does not require a separate login. API tokens are still rejected for the access-settings route.

If `operator_authentication_required` appears with authentication disabled, check the running Core build. Older builds, including the public 2026.10.19 runtime, have a login gate that rejects this configuration. Use a compatible Core build containing the fix when available; updating Backdoor alone does not change this Core-owned route. Do not work around this by adding credentials to agent arguments or editing mod-owned settings.

## Operation stays queued or running

Keep its operation ID and inspect it in a later call. A receipt is acceptance, not completion. Avoid duplicate submissions. If Backdoor itself was disabled/uninstalled, use operator Settings. After interruption, reconcile actual mod state before retrying.

## Failed or interrupted mutation

| Code or condition | What to check |
| --- | --- |
| `mod_authority_forbidden` | Current capability grant and caller’s admin assignment |
| `mod_not_found` / `mod_source_not_resolved` | Target ID and configured source availability |
| `mod_version_unavailable` | Whether the requested version matches the source’s currently inspected latest version |
| `mod_install_in_progress` | Existing install/update work; wait and inspect state |
| `mod_source_authentication_failed` | Operator-managed source authentication |
| `mod_source_timeout` / `mod_source_git_failed` | Source availability and Core’s source status |
| `mod_archive_resources_exceeded` / `mod_archive_resources_unavailable` | Package resource limits or resource availability |
| `mod_management_unavailable` | Core management readiness/availability |
| `mod_management_operation_not_found` | Exact receipt UUID and Backdoor ownership |
| `mod_management_failed` / `mod_management_interrupted` | Sanitized failure or uncertain outcome; inspect actual state before retrying |

The management tools intentionally omit raw provider/source bodies. Diagnostic tools also use scoped projections. The separately approved full API tool returns raw endpoint error bodies and headers and can expose sensitive data; do not apply diagnostic privacy assumptions to it.

## Empty, truncated, or unsupported diagnostics

A session tail is not full history. Trace output is omitted by default. Context and Brains tools intentionally omit content bodies. Mod job diagnostics are opt-in; `unsupported` differs from `unavailable` or `diagnostic_error`. Use returned cursors for pagination rather than assuming the first page is complete.

## Report a problem

Include Core/Backdoor versions, the tool name, sanitized arguments, the error code, and whether the operation reached a terminal state. Review session/trace previews and actor identifiers before posting. Use the [public issue tracker](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/issues).
