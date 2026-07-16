---
phase: 28
slug: shipped-tarball-e2e-real-clone-uat
status: verified
asvs_level: 1
threats_found: 6
threats_closed: 6
threats_open: 0
created: 2026-07-17
---

# Phase 28 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Mode: VERIFY (register authored at plan time across 28-01/02/03/04 `<threat_model>`
> blocks). Each declared mitigation was confirmed present in the implemented code /
> CI -- not accepted on documentation or intent. No blind scan for new threats.
>
> Scope note: this is a VERIFICATION phase. It changed NO shipped product/runtime
> code (the standalone CLI froze in Phases 25-27); the diff is a new e2e project,
> shared test-util helpers, a Windows CI job, a self-auditing guard spec, plus
> code-quality config (`.fallowrc.jsonc`, `.gitattributes`). Every threat below is a
> test-harness / CI trust boundary, not a shipped-artifact boundary.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| test process -> local Verdaccio registry (127.0.0.1) | The publish-once flow writes the built dist to a local registry; a misconfigured registry URL could leak a real `nx release publish` to public npm. | dist tarball, minted bearer token |
| test process -> installed CLI (OS process boundary) | Each PM's `.bin` shim is spawned as an OS process; `npx` name resolution can fetch a foreign package. | fixed CLI argv (tsconfig paths + flags) |
| consumer fixture install -> npm registry | Each nested npm/yarn/pnpm install must resolve ONLY from Verdaccio, never an inherited public registry. | package resolution + install scripts |
| workflow inputs (matrix/project name, action refs) -> CI runner shell | A project name or action ref reaching a shell command, or a mutable action tag, can execute attacker-controlled code on the runner. | `matrix.project` value, `uses:` action refs |
| untrusted OSS clone content -> type-check engine + human dev host (VER-05) | Real third-party clones are checked out on a developer machine; their content and any install scripts are untrusted. | clone source files, tsconfigs |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-28-01 | Tampering / Elevation of Privilege | `e2e-windows` CI job run steps (command injection) | mitigate | Project name reaches run steps via a hardcoded `PROJECT` env var, never `${{ }}`-interpolated into a `run:`; consumed as `-p "$PROJECT"`. GUARD-01f locks it. | closed |
| T-28-02 | Elevation of Privilege / Repudiation | Verdaccio publish + install-by-name (npm/yarn/pnpm, Linux + Windows) | mitigate | `createVerdaccioGlobalSetup` refuse-gate rejects any registry not starting `http://127.0.0.1:` before publish; every spec re-asserts the same on `verdaccioUrl`; registry pinned to numeric IPv4 loopback. | closed |
| T-28-03 | Malicious code / Supply chain | CLI invocation (`npx atc` -> unrelated `atc@0.0.6`) | mitigate | `atc` is exercised ONLY via the installed `.bin/atc` shim by path (`runShim`) or `node -r hook bin.js`; the npx cell hardcodes `npx angular-typechecker`. Zero `npx atc` in any spec or the UAT (source grep). | closed |
| T-28-04 | Tampering | Real OSS clone content (VER-05 UAT) | mitigate | Clones stay UNCOMMITTED and pinned by URL + SHA (reproducible, auditable, never merged); the shipped engine only READS tsconfigs/sources via ts/fs -- no exec/shell-out of clone content. | closed |
| T-28-05 | Tampering | `e2e-windows` `uses:` actions (mutable-tag repoint) | mitigate | Every `uses:` is a 40-char commit-SHA pin copied verbatim from the existing `ci.yml` pins (Dependabot-managed); no mutable `@vN`/branch tag. | closed |
| T-28-06 | Information disclosure / Tampering | Consumer fixture nested install (registry leak + build-script execution) | mitigate | `buildCleanEnv({ stripAllNpmConfig: true })` + `npm_config_userconfig` -> nonexistent path so an inherited `npm_config_registry` / user `~/.npmrc` cannot retarget the install; pnpm `strictDepBuilds: false` runs zero postinstall scripts; yarn pins registry + `enableMirror: false`. | closed |

*Status: open . closed*
*Disposition: mitigate (implementation required) . accept (documented risk) . transfer (third-party)*

---

## Accepted Risks Log

None this phase. All six declared threats are `mitigate` and every mitigation was
confirmed present in the implemented code / CI.

(The `atc` bin-name collision with the unrelated `atc@0.0.6` was accepted as
`AR-27-03` in Phase 27's SECURITY.md and does not resurface here; Phase 28's T-28-03
mitigation -- never route `atc` through `npx` -- is the operational control that keeps
that accepted risk contained, and it is verified present.)

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-17 | 6 | 6 | 0 | gsd-security-auditor |

### Evidence log (VERIFY mode -- direct code / CI inspection, not documentation)

- **T-28-01** (plan 28-03): `.github/workflows/ci.yml` `e2e-windows` job (:294-319) sets
  `PROJECT: angular-typechecker-cli-e2e` as a hardcoded env value (:300); the two nx
  run steps use `-p "$PROJECT"` (:316, :318) with `shell: bash`; NO `${{ }}` appears
  inside any `run:` in the job. GUARD-01f asserts `run-many -t e2e -p "$PROJECT"` +
  `PROJECT: angular-typechecker-cli-e2e` (ci-e2e-coverage-guard.spec.ts:448-464), and
  the guard is non-vacuous (deleting the job makes `extractJobLines` throw).
- **T-28-02** (plans 28-01/02/03): `libs/test-util/src/lib/verdaccio-global-setup.ts:218`
  refuse-gate `if (!registryUrl.startsWith('http://127.0.0.1:')) throw ...` before any
  publish; `listenAddress: '127.0.0.1'` (:207). Re-asserted per spec:
  `cli-exit-codes.e2e.spec.ts:108`, `cli-exit-codes-pnpm.e2e.spec.ts:98`,
  `cli-exit-codes-yarn.e2e.spec.ts:151`, `nx-free-runtime.e2e.spec.ts:77`
  (`expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true)`). The Windows leg
  runs the same project + global-setup, so the identical gate applies on the Windows
  runner.
- **T-28-03** (plans 28-01/02/04): `git grep "npx atc"` returns ZERO hits in any spec
  under `e2e/`, in `libs/test-util/`, or in `28-04-UAT.md` (matches are only in
  planning docs that DOCUMENT the hazard). `runShim` (cli-e2e.ts:33-65) spawns the
  `.bin/<binName>` shim BY PATH; `runNpx` hardcodes `npx angular-typechecker`
  (cli-exit-codes.e2e.spec.ts:79); the runtime probe uses
  `node -r "<hook>" "<installed bin.js>"` (nx-free-runtime.e2e.spec.ts:133).
- **T-28-04** (plan 28-04): `28-04-UAT.md` frontmatter + "About this gate" state clones
  are UNCOMMITTED and reproduced from repo URL + pinned commit SHA (carry-forward SHAs
  `818e9ae...`, `9e3528f...` literal; Nx-kind SHAs pinned fresh + recorded). The doc
  steers to `npx angular-typechecker` and forbids `npx atc` (:44-46); zero `npx atc`
  occurrences. The shipped engine (frozen Phases 25-27) reads sources via ts/fs only.
- **T-28-05** (plan 28-03): `.github/workflows/ci.yml` `e2e-windows` `uses:` refs are all
  40-char SHA pins copied from the existing file --
  `actions/checkout@9c091bb2...` (:302), `actions/setup-node@48b55a01...` (:305),
  `pnpm/action-setup@0ebf4713...` (:311); no mutable tag introduced.
- **T-28-06** (plans 28-01/02): `buildCleanEnv({ stripAllNpmConfig: true })` +
  `npm_config_userconfig: join(tmp, '.npmrc.nonexistent')` in every spec
  (cli-exit-codes:53,:123 / -pnpm:68,:140 / -yarn:60,:163 / nx-free-runtime:55,:91);
  the global-setup also strips all `npm_config_*` and asserts none survive
  (verdaccio-global-setup.ts:228-234). pnpm build-script gate disabled via
  `strictDepBuilds: false` written to `pnpm-workspace.yaml`
  (cli-exit-codes-pnpm.e2e.spec.ts:115-118) -- runs ZERO postinstall scripts (safer
  than an allowlist). yarn pins the registry to Verdaccio with
  `unsafeHttpWhitelist: [127.0.0.1]` + `enableMirror: false`
  (cli-exit-codes-yarn.e2e.spec.ts:120-134). The `cli-consumer` fixture commits NO
  `.npmrc` / `.yarnrc.yml`.

### Unregistered flags

None. All four plan SUMMARYs (28-01/02/03/04) carry a `## Threat Flags` section reading
"None new" -- no new attack surface appeared during implementation without a threat
mapping. The only non-test, non-CI code changes are code-quality / repo config with no
runtime attack surface: `.fallowrc.jsonc` (FAL-12 adds `libs/**` to the dead-code
health-ignore + declares the new e2e global-setup as a config-only entry point) and
`.gitattributes` (`*.ts text eol=lf` LF guard). Neither introduces an unmapped boundary.

### Public-repo hygiene

Allowlist-inversion email scan over the phase's authored + modified files (e2e project,
test-util, `ci.yml`, guard spec, `.fallowrc.jsonc`, all 28-* planning docs) found the
only email-shaped tokens to be the approved public gmail and the synthetic Verdaccio
test credential `ci@example.com`. No maintainer work email or its bare domain present.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] No accepted risks required this phase (all six threats mitigated in code/CI)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] Implementation files unmodified (only 28-SECURITY.md authored)

**Approval:** verified 2026-07-17
