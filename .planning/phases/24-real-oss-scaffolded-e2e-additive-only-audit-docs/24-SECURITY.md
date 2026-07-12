---
phase: 24
slug: real-oss-scaffolded-e2e-additive-only-audit-docs
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-11
---

# Phase 24 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

This phase is VERIFICATION + AUDIT + DOCS: it adds NO production runtime code, no
network endpoints, no auth, and no new shipped dependency. The only network action in
the whole phase is a loopback-gated (`127.0.0.1`) Verdaccio publish in the e2e
global-setup. No `high`+ severity threat exists in the phase surface; every plan-time
threat is `mitigate` or `accept`.

Each mitigation was re-verified INDEPENDENTLY against the actual implementation on
2026-07-11 (this audit run did NOT trust the draft's claims or the code review; it
grepped/read the cited files and located each mitigation by `file:line`). See the
"Independent Verification Evidence" section below. All eight threats resolve CLOSED;
`threats_open: 0`.

---

## Delta: ACV-01 gap-fix re-audit (2026-07-11)

The ACV-01 real-clone gate (realworld-angular @ `9e3528f`) surfaced a correctness bug
fixed in commits `1837b25` (fix) + `49974f1` (non-vacuous regression tests). This is a
re-audit of the security posture AFTER that fix. **Verdict: no new threat introduced;
`threats_open: 0` unchanged.**

**The change (production code, `packages/angular-typechecker/src/generators/configuration/generator.ts`):**
On the CLI write-fork (`tree.exists('angular.json') && !tree.exists('nx.json')`), the
project's `root`/`projectType` are now read STRAIGHT from angular.json
(`readJson<AngularJsonWorkspace>(tree, 'angular.json').projects[project]`) instead of via
`readProjectConfiguration`. A new `if (!cliProject) throw` guards an absent project.
`resolveTsConfigLeaves` took a `projectConfig` object before; it now takes
`(tree, root, projectType, schema)`. The Nx else-branch is byte-unchanged.

**Threat-surface assessment (grep/read-verified against HEAD + both commits):**

| Vector | Finding |
|--------|---------|
| Path traversal via `root` | **No new surface.** `root` is joined into leaf paths by the SAME mechanism as pre-fix -- `joinPathFragments(root, 'tsconfig.{app,lib,spec}.json')` (generator.ts:166-170) + a `tree.exists` probe (`:172`). The resolved path is existence-probed on the VIRTUAL Nx `Tree` (never `node:fs`) and written as a config string into `options.tsConfig`; it is NEVER executed, `require`d, or passed to a shell during generation. Confirmed: no `node:fs`/`child_process`/`exec`/`spawn`/`require()` call in generator.ts (only `node:path` `isAbsolute` + `@nx/devkit`). An out-of-workspace path would simply fail the probe and be dropped / throw the located error. |
| Untrusted-input handling | **No new trust boundary.** `root` now comes from angular.json, a WORKSPACE-controlled file the generator ALREADY reads (the `architect[targetName]` collision read) AND writes (`updateJson`, `:276`). It was already fully inside this generator's read+write trust boundary. `readProjectConfiguration` itself polyfills `root`/`projectType` from the SAME angular.json in the non-collision case, so the source value is identical there; the fix only changes which value wins under a pnpm-workspace name collision (authoritative angular.json vs a shadowing `root:"."` stub). Whoever controls angular.json could already set `options.tsConfig` directly -- no privilege is gained. |
| Injection | **None.** `root` interpolates only into `joinPathFragments` (path normalization) and a thrown Error message (`:175-178`) -- no shell, regex, query, or `eval` sink. |
| New `!cliProject` throw | **Reduces** surface -- a defensive guard against an undefined deref; not new surface. |
| Additive-only (T-24-01) | **Holds.** Both commits touched ONLY `generator.ts` + 2 spec files -- no `schema.json`, `schema.d.ts`, `executors.json`, `TYPECHECK_EXECUTOR_ID`, builder id, collection, or public barrel (`index.ts`) change. `resolveTsConfigLeaves` is a private (non-exported) function; its signature change is internal. The `AngularJsonProject` interface additions (`projectType?`, `root?`) are internal + additive. Cross-confirmed by `24-REVIEW-ACV01FIX.md` (status: resolved, 0 blockers). |

**Threat model impact:** The Phase 24 register (T-24-01..T-24-SC) covers the phase's
declared surface (barrel drift, fixture, docs, release, loopback e2e publish, npm config,
supply chain) -- none of those mitigations touch the generator's tsconfig-path resolution,
so all eight remain CLOSED. The generator's own threat model belongs to the earlier CLI
write-fork phase; the fix changes the SOURCE of an already-trusted config value, not the
mechanism, and adds no injection/traversal/untrusted-input sink. No `unregistered_flag`:
the change is a same-mechanism gap-fix within an existing, already-audited component, not
new attack surface. **`threats_open: 0` (unchanged).**

---

## Delta: 24-04 / 24-05 gap-closure re-audit (2026-07-12)

Two gap-closure plans landed on the already-secured phase after the original
24-01/02/03 audit: **24-04** (declare `nx` as a direct `^23.0.0` dependency so yarn
consumers get it) and **24-05** (finalize the yarn CLI e2e + add the committed pnpm
name-collision e2e). This is a re-audit of the NEW threat surface those plans introduced,
verified INDEPENDENTLY by read against the working tree (not from the plan drafts or the
code review). **Verdict: 3 new threats (T-24-08/09/10) all CLOSED; the 3 pre-existing
e2e threats (T-24-05/07/SC) re-verified against the extended surface; `threats_open: 0`
unchanged; no BLOCKER.**

**Threat total: 8 -> 11 (all CLOSED).**

### New + re-verified threats (grep/read-located)

| Threat ID | Category | Disposition | Evidence (file:line) | Verdict |
|-----------|----------|-------------|----------------------|---------|
| T-24-08 | Tampering (supply chain) | accept | `packages/angular-typechecker/package.json:49-53` declares `"nx": "^23.0.0"` in `dependencies` only; `peerDependencies` (`:54-59`) has NO `nx`. `^23.0.0` (`>=23.0.0 <24.0.0`) is a strict subset of `@nx/devkit@23.0.1`'s `nx` peer (`>= 22 <= 24 \|\| ^23.0.0-0`) -- cannot pull nx 22/24. `nx` was ALREADY in the tree transitively via devkit's peer, so no NEW package enters. | closed |
| T-24-09 | Denial of service (version skew) | accept | `packages/angular-typechecker/eslint.config.mjs:76` `checkVersionMismatches: false` (no autofix range rewrite); `:95` `ignoredDependencies: ['nx', '@angular-devkit/architect', 'rxjs']` includes `'nx'` (dep-checks stays green at maxWarnings:0). The `^23.0.0` subset means no double-constraint vs devkit's peer. | closed |
| T-24-10 | Elevation of privilege (pnpm build-scripts) | accept (**disposition change -- see below**) | `e2e/.../ng-add-ng-run-pnpm.e2e.spec.ts:212-215` writes `pnpm-workspace.yaml` with `strictDepBuilds: false` -- NOT the plan's `allowBuilds: { nx: true }`. Rationale documented at `:202-211`. | closed |
| T-24-05 | Tampering (registry) | mitigate | Global-setup loopback gate `e2e/.../global-setup.ts:118-122` (`if (!registryUrl.startsWith('http://127.0.0.1:')) throw`) intact; BOTH new specs re-assert it: yarn `ng-add-ng-run-yarn.e2e.spec.ts:249`, pnpm `ng-add-ng-run-pnpm.e2e.spec.ts:183`. | closed |
| T-24-07 | Tampering (env) | mitigate | `buildCleanEnv({ stripAllNpmConfig: true })` yarn `:107` / pnpm `:102`; `npm_config_userconfig -> .npmrc.nonexistent` yarn `:268-271` / pnpm `:235-238`; yarn keeps `enableMirror: false` (`:231`, load-bearing anti-stale-tarball); pnpm reads the tmp Verdaccio `.npmrc` via `writeVerdaccioNpmrc` (`:231`). | closed |
| T-24-SC | Tampering (installs) | accept | No NEW shipped package: the only `dependencies` delta is `nx`, a first-party Nrwl package already present transitively (T-24-08). e2e installs are all from local Verdaccio on 127.0.0.1 (T-24-05). Fixture ships canonical first-party Angular 22 devDeps only. | closed |

### T-24-10 disposition change (recorded)

The 24-05 plan declared the mitigation as `allowBuilds: { nx: true }` (approve ONLY nx's
postinstall). The executor DEVIATED and used `strictDepBuilds: false` instead. This is a
**strictly more restrictive** posture, not a regression:

- `allowBuilds: { nx: true }` would **RUN** nx's approved postinstall build script.
- `strictDepBuilds: false` disables pnpm 11's build-script gate so the install does not
  fail on the fixture's 5-6 unapproved native build-script packages
  (`@parcel/watcher`, `esbuild`, `lmdb`, `msgpackr-extract`, `nx`) -- and, with no
  `allowBuilds` allowlist, runs **ZERO** dependency postinstall scripts.

The type-check e2e needs none of those native postinstall artifacts (only wiring +
`ng run typecheck`), so skipping all build scripts is both sufficient AND the safest
posture (it avoids `@parcel/watcher`'s fragile build-from-source on Windows arm64). It
mirrors npm's proven skip-and-succeed on the same fixture. The threat's `accept`
disposition holds; the mitigation actually shipped is more restrictive than planned.

### Threat-flag / unregistered-surface reconciliation

No new production runtime code, network endpoint, auth surface, or shipped dependency
(beyond the already-transitive `nx`) was introduced. The e2e `ngRun` shell strings
(`corepack yarn ng run ${target}` / `npx ng run ${target}`) interpolate only
constant project ids (`APP_PROJECT`/`LIB_PROJECT`), not untrusted input -- no injection
sink. No `unregistered_flag`. The CLI-x-yarn `ng add` no-autowire (the retained
`ng g angular-typechecker:ng-add` wire step at `ng-add-ng-run-yarn.e2e.spec.ts:302`) is a
documented Angular-CLI / nx-transitive-hoist quirk (resolved debug doc +
24-REVIEW-GAP-2404-2405-FIX.md), NOT a security concern.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| public API barrel (`src/index.ts`) -> downstream consumers | A narrowed/renamed export is a silent breaking change; the drift tripwire guards it | Public type/symbol surface |
| test fixture on disk -> builder eager prelude | `fixtures/builder-context/angular.json` is read by the builder's project-graph prelude; first-party test fixture, not untrusted input | Local fixture config |
| README/CHANGELOG prose -> consumer trust | An over-claimed or softened support statement misleads consumers about what is verified | Documentation claims |
| e2e publish step -> npm registry | The global-setup publishes the built tarball; it MUST be local Verdaccio (`127.0.0.1`), never the public registry | Built package tarball |
| committed fixture -> repository | The fixture ships in git; must contain no secrets/tokens and only first-party pinned Angular deps | Scaffolded workspace |
| tmp install (`ng add`) -> package resolution | Inherited `npm_config_*` (a leaked `legacy-peer-deps`) could mask a real on-stack peer result or retarget the install | npm config env |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-24-01 | Tampering | public barrel / schemas (additive-only regression) | mitigate | `src/index.drift.ts` `tsc --noEmit` tripwire (all 5 barrel exports) wired into `tsconfig.drift.json` + `24-ADDITIVE-AUDIT.md` git-diff audit vs `angular-typechecker@0.2.0` + existing surface-regression/schema-parity guards. Verified: `nx typecheck` (drift) green; version unchanged at 0.2.0. | closed |
| T-24-02 | Spoofing | builder-context fixture resolves the wrong workspace root | mitigate | `TestingArchitectHost` pinned at `fixtures/builder-context/`; the WR-01 hardening asserts the planted `TS2322`/`TS2345` surface (fixture genuinely resolves + type-checks). Verified: `builder.integration.spec.ts` green + non-vacuous. | closed |
| T-24-03 | Information disclosure / Repudiation | README `## Angular CLI` claims (softened/over-claimed/deleted) | mitigate | `src/angular-cli-docs.spec.ts` content tripwire (9 tests) locks the load-bearing claims; the `storybook-docs.spec.ts` "not supported" caveat is preserved (not weakened). Verified green. | closed |
| T-24-04 | Tampering | accidental version/tag cut in a prose-only docs change | mitigate | CHANGELOG is prose-only; `package.json` unchanged (verified 0.2.0); no tag; the Release-PR flow is the sole cut path (AGENTS.md). | closed |
| T-24-05 | Tampering | e2e accidentally publishes to a real registry | mitigate | The global-setup `127.0.0.1`-only publish SAFETY gate copied verbatim (`if (!registryUrl.startsWith('http://127.0.0.1:')) throw`) + the loopback invariant re-asserted in the spec. Verified intact by code review. | closed |
| T-24-06 | Information disclosure | committed fixture ships a secret/token or a peer-masking `.npmrc` | mitigate | Fixture stripped of `node_modules`/`.git`; first-party pinned Angular deps only + committed `package-lock.json`; no fixture `.npmrc` with `legacy-peer-deps`; the Verdaccio `.npmrc` is written to tmp at test time, never committed. Verified: no secret/email/`consensus.dk` leak in phase-new files. | closed |
| T-24-07 | Tampering | inherited npm config masks a real on-stack peer result | mitigate | `buildCleanEnv({ stripAllNpmConfig: true })` strips every `npm_config_*`; the spec asserts the on-stack Angular 22 install needs no `--legacy-peer-deps` flag. Verified intact by code review. | closed |
| T-24-SC | Tampering | supply chain (npm/pip/cargo installs) | accept | No new package enters the SHIPPED plugin; `@angular-devkit/architect/testing` is an already-installed optional peer; the fixture declares canonical first-party Angular 22 devDeps only. See Accepted Risks. | closed |
| T-24-08 | Tampering (supply chain) | `nx` added to `dependencies` (24-04) | accept | `nx@^23.0.0` declared in `dependencies` only (`package.json:49-53`), NOT a peer; strict subset of devkit's `nx` peer; same first-party package already present transitively -- no NEW package. See Delta 24-04/24-05. | closed |
| T-24-09 | Denial of service | `nx` version-range skew (24-04) | accept | `checkVersionMismatches: false` + `'nx'` in `ignoredDependencies` (`eslint.config.mjs:76,95`); `^23.0.0` subset avoids double-constraint. See Delta 24-04/24-05. | closed |
| T-24-10 | Elevation of privilege | pnpm postinstall build scripts (24-05) | accept | `strictDepBuilds: false` (`ng-add-ng-run-pnpm.e2e.spec.ts:212-215`) runs ZERO dependency build scripts -- MORE restrictive than the planned `allowBuilds: { nx: true }` (which would run nx's postinstall). Disposition change recorded in Delta 24-04/24-05. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Independent Verification Evidence

Located by grep/read against the working tree on 2026-07-11 (not from the draft or
`24-REVIEW.md`). Every mitigation was found in its cited location.

| Threat ID | What was checked | Located at (file:line) | Verdict |
|-----------|------------------|------------------------|---------|
| T-24-01 | Barrel drift tripwire imports + references all 5 exports (2 value + 3 type-only) | `src/index.drift.ts:21-22` (imports), `:27-28,33,35` (references) | present |
| T-24-01 | Tripwire wired into the drift `tsc --noEmit` target | `tsconfig.drift.json:15` (`"src/index.drift.ts"` in `files`) | present |
| T-24-01 | Barrel under lock exports exactly the 5 names | `src/index.ts:14-19` | present |
| T-24-01 | Additive-only git-diff verdict vs the `0.2.0` tag (barrel UNCHANGED, executor schema WIDEN-ONLY, others unchanged/new-file) | `24-ADDITIVE-AUDIT.md:52-59` | present |
| T-24-01 / T-24-04 | Published `version` unchanged at `0.2.0` | `packages/angular-typechecker/package.json:3` | confirmed |
| T-24-02 | `TestingArchitectHost(fixtureRoot, fixtureRoot)` pinned at `fixtures/builder-context` | `builder.integration.spec.ts:60,85` | present |
| T-24-02 | WR-01 hardening: planted `TS2322`+`TS2345` asserted in captured stdout (not a vacuous `success:false`) | `builder.integration.spec.ts:165-166,189-190` | present |
| T-24-02 | Fixture is a resolvable Angular CLI root declaring the builder + 2-element `tsConfig` | `fixtures/builder-context/angular.json:12-16` | present |
| T-24-03 | Docs tripwire locks the load-bearing `## Angular CLI` claims (9 assertions) | `src/angular-cli-docs.spec.ts:26-83` | present |
| T-24-03 | README carries the auto-wire-all + parity + no-caching + nx-transitive + off-stack claims | `README.md:394-396,417-418,451,456-457,467-468` | present |
| T-24-03 | Storybook "not supported" caveat preserved (not weakened) + coherent deferral | `storybook-docs.spec.ts:67-70`; `README.md:461-463,567-568` | present |
| T-24-04 | CHANGELOG `0.2.1` entry is prose only (no version bump, no link ref) | `CHANGELOG.md:5-32` | present |
| T-24-04 | No `angular-typechecker@0.2.1` git tag exists (latest tag is `@0.2.0`) | `git tag -l` (0.0.1..0.2.0 only) | confirmed |
| T-24-05 | Loopback-only publish SAFETY gate (`if (!registryUrl.startsWith('http://127.0.0.1:')) throw`) | `e2e/.../src/global-setup.ts:118-122` | present |
| T-24-05 | Loopback invariant re-asserted in the spec | `e2e/.../src/ng-add-ng-run.e2e.spec.ts:174` | present |
| T-24-06 | Committed fixture: no `.npmrc`, `package-lock.json` present, no `node_modules`/`.git` | `git ls-files` fixture tree (34 files, none an `.npmrc`) | confirmed |
| T-24-06 | No secret/token committed; only `legacy-peer-deps` hit is a PROHIBITION note | secret grep = NO_SECRET_MATCH; `REGENERATE.md:34` (prohibition only) | confirmed |
| T-24-06 | Fixture declares canonical first-party pinned Angular 22 devDeps only | `fixtures/.../package.json:13-32` | confirmed |
| T-24-07 | `buildCleanEnv({ stripAllNpmConfig: true })` strips every `npm_config_*` | `global-setup.ts:128,130-134`; `ng-add-ng-run.e2e.spec.ts:92` | present |
| T-24-07 | On-stack install asserted with NO `--legacy-peer-deps` (`sh('npm install')` throws on ERESOLVE) | `ng-add-ng-run.e2e.spec.ts:202` | present |
| T-24-SC | No new SHIPPED dep (deps still `@nx/devkit`+`tslib`); `@angular-devkit/architect/testing` already installed as an optional peer | `package.json:49-64`; `node_modules/@angular-devkit/architect/testing` present | confirmed |

Threat-flag reconciliation: no SUMMARY carries a `## Threat Flags` heading; `24-03-SUMMARY.md:145` states "No threat flags." No unregistered attack surface. Mitigations `T-24-05/06/07` map to the disclosed e2e surface. No unregistered flags to log.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-24-01 | T-24-SC | Phase 24 adds no new dependency to the shipped plugin. The only dev-time libraries used (`@angular-devkit/architect/testing`, `@angular/cli`, first-party pinned Angular 22 packages in the committed fixture) are canonical first-party Angular packages, already installed / already optional peers, verified against `registry.npmjs.org` (RESEARCH.md Package Legitimacy Audit — none `[ASSUMED]`/`[SUS]`). Verdaccio proxies upstream at pinned versions. | Lars Gyrup Brink Nielsen | 2026-07-11 |
| AR-24-02 | T-24-08 | 24-04 adds `nx@^23.0.0` to the shipped plugin's `dependencies`. This is NOT a new package: `nx` is the same first-party Nrwl package already pulled transitively via `@nx/devkit`'s `nx` peer (npm/pnpm auto-install it). Declaring it direct only ensures yarn consumers (which do not auto-install peers) get it. `^23.0.0` is Nx-23-only and a strict subset of devkit's peer range -- cannot introduce nx 22/24. No new attack surface. | Lars Gyrup Brink Nielsen | 2026-07-12 |
| AR-24-03 | T-24-10 | The pnpm CLI e2e disables pnpm 11's build-script gate with `strictDepBuilds: false` rather than approving nx's postinstall via `allowBuilds`. This runs ZERO dependency build scripts (strictly safer than the planned allowlist) and is test-infra only -- the shipped plugin is unaffected. | Lars Gyrup Brink Nielsen | 2026-07-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-11 | 8 | 8 | 0 | Claude (gsd-secure-phase; mitigations cross-confirmed by 24-REVIEW.md + 24-VERIFICATION.md) |
| 2026-07-11 | 8 | 8 | 0 | Claude (gsd-security-auditor; INDEPENDENT file-level re-verification -- each mitigation located by grep/read at `file:line`, draft claims NOT trusted; see Independent Verification Evidence) |
| 2026-07-11 | 8 | 8 | 0 | Claude (gsd-security-auditor; ACV-01 gap-fix re-audit of commits `1837b25`+`49974f1` -- generator.ts CLI write-fork now reads `root`/`projectType` straight from angular.json; no new threat, same-mechanism gap-fix, additive-only; see Delta section) |
| 2026-07-12 | 11 | 11 | 0 | Claude (gsd-security-auditor; 24-04/24-05 gap-closure re-audit -- 3 NEW threats T-24-08/09/10 verified by read against package.json + eslint.config.mjs + the two new CLI e2e specs; T-24-05/07/SC re-verified on the extended surface; T-24-10 disposition change recorded (`strictDepBuilds:false` > planned `allowBuilds`); no BLOCKER; see Delta 24-04/24-05) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-11
