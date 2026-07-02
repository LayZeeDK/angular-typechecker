# ROUND 2 — verified facts, round-1 spread, reconciliation on the table

Read with `FACTS.md` (round-1 baseline). This adds facts verified after round 1 (in response to
members' FACTS-NEEDED), the round-1 position spread, and a proposed reconciliation per decision.
State your round-2 position on each decision: CONVERGE (accept) or HOLD. For any HOLD, cite the
specific fact that sustains it. Facts only below — no value language intended.

## A. Facts verified after round 1

1. **Cold-compile cost.** A single real `performCompilation` on a fixture is ~0.5s (measured:
   gate-b cold-run = 529ms). The full current plugin suite = 26 files / 155 tests, 8.75s
   wall-clock (parallel), ~38s summed test time. Adding ~18 single-compile fixtures adds on the
   order of ~9s of compile work per matrix cell (parallelized by Vitest workers; Windows is
   slower per the existing 30000ms timeout margin).
2. **ErrorCode map (authoritative, `@angular/compiler-cli@22.0.4` `error_code.d.ts`).** The 18
   `ExtendedTemplateDiagnosticName` members map to: invalidBananaInBox=8101,
   nullishCoalescingNotNullable=8102, optionalChainNotNullable=8107, missingControlFlowDirective=8103,
   missingStructuralDirective=8116, textAttributeNotBinding=8104, uninvokedFunctionInEventBinding=8111,
   missingNgForOfLet=8105, suffixNotSupported=8106, skipHydrationNotStatic=8108,
   interpolatedSignalNotInvoked=8109, **controlFlowPreventingContentProjection=8011**,
   unusedLetDeclaration=8112, uninvokedTrackFunction=8115, unusedStandaloneImports=8113,
   unparenthesizedNullishCoalescing=8114, uninvokedFunctionInTextInterpolation=8117,
   **deferTriggerMisconfiguration=8021**. Two members (8011, 8021) are OUTSIDE the 81xx range.
   `UNSUPPORTED_INITIALIZER_API_USAGE=8110` and `FORBIDDEN_REQUIRED_INITIALIZER_INVOCATION=8118`
   are `ErrorCode`s but are NOT members of `ExtendedTemplateDiagnosticName` (not configurable via
   `extendedDiagnostics`). So the configurable extended set is exactly the 18 enum members.
3. **No per-code branching in the core.** Grep of non-test `src/`: zero diagnostic-code literals
   except `UNKNOWN_ERROR_CODE=500` (infra), the `NG()`/`ngCodeOf` pure encoding helper, and
   `NG3004` (TCB-fatal detection). The gatherer runs all getters unconditionally and buckets by
   `DiagnosticCategory`; the zero-rootNames guard keys on `rootNames.length`, not a code. The core
   handles extended diagnostics uniformly (no per-NG8xxx suppression/remap/category override).
4. **`context.root`→`tsConfig` resolution is a pure, unit-covered function.** `normalize-options.ts`:
   `isAbsolute(options.tsConfig) ? options.tsConfig : joinPathFragments(context.root, options.tsConfig)`
   (two branches), with `normalize-options.spec.ts` present. No executor-only resolution branch was
   found that is unreached by this unit spec + the e2e tier.
5. **No `-p`-list guard exists.** Grep finds no test/tool asserting the `e2e` job's `-p` project
   list equals the set of e2e projects in the graph.
6. **install-e2e hostability.** The `install-e2e` fixture is `consumer-app`, which ALREADY has the
   `angular-typecheck` target pre-wired (`project.json` + `nx.json`). Hosting a generator e2e there
   requires (a) the plugin to ship a `generators.json` + the generator, and (b) a project in the
   fixture WITHOUT the target pre-wired (or an assertion that runs the generator on a fresh target).
7. **Per-introduction-version taxonomy rot (observed).** The integration scaffold's would-be
   `executor.angular17.*` file was renamed to an `extended.promotion` file because its
   introduction-version signal was false; only the `angular13` file is populated today.

## B. Stated decision for this round (generator shape)

For convergence, assume the generator's shape is: **edits `project.json` only** (via
`readProjectConfiguration`/`updateProjectConfiguration`/`formatFiles`), **emits no file** that any
in-process step reads back, and has **no per-project-type branching** beyond a default `tsConfig`
value. (This matches the sandbox prior art's 33-line generator.) If your round-1 position had a
mind-change trigger conditioned on the generator emitting a file or branching per project type,
treat that trigger as NOT met. (This is a decision, not a discovered fact; it may be revisited.)

## C. Round-1 position spread (by lens)

- **D1 substrate** — 7 of 8 (Nx-eng, Angular-correctness, test-arch, CI, product, minimalist,
  failure-modes): in-memory `createTreeWithEmptyWorkspace`; do NOT author `createFsTree`; real-disk
  only at e2e. 1 of 8 (maximalist): author `createFsTree` now (quarantined + drift-pinned), its own
  stated trigger to drop it = "generator emits no file AND generator-e2e runs the target."
- **D2 organization** — single enum-keyed data table: Angular-correctness, failure-modes,
  minimalist. Per-introduction-version files (± `it.each`): Nx-eng, test-arch, CI, product,
  maximalist. (Failure-modes + Angular-correctness cite fact A7 against per-version files.)
- **D2 scope** — all 18 by exact code+category+count+promotion: Angular-correctness, product,
  maximalist, failure-modes; all-but-bounded-by-cost: Nx-eng, test-arch, CI; ~2-3 representative
  only: minimalist (stated trigger = "tool branches per-code" — see fact A3).
- **D2 completeness tripwire** (catalog rows === enum members, in `test`): proposed by
  Angular-correctness, mandated by failure-modes; not opposed by others.
- **D3 mid-tier executor-vs-workspace** — add one thin ONLY if an uncovered `context`→`tsConfig`
  branch exists: Nx-eng, test-arch, CI, product (see fact A4). Cut: minimalist, failure-modes.
  Expand to FsTree+matrix: maximalist.
- **D4 generator e2e** — 8 of 8: extend the existing `install-e2e` tarball harness (generate→run),
  no Verdaccio, no new e2e project. Failure-modes adds: use `--skip-nx-cache`.
- **D5 CI** — 8 of 8: in-plugin specs auto-route into the 6-cell `test` matrix (no `ci.yml` change);
  fold generator e2e into `install-e2e`; single `ci` gate. Failure-modes adds: a set-equality guard
  test for the `-p` list (see fact A5 — none exists). Conditional: split the `test` target
  Linux-only IF cold-compile cost blows the budget (see fact A1).
- **D6 scope** — 8 of 8: generator in scope. Broad consensus to exclude Verdaccio, Nx
  cache/`dependsOn`-ordering tests, quiet/errors-only mode tests, and the jscodeshift injection
  toolkit. 7 of 8 also exclude `createFsTree`.

## D. Reconciliation on the table (accept or HOLD with a fact)

- **D1:** In-memory `createTreeWithEmptyWorkspace` for the generator unit tests; do not author
  `createFsTree`/`flushFsTreeChanges`. (Given decision B, the maximalist's drop-trigger is met.)
- **D2:** Assert all 18 `ExtendedTemplateDiagnosticName` members + the baseline TS/NG codes by
  exact code + `DiagnosticCategory` + count, plus one severity-promotion case, against the real
  compiler over committed fixtures; organize as a single data-driven `it.each` table keyed on the
  enum members (introduction-version as a row field, not a file split); add a completeness tripwire
  asserting catalog rows === the `ExtendedTemplateDiagnosticName` enum; mark any member not
  reproducible by a static fixture as `it.skip` with a written reason (never silent). Batch
  fixtures per program where practical.
- **D3:** Do not add a separate executor-against-workspace tier; if a `context.root`-relative
  `tsConfig` case is missing from `normalize-options.spec.ts`, add it there (unit), not as a new
  tier.
- **D4:** One generator scenario inside `install-e2e`: ship `generators.json` + the generator, add
  an un-wired project to the fixture, `nx g`, assert `project.json`, then `nx run <proj>:angular-typecheck`
  with `--skip-nx-cache`. No new e2e project, no Verdaccio.
- **D5:** No `ci.yml` change for in-plugin specs; generator e2e rides `install-e2e`; add the
  set-equality `-p`-list guard test; keep the single `ci` gate. No `test`-target split (fact A1
  shows the budget is comfortable) unless a measured regression appears.
- **D6:** Generator in scope at the shape in decision B; testing scope = generator unit + schema
  parity + the 18-member catalog + completeness tripwire + one folded generator e2e + the `-p`
  guard. Exclude `createFsTree`, mid-tier tier, Verdaccio, jscodeshift toolkit, cache/ordering and
  mode tests.

## E. Output contract (round 2)

```
ROUND2
D1: CONVERGE | HOLD — <if HOLD, the fact that sustains it>
D2-organization: CONVERGE | HOLD — <fact>
D2-scope: CONVERGE | HOLD — <fact>
D2-tripwire: CONVERGE | HOLD — <fact>
D3: CONVERGE | HOLD — <fact>
D4: CONVERGE | HOLD — <fact>
D5: CONVERGE | HOLD — <fact>
D6: CONVERGE | HOLD — <fact>
NEW-FACTS-NEEDED: <or none>
```
