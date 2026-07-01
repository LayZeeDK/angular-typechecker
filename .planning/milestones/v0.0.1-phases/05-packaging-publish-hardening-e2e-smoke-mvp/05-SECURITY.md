---
phase: 05-packaging-publish-hardening-e2e-smoke-mvp
audit: security
audited: 2026-06-28
asvs_level: 1
block_on: high
threats_total: 25
threats_closed: 25
threats_open: 0
status: SECURED
---

# Phase 5: Security Threat Verification

**Phase:** 5 -- Packaging, Publish Hardening, e2e Smoke (MVP)
**Audited:** 2026-06-28
**ASVS Level:** 1
**Block on:** high severity
**Result:** SECURED -- 25/25 declared threats closed; 0 open at or above `high`.

> NOTE: `angular-typechecker@0.0.1` is ALREADY PUBLISHED LIVE on npm (verified via
> `npm view angular-typechecker --json` -> version `0.0.1`, `provenance: true`,
> SLSA `predicateType: https://slsa.dev/provenance/v1`). This is a retroactive
> audit of a shipped artifact, not a dry run -- verification rigor matters.

## Scope and surface

This phase shipped the package's PUBLISHABLE artifact and its release pipeline.
The real attack surface assessed:

- The published npm manifest (tarball `files` allowlist; author/contact metadata;
  `publishConfig.provenance`; absence of install lifecycle scripts).
- The shipped `.d.ts` type surface (a deep-relative `node_modules` escape would
  break consumer resolution -- D-10/B-02).
- The packed tarball file set (positive presence + negative leak of
  spec/tsconfig.spec/fixture/consumer files; no `postinstall` payload vector).
- The CJS executor's dynamic `import()` of the ESM `@angular/compiler-cli`
  surviving packaging (no `ERR_REQUIRE_ESM`).
- The published vs dev-scoped executor id (resolution from a clean install).
- Honest peer resolution on a clean install (no masked ERESOLVE).
- The GitHub Actions release workflow (trigger surface, least-privilege
  permissions, SHA-pinned actions, persisted-credential leak, OIDC/no-token,
  provenance, required-reviewer environment) -- the s1ngularity / TanStack /
  tj-actions vectors.
- The live first publish operational controls (short-lived seed token + revoke,
  Trusted Publisher trust scope, 2FA, required-reviewer approval) -- partly
  npm-account-side, verified against repo-observable evidence + git history.
- Supply chain: the two new root devDeps (publint + attw) and the publish action.

No threats were invented for surfaces this phase does not have. The register was
authored at plan time; this audit verifies each declared mitigation exists in the
implemented code / config / live registry state.

## Threat verification

Each threat is verified against the IMPLEMENTED artifact (code, config, or live
registry state), not documentation or intent. Evidence is a `file:line` (or
git-commit / `npm view`) reference confirming the mitigation is present at the
actual control point.

### Plan 05-01 -- manifest + LICENSE + self-contained types

| Threat ID | Category                                               | Disposition | Status | Evidence                                                                                                                                                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------ | ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-05-01   | Information Disclosure (tarball file set)              | mitigate    | CLOSED | Explicit allowlist `packages/angular-typechecker/package.json:34-39` `"files": ["src","executors.json","README.md","LICENSE"]`; never relies on npm defaults. Negative-leak assertion enforced in 05-02 (T-05-05).                                                                                                                             |
| T-05-02   | Tampering (shipped `.d.ts` deep-relative escape)       | mitigate    | CLOSED | Self-contained types landed (05-01 commit `bf32775`; `compiler-cli-types.ts` declares over the `typescript` substrate, no `node_modules/@angular/compiler-cli` deep import). Authoritatively verified by the `attw --pack` problems-empty gate in 05-02 (`tarball-audit.int.spec.ts:202-218`) -> live tarball returns `analysis.problems: []`. |
| T-05-03   | Tampering (peer-range autofix)                         | mitigate    | CLOSED | `packages/angular-typechecker/eslint.config.mjs:76` `checkVersionMismatches: false` inside the `@nx/dependency-checks` options; peer ranges held exact `package.json:44-47` (`@angular/compiler-cli: ^22.0.0`, `typescript: >=6.0.0 <6.1.0`). Manifest spec asserts the ranges (05-01 commit `46155da`).                                       |
| T-05-04   | Information Disclosure (contact metadata, PUBLIC repo) | mitigate    | CLOSED | `packages/angular-typechecker/package.json:15` `author` = `Lars Gyrup Brink Nielsen <larsbrinknielsen@gmail.com>` (PUBLIC email). `git grep -c "consensus.dk"` across the manifest, README, and SECURITY.md returns 0 (no work-address leak).                                                                                                  |

### Plan 05-02 -- tarball audit gate

| Threat ID | Category                                                 | Disposition | Status | Evidence                                                                                                                                                                                                                                                                                                                     |
| --------- | -------------------------------------------------------- | ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| T-05-05   | Information Disclosure (tarball file set)                | mitigate    | CLOSED | `e2e/angular-typechecker-install-e2e/src/tarball-audit.int.spec.ts:226-233` negative-leak loop over `npm pack --json files[].path` asserts no `/\.spec\./`, `/tsconfig\.spec/`, `/(libs                                                                                                                                      | fixtures | e2e)\//`, `/typecheck-consumer/`; plus the `@fixtures` `.d.ts`non-leak guard`:235-241`. Positive presence loop `:220-224`. |
| T-05-06   | Tampering (shipped `.d.ts` resolution / D-10 regression) | mitigate    | CLOSED | `tarball-audit.int.spec.ts:202-218` `attw <tgz> --profile node16 --format json` asserts `analysis.problems` deep-equals `[]` with NO rule-suppression flag (`git grep -c "ignore-rules"` returns 0). The permanent D-10/B-02 regression detector; a real `InternalResolutionError` is a defect, never a pre-approved ignore. |
| T-05-07   | Tampering (malicious postinstall in tarball)             | mitigate    | CLOSED | `tarball-audit.int.spec.ts:54-60,243-252` reads the REAL packed `package/package.json` and asserts `preinstall/install/postinstall/prepare/prepublish` all `undefined`. Blocks reintroducing the s1ngularity postinstall vector.                                                                                             |

### Plan 05-03 -- install smoke (tracer bullet)

| Threat ID | Category                                          | Disposition           | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------- | ------------------------------------------------- | --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-05-08   | Tampering (packaged executor `import()` survival) | mitigate              | CLOSED | `e2e/angular-typechecker-install-e2e/src/install-smoke.int.spec.ts:235` injected-error run asserts `expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/)` -- the installed CJS executor's dynamic `import()` of the ESM compiler-cli survived packaging. Paired with `:234` (`TS2322` present) + `:233` (non-zero exit) + `:236` (no infra-error) so the check provably RAN.                                                                                            |
| T-05-09   | Spoofing (dev-scoped vs published executor id)    | mitigate              | CLOSED | Fixture wires the PUBLISHED unscoped id `e2e/angular-typechecker-install-e2e/fixtures/consumer-app/project.json:8` `"executor": "angular-typechecker:angular-typecheck"`; smoke target `install-smoke.int.spec.ts:33` `consumer-app:angular-typecheck`; resolution proven from the install via the `node_modules/angular-typechecker/executors.json` check `:193-204` + a green run `:207-208`. The dev `@angular-typechecker/...` key would not bind in a consumer. |
| T-05-10   | Tampering (honest peer resolution, B-03)          | accept-with-surfacing | CLOSED | See Accepted Risks Log. Clean install with NO peer-resolution override: `install-smoke.int.spec.ts:176` empty `.npmrc`, `:183-187` `npm install <tgz>` with no flag + `npm_config_userconfig` -> non-existent path, `:82-83` env-strip of `npm_config_legacy_peer_deps`. `git grep -c "legacy-peer-deps"` returns 0. An ERESOLVE would FAIL the test (surfaced, not masked); 05-03-SUMMARY records B-03 RESOLVED (clean install succeeded for stable Angular 22).    |

### Plan 05-04 -- release config + supply-chain hardening

| Threat ID | Category                                               | Disposition | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------ | ----------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-05-11   | Elevation of Privilege / Tampering (workflow trigger)  | mitigate    | CLOSED | `.github/workflows/release.yml:27-31` triggers on `push.tags: ['angular-typechecker@*']` + `workflow_dispatch` only; NO `pull_request_target` (`git grep -c "pull_request_target"` returns 0). Top-level `:33-34` `permissions: contents: read`. Regression-guarded `release-hygiene.int.spec.ts:100-117`.                                                                                                                                                                                                                                                                                                                  |
| T-05-12   | Spoofing / Tampering (Trusted Publisher trust scope)   | mitigate    | CLOSED | Workflow names a required-reviewer environment `release.yml:43` `environment: npm-publish` (the manual-approval gate; load-bearing for the TP filename+environment binding). Asserted `release-hygiene.int.spec.ts:130-136`. TP registration itself is operator-attested (see operational note).                                                                                                                                                                                                                                                                                                                            |
| T-05-13   | Tampering (mutable action tags)                        | mitigate    | CLOSED | All actions SHA-pinned: `release.yml:49` `actions/checkout@93cb6efe...18208431cddfb8368fd83d5badbf9bfd # v5.0.1`, `:52` `actions/setup-node@a0853c24...544627f65ddf259abe73b1d18a591444 # v5.0.0`. Spec asserts every `uses:` ref matches `^[0-9a-f]{40}$` `release-hygiene.int.spec.ts:138-154`. Freshness: `.github/dependabot.yml:7` `package-ecosystem: github-actions`.                                                                                                                                                                                                                                                |
| T-05-14   | Information Disclosure (persisted checkout credential) | mitigate    | CLOSED | `release.yml:50-51` `with: persist-credentials: false` on checkout. Asserted `release-hygiene.int.spec.ts:156-162`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-05-15   | Information Disclosure (leaked long-lived npm token)   | mitigate    | CLOSED | `release.yml:63-64` the `npx nx release publish` step declares ONLY `NPM_CONFIG_PROVENANCE: true` under `env:` -- NO `NODE_AUTH_TOKEN` binding (OIDC-only steady state). The token name appears only in explanatory comments (`:65-76`), so a raw `git grep -c "NODE_AUTH_TOKEN"` matches those 2 comment lines, NOT an active assignment. The real enforcement: `release-hygiene.int.spec.ts:164-173` runs `stripCommentLines()` BEFORE asserting `not.toContain('NODE_AUTH_TOKEN')` -- a comment can neither satisfy nor break the gate. OIDC floor met: `:56` `npm i -g npm@latest`, `:54` node 24, `:38` ubuntu-latest. |
| T-05-16   | Repudiation (unverifiable build origin)                | mitigate    | CLOSED | `release.yml:64` `NPM_CONFIG_PROVENANCE: true` + manifest `packages/angular-typechecker/package.json:51-54` `publishConfig.provenance: true`. `nx.json:84` `releaseTag.pattern: "angular-typechecker@{version}"` matches the trigger. LIVE PROOF: `npm view angular-typechecker --json` -> `provenance: true` + SLSA attestation on 0.0.1.                                                                                                                                                                                                                                                                                  |

### Plan 05-05 -- live first publish (HUMAN-GATED; no SUMMARY -- verified via repo state + git history + live registry)

| Threat ID | Category                                             | Disposition | Status                            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | ---------------------------------------------------- | ----------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-05-17   | Information Disclosure (seed npm token)              | mitigate    | CLOSED                            | Repo-observable: seed token activated in commit `136f1ac` (added `NODE_AUTH_TOKEN: ${{ secrets.NPM_SEED_TOKEN }}` -- a GitHub-secret reference, never a literal token in-repo), reverted in `4708eae` ("revert seed token, restore OIDC-only release workflow"). Current `release.yml:62-76` has NO `NODE_AUTH_TOKEN`; `git grep` finds no literal `_authToken`/npm token in tracked files (the one `_authToken` match `release.yml:75` is an explanatory comment). Token expiry/revocation on npmjs.com is operator-attested -- consistent with repo evidence. |
| T-05-18   | Spoofing / Tampering (Trusted Publisher trust scope) | mitigate    | CLOSED-by-operational-attestation | NOT code-verifiable (npm-account-side TP registration). Repo evidence is consistent: `release.yml:43` env `npm-publish` + filename `release.yml` are the exact strings the TP must bind to; the seed-complete comment `release.yml:70-72` records the TP scope (repo `LayZeeDK/angular-typechecker`, workflow `release.yml`, env `npm-publish`). Live 0.0.1 publish with provenance corroborates the OIDC/TP path. Operator-attested: whole-repo trust avoided.                                                                                                 |
| T-05-19   | Repudiation (unverifiable build origin)              | mitigate    | CLOSED                            | LIVE PROOF: `npm view angular-typechecker --json` -> `version 0.0.1`, `provenance: true`, SLSA `predicateType: https://slsa.dev/provenance/v1`, `_npmVersion: 11.17.0` (>= 11.5.1), `_nodeVersion: 24.17.0`; published `repository.url` byte-matches `git+https://github.com/LayZeeDK/angular-typechecker.git` (LayZeeDK casing). Provenance attested on the seed publish + steady-state OIDC.                                                                                                                                                                  |
| T-05-20   | Elevation of Privilege (unauthorized publish)        | mitigate    | CLOSED-by-operational-attestation | Repo-verifiable half: `release.yml:43` `environment: npm-publish` (the required-reviewer gate on the publish job). The reviewer configuration + npm-account 2FA are npm/GitHub-account-side, operator-attested. Repo evidence consistent (environment named, OIDC-only steady state, token reverted).                                                                                                                                                                                                                                                           |

### Supply-chain (T-05-SC, one per plan -- reconciled)

| Plan  | Component                                  | Disposition | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                          |
| ----- | ------------------------------------------ | ----------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 05-01 | npm/pip/cargo installs                     | mitigate    | CLOSED | No package installs in 05-01 (`tech-stack.added: []` in 05-01-SUMMARY).                                                                                                                                                                                                                                                                                                           |
| 05-02 | install of publint + @arethetypeswrong/cli | mitigate    | CLOSED | Two root devDeps only, exact-pinned: `package.json:14` `@arethetypeswrong/cli: 0.18.4`, `:41` publint: `0.3.21`; NEITHER in the plugin manifest (`git grep -c "publint\|arethetypeswrong" packages/angular-typechecker/package.json` returns 0). Blocking legitimacy gate pre-verified both (postinstall-free, mature, source-backed -- 05-02-SUMMARY "Package Legitimacy Gate"). |
| 05-03 | npm install in the smoke                   | mitigate    | CLOSED | Only install is the just-built local tarball + the fixture's pinned stable Angular 22.0.4 / Nx 23.0.1 deps into a discarded `mkdtemp` dir (`install-smoke.int.spec.ts:165,172,183-187,238`). No untrusted external package.                                                                                                                                                       |
| 05-04 | npm/pip/cargo installs                     | mitigate    | CLOSED | No new installs at plan time; the only `npm i -g npm@latest` is CI workflow TEXT (`release.yml:56`), not executed during the plan.                                                                                                                                                                                                                                                |
| 05-05 | the npm publish action itself              | mitigate    | CLOSED | The live publish ran the just-audited tarball (05-02 no-install-scripts + leak gates) through the hardened SHA-pinned workflow; the irreversible step was human-approved via the `npm-publish` required-reviewer environment (B-01). Live 0.0.1 on npm with provenance confirms it shipped through that path.                                                                     |

## Accepted risks log

These threats have a non-`mitigate` declared disposition, verified to be correctly
dispositioned with the disposition's required evidence present.

### T-05-10 -- honest peer resolution / clean install (accept-with-surfacing)

**Rationale:** The install smoke deliberately installs the packed tarball into an
isolated tmp workspace with NO peer-resolution override -- an explicit empty
`.npmrc` (`install-smoke.int.spec.ts:176`), `npm_config_userconfig` pointed at a
non-existent path (`:185`), and the `npm_config_legacy_peer_deps` /
`NPM_CONFIG_LEGACY_PEER_DEPS` env vars stripped (`:82-83`). No `--legacy-peer-deps`
flag is ever passed (`git grep -c "legacy-peer-deps"` in the spec returns 0). The
disposition is "accept-with-surfacing": a clean install that ERESOLVEs is NOT
auto-masked -- the `npm install` call would throw and FAIL the test, surfacing the
real consumer finding for human B-03 remediation. The 05-03-SUMMARY records the
B-03 outcome as RESOLVED: the clean install SUCCEEDED for the stable published
peer set (`@angular/compiler-cli@^22.0.0` + `typescript@>=6.0.0 <6.1.0` against the
consumer's stable Angular 22.0.4 + Nx 23.0.1), because a downstream consumer does
not pull the dev repo's `@nx/angular` `<22.0.0` peer ceiling. Residual risk:
consumers on Angular `22.x-next`/`-rc` must pass `--legacy-peer-deps` (the
caret-`^22.0.0` peer excludes pre-releases by semver) -- documented in the README's
pre-release note. Disposition CORRECTLY `accept-with-surfacing`; the surfacing
mechanism is present and was not bypassed.

## Operational controls (05-05) -- attestation basis

T-05-18 (Trusted Publisher trust-scope registration) and T-05-20's 2FA /
required-reviewer-account configuration are npm-account-side and GitHub-account-side
operations that are NOT readable from the repository. They are marked
**CLOSED-by-operational-attestation** because every repo-observable signal is
consistent with the declared mitigation:

- The steady-state `.github/workflows/release.yml` is OIDC-only (no
  `NODE_AUTH_TOKEN`, `git grep` count 0).
- npm provenance is present and live on 0.0.1 (`npm view` -> `provenance: true` +
  SLSA attestation), which only succeeds through the id-token:write OIDC path.
- The seed token was activated (`136f1ac`) and reverted (`4708eae`) per the
  documented seed-then-revoke runbook; no literal token persists in any tracked
  file.
- The workflow names the exact required-reviewer environment (`npm-publish`) and
  exact filename (`release.yml`) that the TP must bind to.

No repo evidence CONTRADICTS the operator's attestation. If a future audit finds
the steady-state workflow re-introducing a standing token, or the published
provenance dropping, these would flip to OPEN and ESCALATE.

## Threat flags reconciliation (from SUMMARY)

`05-03-SUMMARY.md ## Threat Flags` reports: "None. The smoke introduces no new
network endpoint, auth path, or trust-boundary schema change beyond the in-register
tarball-install and injected-source boundaries already modeled."
`05-04-SUMMARY.md ## Threat Flags` reports: "None. The release workflow +
SECURITY.md introduce only the security surface enumerated in the plan's
`<threat_model>` (T-05-11..T-05-16)."
`05-01-SUMMARY.md` and `05-02-SUMMARY.md` predate the explicit `## Threat Flags`
heading but carry a "Threat Model Adherence" section documenting no surface beyond
their `<threat_model>` blocks. `05-05` has no SUMMARY (human-operated live publish);
its surface is verified via repo state + git history + the live registry above.

**Unregistered flags:** none. No new attack surface appeared during implementation
that lacks a mapped threat ID.

## Note on a manifest deviation (not a threat regression)

05-01 planned `publishConfig: { provenance: true }` and DROP `access`. The shipped
manifest (`packages/angular-typechecker/package.json:51-54`) carries
`publishConfig: { provenance: true, access: "public" }` -- `access: "public"` was
added in commit `9d3f7b7` ("set publishConfig.access=public for provenance on a new
package"). This is a publishing-correctness fix for a first publish of an unscoped
package, NOT a security regression: it does not weaken any T-05 control, the
provenance flag is intact, and the live 0.0.1 publish carries provenance. Noted for
traceability only.

## Verdict

All 25 declared threats are CLOSED. 21 are closed with concrete code/config
`file:line` evidence at the actual control points; T-05-16/T-05-19 additionally
carry LIVE registry proof (`npm view` -> provenance + SLSA attestation on the
published 0.0.1); T-05-17 is closed by repo-observable git-history evidence
(seed-token activate `136f1ac` -> revert `4708eae`, no standing token); T-05-18 and
T-05-20's npm-account-side halves are CLOSED-by-operational-attestation with all
repo signals consistent and none contradicting. The one non-`mitigate` threat
(T-05-10 accept-with-surfacing) is correctly dispositioned with its surfacing
mechanism present and logged in the accepted-risks log. No unregistered attack
surface. No open threat at or above the `high` block threshold.

**threats_open: 0**
