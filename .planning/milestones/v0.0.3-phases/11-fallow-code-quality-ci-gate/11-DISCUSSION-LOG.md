# Phase 11: Fallow code-quality CI gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 11-fallow-code-quality-ci-gate
**Mode:** `--analyze --auto --chain` (autonomous; recommended-option selection with logged trade-off tables; `--research` to plan-phase)
**Areas discussed:** Gate strictness, Suppression mechanism, Analysis scope & dependency findings, Rule families & thresholds, CI wiring

> Phase-specific research (`11-DISCUSS-RESEARCH.md`) ran BEFORE gray-area analysis: live `fallow@2.103.0` runs verified the CLI surface, gate semantics, config schema, and the repo's ACTUAL findings. Every auto-selection below is grounded in that evidence + the roadmap scope sketch.
> Trap-quadrant assessment (per global rule): all five areas are MEDIUM-or-lower IMPACT with HIGH-or-recommended CONFIDENCE (last phase of the milestone; roadmap pre-locks direction; reversible config). NONE escalated out of `--auto` -- unlike Phase 10's HARD-01.

---

## Gate strictness (GA-1)

| Option | Description | Selected |
|--------|-------------|----------|
| `--gate new-only` (default) | Fail only on findings INTRODUCED by the changeset; inherited reported but non-blocking | ✓ |
| `--gate all` | Fail on every finding in changed files; skip base-snapshot attribution | |

**Choice:** `new-only` -- fallow default + roadmap-specified command + correct gate semantics. Phase resolves all current findings, so new-only/all converge on the clean tree. Inherited findings still suppressed in config for determinism (caveat: an inherited finding can flip to `introduced` when its file is later touched).

---

## Suppression mechanism (GA-2)

| Option | Description | Selected |
|--------|-------------|----------|
| Config `.fallowrc.jsonc` | `entry`/`ignoreExports`/`overrides`/`ignoreDependencies` + JSONC comment per declaration | ✓ |
| Inline `// fallow-ignore-*` comments | Per-symbol suppression next to the code | |

**Choice:** config-driven `.fallowrc.jsonc` -- roadmap item 1 + global preference (centralized, auditable, documented). Hand-authored `.fallowrc.jsonc` (init emits `.fallowrc.json`; both auto-discovered).

---

## Analysis scope & dependency findings (GA-3)

| Option | Description | Selected |
|--------|-------------|----------|
| Root scope + `unused-dev-dependencies: off` + keep `unused-dependencies` on | Roadmap command; kill 14 permanent dev-tooling false positives at the rule level; keep prod-dep signal | ✓ |
| Root scope + `ignoreDependencies: [14 names]` | Keep the rule on with a hand-list | |
| Scope to `packages/angular-typechecker` (`--workspace`) | No root-tooling noise but loses whole-repo coverage; contradicts roadmap | |

**Choice:** root scope (roadmap) + `unused-dev-dependencies` off (structural fix, not a rotting ignore-list) + `unused-dependencies` on. `@angular/forms` (prod) = verify-then-resolve by the executor (remove vs ignore-with-reason). IN-05 does NOT reproduce in 2.103.0 (fallow analyzes root `package.json`, not the published manifest) -- drop it from the expected-false-positive list.

---

## Rule families & thresholds (GA-4)

| Option | Description | Selected |
|--------|-------------|----------|
| All three families at default thresholds | dead-code + `duplicates` + `health` defaults (minOccurrences 3 / maxCyclomatic 20 / maxCognitive 15 / maxCrap 30) | ✓ |
| Custom thresholds | Tune now | |

**Choice:** all three at defaults -- repo is clean on duplication (0 clone groups) + complexity (0 findings) today, so defaults become zero-cost regression tripwires. Re-tune only if a default is later proven wrong.

---

## CI wiring (GA-5)

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated path-gated SHA-pinned `fallow` job in `ci` needs:, fetch-depth:0, `npx fallow audit --format json --base origin/main`, exit-code gate, `--format json` (no SARIF), act-compat assertion | Roadmap items 2-3; required check stays `ci`; least-privilege preserved | ✓ |
| SARIF + GitHub code-scanning (`--ci`) | Richer UI but needs `security-events: write` | |

**Choice:** dedicated job per roadmap. Pin fallow as a root devDependency (run `npx fallow`, not `@latest`); `fetch-depth: 0` for new-only attribution; same `!= 'false'` path-gate as test/e2e; Node 24; `--format json` (no SARIF -- keeps `contents: read`); add `assert_selected "$PR_PLAN" "ci/fallow"` to act-compat.sh; actionlint stays green.

---

## Claude's Discretion

- Exact `.fallowrc.jsonc` layout, `$schema` pointer, comment wording; `audit.gate` config key vs `--gate` CLI flag (config preferred for determinism).
- `@angular/forms` remove-vs-ignore -- decided by the executor's import-graph check.
- `fallow` job position in the workflow and whether it consumes `changes` output directly.

## Deferred Ideas

- SARIF -> GitHub code-scanning (`--ci`) -- needs `security-events: write`; out of scope.
- Fixing GSD's broken fallow structural pre-pass -- roadmap item 5, out of scope.
- Duplication/complexity threshold tuning -- until a real finding proves a default wrong.
