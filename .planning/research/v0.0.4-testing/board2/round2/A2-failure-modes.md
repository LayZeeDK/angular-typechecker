# A2 -- Failure-Modes / Fragility (Round 2)

**Mandate:** adversarial -- keep probing for false-greens, silent skips, drift, fragility.
**Verdict:** CONVERGE on all eight. The reconciliation (&sect;D) absorbed both systemic holes I
raised in round 1 (NG8xxx coverage drift; the `e2e` `-p` silent-skip) AND every per-decision
mechanism I asked for (exact code+category+count, `--skip-nx-cache`, written-reason skips). I
could not name a single fact &sect;D gets wrong that leaves a concrete false-green or silent-skip
path open, so a HOLD would be illegitimate per the round rules.

## Per-decision adversarial check

**D1 -- CONVERGE.** &sect;D: in-memory `createTreeWithEmptyWorkspace`, no `createFsTree`. My
round-1 drop-trigger was "a generator step that reads its own emitted file from disk DURING
generation." Decision B states the generator edits `project.json` only and emits no file read
back in-process -- the trigger is explicitly NOT met. The `/virtual` leakage (nx#32588) and
open-handle (nx#26346) hazards are real but are in-substrate mitigations (mock-project-graph
first import; `NX_DAEMON:false` already set), not grounds to reject the chosen substrate. No
fact contradicts &sect;D.

**D2-organization -- CONVERGE.** Single enum-keyed `it.each` table, introduction-version as a
row field not a file split. Fact A7 confirms the taxonomy-rot I cited in round 1 (the
`executor.angular17.*` -> `extended.promotion` rename because the version signal was false). A
file-per-version split is the documented false-taxonomy trap; the table eliminates it.

**D2-scope -- CONVERGE.** All 18 `ExtendedTemplateDiagnosticName` members + baseline TS/NG by
exact code + `DiagnosticCategory` + count, plus one severity-promotion case. Fact A3 (no
per-code branching; the gatherer runs all getters unconditionally and buckets by category) means
a fixture-driven catalog faithfully exercises the real code path -- there is no per-NG8xxx branch
the catalog could miss. Exact code+category+count is the non-negotiable guard against the
boolean-only false green; &sect;D mandates it.

Adversarial probe on the `it.skip`-with-reason clause: does skipping an irreproducible member
re-open a silent skip? No. (1) The skipped member's ROW still exists in the catalog table, so the
completeness tripwire stays correctly green (the catalog IS complete); (2) Vitest renders skipped
tests visibly with the written reason; (3) &sect;D says "never silent." Skip-with-written-reason is
the correct treatment, not a hole.

**D2-tripwire -- CONVERGE.** Catalog rows === the `ExtendedTemplateDiagnosticName` enum, run in
`test`. This is the single most valuable defense in D2 and FACTS proves it is needed RIGHT NOW:
`DIAGNOSTIC-CATALOG.md` lists only 16 extended entries -- it omits
`controlFlowPreventingContentProjection` (8011) and mislabels `unusedLetDeclaration` (8112) --
while the verified enum (fact A2 / FACTS &sect;4) has 18 members, two of them OUTSIDE the 81xx
range (8011, 8021). The tripwire converts that exact drift into a loud failure as compiler-cli
evolves. It runs in the `test` matrix glob, so it cannot be silently dropped.

**D3 -- CONVERGE.** No mid-tier executor-vs-workspace; if a `context.root`-relative `tsConfig`
case is missing, add it to `normalize-options.spec.ts` (unit). Fact A4 fact-checks my round-1
mind-change trigger and finds it NOT present: the resolution is a pure two-branch function with a
spec, and "No executor-only resolution branch was found that is unreached by this unit spec + the
e2e tier." A hand-built `ExecutorContext` mid-tier would re-cover e2e ground against a fiction --
a false-green vector with no offsetting catch.

**D4 -- CONVERGE.** One generator scenario folded into `install-e2e` (already in the `-p` list),
with `--skip-nx-cache`. This closes two false-greens I named: the new-e2e-project silent-skip
(avoided by riding an already-listed project) and the cached-green (the `angular-typecheck`
target's `production` input excludes `*.spec.ts`, so without `--skip-nx-cache` a post-generate run
is served a stale exit-0). Fact A6 confirms the exact preconditions &sect;D specifies: ship
`generators.json` + the generator, and add a project WITHOUT the target pre-wired
(`consumer-app` is already wired, so a fresh un-wired project is required). No Verdaccio
(Windows-arm64 `execFileSync` divergence + flake surface).

**D5 -- CONVERGE.** In-plugin specs auto-route into the 6-cell `test` matrix (glob, no `ci.yml`
edit -- the opposite of a silent skip); generator e2e rides `install-e2e`; ADD the set-equality
`-p`-list guard. Fact A5 confirms no such guard exists today, so the `-p` list is currently an
unguarded human-maintenance contract -- the load-bearing silent-skip generator. &sect;D adopts the
guard, converting it into a loud, located failure. Fact A1 (cold compile ~0.5s; ~+9s/cell
parallelized, within the 30000ms margin) confirms no `test`-target split is needed; the
no-split-unless-measured-regression stance is fact-backed.

**D6 -- CONVERGE.** Generator in scope at shape B; testing scope = generator unit + schema parity

- 18-member catalog + completeness tripwire + one folded generator e2e + `-p` guard; descope
  `createFsTree`, mid-tier, Verdaccio, jscodeshift, cache/`dependsOn`-ordering, mode tests. This is
  exactly my round-1 rank-ordered scope: the two systemic self-auditing tests (enum-vs-table
  completeness; `-p` set-equality) lead, then the point coverage. Over-scoping to the prior-art
  union would import its fragility wholesale for no false-green-prevention gain.

## Why no HOLD

A HOLD is valid only by citing a fact &sect;D gets wrong. The two residual false-green/silent-skip
paths a type-checker test suite must fear -- (1) diagnostic coverage silently rotting as
compiler-cli evolves, (2) an e2e project silently never running in CI -- are each closed by a
mandated systemic tripwire/guard in &sect;D, and the per-decision mechanisms (exact
code+category+count, `--skip-nx-cache`, written-reason skips, glob-routing) are all present. The
`it.skip` and in-memory-leakage edges I probed are correctly handled, not holes. No fact is
misused. Converge.
