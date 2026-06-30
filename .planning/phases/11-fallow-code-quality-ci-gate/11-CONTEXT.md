# Phase 11: Fallow code-quality CI gate - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

**Mode:** `--analyze --auto --chain` (phase-specific research performed before gray-area analysis; `--research` to be passed to plan-phase). All gray areas were assessed against the IMPACT x CONFIDENCE trap-quadrant rule; NONE qualified for escalation out of `--auto` (this is the milestone's last phase -- no downstream phase inherits these choices -- the roadmap already locks most direction, and every decision is reversible config). Contrast Phase 10's HARD-01, which WAS escalated (HIGH-impact + LOW-confidence on intent). Decisions below are recommended-option auto-selections grounded in `11-DISCUSS-RESEARCH.md` (live `fallow@2.103.0` runs against this repo).

<domain>
## Phase Boundary

Adopt `fallow` (npm, the dead-code / duplication / complexity analyzer, v2.x -- 2.103.0 at research time) as a CI quality gate so newly-introduced dead code, duplication, or over-complexity breaks CI LOUDLY, AND resolve the repo's CURRENT fallow findings so the gate is green on adoption. Last phase of v0.0.3 (Engine hardening).

**In scope (HOW to wire the gate + resolve current findings):**
- `fallow` as an exact-pinned root devDependency + a hand-authored `.fallowrc.jsonc` (JSONC; both `.json`/`.jsonc` auto-discovered) that declares the Phase-10 drift tripwire / contract-mirror shim as not-dead and resolves the other current findings.
- A new dedicated, path-gated, SHA-pinned `fallow` CI job wired into the `ci` aggregate's `needs:` (+ gate) -- the single required status check stays `ci`, so NO branch-ruleset change.
- `assert_selected "$PR_PLAN" "ci/fallow"` in `tools/act/act-compat.sh`; actionlint (`lint-workflows`) stays green; ci.yml security posture (SHA-pinned actions, `contents: read`, no PR-metadata interpolation) preserved.
- Resolve (not baseline) the current findings: false positives suppressed in config with documented reasons; intentional-fixture findings scoped off; genuine findings (e.g. a possibly-unused prod dep) verified-then-resolved.

**Out of scope:**
- Fixing GSD's broken fallow structural pre-pass (fallow 2.x CLI flag drift, documented in global CLAUDE.md) -- project keeps `code_quality.fallow.enabled: true` and gates via this CI job instead.
- Any engine/source behavior change beyond what's needed to resolve a genuine fallow finding.
- Migrating fallow output into GitHub code-scanning (SARIF) -- would need `security-events: write`, contradicting ci.yml's least-privilege `contents: read`.

</domain>

<decisions>
## Implementation Decisions

### Gate strictness (GA-1)
- **D-01:** Use `--gate new-only` (fallow's default). A PR fails only for findings it INTRODUCES; inherited findings are reported but do not block. Matches the roadmap-specified command and correct gate semantics. Because this phase RESOLVES all current findings, `new-only` and `all` converge on the clean tree today; `new-only` is the lower-friction long-term default.
- **D-02:** Pin the gate in config too (`"audit": { "gate": "new-only" }`) so the verdict is deterministic regardless of CLI invocation, AND suppress inherited findings in config (not rely on their `introduced:false` status) -- per research caveat 6, an inherited finding can flip to `introduced` when its file is later touched. The repo must end this phase genuinely clean, not merely below the new-only threshold.

### Suppression mechanism (GA-2)
- **D-03:** Config-driven via a hand-authored `.fallowrc.jsonc` (NOT inline `// fallow-ignore-*` comments). Centralized, auditable, with a JSONC comment on every declaration explaining WHY. Matches roadmap item 1 + global preference. (`fallow init` emits `.fallowrc.json` with JSONC content; we author `.fallowrc.jsonc` directly -- both are auto-discovered.)
- **D-04:** Verified config keys (from `fallow config-schema`, 2.103.0):
  - `entry: ["packages/angular-typechecker/src/core/compiler-cli-types.drift.ts", ...]` -- declares the tsconfig-`files`-only drift tripwire reachable, killing the `unused_file` false positive (IN-02). KEEP the real source entry points too.
  - `overrides: [{ files: ["**/compiler-cli-types.ts"], rules: { "unused-enum-members": "off" } }]` -- scopes off the `EmitFlags` contract-mirror shim's 7 "unused" members (IN-03).
  - `ignoreExports: [{ file: "**/compiler-cli-types.ts", exports: ["UNKNOWN_ERROR_CODE"] }]` -- pins the value-mirrored type export (IN-04; currently `introduced:false` but suppress for determinism per D-02).
  - `overrides: [{ files: ["**/fixtures/fault-isolation/**"], rules: { "unrendered-components": "off", "unused-component-inputs": "off" } }]` -- intentional test-fixture components rendered nowhere + one fixture `@Input`.

### Analysis scope & dependency findings (GA-3)
- **D-05:** Gate at REPO ROOT (per roadmap item 2: `npx fallow audit ... --base origin/main` from root) -- NOT scoped to `packages/angular-typechecker`. Preserves whole-repo dead-code/duplication/complexity coverage (fixtures, tools, the package).
- **D-06:** Set `rules: { "unused-dev-dependencies": "off" }` (commented) -- fallow flagged 14 root dev deps (ESLint flat-config plugins, `@swc-node/register`, `@swc/helpers`, attw/publint/typescript-eslint CLIs) that are STRUCTURALLY un-traceable by import graph and will ALWAYS false-positive. Disabling the rule is the correct structural fix, not a rotting hand-list of `ignoreDependencies`. Dev-tooling dep hygiene is owned by `@nx/dependency-checks` (the PUBLISHED package) + manual review.
- **D-07:** KEEP `unused-dependencies: "error"` on (catches a genuinely unused PROD dep). `@angular/forms` (root prod dep, fallow-flagged `introduced:false`) is a VERIFY-THEN-RESOLVE item for the executor: confirm whether it's truly unused (remove it) or a deliberate fixture/peer-test dep (`ignoreDependencies` with a reason). Do NOT blanket-ignore blind.
- **D-08:** IN-05 (`publishConfig.provenance` mislabeled `unused_dependency`) does NOT reproduce in 2.103.0 -- fallow analyzes root `package.json`, not the published manifest. No suppression for IN-05; the planner should drop it from the expected-false-positive list.

### Rule families & thresholds (GA-4)
- **D-09:** Enable all three families -- dead-code + duplication (`duplicates`) + complexity (`health`) -- at fallow DEFAULT thresholds (`duplicates.minOccurrences 3`; `health.maxCyclomatic 20` / `maxCognitive 15` / `maxCrap 30`). The repo is CLEAN on duplication (0 clone groups) and complexity (0 findings) today, so defaults become zero-cost regression tripwires. Re-tune only if a future finding proves a default wrong.

### CI wiring (GA-5)
- **D-10:** Dedicated `fallow` job added to the `ci` aggregate's `needs:` list AND its `contains(needs.*.result, 'failure'|'cancelled')` gate. The single required status check stays `ci` -- NO Default-branch ruleset change.
- **D-11:** Install via exact-pinned `fallow` ROOT devDependency (in `package-lock.json`); CI runs `npm ci` then `npx fallow` (resolves the locked version) -- NOT `npx fallow@latest`. Catches IN-05's lesson: pin the analyzer so a fallow release can't silently change the gate.
- **D-12:** Gate command: `npx fallow audit --format json --base origin/main`. The audit EXIT CODE gates (1 on `fail`); `--format json` is for the CI log artifact. Do NOT use `--ci`/SARIF -- it needs `security-events: write`, contradicting ci.yml's `contents: read`.
- **D-13:** `actions/checkout` with `fetch-depth: 0` (+ `persist-credentials: false` like every other checkout). `new-only` attribution runs a base-snapshot pass that needs `origin/main`'s merge-base reachable; a shallow checkout breaks new-vs-inherited attribution (research caveat 5). Optionally pin `FALLOW_AUDIT_BASE=origin/main`.
- **D-14:** Path-gate the job with the SAME `if: ${{ needs.changes.outputs.code != 'false' }}` NEGATIVE form as `test`/`e2e` (so a planning/docs-only PR skips it AND it stays in the `act -n` plan under empty filter output). Runs on `ubuntu-latest`, Node 24 (matching the e2e/release Node), SHA-pinned actions, Dependabot-tracked.
- **D-15:** Add `assert_selected "$PR_PLAN" "ci/fallow"` to `tools/act/act-compat.sh` (job id `fallow` -> act label `ci/fallow`); actionlint stays green.

### Claude's Discretion
- Exact `.fallowrc.jsonc` layout / `$schema` pointer, comment wording, and whether to use the `audit.gate` config key vs the `--gate` CLI flag (both equivalent; config preferred for determinism).
- Whether `@angular/forms` is removed vs ignored -- decided by the executor's import-graph check, not pre-locked.
- Ordering of the `fallow` job in the workflow file and whether it shares the `changes` job output directly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's research (read FIRST)
- `.planning/phases/11-fallow-code-quality-ci-gate/11-DISCUSS-RESEARCH.md` -- verified `fallow@2.103.0` CLI surface, gate semantics, config schema (entry/ignoreExports/overrides/rules/duplicates/health/audit), and the ACTUAL findings on this repo (28 dead-code issues; 12 introduced; IN-02/03/04 reproduce, IN-05 does not; +`@angular/forms` + 14 dev deps + fixture components).

### Findings to resolve (the gate must be green on adoption)
- `.planning/phases/10-drift-hardening-maintainability/10-REVIEW.md` SS IN-02..IN-05 -- the confirmed fallow false positives (drift file `unused_file`; `EmitFlags` members; `UNKNOWN_ERROR_CODE`; the non-reproducing `publishConfig` one).

### Files the config must declare / scope
- `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts` -- tsconfig-`files`-only drift tripwire -> `entry`.
- `packages/angular-typechecker/src/core/compiler-cli-types.ts` SS `EmitFlags` (L110-116) + `UNKNOWN_ERROR_CODE` (L130) -- contract-mirror shim -> `overrides` / `ignoreExports`.
- `packages/angular-typechecker/project.json` (`typecheck-drift` target) + `packages/angular-typechecker/tsconfig.drift.json` (`files: ["src/core/compiler-cli-types.drift.ts"]`) -- WHY the drift file is reachable only via tsconfig `files`, invisible to fallow's import graph.
- `packages/angular-typechecker/fixtures/fault-isolation/*.component.ts` -- intentional fixtures (NonTemplateError/Survivor/TcbPoison + `someInput`) -> fixture-scoped `overrides`.

### CI / tooling to extend (preserve security posture)
- `.github/workflows/ci.yml` -- the `changes` path-filter job (`needs.changes.outputs.code`), the `test`/`e2e` path-gating pattern (`!= 'false'` NEGATIVE form), and the `ci` aggregate (`needs:` list + `contains(needs.*.result, ...)` gate). Threat model header (SHA-pinned actions, `contents: read`, `persist-credentials: false`, no PR-metadata interpolation) MUST hold for the new job.
- `tools/act/act-compat.sh` SS `assert_selected` (the `ci/<job>` family assertions; add `ci/fallow`).
- `.planning/config.json` SS `code_quality.fallow.enabled: true` (kept; project gates via CI, not the GSD pre-pass).

### Stale-doc note
- Global `CLAUDE.md` SS "Fallow structural pre-pass: CLI API drift" -- correct that `--json`/`--profile`/`--stdin-files` are rejected, but now PARTLY STALE for 2.103.0: `--gate`, `--brief`, `--ci`, `-o`, `--base` all exist; there is NO `profiles`/`--profile` concept (use `extends`+`overrides`+`--only/--skip`); `fallow init` emits `.fallowrc.json` (JSONC content). Do not let the stale note drive plan text.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets / Patterns
- **Path-gated CI job pattern** (`ci.yml` `test`/`e2e`): `needs: changes` + `if: ${{ needs.changes.outputs.code != 'false' }}` (NEGATIVE form is load-bearing for `act -n` stability under empty filter output). The `fallow` job copies this verbatim.
- **`ci` aggregate contract** (`ci.yml` job id+name EXACTLY `ci`): the only required status check. New jobs join via `needs:` + the `contains(needs.*.result, 'failure'|'cancelled')` gate; `'skipped'` is intentionally NOT a failure (path-skip tolerance).
- **SHA-pinned-action + Dependabot pattern**: every action is a 40-char SHA with a `# vX.Y.Z` comment; Dependabot (github-actions ecosystem) bumps them. The new job reuses the SAME `actions/checkout` + `actions/setup-node` pins.
- **act-compat assertion pattern** (`act-compat.sh`): `assert_selected "$PLAN" "ci/<jobid>" "<trigger>"` matches a job family in the `act -n` dry-run plan.

### Integration Points
- New `fallow` job -> `ci` aggregate `needs:` + gate (the cross-phase D-02 contract from Phase 6/7).
- New root `devDependency` `fallow` -> `package.json` + `package-lock.json` (root, not the published package). This is a dependency-changing edit: if any plan runs in a worktree, it needs Pattern B (per-worktree `npm ci`), NOT the shared `node_modules` junction (AGENTS.md).
- `.fallowrc.jsonc` at repo root (auto-discovered by `fallow audit`).

</code_context>

<specifics>
## Specific Ideas

- Resolve, do NOT baseline: the roadmap intent (item 4) is to end this phase with a genuinely clean gate -- suppress false positives WITH documented reasons, scope off intentional fixtures, and fix/ignore genuine findings -- never `--save-baseline` the debt away.
- Each `.fallowrc.jsonc` declaration carries a JSONC comment naming the finding it resolves (e.g. `// IN-02: tsconfig-files-only drift tripwire, invisible to import graph`).
- Keep the analyzer pinned (D-11) -- a fallow minor release changing a default rule must not silently flip the gate.

</specifics>

<deferred>
## Deferred Ideas

- Migrating fallow output to GitHub code-scanning via SARIF (`--ci`) -- deferred: requires `security-events: write`, contradicting ci.yml's least-privilege posture. Revisit only if the security-events permission is ever justified independently.
- Fixing GSD's broken fallow structural pre-pass (fallow 2.x flag drift) -- explicitly out of scope (roadmap item 5); a GSD-tooling concern, not this repo's gate.
- Tuning duplication/complexity thresholds -- deferred until a real finding proves a default wrong (repo is clean on both today).

</deferred>

---

*Phase: 11-fallow-code-quality-ci-gate*
*Context gathered: 2026-06-30*
