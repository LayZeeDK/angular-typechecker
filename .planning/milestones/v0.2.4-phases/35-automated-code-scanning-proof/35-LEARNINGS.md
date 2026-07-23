---
phase: 35
phase_name: "automated-code-scanning-proof"
project: "angular-typechecker"
generated: "2026-07-22"
counts:
  decisions: 10
  lessons: 7
  patterns: 7
  surprises: 5
missing_artifacts: []
---

# Phase 35 Learnings: automated-code-scanning-proof

## Decisions

### All four SARIF families from ONE solution-tsconfig CLI run
The proof fixture emits TS2322 + NG8002 + NG8101 + ATC90002 (one diagnostic per SARIF family) from a single CLI run: a solution `tsconfig.json` (`files:[]`) referencing one surviving leaf (real TS + template diagnostics) plus one deliberately-missing `./tsconfig.missing.json` reference that synthesizes ATC90002.

**Rationale:** Lazier and self-verifying vs a second invocation + merge, and it sidesteps the multi-run-same-category ingestion rejection downstream (one run + one category).
**Source:** 35-01-PLAN.md, 35-01-SUMMARY.md

### NG8101 (invalidBananaInBox) for the extended-diagnostics family
`<input ([value])="value" />` was used for the NG8xxx family rather than a two-component NG8011 fallback.

**Rationale:** It fires cleanly at warning level with no extra component wiring and coexists with NG8002 on a separate element with no interference (confirmed by the drift-lock spec: exactly 4 rules, no incidental diagnostics).
**Source:** 35-01-SUMMARY.md

### ATC90002 (not-found reference), not ATC90001 (zero-rootNames), for the tool family
The tool-family diagnostic is driven by a missing reference (90002), not an empty root-names set (90001).

**Rationale:** ATC90002 co-exists with the surviving leaf; ATC90001 requires NO surviving leaves, which would preclude the other three families in the same run.
**Source:** 35-01-SUMMARY.md

### Drift-lock asserts the tuple SET + one-rule-per-family, not exact ruleIds
The local drift-lock integration spec asserts the SET of (family tag, level) tuples and exactly one rule per family; the extended ruleId stays discretionary (asserted by tag, not hard-pinned). TS2322/NG8002/ATC90002 are pinned explicitly.

**Rationale:** Catches any family drift while keeping the extended code Task-discretionary; a fixture or reporter change that breaks the contract is caught locally, not silently.
**Source:** 35-01-SUMMARY.md

### Category filter in the CLI entry; the pure matcher stays category-agnostic
`missingTuples(alerts, expected)` receives already-scoped alerts and stays category-agnostic; both the seam and normal branches client-filter to `most_recent_instance.category === 'angular-typecheck-proof'` BEFORE calling it (Pattern 2).

**Rationale:** Keeps the pure matcher simple and makes the category-isolation test load-bearing (a dogfood-category `tool` alert must NOT satisfy the `tool` tuple).
**Source:** 35-02-SUMMARY.md

### Flush-safe fail-loud via `process.exitCode = 1` in a `.catch`
The assert script fails loud by setting `process.exitCode = 1` in a `.catch` (the shipped `bin.ts` D-02 pattern), not by an uncaught top-level-await rejection.

**Rationale:** Deterministic exit 1 plus a clean one-line stderr message the spec asserts on; avoids relying on TLA-at-block-scope rejection semantics.
**Source:** 35-02-SUMMARY.md

### Simple fork gate on a job that is already PR-only
The `code-scanning-proof` job's fork gate is the bare `github.event.pull_request.head.repo.fork == false`, not the dogfood job's compound `github.event_name != 'pull_request' || ...` form.

**Rationale:** The job is already PR-only via its own `if:`, so the compound push-to-main guard is unnecessary; the bare form guards BOTH the upload and assert steps.
**Source:** 35-03-SUMMARY.md

### Proof job deliberately kept OUT of the required `ci` aggregate
The `code-scanning-proof` job is absent from the `ci` aggregate `needs[]`.

**Rationale:** Promotion into the required gate (GATE-01) is Phase 36 work; this phase only proves the contract, it does not yet enforce it.
**Source:** 35-03-SUMMARY.md

### G-35-01 fix: region-less whole-file fallback location, not a synthetic line-1 region
File-less SARIF results (`record.file === null`) now carry `{ fileUri: relativizePath(result.tsConfigPath, pathBase) }` (fileUri alone, no region), reversing the old no-location emission in the SARIF EMISSION only. DiagnosticRecord, json-report, fingerprint, the barrel, and the package version are byte-unchanged.

**Rationale:** Region-less is honest for project/config-level diagnostics and the smallest diff; GitHub path-level-alert acceptance was the real-CI-only confirmation (and it was accepted -- see Surprises).
**Source:** 35-04-PLAN.md, 35-04-SUMMARY.md

### fast-uri HIGH cve fixed via a nested `ajv->fast-uri ^3.1.4` override
The pre-existing HIGH `fast-uri@3.1.3` advisory (GHSA-v2hh-gcrm-f6hx) was cleared with a nested `ajv -> fast-uri ^3.1.4` override, NOT the cve-lite-suggested `ajv 6->8` two-major-line bump.

**Rationale:** The nested plain-range override is npm 10/11-portable, scoped to the only fast-uri consumer (ajv 8.x), and a patch bump -- avoiding the do-not-bump-across-a-major-line + override-portability traps that can break `npm ci`.
**Source:** 35-04-SUMMARY.md, STATE.md

---

## Lessons

### The Nyquist point held: SARIF ingestion is provable ONLY in real CI
Every local gate (schema validation, the drift-lock spec, `act --validate`, the subprocess matcher tests) was green, yet the first real CI upload still failed. Local gates prove the SARIF is well-formed and the assert logic is correct; they CANNOT prove GitHub ingested it.

**Context:** The standing SARIF-dogfood lesson repeated exactly. The authoritative phase gate is the `code-scanning-proof` job GREEN on a real PR, not any local battery.
**Source:** 35-VERIFICATION.md, 35-UAT.md

### GitHub rejects the ENTIRE SARIF if ANY result has no `locations`
`upload-sarif` failed at wait-for-processing with `locationFromSarifResult: expected at least one location`. One file-less result (the ATC90002 tool diagnostic) sank the whole upload. The dogfood `code-scanning` job passed only because its real projects never emit a file-less diagnostic through this path.

**Context:** File-less (tool/project/config-level) diagnostics MUST carry a fallback location to be ingestible. This is the G-35-01 root cause and the reason plan 35-04 revisited the locked D-01 "no-location result" decision.
**Source:** 35-UAT.md (G-35-01), 35-VERIFICATION.md

### The adversarial verifier's refusal to trust "complete" framing was vindicated
The prior verification refused to accept SUMMARY.md's "complete" claim for PROOF-01/02 and left SC2/SC3 behavior-unverified because real ingestion had never executed. The first real CI run then DID fail on a genuine defect.

**Context:** Trust the real-CI gate and independently-fetched job logs (`gh run view --log`, `gh pr checks`), never the SUMMARY narrative, for a real-CI-only contract.
**Source:** 35-VERIFICATION.md

### `nx test` does not type-check specs (standing lesson, re-hit)
`nx test` (vitest/esbuild) green-masks spec type errors, so the assert spec was additionally type-checked with `tsc --noEmit -p packages/angular-typechecker/tsconfig.spec.json` beyond the passing `nx test`.

**Context:** Any spec-level type regression needs the separate `nx typecheck` (3 tsc) gate; the test runner alone is not sufficient.
**Source:** 35-02-SUMMARY.md

### A plan's fallow verify grep was over-broad (folded stderr into the match)
The Task-2 verify `npx fallow audit ... 2>&1 | rg -i "sarif-proof-fixture"` tripped on a benign `WARN tsconfig chain not fully loaded ... tsconfig.missing.json` stderr line -- that missing reference is BY DESIGN (it synthesizes ATC90002).

**Context:** The correct signal is that no fallow FINDING (stdout) names the fixture. Don't fold stderr into a finding-detection grep for a fixture that intentionally emits warnings.
**Source:** 35-01-SUMMARY.md

### An env test seam makes a real-CI-only assert locally unit-testable
The `ASSERT_ALERTS_FILE` env seam reads a canned alerts payload and applies the same category filter + `missingTuples`, so the assert's set-membership decision and RED (exit 1) path are provable locally WITHOUT hitting GitHub -- while the ingestion round-trip stays real-CI-only.

**Context:** The right decomposition for a real-CI-only script: a pure exported core + an env seam for the decision logic, leaving only the genuine external round-trip unprovable locally.
**Source:** 35-02-SUMMARY.md

### Structural-isolation properties need a STANDING test, not an ad-hoc plan-time check
PROOF-01's "fixture lives outside the normal `nx typecheck` gate" property had only ever been checked once, as a shell command in the plan's `<verify>` block -- never persisted as a regression test. validate-phase filled this gap with `sarif-proof-fixture-isolation.spec.ts` (asserts no `project.json`, not in `tsconfig.tools.json`).

**Context:** A requirement clause that is only checked at execution time silently rots; if the property matters, lock it with a spec that fails when the property is violated.
**Source:** 35-VALIDATION.md

---

## Patterns

### One-per-family proof fixture driving the SHIPPED engine
A deterministic, one-diagnostic-per-family SARIF input built as a fixture OUTSIDE the Nx graph (no `project.json`, not in the explicit-allowlist `tsconfig.tools.json`), fed to the shipped CLI.

**When to use:** Proving an external-service contract (SARIF -> Code Scanning) needs a stable, minimal, self-contained input that exercises every branch of the shipped output without polluting the real build/typecheck gates.
**Source:** 35-01-SUMMARY.md

### Local drift-lock integration spec as the fast tripwire for a real-CI-only contract
An integration spec runs the real cold compiler over the fixture and asserts the exact output tuples the CI proof depends on.

**When to use:** When the authoritative gate is slow/remote/external, add a fast local spec that fails the instant the fixture or the emitting code drifts from the contract -- so most regressions are caught before the PR.
**Source:** 35-01-SUMMARY.md

### Real-CI-only assertion script = pure exported core + env test seam
Ship the CI assert as a `tools/ci/*.mjs` with an exported pure matcher (`missingTuples`) and an env seam (`ASSERT_ALERTS_FILE`); the CLI entry composes the poll + filter + matcher.

**When to use:** Any script whose full behavior can only run in CI -- factor out the decision logic so it has fast local unit coverage; leave only the true external round-trip untested locally.
**Source:** 35-02-SUMMARY.md

### Plugin-side subprocess spec drives a `tools/ci` .mjs via execFileSync + env seam
The spec runs the REAL `.mjs` as a child process (`execFileSync('node', ...)`) through the env seam and normalizes `{ status, stdout, stderr }`, asserting exact exit codes -- never a static cross-project import.

**When to use:** Testing an out-of-project CI helper from a plugin's Vitest suite; `@nx/enforce-module-boundaries` and the Vitest module runner both block a static import, so drive it as a subprocess.
**Source:** 35-02-SUMMARY.md

### Injection-safe CI subprocess + PR-metadata via `env:`
`execFileSync('gh', ['api', pathAndQuery])` (fixed arg array, no `shell:true`); PR number and `sarif-id` reach the assert step via `env:` values (bracket syntax for the hyphenated output), never interpolated into a `run:` shell; the fork check is an Actions expression, not a shell.

**When to use:** Any workflow step consuming untrusted PR metadata or shelling out -- keep the data as data (env + fixed arg arrays), never as shell string interpolation.
**Source:** 35-02-SUMMARY.md, 35-03-SUMMARY.md

### SARIF file-less fallback location
Anchor a project/config-level diagnostic that has no source location to its always-present `tsConfigPath` (relativized, forward-slash, region-less) rather than emitting no `locations` key -- ingestible by GitHub while the diagnostic is still never dropped, and out-of-band so the synthesized record stays `file: undefined` and never feeds the fingerprint.

**When to use:** Emitting SARIF for any tool that can produce whole-program/config-level findings with no file -- every result needs a location or GitHub rejects the whole upload.
**Source:** 35-04-SUMMARY.md

### act-compat `assert_absent` proves a PR-only job cannot run on `push`
An `assert_absent "$PUSH_MAIN_PLAN" "ci/code-scanning-proof"` assertion locks that the `github.event_name == 'pull_request'` gate drops the job from the push-to-main plan.

**When to use:** Any job whose deliberate errors/alerts must never reach `main` -- assert its ABSENCE from the push plan, not just its presence in the PR plan (the leak-prevention direction).
**Source:** 35-03-SUMMARY.md

---

## Surprises

### The proof harness caught a real, unplanned defect on its VERY FIRST live run
The first real CI run failed on a genuine SARIF->Code Scanning contract break (G-35-01), not a synthetic drill. The `code-scanning-proof` job went red automatically with no manual intervention.

**Impact:** The strongest possible evidence for SC3 ("a broken contract is caught automatically") -- the harness proved itself by finding a real bug, stronger than any planted regression. It also justified the multi-plan investment: the fixture/assert/job were correct precisely because they surfaced a defect nothing else did.
**Source:** 35-VERIFICATION.md, 35-UAT.md

### Region-less whole-file location was ACCEPTED by GitHub -- no line-1 fallback needed
The D6 open question (region-less vs a synthetic line-1 region) resolved in favor of region-less: GitHub ingested the region-less whole-file location with no rejection.

**Impact:** The smaller, more honest diff was sufficient; no synthetic region was needed. Definitively closes the CONTEXT D6 open question.
**Source:** 35-04-SUMMARY.md, STATE.md

### NG8101 fired cleanly on the first attempt
The extended-diagnostics family fired at warning with no extra wiring; the plan's split-into-two-components fallback was unnecessary.

**Impact:** Plan 35-01 landed with zero deviation; the fixture emitted the exact four families first try.
**Source:** 35-01-SUMMARY.md

### act PR-selection fidelity is not verifiable on the local Windows box
`act -n pull_request` does not resolve `needs.changes.outputs.code` to empty-string in dry-run, so ALL code-gated jobs (including the untouched dogfood `code-scanning`) drop from the local PR plan -- the new `assert_selected` fails locally for an environment reason, not a defect.

**Impact:** The real-CI `act-compat` job (ubuntu, act v0.2.89, in the required `ci` aggregate) is authoritative for PR-selection fidelity; the local suite is CI-authoritative by design and the local failure was correctly treated as environment divergence.
**Source:** 35-03-SUMMARY.md

### A freshly-published OSV advisory turned the cve-lite gate red mid-phase with ZERO code change
Plan 35-04 touched no `package.json`/`package-lock.json`, yet its 8-gate battery went 7/8 because a newly-published HIGH `fast-uri` advisory turned the pre-existing dependency tree red.

**Impact:** Dependency-tree advisories are a moving target independent of your diff; a "clean" additive plan can still fail a security gate, and the fix belongs in a dedicated dep-hygiene step, not an inline drive-by.
**Source:** 35-04-SUMMARY.md
