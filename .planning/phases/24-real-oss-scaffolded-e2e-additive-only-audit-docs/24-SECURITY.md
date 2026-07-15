---
phase: 24
slug: real-oss-scaffolded-e2e-additive-only-audit-docs
status: verified
threats_open: 0
severity_max: none
asvs_level: 1
created: 2026-07-11
last_audited: 2026-07-15
---

# Phase 24 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

This phase is VERIFICATION + AUDIT + DOCS + a single nx-free ng-add product change (24-06):
it adds NO network endpoints, no auth, and no new shipped dependency. The only network action
in the whole phase is a loopback-gated (`127.0.0.1`) Verdaccio publish in the e2e global-setup.
No `high`+ severity threat exists in the phase surface; every plan-time threat is `mitigate`
or `accept`. **`threats_open: 0`; `severity_max: none`; no BLOCKER.**

Each mitigation was re-verified INDEPENDENTLY against the actual implementation (this audit
did NOT trust plan claims or code reviews; it grepped/read the cited files and located each
mitigation by `file:line`). See the "Independent Verification Evidence" section below. All
fifteen threats resolve CLOSED.

---

## Delta: 24-06 nx-free vanilla ng-add re-audit (2026-07-15)

Plan **24-06** (NGADD-01 yarn first-run auto-wire, Option C) landed AFTER the 2026-07-12
audit that covered 24-01..24-05. It makes the Angular CLI `ng-add` schematic a VANILLA
`@angular-devkit/schematics` Rule with ZERO `@nx/devkit`, and extracts the collision-fixed
wiring logic into a shared PURE core `src/core/angular-cli-wiring.ts` (imported by BOTH the
vanilla ng-add AND the Nx `configuration` generator). This re-audit verifies the 4 threats
that plan declared plus re-confirms the still-standing e2e / supply-chain mitigations against
the new surface. **Verdict: 4 new threats (T-24-06-01/02/03/SC) all CLOSED; `threats_open: 0`
unchanged; no new attack surface; no BLOCKER.**

**Threat total: 11 -> 15 (all CLOSED).**

### New threats (grep/read-located against HEAD)

| Threat ID | Category | Disposition | Evidence (file:line) | Verdict |
|-----------|----------|-------------|----------------------|---------|
| T-24-06-01 | Tampering (consumer angular.json rewrite) | mitigate | Null-guarded `tree.read` for BOTH `package.json` (`schematic.ts:40-42`) and `angular.json` (`:58-64`); the WHOLE workspace object is parsed once (`:68-70`) and re-stringified whole (`:114`) -- never a partial write; every unmodeled key is preserved via the `[key: string]: unknown` index signatures on `AngularJsonTarget/Project/Workspace` (`angular-cli-wiring.ts:43-59`). The migrated spec asserts an untouched project stays unwired (`ng-add.spec.ts:123,200`) and that a pre-existing OUR target's `maxWarnings`/`configurations` survive an idempotent re-run (`:136-167`). | closed |
| T-24-06-02 | Tampering (dropped tsconfig leaf -- "a type-checker that lies") | mitigate | Core `resolveTsConfigLeaves` builds the `[build, spec]` array, existence-filters each leaf, and THROWS the located error when the result is empty rather than writing an under-checking target (`angular-cli-wiring.ts:124-151`). The pure core spec asserts the exact `['tsconfig.app.json','tsconfig.spec.json']` array, the missing-leaf-drop, and the empty->throw regex (`angular-cli-wiring.spec.ts:82,96,122`). The Nx `configuration` generator routes the SAME core (`generator.ts:16`), keeping its observable behaviour byte-identical (its own not-found throw stays local at `:150`); the CLI e2e plants distinct per-leaf codes (app TS2322/TS2345, lib TS2554) with no cross-bleed. | closed |
| T-24-06-03 | Tampering (e2e publishes to a real registry) | mitigate | The global-setup loopback SAFETY gate is intact: `if (!registryUrl.startsWith('http://127.0.0.1:')) throw` (`global-setup.ts:150-154`); the yarn spec re-asserts `verdaccioUrl.startsWith('http://127.0.0.1:')` (`ng-add-ng-run-yarn.e2e.spec.ts:238`) and keeps the load-bearing `enableMirror: false` (`:220`) + numeric-loopback `unsafeHttpWhitelist` (`:214`). | closed |
| T-24-06-SC | Tampering (new shipped dependency / supply chain) | accept | NO new shipped runtime dependency. The shared core imports ONLY `node:path` (`angular-cli-wiring.ts:1`) -- no `node:fs`, `child_process`, or network. The vanilla schematic's `@angular-devkit/schematics` imports are TYPE-ONLY (`schematic.ts:1`, `import type`), erased at compile: the compiled `dist/.../schematic.js` `require()`s ONLY `"../../core/angular-cli-wiring"` (dist grep = clean of `@nx/devkit`/`convertNxGenerator`/`require(@angular-devkit/schematics)`). `package.json` `dependencies` are unchanged (`@nx/devkit@23.0.1`, `nx@^23.0.0`, `tslib`); `@angular-devkit/schematics` is a consumer-provided Angular CLI peer, ignored in dep-checks (`eslint.config.mjs:101-106`). The D-11 `core/**` lint boundary bans every Nx/@nx/@angular-devkit/nx/yargs import (incl. type-only) in the core (`eslint.config.mjs:16-64`). | closed |

### Purity + boundary confirmation (24-06)

- `git grep -n "^import\|require(" src/core/angular-cli-wiring.ts` returns ONLY `import { isAbsolute, posix } from 'node:path'`. No fs / child_process / net / http in the core OR the schematic (grep = NONE). The core is pure and existence is injected via an `exists(path)` callback -- no direct disk access, no path traversal sink (leaf paths are `posix.join`ed and only existence-probed, never executed / `require`d / shelled).
- The consumer's `angular.json` is the ONLY thing written, via the virtual schematic `Tree.overwrite` -- never `node:fs`, so nothing outside the workspace tree can be written.
- Error strings are byte-preserved from the pre-refactor generator (the `configuration` specs + schema-parity spec stay green; the core spec asserts each message regex).

### T-24-10 (pnpm build-gate) re-confirmed on the flipped e2e

The CLI x pnpm-workspace e2e still satisfies pnpm 11's build-script gate via
`strictDepBuilds: false` (`ng-add-ng-run-pnpm.e2e.spec.ts:214`), NOT `allowBuilds: { nx: true }`.
As recorded in the 24-04/24-05 delta, this is STRICTLY MORE restrictive -- it runs ZERO
dependency build scripts (no postinstall executes at all), where an `allowBuilds` allowlist
would RUN nx's approved postinstall. Rationale documented at `:43-53,200-207`. `accept` holds.

### Additive-only + threat-flag reconciliation (24-06)

- The `ng-add` implementation change is inside the UNRELEASED v0.2.1 Angular CLI surface
  (0.2.0 has no Angular CLI surface), so it is additive by construction: `collection.json`'s
  ng-add factory + schema paths are byte-unchanged, the executor id is unchanged, `src/index.ts`
  is byte-unchanged, ng-add stays ABSENT from `generators.json` (`nx add` unchanged). The dead
  `src/generators/ng-add/generator.ts` was deleted; its `schema.json`/`schema.d.ts` are kept.
- The yarn `ngRun` shell strings (`corepack yarn ng add angular-typechecker --skip-confirmation`,
  `corepack yarn ng run ${target}`) interpolate only constant project ids -- no untrusted input,
  no injection sink. The `ng g angular-typechecker:ng-add` fallback line is REMOVED (grep = 0).
- `24-06-SUMMARY.md` carries NO `## Threat Flags` heading. No unregistered attack surface; no
  `unregistered_flag` to log.
- Public-repo hygiene (allowlist-inversion over every phase-changed tracked source/e2e/config
  file): the ONLY identity email-shaped token is `larsbrinknielsen@gmail.com` (the approved
  public gmail). The other email-shaped token, `ci@example.com`, is a synthetic RFC-2606
  reserved-domain placeholder used to register the throwaway Verdaccio CI user in the two e2e
  `global-setup.ts` files -- not an identity, not the forbidden work domain. No leak.

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
`(tree, root, projectType, schema)`. The Nx else-branch is byte-unchanged. (24-06 later
extracted `resolveTsConfigLeaves` into the shared pure core -- see the 24-06 delta above.)

**Threat-surface assessment (grep/read-verified):**

| Vector | Finding |
|--------|---------|
| Path traversal via `root` | **No new surface.** `root` is joined into leaf paths by `posix.join(root, 'tsconfig.{app,lib,spec}.json')` (now in `angular-cli-wiring.ts:135-139`) + an existence probe. The resolved path is existence-probed on the VIRTUAL Nx `Tree`/injected callback (never `node:fs`) and written as a config string; it is NEVER executed, `require`d, or shelled. No `node:fs`/`child_process`/`exec`/`spawn`/`require()` call in the generator or the core. |
| Untrusted-input handling | **No new trust boundary.** `root` comes from angular.json, a WORKSPACE-controlled file the generator already reads AND writes. Whoever controls angular.json could already set `options.tsConfig` directly -- no privilege is gained. |
| Injection | **None.** `root` interpolates only into `posix.join` (path normalization) and a thrown Error message -- no shell, regex, query, or `eval` sink. |
| New `!cliProject` throw | **Reduces** surface -- a defensive guard against an undefined deref. |
| Additive-only (T-24-01) | **Holds.** Both commits touched ONLY `generator.ts` + 2 spec files -- no `schema.json`, `schema.d.ts`, `executors.json`, `TYPECHECK_EXECUTOR_ID`, builder id, collection, or public barrel change. Cross-confirmed by `24-REVIEW-ACV01FIX.md` (0 blockers). |

---

## Delta: 24-04 / 24-05 gap-closure re-audit (2026-07-12)

Two gap-closure plans landed after the original 24-01/02/03 audit: **24-04** (declare `nx`
as a direct `^23.0.0` dependency so yarn consumers get it) and **24-05** (finalize the yarn
CLI e2e + add the committed pnpm name-collision e2e). **Verdict: 3 new threats
(T-24-08/09/10) all CLOSED; the 3 pre-existing e2e threats re-verified; `threats_open: 0`
unchanged; no BLOCKER.**

**Threat total: 8 -> 11 (all CLOSED).**

| Threat ID | Category | Disposition | Evidence (file:line) | Verdict |
|-----------|----------|-------------|----------------------|---------|
| T-24-08 | Tampering (supply chain) | accept | `package.json:49-53` declares `"nx": "^23.0.0"` in `dependencies` only; `peerDependencies` (`:54-59`) has NO `nx`. `^23.0.0` is a strict subset of `@nx/devkit@23.0.1`'s `nx` peer -- cannot pull nx 22/24. `nx` was ALREADY transitive via devkit's peer, so no NEW package enters. | closed |
| T-24-09 | Denial of service (version skew) | accept | `eslint.config.mjs:76` `checkVersionMismatches: false`; `:101-106` `ignoredDependencies` includes `'nx'`. The `^23.0.0` subset avoids double-constraint vs devkit's peer. | closed |
| T-24-10 | Elevation of privilege (pnpm build-scripts) | accept | `ng-add-ng-run-pnpm.e2e.spec.ts:214` writes `strictDepBuilds: false` -- runs ZERO dependency build scripts, MORE restrictive than the planned `allowBuilds: { nx: true }`. Disposition change recorded. | closed |
| T-24-05 | Tampering (registry) | mitigate | Global-setup loopback gate `global-setup.ts:150-154` intact; both CLI specs re-assert it (yarn `:238`, pnpm `:183`). | closed |
| T-24-07 | Tampering (env) | mitigate | `buildCleanEnv({ stripAllNpmConfig: true })` (`global-setup.ts:160`); the assert-no-`npm_config_*` guard (`:162-166`); yarn keeps `enableMirror: false`. | closed |
| T-24-SC | Tampering (installs) | accept | No NEW shipped package: the only `dependencies` delta is `nx`, a first-party Nrwl package already present transitively (T-24-08). e2e installs are all from local Verdaccio on 127.0.0.1 (T-24-05). | closed |

### T-24-10 disposition change (recorded)

`allowBuilds: { nx: true }` would RUN nx's approved postinstall; `strictDepBuilds: false`
disables pnpm 11's build-script gate so the install does not fail on the fixture's unapproved
native build-script packages AND runs ZERO dependency postinstall scripts. The type-check e2e
needs none of those artifacts, so skipping all build scripts is both sufficient AND the safest
posture. The `accept` disposition holds; the shipped mitigation is more restrictive than
planned.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| public API barrel (`src/index.ts`) -> downstream consumers | A narrowed/renamed export is a silent breaking change; the drift tripwire guards it | Public type/symbol surface |
| `ng add` consumer input -> angular.json rewrite | The vanilla ng-add parses + rewrites the CONSUMER's angular.json; a bad write could corrupt their workspace config (T-24-06-01) | Consumer workspace config |
| test fixture on disk -> builder eager prelude | `fixtures/builder-context/angular.json` is read by the builder's project-graph prelude; first-party test fixture, not untrusted input | Local fixture config |
| README/CHANGELOG prose -> consumer trust | An over-claimed or softened support statement misleads consumers about what is verified | Documentation claims |
| e2e publish step -> npm registry | The global-setup publishes the built tarball; it MUST be local Verdaccio (`127.0.0.1`), never the public registry | Built package tarball |
| committed fixture -> repository | The fixture ships in git; must contain no secrets/tokens and only first-party pinned Angular deps | Scaffolded workspace |
| tmp install (`ng add` under yarn) -> package resolution | Inherited `npm_config_*` or a global yarn mirror could mask a real on-stack peer result or install a stale tarball | npm/yarn config + mirror |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-24-01 | Tampering | public barrel / schemas (additive-only regression) | mitigate | `src/index.drift.ts` `tsc --noEmit` tripwire (all 5 barrel exports) wired into `tsconfig.drift.json` + `24-ADDITIVE-AUDIT.md` git-diff audit vs `angular-typechecker@0.2.0` + existing surface-regression/schema-parity guards. Verified: drift target green; version unchanged at 0.2.0. | closed |
| T-24-02 | Spoofing | builder-context fixture resolves the wrong workspace root | mitigate | `TestingArchitectHost` pinned at `fixtures/builder-context/`; the WR-01 hardening asserts the planted `TS2322`/`TS2345` surface. Verified: `builder.integration.spec.ts` green + non-vacuous. | closed |
| T-24-03 | Information disclosure / Repudiation | README `## Angular CLI` claims (softened/over-claimed/deleted) | mitigate | `src/angular-cli-docs.spec.ts` content tripwire (9 tests) locks the load-bearing claims; the `storybook-docs.spec.ts` "not supported" caveat is preserved. Verified green. | closed |
| T-24-04 | Tampering | accidental version/tag cut in a prose-only docs change | mitigate | CHANGELOG is prose-only; `package.json` unchanged (verified 0.2.0); no tag; the Release-PR flow is the sole cut path. | closed |
| T-24-05 | Tampering | e2e accidentally publishes to a real registry | mitigate | The global-setup `127.0.0.1`-only publish SAFETY gate (`if (!registryUrl.startsWith('http://127.0.0.1:')) throw`) + the loopback invariant re-asserted in each CLI spec. Verified. | closed |
| T-24-06 | Information disclosure | committed fixture ships a secret/token or a peer-masking `.npmrc` | mitigate | Fixture stripped of `node_modules`/`.git`; first-party pinned Angular deps only + committed `package-lock.json`; no fixture `.npmrc`; the Verdaccio `.npmrc` is written to tmp at test time. Verified: no secret/email/work-domain leak. | closed |
| T-24-07 | Tampering | inherited npm config masks a real on-stack peer result | mitigate | `buildCleanEnv({ stripAllNpmConfig: true })` strips every `npm_config_*`; the spec asserts the on-stack Angular 22 install needs no `--legacy-peer-deps`. Verified. | closed |
| T-24-SC | Tampering | supply chain (npm installs) | accept | No new package enters the SHIPPED plugin; the fixture declares canonical first-party Angular 22 devDeps only. See Accepted Risks. | closed |
| T-24-08 | Tampering (supply chain) | `nx` added to `dependencies` (24-04) | accept | `nx@^23.0.0` in `dependencies` only (`package.json:49-53`), NOT a peer; strict subset of devkit's `nx` peer; same first-party package already present transitively. See Delta 24-04/24-05. | closed |
| T-24-09 | Denial of service | `nx` version-range skew (24-04) | accept | `checkVersionMismatches: false` + `'nx'` in `ignoredDependencies` (`eslint.config.mjs:76,101-106`); `^23.0.0` subset avoids double-constraint. See Delta 24-04/24-05. | closed |
| T-24-10 | Elevation of privilege | pnpm postinstall build scripts (24-05) | accept | `strictDepBuilds: false` (`ng-add-ng-run-pnpm.e2e.spec.ts:214`) runs ZERO dependency build scripts -- MORE restrictive than the planned `allowBuilds`. See Delta 24-04/24-05. | closed |
| T-24-06-01 | Tampering | vanilla ng-add rewriting the consumer's angular.json (24-06) | mitigate | Null-guarded `tree.read` (`schematic.ts:40-42,58-64`); parse-mutate-stringify the WHOLE workspace (`:68-70,114`); `[key: string]: unknown` index signatures preserve all unmodeled keys (`angular-cli-wiring.ts:43-59`); the migrated spec asserts untouched projects + user options/configurations survive (`ng-add.spec.ts:123,136-167,200`). See Delta 24-06. | closed |
| T-24-06-02 | Tampering | narrowed/dropped tsconfig leaf ("a type-checker that lies") (24-06) | mitigate | `resolveTsConfigLeaves` existence-filters `[build, spec]` and THROWS on empty (`angular-cli-wiring.ts:124-151`); the pure core spec asserts the exact arrays + missing-leaf-drop + empty->throw (`angular-cli-wiring.spec.ts:82,96,122`); byte-identical `configuration` behaviour + planted-per-leaf CLI e2e. See Delta 24-06. | closed |
| T-24-06-03 | Tampering | e2e accidentally publishes to a real registry (24-06) | mitigate | Reuses the global-setup 127.0.0.1-only SAFETY gate (`global-setup.ts:150-154`); the flipped yarn spec re-asserts `startsWith('http://127.0.0.1:')` (`:238`) + keeps `enableMirror: false` (`:220`). See Delta 24-06. | closed |
| T-24-06-SC | Tampering | new shipped dependency (24-06) | accept | NO new shipped runtime dep: the core imports ONLY `node:path`; `@angular-devkit/schematics` is a TYPE-ONLY import (`schematic.ts:1`), erased at compile -- the compiled `schematic.js` `require()`s ONLY the pure core; `package.json` deps unchanged; D-11 `core/**` lint boundary enforces framework-agnosticism. See Delta 24-06. | closed |

*Status: open . closed*
*Disposition: mitigate (implementation required) . accept (documented risk) . transfer (third-party)*

---

## Independent Verification Evidence

Located by grep/read against the working tree (not from any draft or code review). Every
mitigation was found in its cited location.

| Threat ID | What was checked | Located at (file:line) | Verdict |
|-----------|------------------|------------------------|---------|
| T-24-01 | Barrel drift tripwire references all 5 exports; published `version` still `0.2.0` | `src/index.drift.ts`; `packages/angular-typechecker/package.json:3` | confirmed |
| T-24-02 | `TestingArchitectHost` pinned at `fixtures/builder-context`; planted TS2322/TS2345 asserted | `builder.integration.spec.ts` | present |
| T-24-03 | Docs tripwire locks the `## Angular CLI` claims; Storybook "not supported" caveat preserved | `src/angular-cli-docs.spec.ts`; `storybook-docs.spec.ts` | present |
| T-24-04 | CHANGELOG `0.2.1` entry prose-only; no `angular-typechecker@0.2.1` tag | `CHANGELOG.md`; `git tag -l` | confirmed |
| T-24-05 | Loopback-only publish SAFETY gate | `e2e/.../global-setup.ts:150-154` | present |
| T-24-06 | Committed fixture: no `.npmrc`, `package-lock.json` present, no secret/token | fixture tree | confirmed |
| T-24-07 | `buildCleanEnv({ stripAllNpmConfig: true })` + assert-no-`npm_config_*` guard | `global-setup.ts:160,162-166` | present |
| T-24-SC / T-24-08 | Shipped `dependencies` = `@nx/devkit`, `nx@^23.0.0`, `tslib`; no NEW package | `package.json:49-53` | confirmed |
| T-24-09 | `checkVersionMismatches:false` + `'nx'` ignored | `eslint.config.mjs:76,101-106` | present |
| T-24-10 | pnpm `strictDepBuilds: false` (ZERO build scripts) | `ng-add-ng-run-pnpm.e2e.spec.ts:214` | present |
| T-24-06-01 | Null-guarded reads; whole-workspace parse+overwrite; index-signature key preservation; spec assertions | `schematic.ts:40-42,58-64,68-70,114`; `angular-cli-wiring.ts:43-59`; `ng-add.spec.ts:123,136-167,200` | present |
| T-24-06-02 | Leaf existence-filter + empty->throw; core spec exact-array/drop/throw assertions | `angular-cli-wiring.ts:124-151`; `angular-cli-wiring.spec.ts:82,96,122` | present |
| T-24-06-03 | Yarn spec re-asserts loopback gate + keeps `enableMirror:false` | `ng-add-ng-run-yarn.e2e.spec.ts:238,220` | present |
| T-24-06-SC | Core imports only `node:path`; type-only schematics import; compiled `schematic.js` requires only the pure core | `angular-cli-wiring.ts:1`; `schematic.ts:1`; `dist/.../schematic.js` (require = `"../../core/angular-cli-wiring"` only) | confirmed |
| T-24-06-SC | D-11 `core/**` lint boundary bans Nx/@nx/@angular-devkit/nx/yargs (incl. type-only) | `eslint.config.mjs:16-64` | present |
| (hygiene) | Allowlist-inversion email scan of every phase-changed tracked source/e2e/config file: only identity token is the approved gmail; `ci@example.com` is an RFC-2606 test placeholder | phase-changed files diff vs `angular-typechecker@0.2.0` | confirmed |

No SUMMARY (24-01..24-06) carries a `## Threat Flags` heading; `24-03-SUMMARY.md` states "No
threat flags." No unregistered attack surface. No `unregistered_flag` to log.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-24-01 | T-24-SC | Phase 24 adds no new dependency to the shipped plugin. The only dev-time libraries used (`@angular-devkit/architect/testing`, `@angular/cli`, first-party pinned Angular 22 packages in the committed fixture) are canonical first-party Angular packages, already installed / already optional peers, verified against `registry.npmjs.org`. Verdaccio proxies upstream at pinned versions. | Lars Gyrup Brink Nielsen | 2026-07-11 |
| AR-24-02 | T-24-08 | 24-04 adds `nx@^23.0.0` to the shipped plugin's `dependencies`. NOT a new package: `nx` is the same first-party Nrwl package already pulled transitively via `@nx/devkit`'s `nx` peer. Declaring it direct only ensures yarn consumers (which do not auto-install peers) get it. `^23.0.0` is Nx-23-only and a strict subset of devkit's peer range. No new attack surface. | Lars Gyrup Brink Nielsen | 2026-07-12 |
| AR-24-03 | T-24-10 | The pnpm CLI e2e disables pnpm 11's build-script gate with `strictDepBuilds: false` rather than approving nx's postinstall via `allowBuilds`. This runs ZERO dependency build scripts (strictly safer than the planned allowlist) and is test-infra only -- the shipped plugin is unaffected. | Lars Gyrup Brink Nielsen | 2026-07-12 |
| AR-24-04 | T-24-06-SC | 24-06 introduces NO new shipped runtime dependency. The wiring core is first-party and pure (`node:path` only). The vanilla ng-add's `@angular-devkit/schematics` imports are TYPE-ONLY (erased at compile; the compiled `schematic.js` requires only the pure core), and `@angular-devkit/schematics` is a consumer-provided Angular CLI peer -- `rxjs`/`@angular-devkit/schematics` appear only in the migrated test file. `package.json` `dependencies` are unchanged. | Lars Gyrup Brink Nielsen | 2026-07-15 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-11 | 8 | 8 | 0 | Claude (gsd-secure-phase; mitigations cross-confirmed by 24-REVIEW.md + 24-VERIFICATION.md) |
| 2026-07-11 | 8 | 8 | 0 | Claude (gsd-security-auditor; INDEPENDENT file-level re-verification -- each mitigation located by grep/read) |
| 2026-07-11 | 8 | 8 | 0 | Claude (gsd-security-auditor; ACV-01 gap-fix re-audit of commits `1837b25`+`49974f1` -- no new threat, same-mechanism gap-fix, additive-only) |
| 2026-07-12 | 11 | 11 | 0 | Claude (gsd-security-auditor; 24-04/24-05 gap-closure re-audit -- 3 NEW threats T-24-08/09/10; T-24-10 disposition change recorded; no BLOCKER) |
| 2026-07-15 | 15 | 15 | 0 | Claude (gsd-security-auditor; 24-06 nx-free vanilla ng-add re-audit -- 4 NEW threats T-24-06-01/02/03/SC verified by read against the shared pure core + vanilla schematic + compiled dist + eslint D-11 boundary + the two CLI e2e specs; core confirmed fs/child_process/network-free; compiled `schematic.js` requires ONLY the pure core; public-repo email hygiene clean; no BLOCKER) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed (15/15 CLOSED; `severity_max: none`)
- [x] `status: verified` set in frontmatter
- [x] 24-06 nx-free vanilla ng-add surface audited (T-24-06-01/02/03/SC CLOSED)

**Approval:** verified 2026-07-15
