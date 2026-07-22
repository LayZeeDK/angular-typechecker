# Phase 34: Per-project SARIF categories in CI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 34-per-project-sarif-categories-in-ci
**Mode:** `--auto` (autonomous, single pass) + `--analyze` (trade-off tables) + `--chain` (auto-advance to plan)
**Areas discussed:** Discovery mechanism, Merge assembly, Per-project CLI invocation, Drift-guard independence, CI job rewiring

---

## Discovery mechanism (MULTI-02)

**Trade-off analysis**

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Pure-fs scan of `apps/*/project.json` + `libs/*/project.json`, filter executor id | Matches the repo's LEAN-fs precedent (`list-e2e-projects.mjs`); no `npm ci`/graph spin; fast + execable inside the drift-guard spec; excludes e2e fixtures by root-scoping | Hardcodes the `apps/`/`libs/` roots -- a consumer under a new root is missed (mitigated: the root-agnostic guard, D-04, fails loud) | [x] |
| Graph-based `nx show projects --json` + per-project executor filter | Root-agnostic / authoritative; research-recommended | Needs the Nx graph loaded; slow + flaky to exec inside a unit spec; contradicts the `ci.yml` `discover` job's deliberate "NOT npm ci + nx show projects" stance | |
| Plain `nx show projects --with-target typecheck` | One command | Over-matches (plugin's own `nx:run-commands` typecheck, `test-util`, e2e projects) -- explicitly the wrong filter per MULTI-02 | |

**[auto] Selected:** Pure-fs scan scoped to `apps/`/`libs/`, filter `executor === 'angular-typechecker:typecheck'` (recommended default given repo precedent + guard testability).
**Notes:** Refines the research's "graph-based recommended" -- the root-agnostic authority research wanted is delegated to the drift guard's independent side (D-04). CI-only + guard-protected + reversible, so not in the high-impact + low-confidence quadrant; auto-locked without escalation.

---

## Merge assembly (MULTI-01)

**Trade-off analysis**

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Dedicated `tools/ci/merge-sarif.mjs` | Cleaner; unit-testable; richer logic (N files -> one N-run file + per-run id + empty-input skip) has a home | One more file | [x] |
| Inline `node -e` (fallow-style) | Fewest files; matches the existing fallow per-run stamp | Not unit-testable; combining N files is more than fallow's single-file per-run loop | |

**[auto] Selected:** Dedicated `tools/ci/merge-sarif.mjs` (recommended default).
**Notes:** Stamps `run.automationDetails.id = angular-typecheck/<project>` (literal `angular-typecheck/`, no `-er`, per MULTI-01/ROADMAP SC1); skips empty/0-byte inputs (per-project produced-guard).

---

## Per-project CLI invocation (MULTI-01)

**Trade-off analysis**

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Standalone CLI `bin.js -c <tsConfig...> --format sarif > file` per project | Byte-pure SARIF to stdout (advisories on stderr); already the dogfood generator; repeatable `-c` for multi-leaf tsConfig | Needs the built dist bin | [x] |
| `nx run <project>:typecheck --format sarif` | Uses the Nx target directly | The executor FRAMES stdout -- not byte-pure SARIF; unsuitable for redirect-to-file | |

**[auto] Selected:** Standalone CLI from dist, run from repo root, looped per discovered project, reusing the `|| true` + `[ -s file ]` produced-guard (recommended default).
**Notes:** Same invocation the current single-run dogfood step uses; run-from-root keeps `artifactLocation` URIs repo-relative.

---

## Drift-guard independence (MULTI-02)

**Trade-off analysis**

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| In-plugin `cache: false` Vitest spec: exec discovery script vs. an independent ROOT-AGNOSTIC enumeration (all `project.json` minus `e2e/*/fixtures/`) | Genuine independence; catches a consumer added under a root the fs discovery misses; mirrors GUARD-01b | Root-agnostic side must subtract fixture paths | [x] |
| Guard re-uses the same fs-scoped method as discovery | Simplest | Not independent -- a scoping bug passes both sides silently | |

**[auto] Selected:** Independent root-agnostic guard (recommended default).
**Notes:** This is the "cannot silently drift" mechanism (MULTI-02 SC3); mirrors the e2e `ci-e2e-coverage-guard.spec.ts`.

---

## CI job rewiring (MULTI-01)

**Trade-off analysis**

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Rewire the existing `code-scanning` job: replace the single hardcoded `bin.js` run + `category:` upload with discover -> loop -> merge -> one no-category upload; leave fallow untouched | One job; preserves all fork-skip/SHA-pin/path-gate invariants; fallow unaffected | Requires careful set-e loud-fail wiring in the loop | [x] |
| Add a separate per-project upload step each with its own `category` | Simple per-project mapping | Multiple `upload-sarif` calls; more surface; diverges from the single-upload merge contract in MULTI-01 | |

**[auto] Selected:** Rewire the existing job to a single merged no-category upload (recommended default).
**Notes:** Job STAYS OUT of the required `ci` aggregate (promotion is GATE-01, Phase 36). Fallow generation + its no-category upload untouched.

---

## Claude's Discretion

- Discovery JSON shape (`{ name, tsConfig[] }` vs re-reading tsConfig in the loop).
- `merge-sarif.mjs` input contract (explicit file list vs directory glob).
- Guard spec filename/placement; exact set-e loud-fail wiring of the discover/loop/merge shell steps.
- Verify `ng-spike-app`'s discovered `options.tsConfig` matches the currently-hardcoded `tsconfig.app.json` (no silent coverage reduction).

## Deferred Ideas

- Automated `gh api` Code Scanning proof + isolated one-per-family fixture -- Phase 35 (PROOF).
- Promote `code-scanning` to the required `ci` aggregate + un-path-gate + "Require code scanning results" ruleset + Scanned-files docs -- Phase 36 (GATE/DOC).
- Migrate to a per-project CI matrix -- MULTI-FUT-01 (unneeded at 4 projects).
- Reporter-side `--category` CLI option -- explicitly rejected (would make MULTI release-bearing).
