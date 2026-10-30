# Sources and development

## Current implementation delta — 30 October 2026

This ordinary review follows Backdoor `a8c40cd0210be6c5db734a0b5af9c0d39700d182` (package **2026.10.29**) and Core `bea2171508d1821440ed5c554a688768848699c9`. The full Core API tool, separate capability grant, current settings, response formats, cancellation behavior and diagnostic delegation markers were compared with implementation and test declarations. These are source checks, not application tests or live-provider certification. The previous full reconciliation was 25 October; unchanged contracts retain that evidence. Public packages can lag the development source, so verify installed Core and Backdoor capabilities.

These guides describe Backdoor’s tool and settings contracts, with build-specific notes for Core behavior. Tool schemas are derived from the implementation; Core remains responsible for authorization, diagnostic sanitization, shared API dispatch, distribution, and operation persistence. Full API results are returned without Backdoor sanitization or truncation; these are not diagnostic projections.

| Contract | Public source |
| --- | --- |
| Tool registration and argument schemas | [src/mod.mjs](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/blob/main/src/mod.mjs) |
| System capability and settings contribution | [burrow.mod.json](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/blob/main/burrow.mod.json) |
| Operator settings and access replacement | [ui/settings.js](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/blob/main/ui/settings.js) |
| Boundary and integration checks | [test directory](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/tree/main/test) |
| Core behavior | [Burrow Backend](https://github.com/GoblinKing-Burrow/Burrow/tree/main/backend) |

## Versions

The no-auth settings behavior documented here requires a Core build containing the mod-access authentication fix. The public 2026.10.19 runtime predates that fix; see [settings troubleshooting](troubleshooting.md#settings-say-access-is-unavailable).

The full API tool requires a Core build supporting `core-api-v1` and the `context.coreApi.request` host contract. A compatible Core exposes it only for an effective grant, and still checks the admin caller and current authority on admission. Existing mod-management approval alone does not enable it.

Public release versions use UTC `YYYY.MM.DD`. Release CI assigns versions automatically; do not manually bump package or manifest versions for this change. Use compatible Core and Backdoor releases. Tool schemas also accept valid calendar revisions and semantic version strings as an explicit version guard, but Core requires a match to the source’s currently inspected latest version.

## Local checks

Use Node.js 24.x. From a Backdoor checkout:

```sh
npm ci --ignore-scripts --no-audit --no-fund
BURROW_CORE_ROOT=/absolute/path/to/Burrow-Backend npm run check
```

Install the compatible Core checkout’s dependencies first. `BURROW_CORE_ROOT` selects the integration target explicitly; a missing explicit checkout or a missing Core checkout in CI is a failure. Only optional automatic local discovery may skip integration tests, so check the reported skip count.

The focused `core-api.test.mjs` and `request-boundaries.test.mjs` checks use mock Core facades. `mod-integration.test.mjs` loads the actual selected Core host and uses mock diagnostic/management/API services to test schemas, capability exposure, caller authority and revocation. These checks do **not** establish that every live tool or API route was exercised. Report the actual command, target, pass/fail and skips instead of claiming complete live coverage.

Documentation checks:

```sh
python -m pip install -r requirements-docs.txt
python -m mkdocs build --strict
python scripts/docs/check_site.py site
```

The public site uses MkDocs Material. Documentation CI builds and checks links before deployment. The source and [license](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/blob/main/LICENSE) are available in the public repository.

## Historical review checkpoint: 21 October 2026

Before the full-API addition, these pages were reconciled from the [2026.10.19 runtime baseline](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/tree/02aef71e99bd54b4ee635251ab4496720cd4f5fa) through [public source `381b6f5`](https://github.com/GoblinKing-Burrow/Burrow-Backdoor/tree/381b6f50e545063e2a4434c1f56658f8b7d6d7f0). The public runtime implementation is unchanged across that interval; documentation changes do not imply a new runtime release. Core-dependent and forthcoming managed-skill behavior is identified separately in the relevant guides.

The original guides named the release line but did not pin every page to a commit. This review uses the published release snapshot and repository history as the baseline, rather than assuming an undocumented per-page source revision.

### Historical public-snapshot test limitation

The 2026.10.19 public snapshot includes `test/development-release-workflow.test.mjs` but excludes the development release workflow it reads. The aggregate `npm run check` therefore fails with a missing workflow file even when the mod's focused tests pass. Report that separately from runtime behavior. Core integration additionally requires the compatible Core checkout and dependencies described above; skipped integration cases do not establish compatibility.

