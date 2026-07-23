# Phase 35: Automated Code Scanning proof - Research

**Researched:** 2026-07-21
**Domain:** CI-only, fixture-driven proof that the shipped SARIF -> GitHub Code Scanning contract lands end-to-end (one alert per diagnostic family with the expected category, family tag, and severity), failing red on any regression.
**Confidence:** HIGH (grounded against the real reporter/CLI/CI at HEAD, the four proven SARIF integration fixtures, the closed spike PR #53, and verified GitHub REST field names).

<user_constraints>
## User Constraints (from 35-CONTEXT.md)

### Locked Decisions

**Isolated fixture (PROOF-01)**
- **D-01:** Fixture at `tools/sarif-proof-fixture/` (bare `tsconfig.json` + sources, NO `project.json`), a NEW sibling of `tools/act`, `tools/ci`, `tools/e2e-timing`. With no `project.json` it is invisible to `nx run-many -t typecheck`, so its deliberate errors can never fail the normal gate. `tools/` reads as "CI proof asset, not a consumer example."
- **D-01a (one diagnostic per family):** grounded in `diagnostic-family.ts` + `diagnostic-record.ts`:
  - `typescript` (SARIF level `error`) -- a plain TS type error in a `.ts` (e.g. `TS2322`).
  - `template-type-check` (level `error`) -- a type error in an EXTERNAL `.html` template so it lands `.html`-attributed (e.g. `NG8002`).
  - `extended-diagnostics` (level `warning`) -- a deterministic warning-level NG8xxx from the 18-member extended catalog.
  - `tool` (level `error`) -- a synthesized ATC diagnostic: `ATC90001` (zero rootNames) or `ATC90002` (not-found referenced leaf).
- **D-01b (ATC synthesis, the one flagged wiring detail):** the `tool`-family alert comes from an engine-state condition, not a source error; needs a dedicated references-only/empty (or missing-reference) tsconfig leaf via the repeatable `-c` -- possibly a SECOND CLI invocation merged in. Exact code (90001 vs 90002) and single-vs-double invocation are the researcher/planner's call. CI-only + self-verified: if ATC does not fire, the proof goes red.

**Proof CI job (PROOF-01, SC4)**
- **D-02:** NEW dedicated `code-scanning-proof` job in `.github/workflows/ci.yml` (NOT steps folded into the dogfood `code-scanning` job).
- **D-02a:** upload the fixture SARIF under a DEDICATED `category: angular-typecheck-proof` -- distinct from `angular-typecheck/<project>` dogfood ids and `fallow/<i>` ids.
- **D-02b (PR-scoped, protects `main`, SC4):** upload + assert run ONLY on `pull_request` events (skip push-to-`main`), scoping errors to `refs/pull/<n>/merge` so they NEVER land on `main`'s default alerts view. Also skip FORK PRs (read-only token), mirroring the dogfood fork gate.
- **D-02c (preserve every CI security invariant verbatim):** job-scoped `security-events: write` at job level only (write covers upload AND the alerts/analyses read; top-level `contents: read` restated for checkout), `persist-credentials: false`, `fetch-depth: 0`, SHA-pin any new action (prefer `gh api` over a marketplace action), `gh api` authed via the workflow `GITHUB_TOKEN`, NO PR metadata interpolated into any shell command.
- **D-02d (stays OUT of the required gate):** the proof job is NOT added to the `ci` aggregate `needs[]` this phase (promotion is GATE-01, Phase 36). Keep the `code != 'false'` path-gate.

**Assertion mechanism + determinism (PROOF-01/02, P6)**
- **D-03:** NEW `tools/ci/assert-code-scanning.mjs` (mirrors `list-*.mjs`/`merge-sarif.mjs`) -- a lean `node` script driving `gh api`. NOT a marketplace action. Receives the repo (`LayZeeDK/angular-typechecker`), the PR number, the expected category, and the expected family/severity set.
- **D-03a (deterministic wait handle):** capture the `upload-sarif` step's `sarif-id`; poll `GET /repos/LayZeeDK/angular-typechecker/code-scanning/sarifs/{sarif_id}` until `processing_status == complete` (bounded) BEFORE querying alerts. Fall back to bounded analyses-API polling if the id is unavailable.
- **D-03b (bounded poll, never a single query):** query `code-scanning/analyses?ref=refs/pull/<n>/merge` + `code-scanning/alerts?ref=refs/pull/<n>/merge` (filtered by `tool_name`/category) with bounded retries + backoff. `upload-sarif`'s `wait-for-processing` gives up SILENTLY on timeout, so the script must poll itself and fail loud on timeout.
- **D-03c (set-membership, not counts):** assert SET-MEMBERSHIP of expected tuples -- category present + one alert PRESENT per family matched on rule tag + severity. NEVER an exact count. Exit non-zero (RED) if ANY expected tuple is missing OR the poll times out (PROOF-02).
- **D-03d (the expected set):** `typescript -> error`, `template-type-check -> error`, `extended-diagnostics -> warning`, `tool -> error`.

**No release / additive-only**
- **D-04:** CI/fixture/test-only. New/changed: `tools/sarif-proof-fixture/**` (NEW), `tools/ci/assert-code-scanning.mjs` (NEW), `.github/workflows/ci.yml` (MOD), OPTIONALLY one in-plugin test spec. NO reporter/API/schema edit, NO new runtime dependency, NO version bump. Confirm `packages/angular-typechecker/**` production surface + manifest byte-unchanged.

### Claude's Discretion
- Exact poll bounds (attempts / interval / total timeout) -- sensible default up to ~3-5 min total with linear or exponential backoff.
- **RECOMMENDED drift lock:** a LOCAL, test-only in-plugin spec that runs the shipped CLI over the proof fixture and asserts the emitted SARIF carries exactly the four family tags + severities the CI assert expects (mirrors the Phase-34 drift-guard philosophy). MUST be test-only; shape (`cache:false` regression-guard vs integration spec) is the planner's call.
- Exact ATC code (90001 vs 90002) and whether it needs a second CLI invocation vs an added `-c` leaf (D-01b).
- Whether `assert-code-scanning.mjs` also cross-checks per-analysis `category`/`automationDetails.id` via the analyses API in addition to the alerts API.
- Exact ci.yml step wiring (`set -e` loud-fail on a failed substitution; passing `sarif-id` / PR number between steps via `$GITHUB_OUTPUT`/`env`).

### Deferred Ideas (OUT OF SCOPE)
- Promote `code-scanning` (+ this proof job) into the required `ci` `needs[]`, un-path-gate `code-scanning`, enable the "Require code scanning results" ruleset, document the Scanned-files limitation -- **Phase 36 (GATE-01/02 + DOC-01)**.
- Any reporter-side `--category`/`automationDetails.id` CLI option -- explicitly rejected (would make PROOF release-bearing).
- Asserting exact alert COUNTS -- set-membership only.
- Populating / emitting `run.artifacts` for the "Scanned files" panel (proven inert; DOC-01/Phase 36).
- Precisely distinguishing inline-template TS diagnostics from ordinary `typescript` -- RULE-FUT-01, deferred; the coarse `.html`-origin heuristic is the v1 contract the fixture relies on.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROOF-01 | A CI check emits one known diagnostic per family from an ISOLATED fixture (outside the normal `nx typecheck` gate) and asserts via `gh` (`code-scanning/analyses` + `code-scanning/alerts`) that each expected alert lands with the expected category, tags, and severity. | Fixture design (single solution tsconfig + missing reference -> all 4 families in ONE SARIF run); proof job wiring; assert script driving `gh api` with verified field paths (`alert.rule.tags`, `alert.rule.severity`, `most_recent_instance.category`, analysis `category`/`sarif_id`). |
| PROOF-02 | The proof fails loudly (red check) if any expected alert, category, or tag is missing -- so a SARIF->Code Scanning regression is caught automatically. | Bounded `gh api` poll on `sarif_id` processing + `refs/pull/<n>/merge` alerts; set-membership assertion; non-zero exit on any missing tuple OR timeout; optional local drift-lock integration spec as the second, faster tripwire. |
</phase_requirements>

## Summary

Phase 35 adds ONE CI job that continuously proves the SARIF -> GitHub Code Scanning contract Phase 33 (rule metadata) and Phase 34 (per-project upload) shipped. Nothing in the published package changes: the reporter and all three adapters are byte-unchanged, and there is no version bump. The work is exactly three artifacts (all locked by CONTEXT): an isolated one-per-family fixture under `tools/sarif-proof-fixture/`, a new `code-scanning-proof` job in `ci.yml`, and a lean `tools/ci/assert-code-scanning.mjs` that drives `gh api`.

The single most important finding resolves D-01b (the one CONTEXT-flagged uncertainty). **All four families can be emitted from ONE CLI invocation and ONE SARIF run** by pointing the CLI at a solution-style tsconfig that (a) references a real leaf carrying the `typescript` + `template-type-check` + `extended-diagnostics` diagnostics and (b) references ONE deliberately-missing path, which the engine synthesizes as `ATC90002` (`tool` family, error). This is not speculative: I traced it through `run-typecheck.ts` (`handleSolutionWalk` unions surviving-leaf diagnostics with the synthesized 90002 before a single `finalize`), and both halves are already proven live by two committed fixtures -- `layout-b-host` (a solution tsconfig -> `TS2322` + external-`.html` `NG8002`) and `solution-style-all-missing` (missing references -> `ATC90002`). A single run means a single `upload-sarif` with `category: angular-typecheck-proof` and NO multi-run-same-category rejection risk, and NO merge script. This is strictly lazier than a second CLI invocation + merge, and self-verifying.

The second load-bearing area is the assert script's determinism and the exact GitHub REST field paths. Verified against docs.github.com: `upload-sarif` exposes a `sarif-id` output; `GET .../code-scanning/sarifs/{sarif_id}` returns `processing_status` (`pending`/`complete`/`failed`) -- the deterministic wait handle; `GET .../code-scanning/alerts?ref=refs/pull/<n>/merge&tool_name=angular-typechecker` returns alerts whose `rule.tags` (array) and `rule.severity` (`none`/`note`/`warning`/`error`) carry the family tag and level, and whose `most_recent_instance.category` carries the category. Because the dogfood `code-scanning` job runs on the SAME PR under the same `tool_name`, the assert MUST client-side filter alerts by `most_recent_instance.category === 'angular-typecheck-proof'` to isolate proof alerts from dogfood alerts.

**Primary recommendation:** Build the fixture as a single solution `tsconfig.json` (a surviving leaf with `TS2322` + external-`.html` `NG8002` + a warning-level extended NG8xxx, plus one missing reference for `ATC90002`); run the shipped dist CLI once (`bin.js -c tools/sarif-proof-fixture/tsconfig.json --format sarif`); upload one run under `category: angular-typecheck-proof` on `pull_request` non-fork events only; assert with `gh api` (poll `sarif_id` to `complete`, then set-membership over `refs/pull/<n>/merge` alerts filtered by category). Add the optional local drift-lock integration spec. Pre-empt the two gate landmines: `fallow` (new-only) and Prettier will inspect the new `tools/` fixture and must be scoped.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Emit one diagnostic per family | Isolated fixture (`tools/sarif-proof-fixture/**`) driving the SHIPPED engine | Shipped reporter (`sarif-report.ts`, read-only) | The families + tags + levels are decided by `familyOf`/`toSarifLevel` in the byte-unchanged reporter; the fixture only supplies inputs that make each fire. |
| Generate SARIF | Shipped standalone CLI (`dist/.../cli/bin.js --format sarif`) | -- | The proof runs the real published artifact; NO bespoke SARIF construction. |
| Upload to Code Scanning | CI job (`code-scanning-proof` in `ci.yml`) + `github/codeql-action/upload-sarif` | GitHub Code Scanning ingestion | Same SHA-pinned action + fork/PR gating as the dogfood job; category is the only new input. |
| Assert the contract landed | CI (`tools/ci/assert-code-scanning.mjs` via `gh api`) | GitHub REST (`sarifs`/`alerts`/`analyses`) | Bounded poll + set-membership; the ingestion assertion is provable ONLY in real CI. |
| Lock the expected set locally | In-plugin integration spec (test-only, `nx integration`) | -- | Guards the CI assert's expected tuples from drifting from what the reporter actually emits over the fixture. |

**Note:** No capability belongs in the published package. The reporter/adapter tier is read-only this phase (D-04). Every new artifact is CI/fixture/test-only.

## Standard Stack

No external packages are installed this phase. The proof reuses tooling already present.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `gh` CLI (`gh api`) | pre-installed on GitHub-hosted runners | Query Code Scanning `sarifs`/`alerts`/`analyses`; auth via `GH_TOKEN` | Repo rule "prefer `gh api` over new marketplace actions" -- fewer SHA-pinned deps [CITED: PITFALLS.md repo-specific warnings]. |
| Node.js stdlib (`node:child_process`, `node:fs`, `node:url`) | runner Node 24 | The `assert-code-scanning.mjs` script (spawn `gh`, parse JSON, exit code) | Mirrors the existing pure-`node` `tools/ci/*.mjs` precedent [VERIFIED: read `merge-sarif.mjs`, `list-typecheck-projects.mjs`]. |
| `github/codeql-action/upload-sarif` | `7188fc363630916deb702c7fdcf4e481b751f97a` (v4.37.1) | Upload the fixture SARIF; exposes the `sarif-id` output | Already SHA-pinned in `ci.yml`; reuse the EXACT pin [VERIFIED: read `ci.yml` L602/L611]. |
| Shipped standalone CLI | dist `dist/packages/angular-typechecker/src/cli/bin.js` | Generate the SARIF from the fixture (`--format sarif`, repeatable `-c`) | The real published artifact; byte-unchanged [VERIFIED: read `bin.ts`, `parse-args.ts`]. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `gh api` in a node script | A marketplace "assert code scanning" action | Adds a new SHA-pinned dependency + supply-chain surface; repo explicitly prefers `gh api` [CITED: PITFALLS.md]. |
| Single CLI invocation (solution + missing ref) | Two invocations + merge into one run | More code; a two-run file re-triggers the multi-run-same-category rejection unless results are merged into one run. Single-invocation avoids both. |
| `ATC90002` (not-found reference) for `tool` | `ATC90001` (zero rootNames) | 90001 only fires when there are NO surviving leaves (direct empty path, or an all-empty solution) -- incompatible with also emitting the other three families in one run. 90002 co-exists with surviving leaves. |

**Installation:** none. `npm ci` (already in the job) makes `dist` buildable via `nx build angular-typechecker`; `gh` and Node are ambient on the runner.

## Package Legitimacy Audit

**Not applicable** -- this phase installs NO external packages (npm/PyPI/crates). It reuses the already-pinned `github/codeql-action/upload-sarif` action (verified SHA `7188fc363630916deb702c7fdcf4e481b751f97a`, v4.37.1, identical to the existing dogfood job) and the pre-installed `gh` CLI. Package Legitimacy Gate skipped by construction (nothing to install).

## Architecture Patterns

### System Data Flow

```
  PR opened / updated (pull_request, non-fork)
            |
            v
  +-------------------------------+
  | code-scanning-proof job       |   (NEW; path-gated code != 'false' AND
  |  (ci.yml)                     |    event_name == 'pull_request')
  +-------------------------------+
            |
   1. checkout + setup-node + npm ci + nx build angular-typechecker
            |
            v
   2. node dist/.../cli/bin.js  -c tools/sarif-proof-fixture/tsconfig.json
                                --format sarif  > proof.sarif  || true
            |
            |  the shipped engine walks the solution tsconfig:
            |    surviving leaf ->  TS2322            (typescript,          error)
            |                       NG8002 (ext .html) (template-type-check, error)
            |                       NG8xxx (ext .html) (extended-diagnostics, warning)
            |    missing reference -> ATC90002        (tool,               error)
            |  familyOf() tags each rule; ONE SARIF run, N results
            v
   3. [ -s proof.sarif ] -> produced=true    (exit 1 still writes valid SARIF)
            |
            v
   4. upload-sarif (id: upload)  sarif_file: proof.sarif
                                 category:  angular-typecheck-proof
        -> output steps.upload.outputs['sarif-id']
            |
            v
   5. node tools/ci/assert-code-scanning.mjs   (env: GH_TOKEN, PR_NUMBER, SARIF_ID)
            |
            |  poll GET code-scanning/sarifs/{SARIF_ID}
            |       until processing_status == 'complete' (bounded; fail on 'failed')
            |  GET code-scanning/analyses?ref=refs/pull/<PR>/merge&sarif_id=<id>
            |       assert an analysis with category == 'angular-typecheck-proof'
            |  GET code-scanning/alerts?ref=refs/pull/<PR>/merge&tool_name=angular-typechecker
            |       client-filter alerts by most_recent_instance.category == 'angular-typecheck-proof'
            |       assert SET-MEMBERSHIP of the 4 (tag, severity) tuples
            v
   exit 0  (all tuples present)   |   exit 1 (any missing OR timeout) -> job RED
```

Everything left of GitHub Code Scanning runs on the runner; the ingestion + REST query round-trip is what makes the assertion REAL-CI-only.

### Recommended Fixture Structure
```
tools/sarif-proof-fixture/
├── tsconfig.json          # SOLUTION: files:[], references:[./tsconfig.fixture.json, ./tsconfig.missing.json]
├── tsconfig.fixture.json  # surviving LEAF: files:[type-error.ts, proof.component.ts]; strictTemplates:true
├── type-error.ts          # TS2322  (typescript, error)
├── proof.component.ts      # standalone component, templateUrl: ./proof.component.html
└── proof.component.html    # NG8002 (template-type-check, error) + NG8xxx (extended-diagnostics, warning)
#  tsconfig.missing.json is DELIBERATELY ABSENT -> ATC90002 (tool, error)
#  NO project.json anywhere -> invisible to nx run-many -t typecheck (D-01)
```

### Pattern 1: All four families from ONE SARIF run (resolves D-01b)
**What:** point the CLI at a single solution-style tsconfig; the reference walk unions the surviving leaf's real diagnostics with a synthesized `ATC90002` for the missing reference, and a single `finalize` emits one run.
**When to use:** always -- this is the recommended fixture shape. It sidesteps the multi-run-same-category rejection (one run) and needs no merge script.
**Why it works (traced, HIGH confidence):**
- A solution tsconfig with `files:[]` + `references:[...]` resolves zero rootNames -> `runTypecheck` routes to `handleSolutionWalk` [VERIFIED: `run-typecheck.ts` L425-437].
- `walkReferences` walks each reference: the missing path fails `readConfiguration` (ENOENT -> UNKNOWN_ERROR_CODE), and because `ts.sys.fileExists` is false it synthesizes a `REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE` (90002) fileless Error and records a `not-found` skip -- NOT re-thrown as infra [VERIFIED: `walk-references.ts` L340-357].
- The good reference is a surviving leaf (`rootNamesCount > 0`), so `handleSolutionWalk` calls `finalizeUnion` over `[...configDiagnostics, ...walk.rawDiagnostics]` = surviving-leaf diagnostics + the 90002 [VERIFIED: `run-typecheck.ts` L589-611].
- The external-`.html` diagnostics survive the boundary filter via the v0.2.0 branch-4a `.html`->owning-`.ts` mapping -- already proven for `layout-b-host` (itself a solution tsconfig) [VERIFIED: `machine-reporters-sarif.integration.spec.ts` L271-288].

**Example (the CLI call the proof job runs):**
```bash
# Source: mirrors merge-sarif.mjs's spawn shape + ci.yml dogfood step
node dist/packages/angular-typechecker/src/cli/bin.js \
  -c tools/sarif-proof-fixture/tsconfig.json --format sarif > proof.sarif || true
[ -s proof.sarif ] && echo "produced=true" >> "$GITHUB_OUTPUT" \
                   || echo "produced=false" >> "$GITHUB_OUTPUT"
```

### Pattern 2: Isolate proof alerts from dogfood alerts by category (correctness, not cosmetics)
**What:** the alerts API has no `category` query param, and the dogfood `code-scanning` job runs on the same PR under the same `tool_name=angular-typechecker`. Filter alerts CLIENT-SIDE on `most_recent_instance.category === 'angular-typecheck-proof'`.
**When to use:** always in the assert script.
**Why:** without it, a real `extended-diagnostics` alert from a dogfood project on the same PR could satisfy the `extended-diagnostics` tuple and mask a genuine proof regression. Filtering by the dedicated category makes the assertion answer "did the PROOF fixture's alert land," not "did any angular-typechecker alert land." [VERIFIED: alerts API params are `ref`/`tool_name`/`state` only -- no `category`; `most_recent_instance.category` exists -- docs.github.com]

### Pattern 3: Deterministic wait handle (D-03a)
**What:** capture `steps.upload.outputs['sarif-id']`, poll `GET .../code-scanning/sarifs/{sarif_id}` until `processing_status == 'complete'`, THEN query alerts.
**Why:** `upload-sarif`'s `wait-for-processing: true` waits but "gives up silently on timeout (continues, does not fail)" [CITED: PITFALLS.md P6 / codeql-action upload-lib]. The `sarifs/{id}` poll is the explicit, fail-loud confirmation. `processing_status == 'failed'` -> exit 1 immediately with `errors[]`.

### Anti-Patterns to Avoid
- **Multiple SARIF runs sharing one category.** GitHub rejects "multiple runs with the same category" [CITED: PITFALLS.md P5]. A two-invocation merge would produce two runs; if both carry `category: angular-typecheck-proof`, the upload fails. Use the single-invocation Pattern 1 (one run).
- **`steps.upload.outputs.sarif-id` (dot syntax) in a GitHub expression.** The hyphen parses as subtraction (`sarif - id`). Use bracket syntax: `${{ steps.upload.outputs['sarif-id'] }}`. [ASSUMED: GitHub Actions expression grammar; low risk, actionlint/act-compat will catch a bad expression]
- **Interpolating the PR number into a `run:` shell string.** Violates the top-of-file no-command-injection invariant. Pass `github.event.pull_request.number` through an `env:` value (as the `e2e` job does with `PROJECT`) and read it in the node script. [VERIFIED: `ci.yml` L212-219]
- **Asserting exact alert counts.** Brittle (D-03c). Assert set-membership of tuples.
- **Editing the reporter / adapters to add a category flag.** Makes PROOF release-bearing (Deferred / D-04). The category is an `upload-sarif` input, not a reporter concern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Produce SARIF for the fixture | A bespoke SARIF writer / a second `--category` reporter path | The shipped `bin.js --format sarif` | The whole point is to prove the SHIPPED contract; and any reporter edit would be release-bearing (D-04). |
| Combine families into one upload | A `merge-sarif`-style two-run concatenation for the proof | One solution-tsconfig invocation (Pattern 1) | Avoids the multi-run-same-category rejection and the merge code entirely. |
| Poll GitHub for the analysis | A marketplace polling action | `gh api` in a node script | Fewer SHA-pinned deps (repo rule); `gh` handles auth via `GH_TOKEN`. |
| Wait for ingestion | A fixed `sleep` | Poll `sarifs/{id}.processing_status` then bounded alerts retries | Ingestion latency is variable; a fixed sleep is either flaky or slow. |
| Authenticate REST calls | Hand-rolled `curl` + token headers | `gh api` (reads `GH_TOKEN`) | `gh` is the repo's blessed path and already trusted in CI. |

**Key insight:** every "build" here is already shipped or already in the repo. The phase is wiring + one fixture + one ~120-line assert script.

## Common Pitfalls

### Pitfall 1: The `tools/` fixture trips the `fallow` new-only gate (HIGH -- will fire)
**What goes wrong:** the `fallow` CI job gates on newly-introduced findings (`audit.gate: new-only`, `code_quality.fallow.enabled: true`). The proof fixture's `.ts`/`.component.ts` are imported by nothing (-> `unused-files`, error), the component is rendered nowhere (-> `unrendered-components`, warn), and a deliberately-broken template/`.ts` may trip `unresolved-imports`. `.fallowrc.jsonc` scopes those rules off for `fixtures/**`, `e2e/**/fixtures/**`, `libs/**`, and spec globs -- but NOT for `tools/**` (only `health.ignore` covers `tools/**`, which is complexity-only). [VERIFIED: read `.fallowrc.jsonc` -- `unused-files` off only for the fixture/spec globs; `tools/**` appears only under `health.ignore`]
**Why it happens:** the fixture lives under `tools/` (locked by D-01), which the fallow config treats as tooling, not as diagnostic fixtures.
**How to avoid:** add a `.fallowrc.jsonc` `overrides` entry for `tools/sarif-proof-fixture/**` scoping off `unused-files`, `unrendered-components`, `unused-component-inputs`, and (if the template/imports trip it) `unresolved-imports` -- exactly the shape already used for `fixtures/**`. This is a `ci`/`chore`-typed change to a non-published file (does not affect the additive audit).
**Warning signs:** the `fallow` job goes red on the phase PR with `unused-files`/`unresolved-imports` naming `tools/sarif-proof-fixture/*`. Run `npx fallow audit --format human --base origin/main` locally on the branch before pushing.

### Pitfall 2: Prettier (`format-lint`) inspects the new fixture (MEDIUM -- likely)
**What goes wrong:** `format-lint` runs `nx format:check` over PR-changed files. The new fixture files are changed on this PR, so Prettier checks them. Angular template whitespace reflow can also change WHICH NG diagnostics fire / how many -- the repo already `.prettierignore`s two diagnostic-sensitive templates for this reason. [VERIFIED: read `.prettierignore` L22-29]
**How to avoid:** either keep the fixture files Prettier-clean, OR add the fixture's `.html` (and any whitespace-sensitive file) to `.prettierignore`, mirroring the `extended-batch-fn`/`extended-batch-expression` entries. Prefer ignoring the `.html` (its exact reflow governs NG8002/NG8xxx emission); the `.ts` files are safe to keep Prettier-clean.
**Warning signs:** `format-lint` red on the phase PR naming the fixture files.

### Pitfall 3: Wrong ref -> proof falsely fails (HIGH if not designed for; already locked by D-02b/D-03b)
**What goes wrong:** PR alerts are scoped to `refs/pull/<n>/merge`, NOT `branch:main` / the default alerts view. Querying the default view returns nothing. [CITED: PITFALLS.md P6; auto-memory `code-scanning-sarif-empirical-behavior`; spike PR #53]
**How to avoid:** always query `?ref=refs/pull/<PR_NUMBER>/merge`. `PR_NUMBER` = `github.event.pull_request.number` via env.

### Pitfall 4: Async ingestion + silent `wait-for-processing` timeout (HIGH; mitigated by D-03a/b)
**What goes wrong:** alerts/analyses are not immediately queryable after upload; `upload-sarif`'s `wait-for-processing` continues silently on timeout. A single query right after upload is flaky.
**How to avoid:** poll `sarifs/{id}` to `complete`, then bounded-retry the alerts/analyses queries; fail loud on timeout (never assert once).

### Pitfall 5: Proof errors polluting `main`'s alerts view (SC4; locked by D-02b)
**What goes wrong:** if the proof uploaded on push-to-`main`, the fixture's deliberate errors would become open alerts on `main`'s default view.
**How to avoid:** gate the job on `github.event_name == 'pull_request'` so it NEVER uploads on push. Combined with PR-ref scoping, `main` never sees proof alerts.

### Pitfall 6: `security-events` scope for the READ (locked by D-02c)
**What goes wrong:** the assert reads `code-scanning/alerts`/`analyses`; a read needs `security-events: read`.
**How to avoid:** the job's `security-events: write` (needed for the upload) covers the read -- one job-level grant, no extra permission. [VERIFIED: docs -- read endpoints require `security-events` read; write is a superset]

### Pitfall 7: Fork PRs (document, low practical impact)
**What goes wrong:** fork PRs get a read-only token -> `upload-sarif` fails -> no analysis -> the assert would find nothing. [CITED: PITFALLS.md P6 fork corollary]
**How to avoid:** gate the upload + assert steps on `github.event.pull_request.head.repo.fork == false` (mirrors the dogfood job L601/L610). On a fork PR the job runs the build/generate but skips upload+assert, staying green. No external contributors today; maintainer self-merges.

## Code Examples

### Fixture: solution tsconfig (points the CLI at all four families)
```jsonc
// Source: mirrors fixtures/layout-b-host/tsconfig.json + fixtures/solution-style-all-missing/tsconfig.json
// tools/sarif-proof-fixture/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compileOnSave": false,
  "files": [],
  "references": [
    { "path": "./tsconfig.fixture.json" },   // surviving leaf: TS2322 + NG8002 + NG8xxx
    { "path": "./tsconfig.missing.json" }     // ABSENT on disk -> ATC90002 (tool, error)
  ]
}
```

### Fixture: surviving leaf
```jsonc
// Source: mirrors fixtures/extended-content-projection/tsconfig.app.json
// tools/sarif-proof-fixture/tsconfig.fixture.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "target": "es2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "emitDecoratorMetadata": false,
    "experimentalDecorators": false
  },
  "angularCompilerOptions": { "strictTemplates": true },
  "files": ["type-error.ts", "proof.component.ts"]
}
```

### Fixture: sources (deliberate one-per-family diagnostics)
```typescript
// tools/sarif-proof-fixture/type-error.ts  -> TS2322 (typescript, error)
export const proofTypeError: number = 'not a number';
```
```typescript
// tools/sarif-proof-fixture/proof.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'sarif-proof',
  standalone: true,
  templateUrl: './proof.component.html',
})
export class ProofComponent {
  readonly value = 1;
}
```
```html
<!-- tools/sarif-proof-fixture/proof.component.html -->
<!-- NG8002 unknown property (template-type-check, error) -->
<div [unknownProperty]="value"></div>
<!-- extended-diagnostics, warning: pick a deterministic warning-level NG8xxx from
     EXTENDED_DIAGNOSTIC_CATALOG (e.g. NG8101 inverted banana-in-box, or model on the
     proven NG8011 extended-content-projection fixture). The local drift-lock spec
     confirms the exact code fires. -->
<input ([value])="value" />
```

**Family/level mapping the fixture must satisfy (the assert's expected set):** [VERIFIED: `diagnostic-family.ts` `familyOf` + `sarif-report.ts` `toSarifLevel`]
| Diagnostic | ruleId | `familyOf` -> tag | severity -> level |
|-----------|--------|-------------------|-------------------|
| TS type error in `.ts` | `TS2322` | `typescript` | error |
| Unknown property in ext `.html` | `NG8002` (rawCode `<0`, not in 18-catalog) | `template-type-check` | error |
| Warning NG8xxx in ext `.html` | e.g. `NG8101` (rawCode `<0`, in 18-catalog) | `extended-diagnostics` | warning |
| Missing reference | `ATC90002` (rawCode `>=90000`) | `tool` | error |

### Assert script skeleton (`tools/ci/assert-code-scanning.mjs`)
```javascript
// Source: mirrors tools/ci/merge-sarif.mjs (pure node, gh via child_process, JSDoc-typed)
import { execFileSync } from 'node:child_process';

const REPO = 'LayZeeDK/angular-typechecker';
const CATEGORY = 'angular-typecheck-proof';
const TOOL = 'angular-typechecker';
// D-03d: the contract the proof locks (set-membership, not counts).
const EXPECTED = [
  { tag: 'typescript', severity: 'error' },
  { tag: 'template-type-check', severity: 'error' },
  { tag: 'extended-diagnostics', severity: 'warning' },
  { tag: 'tool', severity: 'error' },
];

const prNumber = process.env.PR_NUMBER;       // github.event.pull_request.number (env, never shell)
const sarifId = process.env.SARIF_ID;         // steps.upload.outputs['sarif-id']
const ref = `refs/pull/${prNumber}/merge`;

/** One authenticated `gh api` GET -> parsed JSON. GH_TOKEN is read by gh from env. */
function ghApi(pathAndQuery) {
  const out = execFileSync('gh', ['api', pathAndQuery], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Deterministic wait handle (D-03a): poll processing_status -> complete.
async function waitProcessing() {
  for (let i = 0; i < 20; i++) {           // ~120s ceiling (tunable, Discretion)
    const s = ghApi(`repos/${REPO}/code-scanning/sarifs/${sarifId}`);
    if (s.processing_status === 'complete') return;
    if (s.processing_status === 'failed') {
      throw new Error(`SARIF processing failed: ${JSON.stringify(s.errors ?? [])}`);
    }
    await sleep(6000);
  }
  throw new Error('timed out waiting for SARIF processing_status == complete');
}

// 2. Optional analyses cross-check (Discretion): an analysis under our category exists.
function assertAnalysisCategory() {
  const analyses = ghApi(
    `repos/${REPO}/code-scanning/analyses?ref=${ref}&tool_name=${TOOL}&sarif_id=${sarifId}`,
  );
  if (!analyses.some((a) => a.category === CATEGORY)) {
    throw new Error(`no analysis with category ${CATEGORY} for sarif_id ${sarifId}`);
  }
}

// 3. Set-membership over PROOF alerts, isolated by category (Pattern 2).
async function assertAlerts() {
  for (let i = 0; i < 20; i++) {           // bounded retry for propagation
    const alerts = ghApi(
      `repos/${REPO}/code-scanning/alerts?ref=${ref}&tool_name=${TOOL}&per_page=100`,
    ).filter((a) => a.most_recent_instance?.category === CATEGORY);

    const missing = EXPECTED.filter(
      (e) => !alerts.some(
        (a) => (a.rule?.tags ?? []).includes(e.tag) && a.rule?.severity === e.severity,
      ),
    );
    if (missing.length === 0) return;      // every tuple present -> pass
    await sleep(6000);
  }
  throw new Error('proof alerts missing expected (tag, severity) tuples after polling');
}

await waitProcessing();
assertAnalysisCategory();
await assertAlerts();
console.log('code-scanning proof: all expected (category, family tag, severity) tuples present');
```

### ci.yml `code-scanning-proof` job skeleton
```yaml
# Source: mirrors the code-scanning job (ci.yml L539-613); PR-only, dedicated category.
code-scanning-proof:
  needs: changes
  # D-02b + D-02d: pull_request ONLY (never push-to-main) AND keep the path-gate.
  # The NEGATIVE != 'false' form keeps it in the `act -n` plan under the empty filter.
  if: ${{ github.event_name == 'pull_request' && needs.changes.outputs.code != 'false' }}
  runs-on: ubuntu-latest
  permissions:
    contents: read
    security-events: write        # covers the upload AND the alerts/analyses read (D-02c)
  env:
    NX_DAEMON: false
  steps:
    - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
      with:
        persist-credentials: false
        fetch-depth: 0
    - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
      with:
        node-version: 24
        cache: npm
    - run: npm ci
    - run: npx nx build angular-typechecker
    - id: gen
      run: |
        node dist/packages/angular-typechecker/src/cli/bin.js \
          -c tools/sarif-proof-fixture/tsconfig.json --format sarif > proof.sarif || true
        if [ -s proof.sarif ]; then echo "produced=true" >> "$GITHUB_OUTPUT"; else echo "produced=false" >> "$GITHUB_OUTPUT"; fi
    - id: upload
      if: ${{ github.event.pull_request.head.repo.fork == false && steps.gen.outputs.produced == 'true' }}
      uses: github/codeql-action/upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1
      with:
        sarif_file: proof.sarif
        category: angular-typecheck-proof     # ONE run + ONE category -> no multi-run rejection
    - if: ${{ github.event.pull_request.head.repo.fork == false && steps.gen.outputs.produced == 'true' }}
      env:
        GH_TOKEN: ${{ github.token }}
        PR_NUMBER: ${{ github.event.pull_request.number }}
        SARIF_ID: ${{ steps.upload.outputs['sarif-id'] }}   # bracket syntax (hyphen != minus)
      run: node tools/ci/assert-code-scanning.mjs
```
Note: the job is deliberately ABSENT from the `ci` aggregate `needs[]` (D-02d; GATE-01 is Phase 36).

### Optional local drift-lock (Discretion, RECOMMENDED)
Add a 5th `describe` block to `machine-reporters-sarif.integration.spec.ts` (or a new sibling `*.integration.spec.ts`) that runs the shipped CLI over the proof fixture and asserts the emitted `rules[]` set-equals the four family tuples the CI assert expects:
```typescript
// runs under the `integration` nx target (real cold compiler) -- test-only, never published
const proofTsConfig = join(workspaceRoot, 'tools', 'sarif-proof-fixture', 'tsconfig.json');
const payload = JSON.parse(await runSarif(proofTsConfig));
// assert one rule per family with the exact tag + level:
//   TS2322 -> typescript/error, NG8002 -> template-type-check/error,
//   NG8101 -> extended-diagnostics/warning, ATC90002 -> tool/error
```
**Strongest form (single source of truth):** put the expected tuples in `tools/sarif-proof-fixture/expected-families.json` and read it from BOTH the `.mjs` assert and the `.ts` spec, so the CI proof's expected set cannot drift from the local check. Plain duplication (with a cross-reference comment) is the acceptable fallback. This is the LOCAL half of the proof; the ingestion half stays real-CI-only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `NG8101` (inverted banana-in-box) fires deterministically at warning level from the fixture template. | Fixture sources | Low -- the exact extended code is Claude's discretion (D-01a); the local drift-lock spec + the CI proof both go red if the chosen code doesn't fire, so a wrong pick is caught before merge. `NG8011` (proven by `extended-content-projection`) is the safe fallback. |
| A2 | `[unknownProperty]` on a native element fires `NG8002` (not a different code) under `strictTemplates`. | Fixture sources | Low -- `layout-b-host` already proves an external-`.html` `NG8002`; if the exact binding differs, model the `.html` on that fixture. Self-verified by the drift-lock. |
| A3 | Poll bounds (20 x 6s for processing, 20 x 6s for alerts, ~4 min ceiling). | Assert script | Low -- Discretion (D-03); tune up if real CI shows longer ingestion latency. Too-short only causes a false timeout (red), never a false pass. |
| A4 | `${{ steps.upload.outputs['sarif-id'] }}` bracket syntax is required (dot syntax parses the hyphen as subtraction). | ci.yml wiring | Low -- actionlint + act-compat validate expressions in CI; a bad expression fails `lint-workflows` before merge. |
| A5 | The proof fixture template can carry BOTH `NG8002` and a warning `NG8xxx` without one suppressing the other. | Fixture design | Low-Medium -- if they interfere, split into two elements or two leaf components (still one run). Self-verified (proof goes red). |

**If a claim proves wrong, the failure mode is a RED proof, never a silent pass** -- which is exactly the PROOF-02 charter.

## Open Questions (RESOLVED)

> RESOLVED: both questions below carry a recommendation that was incorporated into the phase plans (35-01 fixture template + drift-lock; 35-02 analyses-API category cross-check). No open blocker remains.

1. **Exact extended NG8xxx code + whether NG8002 and the extended code coexist in one template.**
   - What we know: `familyOf` maps any 18-catalog member -> `extended-diagnostics` and `NG8002` -> `template-type-check`; both are proven individually (`extended-content-projection` NG8011; `layout-b-host` NG8002).
   - What's unclear: whether the specific pair fires cleanly together in one `.html`.
   - Recommendation: start with one template carrying both; if the drift-lock spec shows one missing, split into two components/leaves. Low risk, fully self-verified.

2. **Whether to also assert per-analysis `category` via the analyses API (Discretion).**
   - Recommendation: YES -- it is one extra `gh api` call and proves the upload landed as an analysis under `angular-typecheck-proof` independent of the alerts loop. Included in the skeleton (`assertAnalysisCategory`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `gh` CLI | assert script (`gh api`) | ✓ (GitHub-hosted runners) | ambient | none needed |
| Node.js | assert script + CLI | ✓ | 24 (job pin) | -- |
| `github/codeql-action/upload-sarif` | SARIF upload | ✓ (SHA-pinned, reused) | v4.37.1 | -- |
| Built dist CLI | SARIF generation | ✓ after `nx build angular-typechecker` | -- | -- |
| `@angular/compiler-cli` (for the fixture's template check) | fixture diagnostics | ✓ (repo devDep/peer resolved by `npm ci`) | 22.0.4 | -- |

**Missing dependencies with no fallback:** none. **Missing with fallback:** none. All ambient on the runner or already pinned/installed. (Local drift-lock spec runs under the existing `integration` target -- no new tooling.)

## Validation Architecture

> nyquist_validation is `true` in `.planning/config.json` -- this section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vitest.config.mts` (unit/`test`); `vitest.integration.config.mts` (`integration` target) |
| Quick run command | `npx nx run-many -t test` |
| Full suite command | `npx nx run-many -t test && npx nx run-many -t integration` |

**KEY:** `nx test` EXCLUDES `*.integration.spec.ts`; the integration tier runs under the separate `integration` target [VERIFIED: STATE.md Phase 33-02 note; `ci.yml` L135/L139]. The local drift-lock spec is an INTEGRATION spec (real cold compiler over the fixture), so it runs under `nx integration`, not `nx test`.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROOF-01 | Fixture emits exactly one diagnostic per family; SARIF carries the 4 (tag, severity) tuples | integration (local drift-lock) | `npx nx integration angular-typechecker` (the new/extended `machine-reporters-sarif.integration.spec.ts` block) | ❌ Wave 0 (extend existing spec) |
| PROOF-01 | The pure alert-matching logic (set-membership over a mock alerts payload) | unit | `npx nx test` (a small `assert-code-scanning` matcher unit test) | ❌ Wave 0 (optional but recommended) |
| PROOF-01 | The fixture is outside the Nx graph (no `project.json`) | manual/structural | `nx show projects` excludes it; visual confirm no `project.json` under `tools/sarif-proof-fixture/` | n/a (structural) |
| PROOF-01/02 | SARIF -> Code Scanning ingestion; alerts land with category/tag/severity; RED on any miss | **real-CI-only** | the `code-scanning-proof` job on a PR (`assert-code-scanning.mjs`) | ❌ Wave 0 (the job + script ARE the deliverable) |
| PROOF-02 | Assert exits non-zero on missing tuple / timeout | unit + real-CI | matcher unit test (negative case) + the job going red when a family is removed | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx nx run-many -t test` (fast unit tier) + `npx nx integration angular-typechecker` when the drift-lock spec changes.
- **Per wave merge:** `npx nx run-many -t test && npx nx run-many -t integration` + `npx nx format:check` + `npx nx run-many -t lint` + `npx fallow audit --format human --base origin/main` (catch Pitfalls 1-2 BEFORE the PR).
- **Phase gate:** the `code-scanning-proof` job GREEN on a real PR against `main` -- this is the only place the SARIF->ingestion assertion is exercised.

### The Nyquist point (explicit, load-bearing)
**The phase's PRIMARY behavior -- "the SARIF contract lands in GitHub Code Scanning" -- is provable ONLY in real CI, on a `pull_request`.** Local gates (schema validation, the drift-lock spec, actionlint, act-compat) can prove the SARIF is well-formed and carries the right tags, but they CANNOT prove GitHub ingested it and surfaced the alerts. This is the repo's standing SARIF-dogfood lesson: "SARIF upload correctness only provable in REAL CI (local gates all pass while GitHub still rejects)" [CITED: auto-memory `ci-sarif-code-scanning-dogfood`; STATE.md Phase 34-01]. The drift-lock spec is the fast local tripwire (does the fixture still emit the 4 tuples?); the CI job is the authoritative gate (did they land?). Do NOT treat a green local suite as proof the phase works.

### Wave 0 Gaps
- [ ] `tools/sarif-proof-fixture/**` -- the isolated fixture (tsconfig solution + leaf + 3 sources), no `project.json`.
- [ ] `tools/ci/assert-code-scanning.mjs` -- the `gh api` poll + set-membership assert.
- [ ] `.github/workflows/ci.yml` -- the `code-scanning-proof` job.
- [ ] `machine-reporters-sarif.integration.spec.ts` (extend) OR a new sibling -- the local drift-lock (RECOMMENDED).
- [ ] `assert-code-scanning` matcher unit test (optional, RECOMMENDED) -- proves the pure tuple-matching logic (incl. the negative/RED case) without hitting GitHub.
- [ ] `.fallowrc.jsonc` -- `overrides` scoping off `unused-files`/`unrendered-components`/`unused-component-inputs`/`unresolved-imports` for `tools/sarif-proof-fixture/**` (Pitfall 1).
- [ ] `.prettierignore` -- add the fixture `.html` if its reflow is diagnostic-sensitive (Pitfall 2).

## Security Domain

> `security_enforcement` is not `false` in config (absent = enabled) -- section REQUIRED. The new surface is a CI job with `security-events: write` and REST reads; the threat model is identical to the existing `code-scanning` job and must be preserved verbatim.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 CI/CD & Supply Chain | yes | SHA-pin the reused `upload-sarif` (full 40-char + `# vX.Y.Z`); no NEW action (prefer `gh api`); `persist-credentials: false`; Dependabot keeps the pin fresh |
| V5 Input Validation | yes | PR number is a GitHub-controlled integer passed via `env` (never shell-interpolated); the fixture is trusted repo content, not attacker input |
| V4 Access Control (least privilege) | yes | `security-events: write` granted at JOB level only; top-level stays `contents: read`; no other write scope |
| V2 Authentication | yes (token) | `gh api` authenticates via the ephemeral workflow `GITHUB_TOKEN` (`GH_TOKEN` env); no long-lived secret |

### Known Threat Patterns for {GitHub Actions CI + Code Scanning}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious action tag repoint (tj-actions class) | Tampering | Full-SHA pin the reused `upload-sarif`; add NO new marketplace action (D-02c) |
| PR-metadata command injection | Tampering / Elevation | PR number via `env:` value, never interpolated into a `run:` shell string (matches the `e2e` job's `PROJECT` pattern) [VERIFIED: `ci.yml` L212-219] |
| Over-broad token scope | Elevation of Privilege | Job-level `security-events: write` only; `contents: read` restated; no publish scope |
| Credential persistence / leak | Information Disclosure | `persist-credentials: false` on checkout |
| Fork PR with read-only token uploading | Denial of Service (false red) | Gate upload + assert on `head.repo.fork == false` (mirror dogfood L601/L610); job stays green on forks |
| Fixture errors leaking to `main` alerts view | Information Disclosure (noise) | `pull_request`-only job + `refs/pull/<n>/merge` scoping (SC4) |

**No new secret, no new action, no new write scope beyond `security-events: write`.** The proof is a read/upload-only reporting job on the SAFE `pull_request` trigger.

## Sources

### Primary (HIGH confidence)
- Real source at HEAD: `packages/angular-typechecker/src/core/diagnostic-family.ts` (`familyOf`), `diagnostic-codes.ts` (90001/90002, `synthesizeFilelessError`), `sarif-report.ts` (`toSarifLevel`, tags/level/help via `.rule`, `toolDriverName: 'angular-typechecker'`), `run-typecheck.ts` (`handleSolutionWalk`/`handleMultiTsConfig`/`finalize` -- the ATC-family trace), `walk-references.ts` (90002 synthesis on a missing reference), `cli/bin.ts` + `cli/parse-args.ts` (`-c` repeatable, `--format sarif`).
- `packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts` -- proves all four family tags/levels over `layout-b-host` (TS2322 + NG8002), `extended-content-projection` (NG8011 warning), `solution-style-all-missing` (ATC90002), `global-diagnostics` (file-less TS2318).
- Fixtures: `fixtures/layout-b-host/tsconfig.json`, `fixtures/solution-style-all-missing/tsconfig.json`, `fixtures/extended-content-projection/{tsconfig.app.json,child.component.ts,child.component.html}` -- the exact shapes to model the proof fixture on.
- `.github/workflows/ci.yml` (`code-scanning` job L539-613, `changes` path-gate, `discover` `set -e` idiom, the `ci` aggregate `needs[]`, the fork gate, SHA-pinned `upload-sarif`) -- the invariants the proof job mirrors.
- `tools/ci/merge-sarif.mjs`, `tools/ci/list-typecheck-projects.mjs` -- the pure-`node` `tools/ci/*.mjs` precedent for `assert-code-scanning.mjs`.
- `.fallowrc.jsonc` + `.prettierignore` -- the two gate landmines (fallow `tools/**` scope; Prettier PR-changed-file check).
- docs.github.com REST "Code scanning" -- verified field names: alerts `rule.tags`/`rule.severity`(none/note/warning/error)/`security_severity_level`/`most_recent_instance.category`, params `ref`/`tool_name`/`state`; analyses `category`/`sarif_id`/`ref`; sarifs `processing_status`(pending/complete/failed)/`analyses_url`/`errors`.
- `github/codeql-action@v4.37.1 upload-sarif/action.yml` -- verified outputs `sarif-id`/`sarif-ids`; inputs `sarif_file`/`category`/`wait-for-processing`.
- `.planning/research/v0.2.4-enhanced-sarif-reporting/{ARCHITECTURE.md §3, PITFALLS.md P5/P6, SUMMARY.md #2/#4}` -- the milestone blueprint (HIGH confidence).

### Secondary (MEDIUM confidence)
- Auto-memory `code-scanning-sarif-empirical-behavior` + `ci-sarif-code-scanning-dogfood` -- spike PR #53 live behavior (tags/severity/category/help render; PR-ref alerts via `refs/pull/<n>/merge`; multi-run-same-category rejection; real-CI-only correctness).
- `.planning/STATE.md` (Phases 33/34) -- the shipped SARIF contract this proof verifies.

### Tertiary (LOW confidence)
- None load-bearing. The exact extended NG8xxx code + poll bounds are Discretion (Assumptions A1/A3), self-verified by the proof going red.

## Metadata

**Confidence breakdown:**
- Fixture design / ATC family (D-01b resolved): HIGH -- traced through `run-typecheck.ts`/`walk-references.ts` AND proven by two committed fixtures; single-invocation solution+missing-ref emits all four families in one run.
- Proof job wiring: HIGH -- mirrors the existing `code-scanning` job verbatim; only the category, the PR-only gate, and the assert step are new.
- Assert script + REST fields: HIGH -- field names/enums verified against docs.github.com; `sarif-id` output confirmed.
- Gate landmines (fallow/Prettier): HIGH -- read `.fallowrc.jsonc`/`.prettierignore` directly; `tools/**` is not scoped like `fixtures/**`.
- Exact extended code + poll bounds: MEDIUM (Discretion) -- self-verified, RED-on-wrong.

**Research date:** 2026-07-21
**Valid until:** ~2026-08-20 (30 days; stable -- reporter contract is frozen this phase, GitHub REST code-scanning surface is stable). Re-verify the `upload-sarif` SHA pin and the GitHub REST fields if either changes upstream.
