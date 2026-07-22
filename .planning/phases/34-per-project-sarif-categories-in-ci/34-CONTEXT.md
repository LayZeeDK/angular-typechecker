# Phase 34: Per-project SARIF categories in CI - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

> Discussion mode: `--auto` (autonomous, single pass) `--analyze` (trade-off tables logged in `34-DISCUSSION-LOG.md`) `--chain` (auto-advance to plan). Every decision below is evidence-backed by the v0.2.4 milestone research (HIGH confidence, mapped against the real source + live `ci.yml` at HEAD) and the closed spike PR #53, which proved live in Code Scanning that per-run `automationDetails.id` categories land as distinct analyses and that GitHub (2025-07-21+) rejects multiple same-category runs. The one genuine either-way (discovery mechanism, D-01) is CI-only, reversible, and guard-protected, so it is not in the high-impact + low-confidence quadrant -- none was escalated.

<domain>
## Phase Boundary

Rewire the CI `code-scanning` job so angular-typechecker's SARIF upload reports **one Code Scanning analysis per workspace project that uses the `angular-typechecker:typecheck` executor** -- auto-discovered so the set cannot silently drift -- merged into ONE multi-run SARIF file whose runs each carry `automationDetails.id = angular-typecheck/<project>`, uploaded with a single `upload-sarif` and **no `category` input**.

This is CI-side ONLY. The shipped reporter stays single-run per CLI invocation; the multi-run merge is assembled in CI. The published package is byte-unchanged -- no reporter/API/schema/dependency change -- so **no version bump** (MULTI is a no-release phase; only Phase 33's RULE-01..04 bumped `0.2.3 -> 0.2.4`).

**In scope:** the two MULTI requirements only -- CI-side per-project multi-run merge + single no-category upload (MULTI-01); executor-filtered auto-discovery of the reported project set + an in-plugin drift guard that fails loud on divergence (MULTI-02). New assets live under `tools/ci/` + one test-only plugin spec; the `code-scanning` job in `ci.yml` is modified; the fallow SARIF steps are untouched.

**Out of scope (own phases / deferred):** the automated `gh api` Code Scanning proof + isolated one-per-family fixture (PROOF, Phase 35); adding `code-scanning` to the required `ci` aggregate + un-path-gating it + the "Require code scanning results" ruleset + the Scanned-files docs (GATE/DOC, Phase 36); any reporter-side `--category`/`automationDetails.id` CLI option (would make MULTI release-bearing -- explicitly rejected); migrating from one merged multi-run file to a per-project CI matrix (MULTI-FUT-01, unneeded at 4 projects, nowhere near the 20-runs/file cap).
</domain>

<decisions>
## Implementation Decisions

### Discovery (MULTI-02)
- **D-01:** Add a NEW pure-fs `tools/ci/list-typecheck-projects.mjs` that scans `apps/*/project.json` + `libs/*/project.json` and keeps targets whose `executor === 'angular-typechecker:typecheck'`, emitting JSON `[{ name, tsConfig[] }]` (`tsConfig` normalized to an array from the target's `options.tsConfig`). Mirrors the existing `tools/ci/list-e2e-projects.mjs` precedent exactly: a lean `node:fs`/`path`/`url` read -- no `npm ci`, no Nx graph spin -- so it is fast and directly execable from a Vitest spec (D-04). Yields exactly the four workspace consumers today: `ng-spike-app`, `typecheck-consumer`, `typecheck-consumer-dep`, `typecheck-walk-consumer`.
- **D-01a (the over-match trap, MULTI-02):** discovery MUST filter by the EXECUTOR id, never `nx show projects --with-target typecheck` -- a plain target-name match over-matches the plugin's own `nx:run-commands` typecheck, `test-util`, and the e2e-tier projects. TWO extra sets carry the REAL `angular-typechecker:typecheck` executor but must NOT become per-project analyses: (1) the e2e **fixture** `project.json` files under `e2e/*/fixtures/` (verified: 8 files) -- NOT workspace-graph projects; (2) the workspace-**root** `project.json` (`@angular-typechecker/source`) -- verified by Phase-34 research to declare a real executor target on `fixtures/tsconfig.clean.json` (an always-clean fixtures sweep). Root-scoping the discovery scan to `apps/*/project.json` + `libs/*/project.json` excludes BOTH by construction, yielding exactly the four consumers -- no hardcoded exception needed in the discovery script.
- **D-01b (RESOLVED via Phase-34 research -- exclude the root project):** the scope stays the four `apps/`/`libs/` consumers; the root `@angular-typechecker/source` is EXCLUDED. Rationale: it produces an always-empty (zero-diagnostic) analysis, and its `@`+`/` name would munge the per-run id into `angular-typecheck/@angular-typechecker/source`. This is a low-impact, reversible, CI-only scope call (research recommendation, HIGH confidence) -- not escalated.
- **Trade-off (research recommended graph-based; we chose fs).** Research (`ARCHITECTURE.md` §2) recommended `nx show projects ... --json` filtered by executor as "authoritative" (root-agnostic). We chose pure-fs instead because it (a) matches the repo's explicit LEAN-fs discovery precedent (the `ci.yml` `discover` job comment deliberately rejects `npm ci` + `nx show projects`), and (b) stays fast + execable inside the drift-guard spec. The root-agnostic authority research wanted is delegated to the guard's independent side (D-04), which fails loud if a consumer ever appears under a root the fs scan misses.

### Merge assembly (MULTI-01)
- **D-02:** Add a NEW dedicated `tools/ci/merge-sarif.mjs` (NOT an inline `node -e`). It reads the N per-project single-run SARIF files, stamps each `run.automationDetails.id = angular-typecheck/<project>`, and writes ONE merged file with N `runs[]`. It SKIPS empty/0-byte inputs (a project that exits 2 / produces nothing is dropped, never fed as an invalid run -- the per-project analogue of the existing `[ -s file ]` produced-guard). A dedicated script (vs. the fallow-style inline `node -e`) is cleaner and unit-testable; the merge logic (combine N files' runs + per-run id) is richer than fallow's single-file per-run loop.
- **D-02a (category id -- preserve verbatim):** the per-run id prefix is the requirement's literal `angular-typecheck/<project>` (note: `angular-typecheck`, NOT `angular-typechecker`). MULTI-01 and ROADMAP SC1 both state it this way; keep it exactly. This supersedes the old single-run `category: angular-typechecker` scheme.

### Per-project CLI invocation (MULTI-01)
- **D-03:** Generate each per-project single-run SARIF by running the SHIPPED standalone CLI from dist -- `node dist/packages/angular-typechecker/src/cli/bin.js -c <tsConfig...> --format sarif > <project>.sarif` -- once per discovered project, run from the repo ROOT (keeps `artifactLocation` URIs repo-relative so Code Scanning maps alerts to source). The `-c` flag is repeatable for a multi-leaf `tsConfig` array. Reuse the existing job's `|| true` + `[ -s file ]` produced-guard PER project. NOT `nx run <project>:typecheck --format sarif`: the standalone CLI writes byte-pure SARIF to stdout with advisories on stderr, whereas the Nx executor frames its stdout. This is exactly the invocation the current single-run dogfood step uses, looped per project.

### Drift guard (MULTI-02)
- **D-04:** Add a NEW in-plugin Vitest spec (regression-guard style, mirroring the e2e `ci-e2e-coverage-guard.spec.ts` / GUARD-01b; a dedicated `cache: false` target is the planner's discretion), e.g. `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts`. It execs `node tools/ci/list-typecheck-projects.mjs` and asserts its project-NAME set equals an INDEPENDENT enumeration of `angular-typechecker:typecheck`-executor projects: parse `targets.*.executor` on every `project.json`, then subtract BOTH the `e2e/*/fixtures/` paths AND the workspace-ROOT `project.json` (`@angular-typechecker/source`). **Subtracting the root project is load-bearing** (Phase-34 research finding): without it the independent side counts 5 while discovery counts 4, so the guard false-fails RED on day one. With the two exclusions the guard is root-agnostic for genuine drift: a consumer added under any root the fs discovery script does not scan trips it LOUD -- the "cannot silently drift" mechanism (MULTI-02 SC3).

### CI job rewiring (MULTI-01)
- **D-05:** In `.github/workflows/ci.yml` `code-scanning` job, REPLACE the single hardcoded `bin.js -c apps/ng-spike-app/tsconfig.app.json ... category: angular-typechecker` generate+upload with: discover (`list-typecheck-projects.mjs`) -> loop `bin.js` per project -> `merge-sarif.mjs` -> ONE `upload-sarif` with NO `category` input (per-run ids become the categories). Leave the fallow SARIF generation + its separate no-category upload UNTOUCHED. Preserve every existing invariant verbatim: the fork-PR skip gate on the upload, job-scoped `security-events: write`, `fetch-depth: 0`, SHA-pinned `upload-sarif`, the path-gated `if: needs.changes.outputs.code != 'false'`, and run-from-repo-root. The job STAYS OUT of the required `ci` aggregate (promoting it is GATE-01, Phase 36).

### No release / additive-only
- **D-06:** The published package is byte-unchanged: no reporter/API/schema edit, no new dependency, no `package.json` version bump. All new code lives under `tools/ci/` plus one test-only plugin spec. Confirm via the repo's standing additive-audit posture that `packages/angular-typechecker/**` production surface + the manifest are untouched (this phase has nothing to release).

### Claude's Discretion
- Whether the discovery JSON carries `tsConfig[]` or the CI loop re-reads it from `project.json` (research suggests emitting `{ name, tsConfig[] }` so the loop needs no second read).
- Whether `merge-sarif.mjs` takes an explicit file list or globs a directory of `*.sarif`. **Phase-34 research recommends "Design B":** fold the per-project generate loop INTO `merge-sarif.mjs` -- it `spawnSync('node', [distBinJs, '-c', ...tsConfigs, '--format', 'sarif'])` per discovered project, then concatenates the runs -- which is injection-free, unit-testable, and dodges the bash/JSON footgun (vs "Design A": a bash loop calling `bin.js` per project + a pure file-reading merge). Either satisfies D-02/D-03/D-05; Design B preferred.
- Exact guard spec filename + whether it sits beside `scoped-name-guard.spec.ts`; exact wiring of the `code-scanning` job's discover/loop/merge shell steps (set-e loud-fail on a failed discovery substitution, mirroring the `discover` job's separate-assignment pattern).
- Verify `ng-spike-app`'s discovered `options.tsConfig` matches the currently-hardcoded `apps/ng-spike-app/tsconfig.app.json` so coverage is not silently reduced (the target may declare a different or multi-leaf tsConfig).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap (locked scope)
- `.planning/REQUIREMENTS.md` -- MULTI-01 (per-project multi-run, per-run `automationDetails.id`, single no-category upload) + MULTI-02 (executor-filtered auto-discovery + anti-drift guard) + MULTI-FUT-01 (deferred matrix migration) + the Out-of-Scope table (no reporter change, no Issue filed).
- `.planning/ROADMAP.md` (Phase 34 detail) -- goal + the 4 success criteria; the "CI-only, no release" attribution and the "published package unchanged -> no version bump" criterion.

### Milestone research (v0.2.4, namespaced -- do NOT clobber)
- `.planning/research/v0.2.4-enhanced-sarif-reporting/SUMMARY.md` -- key finding #2 (MULTI is CI-side, `tools/ci/merge-sarif.mjs` + `tools/ci/list-typecheck-projects.mjs`, filter by executor, 4 consumers, guard mirrors GUARD-01b) and the release-discipline note (keeping MULTI out of the reporter is what preserves "only RULE bumps the version").
- `.planning/research/v0.2.4-enhanced-sarif-reporting/ARCHITECTURE.md` §2 -- the CI-side merge seam, the discovery-by-executor filter with the over-match trap, the graph-vs-fs discovery options, the drift-guard design, and the new-vs-modified MULTI file table.
- `.planning/research/v0.2.4-enhanced-sarif-reporting/FEATURES.md` -- MULTI table-stakes + the anti-feature (reporter-side per-project runs).
- `.planning/research/v0.2.4-enhanced-sarif-reporting/PITFALLS.md` -- SARIF-upload and multi-run Code Scanning pitfalls (the 2025-07-21 multi-run-same-category rejection).

### CI + tooling under change (grounded at HEAD)
- `.github/workflows/ci.yml` -- the `code-scanning` job (D-05 target: today one hardcoded `bin.js -c apps/ng-spike-app/tsconfig.app.json` run + `category: angular-typechecker` upload; the `|| true` + `[ -s file ]` produced-guard to reuse; the fork-PR skip gate; the fallow per-run `automationDetails.id` `node -e` stamp = the merge pattern to mirror); the `discover` job (the lean fs-discovery precedent + its set-e separate-assignment loud-fail idiom); the `ci` aggregate `needs[]` (code-scanning is deliberately absent -- do NOT add it here, GATE-01 is Phase 36).
- `tools/ci/list-e2e-projects.mjs` -- the pure-`node:fs` discovery script `list-typecheck-projects.mjs` (D-01) mirrors.
- The e2e coverage-guard spec (GUARD-01b, `ci-e2e-coverage-guard.spec.ts`) -- the regression-guard the MULTI-02 drift guard (D-04) mirrors.
- `apps/ng-spike-app/project.json`, `libs/typecheck-consumer/project.json`, `libs/typecheck-consumer-dep/project.json`, `libs/typecheck-walk-consumer/project.json` -- the four `angular-typechecker:typecheck` consumers discovery must yield; read `targets.typecheck.options.tsConfig`.
- `packages/angular-typechecker/src/cli/bin.js` (built from `src/cli/bin.ts`) -- the standalone CLI (D-03) runs per project; `--format sarif`, repeatable `-c`.

### Prior phase context (same milestone)
- `.planning/phases/33-diagnostic-family-sarif-rule-metadata/33-CONTEXT.md` -- the RULE-01..04 SARIF-path work this phase's per-project SARIF now carries (family tags/level/help are already in every run); confirms the SARIF-only boundary and the additive-only discipline.

### Empirical evidence (external)
- Closed spike PR #53 (`LayZeeDK/angular-typechecker`) -- PROVED live that per-run `automationDetails.id` categories land as distinct Code Scanning analyses and that a single `category` input across multiple runs is rejected.
- Auto-memory `ci-sarif-code-scanning-dogfood` -- the current `code-scanning` job shape (angular-typechecker single run + fallow multi-run per-run-id, both no-category for fallow); job kept out of the required `ci` aggregate; SARIF-upload correctness only provable in REAL CI.
- Auto-memory `code-scanning-sarif-empirical-behavior` -- rule tags/catalog/help make the GitHub filters + help panel work; PR-ref alerts do not hit the `main` alerts view (relevant to Phase 35's proof, noted here for continuity).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The fallow SARIF step's inline `node -e` that stamps `r.automationDetails = { id: "fallow/" + i }` per run and uploads with NO `category` (`ci.yml` `code-scanning` job) -- the exact per-run-id + no-category pattern D-02/D-05 generalize into `merge-sarif.mjs`.
- `tools/ci/list-e2e-projects.mjs` -- the pure-`node:fs` discovery precedent (lean, no `npm ci`/graph) that `list-typecheck-projects.mjs` (D-01) mirrors.
- The `[ -s file ]` "produced" guard + `|| true` exit-tolerance already in the `code-scanning` job -- reused PER project (D-03) so an exit-2/empty run is skipped, not uploaded as an invalid file.
- The standalone CLI `bin.js --format sarif` (byte-pure SARIF to stdout) -- already the dogfood generator; D-03 loops it.
- The `discover` job's `projects=$(node ...)` separate-assignment (NOT `echo "$(...)"`) so a failed discovery trips `set -e` and fails LOUD -- reuse for the per-project loop wiring.

### Established Patterns
- Lean fs discovery -> dynamic behavior + an in-plugin `cache: false` regression-guard that cross-checks the discovery script against an independent enumeration (the e2e tier's `list-e2e-projects.mjs` + GUARD-01b). MULTI reuses this shape one-to-one.
- CI security invariants that MUST be preserved verbatim: every action SHA-pinned, `persist-credentials: false`, job-scoped `security-events: write` only, fork-PR upload skip, path-gated `if:`, no PR-metadata interpolated into a shell command.
- Standing additive-only audit vs the previous published version gates every release; MULTI touches no published surface, so the audit must show `packages/angular-typechecker/**` production files + manifest byte-unchanged.

### Integration Points
- All new logic is CI-side (`tools/ci/*.mjs` + the `code-scanning` job) plus one test-only plugin spec; the reporter seam (`sarif-report.ts` / `render-report.ts`) and all three adapters (Nx executor, Angular CLI builder, standalone CLI) are UNCHANGED.
- The per-project SARIF already carries Phase 33's rule tags/level/help, so per-project analyses land filterable by family with no additional work here.

</code_context>

<specifics>
## Specific Ideas

- Four fixed workspace consumers today: `ng-spike-app`, `typecheck-consumer`, `typecheck-consumer-dep`, `typecheck-walk-consumer`. The set is DISCOVERED, not hardcoded -- a fifth consumer added under `apps/`/`libs/` is covered with no CI edit, and the drift guard fails loud if the discovery script and the independent enumeration disagree.
- The per-run id prefix is the literal `angular-typecheck/<project>` (no `-er`), from MULTI-01/ROADMAP SC1 -- preserve verbatim.
- e2e-fixture `project.json` files under `e2e/*/fixtures/` carry the executor but are NOT workspace projects -- discovery (root-scoped) and the guard (fixture-path subtraction) must both exclude them.
- Single `upload-sarif`, NO `category` input -- the per-run ids ARE the categories (a single `category` would collide the runs, re-triggering GitHub's rejection).

</specifics>

<deferred>
## Deferred Ideas

- Automated `gh api` Code Scanning proof + isolated one-per-family fixture outside the Nx graph -- Phase 35 (PROOF-01/02).
- Promote `code-scanning` (+ the proof job) into the required `ci` aggregate `needs[]`, un-path-gate it so a planning-only PR still produces an analysis, enable the "Require code scanning results" ruleset (Evaluate-mode-first + `enforcement: disabled` recovery + fork-PR deadlock note), and document the CodeQL-only "Scanned files" limitation -- Phase 36 (GATE-01/02 + DOC-01).
- Migrate per-project uploads from one merged multi-run file to a per-project CI matrix -- MULTI-FUT-01, unneeded now (4 projects, far below the 20-runs/file cap).
- Any reporter-side `--category`/`automationDetails.id` CLI option -- explicitly rejected: it would make MULTI release-bearing and risk a non-additive SARIF change.

None of the above is in scope for Phase 34.

</deferred>

---

*Phase: 34-per-project-sarif-categories-in-ci*
*Context gathered: 2026-07-21*
