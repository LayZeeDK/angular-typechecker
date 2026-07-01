# 07-SECURITY.md -- Phase 7 (Release-PR workflow and clean changelog)

**Audit type:** Retroactive threat-mitigation verification (report-only; no implementation
files modified). Each declared threat from the four PLAN.md `<threat_model>` blocks is
verified by its disposition against code, config, and LIVE GitHub state -- documentation
and intent are NOT accepted as evidence.

**ASVS scope (RESEARCH "Security Domain"):** V1 Supply Chain, V4 Access Control,
V14 Configuration (V6 Cryptography delegated to the unchanged release.yml).

**Verification date:** 2026-06-29
**Verified at commit:** HEAD (release.yml frozen vs 95ad355; see T-07-07)

---

## Verdict

**SECURED.** 14 phase threats (T-07-01 .. T-07-14) + the recurring T-07-SC supply-chain
disposition: ALL resolved. **0 OPEN threats. 0 OPEN threats above `high` severity. No
BLOCKER.**

- Mitigated (verified present): T-07-01, T-07-02, T-07-03, T-07-04, T-07-05, T-07-06,
  T-07-08, T-07-09, T-07-10, T-07-11, T-07-12, T-07-13 (12)
- Accepted (verified documented / no surface): T-07-07, T-07-14, T-07-SC (3 disposition
  rows; T-07-SC declared identically in all four plans)

The six maintainer-requested mitigations (Objective `<mitigations_to_confirm>`) are each
confirmed by direct evidence below (live `gh api`, `git diff`, `git grep`/`rg`, and a green
install-e2e run).

---

## Per-threat disposition

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-07-01 | Tampering (nx.json release.git) | mitigate | CLOSED | `nx.json:85-89` `git` block is exactly `{ "commit": true, "tag": false, "push": false }`. Regression gate: `release-hygiene.int.spec.ts:99-112` asserts `git.tag === false`, and `:80-97` asserts `push === false` + `createRelease === false`. Live run: `angular-typechecker-install-e2e:test` green (17 release-hygiene tests pass). A re-flip FAILS the suite. |
| T-07-02 | Tampering (changelog.createRelease) | mitigate | CLOSED | `nx.json:94-96` `changelog.workspaceChangelog.createRelease` is `false` (never `"github"`). Asserted by `release-hygiene.int.spec.ts:94-96`. The `GIT_PUSH_FALSE_WITH_CREATE_RELEASE` landmine doc is kept in `AGENTS.md` (1 occurrence). |
| T-07-03 | Information Disclosure (CHANGELOG.md public notes) | mitigate | CLOSED | `rg` for the three plan-id-scope leak shapes against `CHANGELOG.md` returns NO matches (exit 1). Automatable backstop present: `release-hygiene.int.spec.ts:237-258` (REL-03) asserts none of `conventionalCommitScope` / `boldHeadingScope` / `bareLeadingScope` match -- green in the live run. |
| T-07-04 | Tampering (ci aggregate gate) | mitigate | CLOSED | `ci.yml:189` gate expression is `contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')` -- `failure` AND `cancelled` stay fail-closed; `'skipped'` is NOT in the expression (only in the line-175 explanatory comment). A real failure cannot slip through. |
| T-07-05 | Denial of Service self (required ci check) | mitigate | CLOSED | No active `paths-ignore:` key in `ci.yml` `on:` (line-38 hit is the explanatory comment only). Workflow triggers on every `pull_request` (`ci.yml:22-23`); diff classified INSIDE via the `changes` job (`ci.yml:46-65`); `ci` runs `if: always()` (`ci.yml:185`) so it always reports. Negative-if gates (`ci.yml:80,114`) keep test+e2e reportable. |
| T-07-06 | Tampering / supply chain (paths-filter ref) | mitigate | CLOSED | `ci.yml:54` pins `dorny/paths-filter@9d7afb8d214ad99e78fbd4247752c4caed2b6e4c # v4.0.0` -- a 40-char SHA, not a mutable tag. ALL eight `uses:` in `ci.yml` are 40-char SHAs. release.yml SHA-pin assertion (`release-hygiene.int.spec.ts:173-189`, regex `^[0-9a-f]{40}$`) still holds and is green. |
| T-07-07 | Tampering (release.yml frozen) | accept | CLOSED | `git diff 95ad355..HEAD -- .github/workflows/release.yml` is EMPTY (0 lines). release.yml retains tag-only trigger (`release.yml:28-30`), `if: startsWith(github.ref,'refs/tags/angular-typechecker@')` (`:54`), `id-token: write` only (`:44-47`), `environment: npm-publish` (`:43`). The release-hygiene spec independently re-asserts these. No bypass re-introduced. |
| T-07-08 | Tampering / instruction integrity (AGENTS.md) | mitigate | CLOSED | `AGENTS.md` rewrite present: `release/x.y.z` branch cut (`:145,203`), `git.tag: false` => no tag at cut (`:207`), PR carries code + `.planning/` (`:152`), tag the MERGE COMMIT (`:153-154,214`). KEPT verbatim: the `GIT_PUSH_FALSE_WITH_CREATE_RELEASE` landmine (`:1` occurrence count). Change is code-review-gated per AGENTS.md's own rule. |
| T-07-09 | Information Disclosure (documented release-notes step) | mitigate | CLOSED | `AGENTS.md:164,219` mandate `gh release create ... --notes-file <curated-section> --verify-tag`; `:165,220` forbid `--generate-notes`. No work email (`consensus.dk`) in any PUBLISHED artifact: `git grep "consensus.dk"` returns hits ONLY inside `.planning/**` (grep-guard assertions / prose) -- NONE in CHANGELOG.md, package.json, README, SECURITY.md, or workflows. Public email asserted by `release-hygiene.int.spec.ts:48,126`. |
| T-07-10 | Elevation of Privilege (documented direct-push) | mitigate | CLOSED | `AGENTS.md:237-238` document the D-12 recovery: admins EDIT the ruleset `enforcement` to `disabled`, push the fix, re-enable -- preferred over a standing bypass actor. The PR-only-`main` + empty-bypass reality is documented; no doc implies a direct push. |
| T-07-11 | Tampering / Elevation (ruleset switch order) | mitigate | CLOSED | LIVE `gh api .../rulesets`: 18229122 "Default branch" `enforcement:active`, `target:branch`; rules include `deletion` + `non_fast_forward` (continuously asserted -- no unprotected window); `strict:false`; `bypass_actors:[]` (empty); `merge:["merge"]`; 3 checks `["Analyze (actions)","Analyze (javascript-typescript)","ci"]`. 18229088 returns HTTP 404 (deleted). Enable-then-delete order achieved the end state with no gap. |
| T-07-12 | Elevation (manual-tag publish path) | mitigate | CLOSED | LIVE `gh api .../rulesets/18229053`: "Release tag" `enforcement:active`, `target:tag`, conditions `include:["refs/tags/angular-typechecker@*"]`, rules `creation/deletion/non_fast_forward`, bypass `[DeployKey(always), User 6364586(always)]`. Tag pushes are governed by THIS separate retained ruleset, NOT the empty-bypass branch ruleset. release.yml job gate `if: startsWith(github.ref,'refs/tags/angular-typechecker@')` unchanged (`release.yml:54`). No publish bypass re-introduced. |
| T-07-13 | Denial of Service self (empty bypass + non-reporting ci) | mitigate | CLOSED | D-12 recovery documented (`AGENTS.md:237-238`). Plan 02 keeps `ci` reportable on planning-only PRs: `changes` job + negative-if gates + `if: always()` aggregate (`ci.yml:46-65,80,114,185`); `'skipped'` accepted so a planning-only PR does not deadlock the merge button. |
| T-07-14 | Spoofing / Elevation (new long-lived secret) | accept | CLOSED | No new secret anywhere: `rg "secrets\."` over `.github/workflows/` returns NO matches; `NODE_AUTH_TOKEN` appears ONLY in a release.yml COMMENT (`:95`, "do NOT add"), never as an active env. The live switch used the maintainer's interactive `gh` auth behind a blocking human gate (07-04 Task 2 checkpoint). No stored PAT/App added. |
| T-07-SC | Tampering (npm/pip/cargo installs) | accept | CLOSED | Declared `accept` in all four plans. No package-manager install introduced by the phase: the only new third-party artifact is the SHA-pinned `dorny/paths-filter` GitHub Action (resolved by SHA at CI runtime). slopcheck is npm/PyPI-scoped and N/A. No legitimacy checkpoint required. |

---

## Maintainer-requested mitigations -- confirmation

1. **Ruleset switch left NO unprotected window (enable-then-delete).** CONFIRMED.
   Live `gh api` end state: 18229122 active (branch, deletion+non_fast_forward present,
   empty bypass, strict:false, merge:[merge], 3 checks), 18229088 -> 404, 18229053 active
   (tag) retained. The end state is only reachable via the safe enable-then-delete order
   (a delete-first order would have left 18229088's deletion+non_fast_forward as the sole
   guard, then removed it before 18229122 was active). T-07-11 CLOSED.

2. **No publish bypass re-introduced.** CONFIRMED. `git diff 95ad355..HEAD --
   .github/workflows/release.yml` is empty (byte-frozen). Tag pushes governed by the
   SEPARATE retained Release-tag ruleset (18229053, target=tag), not the empty-bypass
   branch ruleset. release.yml `if: startsWith(github.ref,'refs/tags/angular-typechecker@')`
   intact. T-07-07 / T-07-12 CLOSED.

3. **No new long-lived secret.** CONFIRMED. No `secrets.*` reference in any workflow;
   `NODE_AUTH_TOKEN` only in a release.yml comment. The switch used interactive `gh` auth
   (human-gated). T-07-14 CLOSED.

4. **ci gate not weakened dangerously.** CONFIRMED. `ci.yml:189` drops ONLY `skipped`;
   `failure` AND `cancelled` remain in the fail set. A real failure cannot pass.
   T-07-04 CLOSED.

5. **Supply chain: paths-filter SHA-pinned.** CONFIRMED. `ci.yml:54`
   `dorny/paths-filter@9d7afb8d214ad99e78fbd4247752c4caed2b6e4c # v4.0.0` (40-char SHA);
   all `uses:` are SHA-pinned; the release-hygiene `^[0-9a-f]{40}$` assertion holds.
   T-07-06 CLOSED.

6. **No scope/PII leak.** CONFIRMED. CHANGELOG.md carries no plan-id scope (rg = 0
   matches); AGENTS.md mandates `--notes-file` and forbids `--generate-notes`; no work
   email in any published artifact; public email asserted by the spec. T-07-03 / T-07-09
   CLOSED.

---

## Unregistered attack surface

None. The new surface introduced this phase (the `changes`/`dorny/paths-filter` job in
ci.yml, the live ruleset switch, the AGENTS.md flow rewrite) each maps to a declared
threat (T-07-06/T-07-04/T-07-05; T-07-11/T-07-12/T-07-13/T-07-14; T-07-08/T-07-09/T-07-10).
No threat flag appeared without a mapping.

---

## Verification commands (reproducible)

```
# Live ruleset state (T-07-11 / T-07-12)
gh api repos/LayZeeDK/angular-typechecker/rulesets --jq '.[] | {id, name, enforcement, target}'
gh api repos/LayZeeDK/angular-typechecker/rulesets/18229122 --jq '{enforcement, strict, checks, bypass, merge, rules}'
gh api repos/LayZeeDK/angular-typechecker/rulesets/18229088   # -> 404
gh api repos/LayZeeDK/angular-typechecker/rulesets/18229053 --jq '{name,target,enforcement,bypass_actors,conditions}'

# release.yml frozen (T-07-07)
git diff 95ad355..HEAD -- .github/workflows/release.yml      # -> empty

# Supply chain + ci gate (T-07-04 / T-07-05 / T-07-06)
git grep -n "uses:" -- .github/workflows/ci.yml             # all 40-char SHAs
rg -n "^\s*paths-ignore:" .github/workflows/ci.yml          # -> none
rg -n "'skipped'" .github/workflows/ci.yml                  # -> comment only, not the gate

# Scope / PII (T-07-03 / T-07-09)
rg -n '\((\d{2}(-\d{2})*)\)|\*\*\d{2}(-\d{2})*[:*]|\b\d{2}(-\d{2})*:' CHANGELOG.md   # -> none
git grep -n "consensus.dk"                                  # -> only under .planning/**

# Secrets (T-07-14)
rg -n 'secrets\.' .github/workflows/                        # -> none
rg -n "NODE_AUTH_TOKEN" .github/workflows/                  # -> release.yml comment only

# Regression backstop (T-07-01 / T-07-02 / T-07-03 / T-07-06 / T-07-09)
npx nx run angular-typechecker-install-e2e:test             # -> 17 release-hygiene tests green
```
