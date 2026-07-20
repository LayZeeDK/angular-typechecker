---
phase: quick-260719-uny
plan: 01
type: execute
status: complete
date: 2026-07-19
---

# Quick Task 260719-uny -- Summary

Address the triaged findings from a three-axis code review of PR #47 (v0.2.3
machine-readable reporters): **Standards** (documented repo standards + the Fowler
smell baseline), **Spec** (the 13 milestone v0.2.3 requirements), and **Correctness**
(bug hunt over the reporter code).

**Review outcome: 0 correctness bugs, 0 spec gaps, 0 hard standard violations.** All
four surviving findings were judgement-call maintainability smells. Every change here
is an INTERNAL refactor -- **zero behavior change, zero output change**: all 550 unit
tests and 140 integration tests pass with **no snapshot or assertion edited**, and
nothing was added to the public barrel (ADD-01 / `index.drift.ts` untouched). Version
held at `0.2.2` (the Release PR owns the bump).

## Commits (3)

| Commit | Scope | What |
|--------|-------|------|
| `fa9e7e3` | `refactor(core)` | **STD-1 + STD-2.** STD-1: the authored-source predicate (`!isDeclarationFile && !endsWith('.ngtypecheck.ts')`) plus its ~6-line WR-01 justification comment were copy-pasted into `run-typecheck.ts` (direct-path filter) and `walk-references.ts` (leaf loop) -- one rule with two homes, and shotgun-surgery bait if the rule ever changes. Extracted one exported `isAuthoredSourceFile(sourceFile)` in `walk-references.ts` (the lower module -- `run-typecheck.ts` already value-imports from it, so no cycle) and used it at both sites, with the WR-01 rationale now living once on the helper. STD-2: `...(totalFilesCount !== undefined ? { totalFilesCount } : {})` at `finalizeUnion` and the direct path guarded a value both sites type as `number` -- a statically always-true branch whose own comment said "always present". Replaced with a plain `totalFilesCount,` property. |
| `9b96f6c` | `refactor(core)` | **STD-4.** `json-report.ts` and `sarif-report.ts` each declared their own `require('../../package.json')` version read. Added one exported `toolVersion` to `core/diagnostic-record.ts` -- the module BOTH reporters already import -- so the emitted JSON `version` and SARIF `toolDriverVersion` cannot drift. The `parse-args.ts` read stays separate (D-15 nx-free CLI boundary). Not exported from the public barrel; the SARIF lazy-import firewall is unaffected (a local `.json` require pulls in no new package, and `sarif-require-graph.spec.ts` stays green). |
| `38717b5` | `refactor(executor)` | **STD-3.** `NormalizedOptions.format` restated the `'human' \| 'json' \| 'sarif'` union instead of referencing the exported `ReportFormat`, so the executor could drift from the reporter seam. Now a type-only `ReportFormat` reference (no runtime graph change). `schema.d.ts` deliberately left self-contained (it is a contract file mirroring `schema.json`) and `parse-args.ts` keeps its inline union (D-15). |

## Triage decisions (findings NOT actioned)

- **SPEC-1 (FMT-03, dropped -- working as intended).** FMT-03 reads "every advisory
  notice, warning, and error goes to stderr via the injected Logger", but the Nx
  executor *suppresses* advisories entirely on machine formats
  (`executor.ts`, `if (format === 'human')`) rather than routing them to stderr. This
  is the documented CR-01 trade-off: `@nx/devkit`'s `logger.info` writes to **stdout**
  and would corrupt the machine payload, which FMT-03's own stdout-purity clause
  forbids. The standalone CLI honors FMT-03 in full (`BufferingLogger` -> stderr,
  payload -> stdout), and the JSON payload still carries every advisory as data in
  `summary.*`. Suppression is the correct resolution of the conflict, not a defect.
- **STD-3 (partial).** `schema.d.ts` and `parse-args.ts` restatements left as-is --
  see the commit row above for the rationale.
- **Correctness axis: no findings.** Verified clean: 1-based position math (incl.
  zero-width and file-less spans), the case-insensitive base-strip fix tied to the
  ORIGINAL length with a real-separator guard, verdict/exit-code parity across all
  three formats (no reporter re-derives `success` from counts; coverage-incomplete
  still fails), SARIF `partialFingerprints` including start column, deterministic
  result ordering, the 18-rule catalog, the lazy-import firewall + CJS interop,
  `totalFilesCount` dedupe and shim exclusion, JSON key determinism, `parse-args`
  flag precedence, and crash safety.

## Verification -- full CI-parity battery (all green)

Run on the main checkout against real `node_modules`. Re-run in full by the executor
after recovery (all three commits already landed + pushed, 23 PR CI checks green):

| Check | Result |
|-------|--------|
| `nx run-many -t typecheck` | PASS -- 12 projects (the gate that catches spec type errors `nx test` misses) |
| `nx run-many -t test` | PASS -- 550 tests / 52 files, **no snapshot or assertion edited** |
| `nx run-many -t integration` | PASS -- 140 tests / 24 files (real cold-compiler fixtures; already green pre-recovery) |
| `nx run-many -t lint` | PASS -- 3 projects (maxWarnings:0) |
| `nx format:check` | PASS |
| `fallow audit --format human --base origin/main` | PASS -- no issues in 205 changed files |

The zero-behavior bar is evidenced by the untouched snapshots: `json-report`,
`sarif-report`, and both `machine-reporters-*` integration snapshots all matched
byte-for-byte without regeneration.

## Deviations from plan

- **Executor interrupted then resumed.** The `gsd-executor` subagent terminated
  mid-run on an org monthly spend-limit API error after committing Task 1
  (`fa9e7e3`), leaving a partial uncommitted edit in `diagnostic-record.ts`. Tasks 2
  and 3 were completed during recovery from the same checked plan (partial edit
  carried forward intact), then the executor agent was **resumed** to formally close
  its run: it confirmed all three commits match the plan (no deviations, no re-work)
  and re-ran the full CI-parity battery green. Commit content and messages match the
  plan.
- **`gsd-verifier` ran (independent gate).** After the resume, `gsd-verifier` was
  spawned and produced `260719-uny-VERIFICATION.md` -- verdict **passed**, 6/6
  must-haves verified independently against the codebase (not from this SUMMARY),
  with the live `typecheck` + `test` gates re-run fresh. The `--validate`
  fresh-context audit was NOT skipped.
- **No worktree isolation.** Single-plan wave, and the executor had to run the Vitest
  suite to prove snapshots stayed green -- per AGENTS.md ("Single-plan wave: skip
  worktrees"), execution ran sequentially on the main checkout with real
  `node_modules`.
