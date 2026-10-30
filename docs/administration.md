# Manage mods

!!! danger "Administrative tools change the home Burrow"
    These eight tools can change installed code and availability. An assigned administrator with the approved `mod-management-v1` capability can invoke them; the separate full API grant is not needed. Backdoor does not add a separate per-call confirmation dialog. Follow your own operator instructions and review the intended target and action before submitting.

## Before changing anything

Call `burrow_mod_management_inventory`. It returns sanitized configured-source status and available/installed mod summaries. Use `pagination.nextOffset` for continuation; the default page size is 50 and the maximum is 100. The same offset/page size applies to the mods and sources arrays.

Confirm the mod ID, installed version, available version, enablement, and whether it can be installed. Sources must already be configured by the operator in Core.

## Supported actions

| Tool | Input | Effect |
| --- | --- | --- |
| `burrow_refresh_mod_sources` | None | Refresh already configured sources |
| `burrow_install_mod` | `modId`, optional `version` | Queue Core installation |
| `burrow_update_mod` | `modId`, optional `version` | Queue Core install/update path |
| `burrow_enable_mod` | `modId` | Queue enablement |
| `burrow_disable_mod` | `modId` | Queue disablement |
| `burrow_uninstall_mod` | `modId` | Queue normal uninstall |

For example, an update uses `{"modId":"burrow-backdoor"}`. An explicit `version` must match the currently inspected source’s latest version. It acts as a version guard; it does not select or fetch arbitrary historical releases. The schema accepts calendar and semantic versions, optionally prefixed by `v`; acceptance of a version string is not proof that a matching release exists.

Installation does not automatically authorize a new system capability. Manage such grants through the operator settings. Fresh installs remain disabled until explicitly enabled.

## Finish the operation

Save the returned `operation.id`. Call `burrow_get_mod_operation` with that UUID in a later tool call. **A queued receipt is not a successful update.** Verify the terminal status and result, then recheck inventory where appropriate. See [operations and recovery](operations.md).

## Deliberate management-tool limits

These eight tools cannot add/remove mod sources or accept source URLs, source credentials or arbitrary installer flags. Inventory and errors are sanitized; source authentication stays inside Core. Use operator Settings to manage source configuration when you have not explicitly authorized broader API actions.

The separately granted [`burrow_api_request`](tools.md#burrow_api_request) is not restricted to these management projections: it can call all Core API routes, including sensitive reads and powerful writes. It is still relative `/api` dispatch, not a direct database, filesystem/process or arbitrary-network facade.

Prefer these durable lifecycle tools for every mod change, **especially Backdoor self-update, disable or uninstall**. A generic API request may retire its caller before returning and does not automatically get the persisted receipt and wait-for-caller behavior described here.

Lifecycle actions reuse Core distribution validation, authentication, recovery journals, and normal transitions. Backdoor being a system mod does not bypass those checks.
