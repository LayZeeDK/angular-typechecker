---
phase: 14
slug: configuration-init-generators-nx-add
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-02
---

# Phase 14 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> All 9 threats were authored at plan time (`register_authored_at_plan_time: true`,
> `<threat_model>` in all three PLAN.md files) and verified CLOSED. Every mitigation
> was independently confirmed present by the deep code review (commit-anchored,
> 0 blockers) and the goal verifier (5/5 success criteria). No `high`-severity
> threats exist: this is a dev-time, config-editing Nx generator with no network,
> runtime-credential, arbitrary-filesystem, or install-lifecycle surface (no
> `generateFiles`, no `postinstall`).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| developer CLI -> `init` generator | `nx g angular-typechecker:init` (or `nx add` invoking it) mutates the workspace `nx.json` `targetDefaults` via the in-memory `Tree`. Only (empty/`skipFormat`) schema args cross. | Workspace config (`nx.json`) |
| developer CLI -> `configuration` generator | `nx g angular-typechecker:configuration <project> [--tsConfig] [--targetName]` mutates the target project's `project.json` (and `nx.json` via the nested `init`) through the in-memory `Tree`. Schema args (`additionalProperties: false`) cross. | Project config (`project.json`), workspace config (`nx.json`) |
| npm tarball / `nx add` -> consumer workspace | The published `generators.json` + `package.json` `generators` field are the discovery surface `nx add`/`nx g` read. No install script; `nx add` runs `init` via the Nx CLI, not an npm lifecycle hook. | Package manifest / generator collection metadata |

*No network, no runtime credentials, no arbitrary filesystem access: generators operate on the in-memory `Tree` (`readJson`/`tree.exists`/`updateNxJson`/`updateProjectConfiguration`), never `node:fs`.*

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-14-01 | Tampering | `init/generator.ts` writing `nx.json` targetDefaults | mitigate | Whole-entry `??=` don't-clobber (D-05): seeds only when the UNSCOPED `angular-typechecker:typecheck` key is absent, so a user-customized cacheable block is never overwritten. Proven by the `init.spec.ts` don't-clobber case. | closed |
| T-14-02 | Tampering (correctness / stale-green) | the seeded `inputs` array | mitigate | WALK-02 block copied VERBATIM from `nx.json:44-58`; `init.spec.ts` asserts `inputs[0] === 'default'` and `inputs` excludes `'production'` (a `production` seed would under-hash `*.spec.ts` -> stale PASS). Reviewer confirmed byte-match. | closed |
| T-14-03 | Tampering | `configuration/generator.ts` writing `project.json` | mitigate | GEN-04/D-09: a same-named NON-ours target (executor != `angular-typechecker:typecheck`) throws a clear located error instead of clobbering; OUR target is merge-rewritten preserving user-added keys (idempotent, strengthened in `c306eee`). Collision + idempotency + merge-preserve spec cases. | closed |
| T-14-04 | Tampering / DoS (stale-green) | `--tsConfig` / tsConfig resolution | mitigate | Resolution reads the virtual `Tree` (`readJson`/`tree.exists`), joins via `joinPathFragments(projectConfig.root, ...)` (workspace-root-relative, matching the executor), existence-probes the relative `--tsConfig` override (`c306eee`) and the flat leaf, and throws a clear located error when nothing resolves. No `node:fs`, no path outside the Tree. | closed |
| T-14-05 | Input validation | schema args (`project`/`tsConfig`/`targetName`) | mitigate | `additionalProperties: false` on both generator schemas (schema-parity specs + `@nx/nx-plugin-checks` validate); `readProjectConfiguration` throws on an unknown project; configurable `targetName` sidesteps a genuine name clash. | closed |
| T-14-06 | Tampering | `generators.json` registration (unresolvable factory/schema) | mitigate | `@nx/nx-plugin-checks` (ERROR, on `package.json`) validates the generators collection — every `factory`/`schema` path must resolve. `nx lint angular-typechecker` is GREEN (blocking gate), so a bad path fails CI loudly rather than silently mis-registering. | closed |
| T-14-07 | Tampering | `package.json` `files` allowlist / build asset glob | mitigate | Explicit `files` allowlist (never npm defaults) + a dedicated `project.json` build asset glob ship `generators.json`; `package-manifest.spec.ts` pins both `package.json.generators === './generators.json'` and the `files` entry. (The tarball-audit REQUIRED_FILES proof that the compiled `generator.js` files ship is Phase 15's scope.) | closed |
| T-14-SC | Tampering (supply chain) | package installs | accept | No npm/pip/cargo install occurs in this phase; the generators import only the already-pinned, audited `@nx/devkit` dependency + Node builtins. `@nx/dependency-checks` (ERROR) independently confirms no undeclared import. No `postinstall`/lifecycle script added. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-14-01 | T-14-SC | Phase 14 installs no packages and adds no install-lifecycle script; the only new imports are the already-pinned `@nx/devkit` + Node builtins, policed by `@nx/dependency-checks`. No residual supply-chain surface to mitigate further. | Lars Gyrup Brink Nielsen | 2026-07-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-02 | 8 | 8 | 0 | gsd-secure-phase (orchestrator; mitigations cross-confirmed by the Phase 14 deep code review + goal verifier) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-02
