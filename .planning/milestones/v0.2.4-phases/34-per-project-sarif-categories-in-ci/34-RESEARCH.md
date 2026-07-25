# Phase 34: Per-project SARIF categories in CI - Research

**Researched:** 2026-07-21
**Domain:** CI-side SARIF assembly + Nx workspace project discovery (GitHub Code Scanning `upload-sarif`)
**Confidence:** HIGH (every claim verified against the real source/config at HEAD; the multi-run + per-run-category behavior is proven live via the shipped fallow step in the same `ci.yml` and closed spike PR #53)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 (discovery script):** NEW pure-fs `tools/ci/list-typecheck-projects.mjs` scans `apps/*/project.json` + `libs/*/project.json`, keeps targets whose `executor === 'angular-typechecker:typecheck'`, emits JSON `[{ name, tsConfig[] }]` (`tsConfig` normalized to an array from `options.tsConfig`). Mirrors `tools/ci/list-e2e-projects.mjs` exactly (lean `node:fs`/`path`/`url`, no `npm ci`, no Nx graph). Yields the four consumers today.

**D-01a (over-match trap):** discovery MUST filter by EXECUTOR id, never `nx show projects --with-target typecheck`. Root-scoping the scan to `apps/`/`libs/` excludes the e2e fixture `project.json` files (which declare the executor but are not workspace-graph projects).

**Trade-off (research recommended graph-based; we chose fs):** pure-fs matches the repo LEAN-fs precedent and stays execable inside the drift guard; the root-agnostic authority research wanted is delegated to the guard's independent side (D-04).

**D-02 (merge assembly):** NEW dedicated `tools/ci/merge-sarif.mjs` (NOT an inline `node -e`). Reads the N per-project single-run SARIF files, stamps each `run.automationDetails.id = angular-typecheck/<project>`, writes ONE merged file with N `runs[]`. SKIPS empty/0-byte inputs (per-project analogue of the existing `[ -s file ]` produced-guard).

**D-02a (category id -- preserve verbatim):** the per-run id prefix is the requirement's literal `angular-typecheck/<project>` (`angular-typecheck`, NOT `angular-typechecker`). Supersedes the old single-run `category: angular-typechecker`.

**D-03 (per-project CLI invocation):** generate each per-project single-run SARIF by running the SHIPPED standalone CLI from dist -- `node dist/packages/angular-typechecker/src/cli/bin.js -c <tsConfig...> --format sarif > <project>.sarif` -- once per discovered project, run from the repo ROOT (repo-relative `artifactLocation` URIs). `-c` is repeatable for a multi-leaf `tsConfig` array. Reuse `|| true` + `[ -s file ]` PER project. NOT `nx run <project>:typecheck` (byte-pure stdout vs framed).

**D-04 (drift guard):** NEW in-plugin Vitest spec (regression-guard style, `cache: false`), e.g. `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts`. Execs `node tools/ci/list-typecheck-projects.mjs` and asserts its project-NAME set equals an INDEPENDENT, ROOT-AGNOSTIC enumeration of `angular-typechecker:typecheck`-executor projects (scan every workspace `project.json`, subtract `e2e/*/fixtures/`). A consumer added under a root the fs script misses trips the guard LOUD. Mirrors GUARD-01b / `ci-e2e-coverage-guard.spec.ts`.

**D-05 (CI job rewiring):** in `ci.yml` `code-scanning` job, REPLACE the single hardcoded `bin.js -c apps/ng-spike-app/tsconfig.app.json ... category: angular-typechecker` generate+upload with: discover -> loop `bin.js` per project -> `merge-sarif.mjs` -> ONE `upload-sarif` with NO `category` input. Leave the fallow SARIF steps UNTOUCHED. Preserve every invariant verbatim (fork-PR skip, job-scoped `security-events: write`, `fetch-depth: 0`, SHA-pinned `upload-sarif`, path-gated `if:`, run-from-repo-root). Job STAYS OUT of the required `ci` aggregate (GATE-01 is Phase 36).

**D-06 (no release / additive-only):** published package byte-unchanged -- no reporter/API/schema edit, no new dependency, no version bump. All new code under `tools/ci/` + one test-only plugin spec.

### Claude's Discretion

- Whether the discovery JSON carries `tsConfig[]` or the CI loop re-reads it from `project.json` (research suggests emitting `{ name, tsConfig[] }`).
- Whether `merge-sarif.mjs` takes an explicit file list or globs a directory of `*.sarif`.
- Exact guard spec filename + whether it sits beside `scoped-name-guard.spec.ts`; exact wiring of the `code-scanning` job's discover/loop/merge shell steps (set-e loud-fail on a failed discovery substitution, mirroring the `discover` job's separate-assignment pattern).
- Verify `ng-spike-app`'s discovered `options.tsConfig` matches the currently-hardcoded `apps/ng-spike-app/tsconfig.app.json` so coverage is not silently reduced.

### Deferred Ideas (OUT OF SCOPE)

- Automated `gh api` Code Scanning proof + isolated one-per-family fixture -- Phase 35 (PROOF-01/02).
- Promote `code-scanning` to the required `ci` aggregate + un-path-gate it + the "Require code scanning results" ruleset + Scanned-files docs -- Phase 36 (GATE/DOC).
- Migrate the merged multi-run file to a per-project CI matrix -- MULTI-FUT-01 (unneeded at 4 projects, far below the 20-runs/file cap).
- Any reporter-side `--category`/`automationDetails.id` CLI option -- explicitly rejected (would make MULTI release-bearing).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MULTI-01 | CI SARIF upload reports one run per executor-using project, each landing as its own Code Scanning analysis under `angular-typecheck/<project>` (merged one file, single `upload-sarif`, no `category`). | Merge shape verified against the shipped SARIF reporter top-level object + the working fallow multi-run step in the same `ci.yml` + spike PR #53 (see Architecture Patterns 2, 3; Code Examples). Plain-JSON merge is sufficient -- NO dependency (Don't Hand-Roll). |
| MULTI-02 | Reported project set auto-discovered by filtering the `angular-typechecker:typecheck` executor (not `--with-target` over-match), with a guard so the set cannot silently drift. | Discovery + drift-guard mechanics verified against the four consumer `project.json` files, the over-match set, and the existing `list-e2e-projects.mjs` + `ci-e2e-coverage-guard.spec.ts` precedents. THE key finding (Pitfall 1): the root project + the guard's independent enumeration. |
</phase_requirements>

## Summary

This is a pure CI-wiring phase. The published package does not change. The work is three new small assets -- a discovery script, a merge script, and a drift-guard spec -- plus a rewrite of the `code-scanning` job's angular-typechecker generate+upload steps. The milestone research (`ARCHITECTURE.md` section 2, `PITFALLS.md` P5/P8, `SUMMARY.md` finding #2) already covers the domain; this document verifies it against the real files and extends it with the exact wiring the planner needs.

The mechanics are de-risked by an existing working example in the SAME workflow file: the fallow SARIF step already reads a multi-run file, stamps `run.automationDetails.id` per run with a plain inline `node -e`, and uploads it with NO `category` input -- exactly the pattern MULTI-01 generalizes. Spike PR #53 proved live that per-run `automationDetails.id` categories land as distinct Code Scanning analyses and that a single `category` across multiple runs is rejected. So no external SARIF/upload contract needs re-discovery; the primary sources are all in-repo and stronger than web docs.

**Primary recommendation:** Merge is plain `JSON.parse`/`stringify` over `node:fs` (no `node-sarif-builder`, no dependency). Discovery is a `list-e2e-projects.mjs` clone scoped to `apps/`+`libs/`. The single load-bearing subtlety -- and the one thing that will fail the phase if missed -- is that the workspace-ROOT `project.json` (`@angular-typechecker/source`) declares a REAL `angular-typechecker:typecheck` target, so the drift guard's "root-agnostic independent enumeration" must exclude BOTH the e2e fixtures AND the workspace-root project, or it will report 5 vs the discovery script's 4 and fail RED on day one (see Pitfall 1).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Discover executor-using projects | CI / build tooling (`tools/ci/*.mjs`) | -- | Pure fs read of workspace config; no runtime, no published-package surface (D-01/D-06). |
| Run the type-check per project | Published CLI adapter (dist `bin.js`), invoked BY CI | -- | The shipped standalone CLI already emits byte-pure SARIF to stdout; CI only loops it (D-03). No adapter change. |
| Merge N single-run files -> one multi-run file | CI / build tooling (`tools/ci/merge-sarif.mjs`) | -- | Assembly is CI-side so the reporter stays single-run and dependency-free -- the discipline that keeps MULTI a no-release change (D-02/D-06). |
| Upload + per-analysis categorization | GitHub Actions (`github/codeql-action/upload-sarif`) | SARIF `run.automationDetails.id` | The per-run id, not the action's `category` input, drives the per-analysis category (verified: shipped fallow step + spike PR #53). |
| Anti-drift enforcement | In-plugin Vitest spec (rides the `test` target) | -- | Set-equality guard, the repo's established "cannot silently drift" pattern (GUARD-01b) (D-04). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` / `node:path` / `node:url` | Node `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` (ambient runner node) | Discovery + merge scripts | `[VERIFIED: tools/ci/list-e2e-projects.mjs]` The existing discovery script uses exactly these builtins and runs on the runner's ambient node with no `setup-node`/`npm ci`. Zero dependency. |
| `node:child_process` (`spawnSync`) | (builtin) | Run the shipped `bin.js` per project from the merge script (recommended Design B) OR from a bash loop (Design A) | `[VERIFIED: packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts]` `execFileSync`/`execSync` are the repo's precedent for invoking a CLI from a spec/script. |
| `vitest` (via `@nx/vitest:test`) | 4.x (installed) | The drift-guard spec + the merge-shape unit spec | `[VERIFIED: packages/angular-typechecker/project.json]` The plugin's `test` + `integration` targets use `@nx/vitest:test`; guard specs ride `test`. |
| `github/codeql-action/upload-sarif` | pinned `@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1` | The single upload of the merged file | `[VERIFIED: .github/workflows/ci.yml:590,600]` Already used twice (angular-typechecker + fallow); reuse the SAME pin. NO new action. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node-sarif-builder` | 4.1.0 (a plugin `dependency`) | The REPORTER uses it to BUILD each per-project SARIF | Do NOT import it in `merge-sarif.mjs`. Merge is pure JSON concatenation; pulling `node-sarif-builder` into a CI script would add nothing and blur the "no new dependency" line. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain-JSON merge | `node-sarif-builder` re-serialization in the merge script | Pointless: the reporter already emitted valid SARIF; re-building it risks reshaping the payload and is more code. Reject. |
| Pure-fs discovery (`apps/*`+`libs/*`) | `nx show project <p> --json` executor filter (research's "authoritative" option) | Graph-based is root-agnostic but needs `npm ci` + graph spin and is not cleanly execable inside a spec. CONTEXT D-01 locks pure-fs; the guard's independent side (D-04) recovers the root-agnostic authority. |
| Fold loop+merge into one node script (Design B) | Bash loop over the JSON + pure file-reading merge (Design A, the literal D-02) | Design A parses JSON + builds repeatable `-c` args in bash, which CLAUDE.md explicitly flags as a footgun; Design B is injection-free and fully unit-testable. Both are valid; see Architecture Pattern 3. |

**Installation:** None. No package is added (D-06). All scripts use node builtins; the upload action is already pinned.

**Version verification:** N/A -- no new package. `node-sarif-builder@4.1.0` is already an installed plugin dependency and is deliberately NOT used by the CI scripts.

## Package Legitimacy Audit

> Not applicable. This phase installs NO external packages (D-06: no new dependency, published package byte-unchanged). The two new scripts (`list-typecheck-projects.mjs`, `merge-sarif.mjs`) import only Node builtins (`node:fs`, `node:path`, `node:url`, `node:child_process`); the drift-guard spec imports only `vitest` + `@workspace/test-util` (both already present). The single GitHub Action (`upload-sarif`) is already SHA-pinned in `ci.yml` and reused unchanged.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
                     (CI code-scanning job, path-gated, run from repo ROOT)
                                     |
  npm ci --> nx build angular-typechecker   (produces dist/.../cli/bin.js)
                                     |
                                     v
   [1] node tools/ci/list-typecheck-projects.mjs
        fs scan apps/*/project.json + libs/*/project.json
        keep targets where executor === 'angular-typechecker:typecheck'
        emit [{ name, tsConfig[] }]
                                     |
             +-----------------------+-----------------------+---------------+
             v                       v                       v               v
   [2] per project: node dist/.../cli/bin.js -c <tsConfig...> --format sarif
        exit 0/1 -> valid single-run SARIF on stdout   (|| true tolerates exit 1)
        exit 2   -> empty stdout                         (skip: the [ -s ] analogue)
             |                       |                       |               |
             +-----------------------+-----------+-----------+---------------+
                                                 v
   [3] node tools/ci/merge-sarif.mjs
        read the produced single-run files, SKIP empty/unparseable/0-run
        stamp run.automationDetails.id = 'angular-typecheck/<project>'
        write ONE file: { version, $schema, runs: [ run_A, run_B, ... ] }
        produced=true IFF the merged file has >= 1 run
                                                 v
   [4] github/codeql-action/upload-sarif  (SHA-pinned, NO category input)
        fork-PR skip gate + produced==true gate  (UNCHANGED from today)
        per-run automationDetails.id -> per-analysis category in Code Scanning
                                                 |
                                                 v
        Code Scanning: one analysis per project, id angular-typecheck/<project>

   [guard, separate, rides the `test` target]
   multi-typecheck-discovery-guard.spec.ts
     exec list-typecheck-projects.mjs  ==  independent root-agnostic enumeration
        (scan ALL project.json for the executor, MINUS e2e/ , MINUS root project.json)
     mismatch -> RED (silent drift caught)
```

### Recommended Project Structure
```
tools/ci/
  list-e2e-projects.mjs          # EXISTING precedent (unchanged)
  list-typecheck-projects.mjs    # NEW (D-01)
  merge-sarif.mjs                # NEW (D-02)
packages/angular-typechecker/src/
  ci-e2e-coverage-guard.spec.ts  # EXISTING precedent (unchanged)
  scoped-name-guard.spec.ts      # EXISTING precedent (unchanged)
  multi-typecheck-discovery-guard.spec.ts  # NEW (D-04) -- rides the `test` target
.github/workflows/ci.yml         # MOD: code-scanning job angular-typechecker steps only
```

### Pattern 1: Executor-filtered fs discovery (mirror `list-e2e-projects.mjs`)
**What:** enumerate `apps/*/project.json` + `libs/*/project.json`, keep targets whose `executor === 'angular-typechecker:typecheck'`, emit `[{ name, tsConfig[] }]`.
**When to use:** the discovery script (D-01).
**Verified facts driving the shape:**
- `[VERIFIED: apps/ng-spike-app/project.json:64-68]` `typecheck.options.tsConfig === "apps/ng-spike-app/tsconfig.app.json"` -- EXACTLY the currently-hardcoded value, so coverage is preserved (answers the D discretion item: no silent reduction).
- `[VERIFIED: libs/typecheck-consumer/project.json:8-13]` tsConfig `libs/typecheck-consumer/tsconfig.lib.json` (also `includeDeps: true` -- see Pitfall 5).
- `[VERIFIED: libs/typecheck-consumer-dep/project.json:8-12]` tsConfig `libs/typecheck-consumer-dep/tsconfig.lib.json`.
- `[VERIFIED: libs/typecheck-walk-consumer/project.json:8-12]` tsConfig `libs/typecheck-walk-consumer/tsconfig.json`.
- All four `options.tsConfig` are single STRINGS today -> normalize each to a 1-element array (`Array.isArray(x) ? x : [x]`). The executor schema was widened to `string | string[]` in v0.2.1, so the array-normalize is future-proof.
- Filter by the EXECUTOR field, not the target NAME (D-01a). Scan `Object.values(targets)` for `executor === 'angular-typechecker:typecheck'` (the target happens to be named `typecheck`, but name-matching over-matches -- see Pitfall 2).

### Pattern 2: Per-run `automationDetails.id` = per-analysis category (mirror the fallow step)
**What:** a single `upload-sarif` of a multi-run file with NO `category` input; each `run.automationDetails.id` becomes that run's Code Scanning category.
**When to use:** MULTI-01, replacing today's single-run `category: angular-typechecker`.
**Verified example (the exact pattern to generalize):**
```js
// Source: .github/workflows/ci.yml:583 (the SHIPPED fallow step)
node -e 'const fs=require("fs");const f="fallow.sarif";const j=JSON.parse(fs.readFileSync(f,"utf8"));(j.runs||[]).forEach(function(r,i){r.automationDetails={id:"fallow/"+i}});fs.writeFileSync(f,JSON.stringify(j))'
```
```yaml
# Source: .github/workflows/ci.yml:598-602 (the SHIPPED fallow upload -- NO category)
- name: Upload fallow SARIF
  if: ${{ (github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false) && steps.fallow-sarif.outputs.produced == 'true' }}
  uses: github/codeql-action/upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1
  with:
    sarif_file: fallow.sarif
```
`[VERIFIED: spike PR #53 + auto-memory ci-sarif-code-scanning-dogfood]` GitHub (2025-07-21+) rejects multiple runs sharing one category; distinct per-run ids avoid it and land as distinct analyses. The angular-typechecker upload MUST drop its `category: angular-typechecker` input (`ci.yml:593`) when it becomes multi-run.

### Pattern 3: The generate+merge wiring -- two viable designs
The top-level per-project SARIF shape is fixed and simple: `[VERIFIED: packages/angular-typechecker/src/core/sarif-report.ts:32,134,221-222]` the reporter emits ONE `SarifRunBuilder` per invocation (`new SarifRunBuilder()...`, `logBuilder.addRun(runBuilder)` once), and `node-sarif-builder` bakes `version: "2.1.0"` + `$schema` at the top level. So each per-project file is `{ version, $schema, runs: [ <one run> ] }`. A clean project still emits a valid run with empty `results[]` (the current single-run dogfood uploads ng-spike-app, which is clean -- proof the `[ -s ]` guard passes on a clean run).

**Design A (literal D-02: two pure scripts + a bash loop).** `list-typecheck-projects.mjs` -> JSON; a bash loop runs `bin.js` per project writing `sarif-parts/<name>.sarif` (each `|| true` + `[ -s ]`); `merge-sarif.mjs` globs `sarif-parts/*.sarif`, stamps id from basename, writes the merged file. Cost: the loop must parse the JSON and build repeatable `-c` args in bash -- CLAUDE.md explicitly warns this class of inline shell is a footgun.

**Design B (RECOMMENDED: discovery pure + merge does generate+merge).** `list-typecheck-projects.mjs` stays a pure discovery module/CLI (so the guard can exec it standalone). `merge-sarif.mjs` imports the discovery, `spawnSync('node', [distBinJs, '-c', leaf1, '-c', leaf2, '--format', 'sarif'], { cwd: repoRoot })` per project (this IS running the shipped CLI per D-03), captures stdout, skips empty/exit-2 stdout, stamps `angular-typecheck/<name>`, concatenates `runs[]`, writes the merged file. The job shell is then one command + the unchanged `[ -s ]` produced-guard + the unchanged fork-gated upload -- no bash-JSON, injection-free, fully unit-testable.
- This folds D-02 (merge) and D-03 (loop) into one script. D-05 makes "exact wiring of the discover/loop/merge shell steps" Claude's Discretion, so this is in scope. It still runs the SHIPPED `bin.js` from repo root, satisfying D-03's byte-pure-stdout + repo-relative-URI intent (`spawnSync` captures stdout; `cwd: process.cwd()` = repo root).
- The literal D-02 wording is "reads the N per-project single-run SARIF files"; Design B reads each project's SARIF from `bin.js` stdout instead of an intermediate file -- semantically identical. If the planner wants strict file-reading, pick Design A.

**Recommendation:** Design B. It is the lazy + robust option and it is what keeps the job shell free of the JSON-in-bash hazard CLAUDE.md warns against.

### Pattern 4: Drift guard -- set-equality vs a root-agnostic independent enumeration (mirror GUARD-01b)
**What:** an in-plugin Vitest spec asserts the discovery script's NAME set equals an independent enumeration; a divergence fails LOUD.
**When to use:** MULTI-02 SC3 (D-04).
**The independent enumeration MUST be:** scan every workspace `project.json` (reuse `collectProjectJsonPaths` + `IGNORED_DIRS` from `ci-e2e-coverage-guard.spec.ts`), keep those with a `targets.*.executor === 'angular-typechecker:typecheck'`, then SUBTRACT (a) any path under `e2e/` (fixtures are not workspace consumers) AND (b) the workspace-ROOT `project.json` (`@angular-typechecker/source`). See Pitfall 1 for why (b) is mandatory. It must parse `targets.*.executor` (NOT string-grep the file), so `nx.json`'s `targetDefaults` key and the generator schemas do not false-match (see Pitfall 3).

### Anti-Patterns to Avoid
- **`nx show projects --with-target typecheck`** to discover the set -- over-matches (Pitfall 2).
- **Leaving `category: angular-typechecker` on the multi-run upload** -- re-triggers the multi-run-same-category rejection (Pitfall 4).
- **A `category` input AND per-run ids** -- the `category` input overrides all runs to one value; use per-run ids only.
- **String-grepping `angular-typechecker:typecheck` for discovery or the guard** -- `nx.json`, `generators.json`, and both generator `schema.json` files contain the literal but are not consumers (Pitfall 3).
- **Importing `node-sarif-builder` in the merge script** -- unnecessary; merge is plain JSON.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SARIF envelope for the merged file | A hand-authored `version`/`$schema` block | Copy `version` + `$schema` verbatim from any input file's top level | The reporter already emitted a valid 2.1.0 envelope; reuse it, only replace `runs`. |
| Per-run categorization | A reporter-side `--category` CLI option | CI-side `run.automationDetails.id` stamp | A CLI option is a published-package change -> makes MULTI release-bearing (rejected, D-06). |
| Multi-run assembly | `node-sarif-builder` re-serialization | `JSON.parse` -> concat `runs[]` -> `JSON.stringify` | Fewer moving parts, no dependency, no risk of reshaping the payload. |
| Workspace project enumeration | A fresh directory walker in the guard | Reuse `collectProjectJsonPaths` + `IGNORED_DIRS` from `ci-e2e-coverage-guard.spec.ts` | The walker (skips `node_modules`/`dist`/`.nx`/`.planning`/etc.) already exists and is battle-tested. |
| Empty/failed-run skip | A new exit-code parser | The existing `[ -s file ]` produced-guard shape (or its node analogue `stdout.trim().length > 0`) | Already the sanctioned exit-2-safe skip in the same job. |

**Key insight:** every primitive this phase needs already exists in-repo (the fallow per-run-id stamp, the `[ -s ]` guard, the fs discovery script, the coverage-guard walker, the SHA-pinned upload action). The phase is assembly, not invention.

## Common Pitfalls

### Pitfall 1: The workspace-ROOT project uses the executor -> the drift guard fails RED on day one (HIGHEST RISK, corrects CONTEXT D-01a)
**What goes wrong:** CONTEXT D-01a states an executor-id filter "yields exactly the four workspace consumers" and lists `@angular-typechecker/source` among the projects a plain target-NAME match over-matches (implying the executor filter drops it). That is FACTUALLY WRONG. `[VERIFIED: project.json:14-18]` the workspace-ROOT `project.json` (name `@angular-typechecker/source`) declares a REAL `typecheck` target with `executor: "angular-typechecker:typecheck"` on `fixtures/tsconfig.clean.json`. So an executor-filtered enumeration over ALL `project.json` files yields FIVE workspace-graph projects, not four:
1. `@angular-typechecker/source` (root)
2. `ng-spike-app`
3. `typecheck-consumer`
4. `typecheck-consumer-dep`
5. `typecheck-walk-consumer`

The discovery script (D-01: `apps/*`+`libs/*` only) yields FOUR -- it excludes the root project by ROOT-SCOPING, not by the executor filter. So the drift guard's "root-agnostic independent enumeration" (D-04), if implemented literally as "scan every project.json, filter executor, subtract e2e fixtures", produces 5 and the discovery produces 4 -> the guard fails RED immediately, on a false positive, not real drift.
**Why it happens:** the root project dogfoods the plugin against the CLEAN fixtures; it genuinely uses the executor but is not a "consumer" in the MULTI sense (it always type-checks a clean tree -> always 0 diagnostics -> an empty per-project analysis; and its scoped name `@angular-typechecker/source` contains `@` and `/`, which is filename-hostile and makes an ugly `angular-typecheck/@angular-typechecker/source` category).
**How to avoid:** the guard's independent enumeration MUST subtract BOTH the `e2e/` paths AND the workspace-root `project.json`. Recommended predicate: keep a project.json ONLY if its relative path is NOT `project.json` (i.e. not at the workspace root) AND does not start with `e2e/`. Then it yields exactly the 4, matches the discovery script, AND stays root-agnostic for any NEW consumer under `apps/`, `libs/`, `packages/`, `tools/`, or a brand-new root (which the guard catches loud if the `apps/`+`libs/` discovery misses it).
**Warning sign:** the guard reports `["@angular-typechecker/source", ...5 names]` on the `expected` side vs 4 on the `actual` side; or someone "fixes" the RED by also scoping the guard's independent side to `apps/`+`libs/` -- DO NOT accept that fix, it silently destroys the root-agnostic drift protection D-04 exists for.
**Decision for the planner (recommend confirm):** exclude the root project from BOTH sides (keep the 4-consumer scope the ROADMAP/CONTEXT lock). The alternative -- include the root as a 5th analysis -- adds an always-empty analysis with a scoped, slash-bearing category id and a filename-sanitization problem; not recommended.

### Pitfall 2: `--with-target typecheck` / target-NAME matching over-matches
**What goes wrong:** a target-name match pulls in projects whose `typecheck` target is NOT the plugin executor.
**Verified over-match set (all have a `typecheck` target that is NOT `angular-typechecker:typecheck`):**
- `[VERIFIED: packages/angular-typechecker/project.json:73-101]` the plugin itself -- `typecheck` via `nx:run-commands` (three `tsc --noEmit` commands).
- `[VERIFIED: libs/test-util/project.json:20-34]` `test-util` -- `typecheck` via `nx:run-commands` (`tsc --noEmit`).
- The e2e-tier projects (GUARD-01c requires every `e2e/*` project define a `typecheck` target; none use the plugin executor -- confirmed absent from the executor-id grep).
**How to avoid:** filter by `executor === 'angular-typechecker:typecheck'` (D-01a). The executor filter correctly EXCLUDES all three classes above.

### Pitfall 3: `nx.json` + generator schemas contain the executor string but are not consumers
**What goes wrong:** a string-grep for `angular-typechecker:typecheck` matches non-consumer files.
**Verified false-match set (from `git grep -l "angular-typechecker:typecheck" -- '*.json'`):**
- `[VERIFIED: nx.json:48]` `targetDefaults["angular-typechecker:typecheck"]` is a targetDefaults KEY, not a `targets.*.executor` field.
- `[VERIFIED]` `packages/angular-typechecker/generators.json`, `.../generators/configuration/schema.json`, `.../generators/init/schema.json` -- the executor id appears as generator/schema data.
- `[VERIFIED]` `fixtures/builder-context/angular.json` -- uses `angular-typechecker:typecheck` as an Angular CLI BUILDER id in an `architect` block (an `angular.json`, NOT a `project.json`).
**How to avoid:** discovery + guard parse `project.json` files and inspect the `targets.*.executor` FIELD (mirror `scoped-name-guard.spec.ts` `executorIdReferences`), never string-grep. Scan `project.json` only (not `angular.json`, not `nx.json`).

### Pitfall 4: Multi-run + `category` input rejection
**What goes wrong:** `[VERIFIED: PITFALLS.md P5 + spike PR #53]` GitHub (2025-07-21+) rejects a delivery with multiple runs sharing one category (`"...does not support uploading multiple SARIF runs with the same category."`). Leaving `category: angular-typechecker` (`ci.yml:593`) on the now-multi-run file re-triggers it.
**How to avoid:** drop the `category` input; per-run `automationDetails.id` becomes the category (Pattern 2).
**Warning sign:** upload fails with the server error. Reminder: catchable only in REAL CI -- local schema-validation, actionlint, and act-compat all pass while GitHub still rejects. Verify via `gh api .../code-scanning/analyses?tool_name=angular-typechecker&ref=refs/pull/<n>/merge` on the PR (that verification is Phase 35's job; here just wire it correctly).

### Pitfall 5: Per-target options (e.g. `includeDeps: true`) are NOT threaded into the CI SARIF loop
**What goes wrong:** `[VERIFIED: libs/typecheck-consumer/project.json:12]` `typecheck-consumer` declares `includeDeps: true`. The discovery emits only `{ name, tsConfig[] }` (D-01), so the per-project `bin.js` loop runs with DEFAULT options -- the SARIF will reflect `includeDeps=false`, not the target's declared behavior.
**Is this a problem?** No, for MULTI scope: this matches the current hardcoded single-run step (which passes only `-c <tsconfig> --format sarif`), MULTI-01/02 are about categories + discovery not option-fidelity, and `includeDeps:true` is a fixture-testing setting for the walk engine, not a "surface node_modules diagnostics in Code Scanning" request. **Recommendation:** do NOT thread per-target options; keep the loop to `-c <tsConfig...> --format sarif`. Flag it in the plan as a known, deliberate scoping so a reviewer does not read it as a coverage bug. (If option-fidelity is ever wanted, it is a separate follow-up, not MULTI.)

### Pitfall 6: Merged file with zero runs must skip the upload
**What goes wrong:** if every discovered project exits 2 (all infra failures), a naive merge writes `{"runs":[]}` -- valid bytes, so a `[ -s ]` check passes, and `upload-sarif` receives an empty-runs file.
**How to avoid:** `merge-sarif.mjs` writes the merged file only when it collected >= 1 run; on 0 runs it writes NOTHING (empty output / no file) so the existing `[ -s ]` produced-guard sets `produced=false` and the upload skips -- the exact exit-2-safe behavior of today's single-run step, preserved at the aggregate level.

## Code Examples

Sketches (illustrative; the planner/executor will finalize). ASCII only.

### `tools/ci/list-typecheck-projects.mjs` (D-01) -- mirror `list-e2e-projects.mjs`
```js
// Enumerate workspace projects whose `typecheck` executor is angular-typechecker:typecheck.
// Pure node:fs -- no nx, no npm ci -- so it is fast and execable from the drift guard.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXECUTOR = 'angular-typechecker:typecheck';

export function listTypecheckProjects(workspaceRoot) {
  const out = [];

  for (const root of ['apps', 'libs']) {
    const rootDir = join(workspaceRoot, root);

    if (!existsSync(rootDir)) {
      continue;
    }

    for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const pj = join(rootDir, entry.name, 'project.json');

      if (!existsSync(pj)) {
        continue;
      }

      const json = JSON.parse(readFileSync(pj, 'utf8'));
      const target = Object.values(json.targets ?? {}).find(
        (t) => t?.executor === EXECUTOR,
      );

      if (json.name && target) {
        const raw = target.options?.tsConfig;
        const tsConfig = Array.isArray(raw) ? raw : raw ? [raw] : [];
        out.push({ name: json.name, tsConfig });
      }
    }
  }

  // Fail loud on empty discovery (mirrors list-e2e-projects.mjs): an empty set
  // would silently upload nothing while the job stays green.
  if (out.length === 0) {
    throw new Error(
      'list-typecheck-projects: no angular-typechecker:typecheck projects found under apps/ or libs/',
    );
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(listTypecheckProjects(process.cwd())));
}
```

### `tools/ci/merge-sarif.mjs` (D-02/D-03, Design B: generate + merge)
```js
// Run the SHIPPED CLI once per discovered project (from repo root), skip empty
// output (exit-2 analogue of [ -s file ]), stamp per-run id, merge to one file.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { listTypecheckProjects } from './list-typecheck-projects.mjs';

const BIN = 'dist/packages/angular-typechecker/src/cli/bin.js';
const root = process.cwd(); // repo root -> repo-relative artifactLocation URIs
const runs = [];
let envelope; // { version, $schema } copied from the first valid file

for (const { name, tsConfig } of listTypecheckProjects(root)) {
  const args = [BIN];

  for (const leaf of tsConfig) {
    args.push('-c', leaf);
  }

  args.push('--format', 'sarif');

  // stdout = byte-pure SARIF; stderr = advisory noise. Exit 0/1 still writes the
  // payload; exit 2 writes nothing. Do NOT throw on a non-zero exit (|| true).
  const res = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const stdout = (res.stdout ?? '').trim();

  if (stdout.length === 0) {
    continue; // exit-2 / empty -> skip (the [ -s file ] analogue)
  }

  let doc;

  try {
    doc = JSON.parse(stdout);
  } catch {
    continue; // unparseable -> skip
  }

  const run = (doc.runs ?? [])[0];

  if (!run) {
    continue;
  }

  run.automationDetails = { id: `angular-typecheck/${name}` }; // D-02a literal prefix
  runs.push(run);
  envelope ??= { version: doc.version, $schema: doc.$schema };
}

// 0 runs -> write nothing so the job's [ -s ] produced-guard skips the upload.
if (runs.length > 0) {
  writeFileSync('angular-typechecker.sarif', JSON.stringify({ ...envelope, runs }));
}
```

### `code-scanning` job rewiring (D-05) -- Design B shell
```yaml
# REPLACES the single hardcoded atc-sarif step (ci.yml:564-567) and drops
# `category: angular-typechecker` from the upload (ci.yml:593). Everything else in
# the step (fork-PR gate, produced gate, SHA pin) is preserved verbatim.
- id: atc-sarif
  run: |
    node tools/ci/merge-sarif.mjs
    if [ -s angular-typechecker.sarif ]; then echo "produced=true" >> "$GITHUB_OUTPUT"; else echo "produced=false" >> "$GITHUB_OUTPUT"; fi
- name: Upload angular-typechecker SARIF
  if: ${{ (github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false) && steps.atc-sarif.outputs.produced == 'true' }}
  uses: github/codeql-action/upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1
  with:
    sarif_file: angular-typechecker.sarif
    # NO category input -- per-run automationDetails.id (angular-typecheck/<project>)
    # is the per-analysis category; a single category would collide the runs.
```
Note: `npm ci` + `nx build angular-typechecker` (ci.yml:555-558) stay as-is (Design B's `merge-sarif.mjs` needs the built `bin.js`). If Design A is chosen instead, the discovery + bash loop + a file-reading `merge-sarif.mjs` replace the single `merge-sarif.mjs` call, and the `set -e` separate-assignment idiom (`projects=$(node ...)`, then use `$projects`) from the `discover` job must be used so a failed discovery fails LOUD.

### Drift-guard independent enumeration (D-04) -- the root+e2e exclusion
```ts
// Independent, root-agnostic enumeration. collectProjectJsonPaths + IGNORED_DIRS
// are reused from ci-e2e-coverage-guard.spec.ts. Parse targets.*.executor (never
// string-grep). Subtract e2e/ AND the workspace-root project.json (Pitfall 1).
function independentTypecheckProjects(root: string): string[] {
  const names: string[] = [];

  for (const path of collectProjectJsonPaths(root)) {
    const rel = relative(root, path).split(sep).join('/');

    if (rel === 'project.json' || rel.startsWith('e2e/')) {
      continue; // root dogfood + e2e fixtures are not MULTI consumers
    }

    const json = JSON.parse(readFileSync(path, 'utf8')) as {
      name?: string;
      targets?: Record<string, { executor?: string }>;
    };
    const uses = Object.values(json.targets ?? {}).some(
      (t) => t?.executor === 'angular-typechecker:typecheck',
    );

    if (json.name && uses) {
      names.push(json.name);
    }
  }

  return names.sort();
}

// assertion: the discovery script's names EQUAL the independent enumeration.
const discovered = (JSON.parse(execSync('node tools/ci/list-typecheck-projects.mjs',
  { cwd: workspaceRoot, encoding: 'utf8' })) as { name: string }[]).map((p) => p.name).sort();
expect(discovered).toEqual(independentTypecheckProjects(workspaceRoot));
// both sides are exactly: ng-spike-app, typecheck-consumer, typecheck-consumer-dep, typecheck-walk-consumer
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single hardcoded `bin.js -c apps/ng-spike-app/tsconfig.app.json` + `category: angular-typechecker` | Discovered per-project loop -> merged multi-run file -> per-run `automationDetails.id`, no `category` | This phase (MULTI) | ng-spike-app plus the 3 lib consumers each become a distinct Code Scanning analysis; the set is auto-discovered + drift-guarded. |
| One merged multi-run file | Per-project CI matrix (one file per job) | MULTI-FUT-01 (deferred) | Only relevant past ~20 self-hosting projects (20-runs/file cap). At 4 projects the merged file is correct; do NOT build the matrix now. |

**Deprecated/outdated:** the `category: angular-typechecker` upload input for angular-typechecker is removed by this phase (it becomes multi-run; per-run ids replace it).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 4 consumers (not 5) are the intended reported set; the workspace-root `@angular-typechecker/source` project is deliberately excluded. | Pitfall 1 | If the maintainer actually wants the root clean-fixtures dogfood as a 5th analysis, discovery + guard both need the root INCLUDED (and a filename/category strategy for its scoped `@.../` name). Recommend confirming; the ROADMAP/CONTEXT wording ("the four workspace consumers") supports exclusion. |
| A2 | Per-target options (`includeDeps` etc.) are intentionally NOT threaded into the CI SARIF loop. | Pitfall 5 | If option-fidelity is required, `typecheck-consumer`'s node_modules diagnostics would be under-reported vs its Nx target. Deliberate per MULTI scope + parity with today's step; flag in the plan. |
| A3 | A clean project emits a valid single-run SARIF (run present, empty `results[]`), so all 4 clean consumers produce mergeable runs and steady-state uploads 4 analyses with 0 alerts each. | Pattern 3 | If a clean run emitted no file, clean projects would be skipped. Strongly supported (the current single-run dogfood uploads clean ng-spike-app), but only fully provable in real CI. |

## Open Questions (RESOLVED -- all three recommendations adopted in 34-01-PLAN.md)

1. **Include the workspace-root project as a 5th analysis, or exclude it?** (RESOLVED: EXCLUDE)
   - What we know: `@angular-typechecker/source` genuinely uses the executor (on clean fixtures); CONTEXT/ROADMAP lock "the four consumers."
   - What's unclear: whether an always-empty root analysis is wanted.
   - Recommendation: EXCLUDE (A1). Keeps the 4-consumer scope, avoids a scoped/slash-bearing category and a filename-sanitization problem. Encode the exclusion in the guard (Pitfall 1) and note it in the plan so a future reviewer understands the guard's root subtraction is intentional, not a hack.

2. **Design A vs Design B for the generate+merge wiring?** (RESOLVED: Design B)
   - What we know: both produce identical output; D-05 makes the shell wiring Claude's Discretion.
   - Recommendation: Design B (fold loop+merge into `merge-sarif.mjs` via `spawnSync`) -- injection-free, unit-testable, no bash-JSON (CLAUDE.md footgun). Use Design A only if the plan insists `merge-sarif.mjs` strictly read pre-written files.

3. **`cache: false` dedicated target vs a plain spec riding `test` for the drift guard?** (RESOLVED: plain spec riding `test`)
   - What we know: `ci-e2e-coverage-guard.spec.ts` (the stated analogue) is a PLAIN spec on the cached `test` target and is correct in CI because CI runs cold (no cross-runner `.nx/cache` restore -- `unknown-local-cache`). `scoped-name-guard` uses a dedicated `cache: false` `nx:run-commands` target ONLY because it must run on docs-only PRs where `test` is path-gated off.
   - What's unclear: CONTEXT D-04 says "cache: false", but the discovery + `code-scanning` job are BOTH path-gated together, so the guard does not need to run on planning-only PRs.
   - Recommendation: a PLAIN spec beside `ci-e2e-coverage-guard.spec.ts`, riding `test` (matches the closest precedent; CI's cold cache makes it re-run on every code PR). If the planner wants the strict always-fresh guarantee, add it to `scoped-name-guard`'s `cache: false` glob or give it its own `cache: false` target -- but that is optional hardening, not required for MULTI-02.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node (ambient runner) | discovery + merge scripts | Yes | Node 24 (job pin) / `^22.22.3 \|\| ^24.15.0 \|\| ^26.0.0` engines | -- |
| Built `dist/.../cli/bin.js` | per-project SARIF generation (D-03) | Yes (built in-job) | shipped | `npx nx build angular-typechecker` already runs in the job (ci.yml:558) |
| `github/codeql-action/upload-sarif` | the single upload | Yes (SHA-pinned) | `v4.37.1` @ `7188fc36...` | -- reuse the existing pin; NO new action |
| Vitest / `@nx/vitest:test` | drift guard + merge-shape spec | Yes | 4.x | -- |
| `gh` CLI | NOT needed this phase | -- | -- | `gh`-based Code Scanning assertion is Phase 35 (PROOF), not MULTI |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none. This phase adds no tool.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vitest.config.mts` (unit `test` target) |
| Quick run command | `npx nx test angular-typechecker` |
| Full suite command | `npx nx run-many -t test` (then `npx nx run-many -t typecheck` for spec type-checking -- see note) |
| Phase gate | full `test` + `typecheck` + `lint` + `format:check` green before verify |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MULTI-01 | Merge of N single-run files -> one file with N `runs[]`, each `automationDetails.id = angular-typecheck/<name>`; empty/0-run inputs skipped; envelope preserved | unit | `npx nx test angular-typechecker` | NO -- Wave 0 (new merge-shape spec) |
| MULTI-02 | Discovery script name set === independent root-agnostic enumeration (excludes e2e fixtures + root project) | unit (drift guard) | `npx nx test angular-typechecker` | NO -- Wave 0 (new drift-guard spec) |
| MULTI-02 | Discovery tolerates a stray dir / falsy name / missing apps or libs (robustness) | unit | `npx nx test angular-typechecker` | NO -- Wave 0 (optional, mirrors the B3 test in `ci-e2e-coverage-guard.spec.ts`) |
| MULTI-01 (end-to-end) | Merged file uploads as N distinct analyses `angular-typecheck/<project>` in Code Scanning | REAL CI only | manual/real-CI `gh api .../code-scanning/analyses?tool_name=angular-typechecker&ref=refs/pull/<n>/merge` | N/A -- not locally provable (see note) |

### Sampling Rate
- **Per task commit:** `npx nx test angular-typechecker` (the two new specs).
- **Per wave merge:** `npx nx run-many -t test` + `npx nx run-many -t typecheck`.
- **Phase gate:** full `test` + `typecheck` + `lint` (maxWarnings:0) + `format:check` green.

### Wave 0 Gaps
- [ ] `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts` -- the MULTI-02 drift guard (D-04). Covers discovery == independent enumeration.
- [ ] A merge-shape unit spec for `tools/ci/merge-sarif.mjs` -- covers MULTI-01 (write fake single-run SARIF parts to a temp dir / stub the CLI, assert merged `runs[]` count + per-run ids + empty-skip). Can live in the same guard spec file or a sibling; mirror the `execFileSync`/temp-root style of `ci-e2e-coverage-guard.spec.ts`'s B3 test.
- Framework install: NONE (Vitest present).

**Nyquist note (load-bearing):** the CI/tooling assets here are the sample points. The drift guard + merge-shape spec are the in-repo CI-authoritative tests (they fully cover discovery + merge logic). Full SARIF-upload correctness -- that the merged file is ACCEPTED and lands as N distinct analyses -- is NOT locally provable: local schema-validation, actionlint, and act-compat all pass while GitHub can still reject (the multi-run-same-category class, Pitfall 4). That end-to-end proof is a real-CI observation this phase wires correctly and Phase 35 (PROOF) automates. Do not claim local coverage of the upload contract.

## Security Domain

> `security_enforcement` is not set in `.planning/config.json` (absent = enabled). This phase is CI-workflow surface, so the threat model is the workflow's, not the application's.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | The new scripts read ONLY repo-local files (`project.json`) + the discovery's own output; they interpolate NO PR-controlled data into any command. `spawnSync` uses a fixed arg array (no shell). |
| V6 Cryptography | no | -- |
| V10 Malicious Code / Supply Chain | yes | No new dependency (D-06); no new Action (reuse the pinned `upload-sarif`). Preserves the `ci.yml` SHA-pin + `persist-credentials: false` posture. |
| V1 Access Control (CI tokens) | yes | Job keeps `security-events: write` at JOB level only (replaces the top-level `contents: read`); fork PRs get a read-only token so the upload steps stay fork-gated. |

### Known Threat Patterns for the code-scanning job
| Pattern | STRIDE | Standard Mitigation (MUST preserve verbatim, D-05) |
|---------|--------|---------------------|
| Untrusted PR metadata injected into a run step | Tampering / EoP | No PR title/branch/author interpolated into any shell; discovery/merge read fixed repo files only; the fork check is an Actions-expression, not shell (matches the top-of-file `ci.yml` threat model). |
| Fork PR obtaining write via the upload | EoP | Fork-PR skip gate on the upload step (`...pull_request.head.repo.fork == false`) -- unchanged from today; the analysis still RUNS on a fork, only the upload skips. |
| Mutable-tag Action swap (tj-actions class) | Tampering | `upload-sarif` stays pinned to the existing 40-char SHA `7188fc36...`; NO new Action is added. |
| Credential persistence via `.git/config` | Info Disclosure | `persist-credentials: false` on checkout -- unchanged. |
| Over-broad token scope | EoP | Job-scoped `security-events: write` only; top-level stays `contents: read` -- unchanged. |
| Silent coverage loss (dropped project) | Repudiation / integrity of the gate | The drift guard (MULTI-02) turns a dropped/added consumer into a loud RED; discovery `throw`s on an empty set (fail-loud). |

## Sources

### Primary (HIGH confidence -- read this session at HEAD)
- `.github/workflows/ci.yml` (the `code-scanning` job lines 488-602: the hardcoded atc step 564-567, the `category` input 593, the fallow per-run-id `node -e` 583 + no-category upload 598-602, the `[ -s ]`/`|| true` produced guard, the fork-PR gate; the `discover` job 153-174 set-e idiom; the `ci` aggregate `needs[]` 619-644, code-scanning deliberately absent).
- `tools/ci/list-e2e-projects.mjs` (the pure-fs discovery precedent + fail-loud-on-empty).
- `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` (GUARD-01b set-equality guard, `collectProjectJsonPaths` + `IGNORED_DIRS`, the B3 synthetic-temp-root robustness test, the CLI-exec assertion) and `scoped-name-guard.spec.ts` (`executorIdReferences` parses `targets.*.executor`, the cache:false `nx:run-commands` guard-target model).
- `project.json` (root, `@angular-typechecker/source` -- the REAL `angular-typechecker:typecheck` target on `fixtures/tsconfig.clean.json` -- Pitfall 1), `apps/ng-spike-app/project.json`, `libs/typecheck-consumer/project.json`, `libs/typecheck-consumer-dep/project.json`, `libs/typecheck-walk-consumer/project.json`, `packages/angular-typechecker/project.json`, `libs/test-util/project.json`, `nx.json` (targetDefaults key), `git grep -l "angular-typechecker:typecheck" -- '*.json'` (the full false-match set).
- `packages/angular-typechecker/src/cli/parse-args.ts` (`-c/--tsConfig` `multiple: true` repeatable; `--format` enum human/json/sarif; help text).
- `packages/angular-typechecker/src/core/sarif-report.ts` (single-run assembly: one `SarifRunBuilder`, `addRun` once; `node-sarif-builder` bakes `version`/`$schema`).
- `.planning/config.json` (`nyquist_validation: true`; `security_enforcement` absent = enabled; `fallow.enabled: true`).

### Secondary (HIGH -- milestone research + proven spike, verified against the above)
- `.planning/research/v0.2.4-enhanced-sarif-reporting/ARCHITECTURE.md` section 2 (CI-side merge seam, discovery-by-executor, graph-vs-fs, drift guard, new-vs-modified file table), `SUMMARY.md` finding #2, `PITFALLS.md` P5 (multi-run-same-category rejection) + P8 (silent discovery drift) + P9 (20-runs/file ceiling).
- Closed spike PR #53 + auto-memories `ci-sarif-code-scanning-dogfood` and `code-scanning-sarif-empirical-behavior`: per-run `automationDetails.id` categories land as distinct analyses; single `category` across runs rejected; SARIF-upload correctness provable only in REAL CI; PR-ref alerts query `refs/pull/<n>/merge`.

### Tertiary (LOW)
- None. No web fetch was needed: the upload-sarif multi-run/no-category contract is proven in-repo (the working fallow step in the same file) and by spike PR #53 -- a stronger source than external docs for this repo's exact wiring.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new package; every builtin/action verified in-repo.
- Architecture (discovery + merge + upload wiring): HIGH -- verified against the shipped reporter shape, the four consumer configs, and a working multi-run example in the same `ci.yml`.
- Pitfalls: HIGH -- Pitfall 1 (root project + guard exclusion) directly verified via `project.json` + `nx.json` + `git grep`; Pitfalls 2-6 verified against the real over-match/false-match sets and the proven upload contract.

**Research date:** 2026-07-21
**Valid until:** 2026-08-20 (stable; the domain is de-risked and in-repo. Re-verify only if `ci.yml`'s code-scanning job, the consumer set, or the shipped reporter's top-level SARIF shape changes.)
