# C2 -- Angular compiler diagnostic correctness and completeness

LENS: faithfully detecting and asserting the full Angular compiler diagnostic surface
(TypeScript + template + the 18 `ExtendedTemplateDiagnosticName` members + baseline NG/TS
codes), and detecting regressions when Angular changes.

All positions below are argued from that lens only. Where the lens is silent on a decision
(e.g. test substrate for a config-edit generator), I say so and defer.

---

## Lens-critical verification (done first, against the installed compiler)

Verified directly against `node_modules/@angular/compiler-cli@22.0.4` this session:

- `src/ngtsc/diagnostics/src/extended_template_diagnostic_name.d.ts` -- the
  `@publicApi` enum has **exactly 18 members**, read verbatim. Matches FACTS.md sec.4.
- `src/ngtsc/diagnostics/src/error_code.d.ts` -- the `@publicApi` `ErrorCode` enum. I mapped
  every one of the 18 names to its numeric `ErrorCode`:

  | #   | Enum member (name string)                  | ErrorCode | Range                        |
  | --- | ------------------------------------------ | --------- | ---------------------------- |
  | 1   | invalidBananaInBox                         | 8101      | extended (81xx)              |
  | 2   | nullishCoalescingNotNullable               | 8102      | extended                     |
  | 3   | optionalChainNotNullable                   | 8107      | extended                     |
  | 4   | missingControlFlowDirective                | 8103      | extended                     |
  | 5   | missingStructuralDirective                 | 8116      | extended                     |
  | 6   | textAttributeNotBinding                    | 8104      | extended                     |
  | 7   | uninvokedFunctionInEventBinding            | 8111      | extended                     |
  | 8   | missingNgForOfLet                          | 8105      | extended                     |
  | 9   | suffixNotSupported                         | 8106      | extended                     |
  | 10  | skipHydrationNotStatic                     | 8108      | extended                     |
  | 11  | interpolatedSignalNotInvoked               | 8109      | extended                     |
  | 12  | **controlFlowPreventingContentProjection** | **8011**  | **baseline template (80xx)** |
  | 13  | unusedLetDeclaration                       | 8112      | extended                     |
  | 14  | uninvokedTrackFunction                     | 8115      | extended                     |
  | 15  | unusedStandaloneImports                    | 8113      | extended                     |
  | 16  | unparenthesizedNullishCoalescing           | 8114      | extended                     |
  | 17  | uninvokedFunctionInTextInterpolation       | 8117      | extended                     |
  | 18  | **deferTriggerMisconfiguration**           | **8021**  | **baseline template (80xx)** |

**LENS-CRITICAL FINDING #1 -- the "18 extended diagnostics" framing is wrong; 2 of the 18
are NOT in the extended (81xx) range.** `controlFlowPreventingContentProjection` is NG**8011**
and `deferTriggerMisconfiguration` is NG**8021** -- both in the 8000-8099 baseline
template-type-check range, alongside SCHEMA*INVALID_ELEMENT (8001), MISSING_PIPE (8004),
WRITE_TO_READ_ONLY_VARIABLE (8005), etc. The enum `ExtendedTemplateDiagnosticName` \_names*
them as configurable-by-name diagnostics, but their codes sit below 8100. The `DIAGNOSTIC-
CATALOG.md` (line 47) even lists NG8021 in its "extended" table and (line 49) admits it does
not list `controlFlowPreventingContentProjection` at all. From the correctness lens this
matters because:

- the test taxonomy MUST be keyed on the **enum membership** (all 18 names), NOT on the
  "NG81xx" numeric pattern. A grep/filter that scopes to `81\d\d` would silently drop
  NG8011 and NG8021 -- exactly the kind of completeness gap this milestone exists to close.
- NG8011 and NG8021 may NOT respond to `extendedDiagnostics.defaultCategory` the same way
  the 81xx checks do (the 81xx checks are registered as "extended template checks" with a
  default-WARNING category; the 80xx codes are emitted by the core template type-checker and
  several are hard errors regardless of config). This is the single biggest UNVERIFIED fact
  blocking a faithful D2 plan (see FACTS-NEEDED).

**LENS-CRITICAL FINDING #2 -- the catalog's NG8112 note is half-right.** `unusedLetDeclaration`
IS a member of the public `ExtendedTemplateDiagnosticName` enum AND its code NG8112 = 8112 is
in the enum. The catalog calls 8112 "undocumented" on angular.dev/extended-diagnostics -- that
is a _docs-page_ gap, not an API gap. The enum is the authoritative public contract (it is
`@publicApi`), so NG8112 is in-scope for completeness and must be asserted; "absent from the
docs site" is not a reason to skip it. Likewise NG8110 (`UNSUPPORTED_INITIALIZER_API_USAGE`) is
in `ErrorCode` but is NOT a member of `ExtendedTemplateDiagnosticName`, so it is correctly
out-of-scope for the "configurable extended check" set (it is a hard analysis error).

**LENS-CRITICAL FINDING #3 -- no new seam is needed to assert code/count.** The sandbox report
worried that "the executor returns only `{ success }`" so a code-level assertion would need a
new seam. That concern does NOT apply to THIS repo. I read
`packages/angular-typechecker/src/core/extended.angular13.integration.spec.ts`: the core
`runTypecheck({ tsConfigPath })` already returns a `CoreResult` with `result.diagnostics`
(each carrying a numeric `code`), `result.errorCount`, `result.warningCount`. The existing
idiom is exactly `result.diagnostics.find(d => d.code === NG(8101))` then assert
`.category` + counts. So the assertion seam this milestone needs ALREADY EXISTS at the core
tier; the work is fixtures + specs, not plumbing. This is decisive for D2 and D3.

I also confirmed the `NG()` negative-encoding helper
(`packages/angular-typechecker/src/core/diagnostic-codes.ts`): `NG(code) = -990000 - code`,
mirroring the compiler's `ngErrorCode(code) = parseInt('-99' + code)`. It is only correct for
4-digit codes -- which all 18 are (8011, 8021, 8101-8117). Good.

---

## D1 -- Test substrate

**Position (lens-scoped): The substrate decision is essentially OUT of my lens for the
generator, and ALREADY SETTLED for diagnostic correctness. For the diagnostic catalog
(the part I own), the substrate is the EXISTING committed `fixtures/<scenario>/` + real
`performCompilation` via `runTypecheck({ tsConfigPath })` -- keep it; do not move diagnostic
correctness onto any Tree/FsTree substrate. For the generator, defer to the substrate board;
from my lens the only constraint I impose is that NO Tree substrate (`createTreeWithEmptyWorkspace`
in-memory or `FsTree` real-disk) is ever used to assert a compiler diagnostic, because none of
them run the Angular compiler.**

Factual basis:

- The 11 existing `*.integration.spec.ts` already drive the REAL compiler against committed
  `fixtures/` tsconfigs and assert exact codes (`extended.angular13.integration.spec.ts` reads
  `fixtures/extended-v13/tsconfig.app.json`, asserts `code === NG(8101)` + WARNING category +
  counts). `git ls-files fixtures/` confirms 13 committed fixture scenarios, each with a real
  `.component.ts`/`.html` + a `tsconfig.*.json`.
- `createTreeWithEmptyWorkspace` / `FsTree` are devkit _generator_ substrates: they record
  file CHANGES in memory (or to a temp dir), with NO Angular compiler in the loop
  (NX-FSTREE-INTERNALS sec.0, sec.9). They can prove "the generator wrote target X"; they
  CANNOT prove "the compiler emits NG8104 for this template." Diagnostic correctness lives in
  a different tier entirely.
- The CURRENT-AUDIT recommendation (in-memory `createTreeWithEmptyWorkspace` default for the
  generator) is consistent with my lens because the generator is a pure `project.json`
  config-edit -- nothing the compiler observes.

Facts I am missing: none that bear on my lens. (Substrate fidelity for the generator's _edits_
is the substrate board's call.)

What would change my position: if a diagnostic could only be reproduced by GENERATING a real
Angular project (e.g. a diagnostic that depends on Nx/Angular-generated tsconfig inheritance
that a hand-written committed fixture cannot replicate). I checked the catalog's triggers --
all 18 are reproducible from a minimal committed component+template+tsconfig (the existing
`fixtures/extended-v13` proves it), so this trigger is not active.

---

## D2 -- Diagnostic coverage (the decision I own)

**Position: Organize coverage as a single DATA-DRIVEN table keyed on the 18
`ExtendedTemplateDiagnosticName` enum members (NOT on the NG81xx numeric pattern, and NOT
one-file-per-Angular-major), backed by committed per-diagnostic fixtures, asserting exact
`code` + `.category` + a count invariant, with explicit category-promotion coverage. Assert
all 18 enum members + the catalog's baseline TS/NG codes. Add a derived-from-the-enum
"completeness tripwire" so a future Angular release that adds a 19th member fails CI.**

This position has five parts; each rests on a verified fact.

1. **Taxonomy = the public enum, asserted by exact code + category.** The authoritative,
   regression-detecting contract is `ExtendedTemplateDiagnosticName` (18 members, `@publicApi`,
   read this session). Assert each by its `ErrorCode` (table above) AND its `.category`,
   reusing the existing `result.diagnostics.find(d => d.code === NG(xxxx))` idiom. Exact code
   beats pass/fail: the sandbox's coarse `expect(result.success).toBe(false)` (SANDBOX sec.4)
   cannot distinguish "we caught NG8104" from "we caught some unrelated error in the fixture"
   -- a false-confidence failure mode for a completeness tool. The repo already rejected the
   coarse idiom (its v13 spec asserts exact code); generalize it.

2. **A single data-driven table, NOT one-file-per-major.** From my lens the introduction-major
   is provenance METADATA, not a test-organizing axis: every one of the 18 runs on Angular 22
   regardless of when it debuted (DIAGNOSTIC-CATALOG line 3 says exactly this). A
   `it.each(CATALOG)` table where each row is `{ name, code, fixtureTsConfig, expectedCategory,
introducedIn }` gives:
   - completeness-by-construction: the table can be cross-checked against the enum (part 5);
   - the introduced-major preserved as a row FIELD (so the catalog provenance is not lost);
   - "add a future major" is still a drop-in (append rows + fixtures), the property the
     sandbox's file-per-major split was chosen for (SANDBOX sec.4), without N nearly-empty
     files. The repo ALREADY drifted off the file-per-major plan (CURRENT-AUDIT A.3: it renamed
     `extended.angular17` to `extended.promotion` because the version signal was false) --
     evidence the version-file axis is a poor fit here.
     I am NOT dogmatic about one-file vs few-files; the load-bearing claim is **data-driven over
     the enum**, not the file count. If the orchestrator prefers `extended.angularNN` files for
     git-blame locality, that is fine PROVIDED the per-major files are generated from / checked
     against the one enum-derived table.

3. **Committed fixtures, NOT programmatic AST injection.** The repo's established substrate is
   committed `fixtures/` (sec.D1). For a completeness suite, committed fixtures are SUPERIOR to
   the sandbox/Connect jscodeshift injection (SANDBOX sec.5, CONNECT sec.6a) on my lens:
   - a committed broken template is a readable, reviewable spec of "what triggers NG8104";
   - it removes a whole failure class (an AST-injection helper that silently stops triggering
     the intended check after an Angular grammar change would make the test pass for the wrong
     reason -- the worst outcome for a regression detector).
     Programmatic injection earns its keep when you must mutate a GENERATED project (the e2e
     tier); it is overkill for asserting a fixed compiler code. Most of the 18 are a one-line
     template snippet (the `error_code.d.ts` doc comments give the exact trigger for each, e.g.
     `<div ([foo])="bar" />` for 8101, `{{ foo ?? bar }}` for 8102, `@for (...; track trackByName)`
     for 8115).

4. **Assert category AND a promotion case, because severity is configurable and that IS the
   correctness surface.** The 81xx extended checks default to WARNING and only become errors
   under `strictTemplates` + `extendedDiagnostics.defaultCategory: "error"` (or per-check
   override) -- the repo proves this with `fixtures/extended-v13` (default warning) vs
   `fixtures/extended-promoted` (promoted to error), and `extended.promotion.integration.spec.ts`.
   For each extended diagnostic the suite should assert: (a) default `.category` ===
   `Warning` and it lands in `warningCount` not `errorCount` (the existing v13 idiom), and at
   least once globally (b) promotion to `Error` via `defaultCategory: "error"` moves it to
   `errorCount` WITHOUT changing the diagnostic count (the D-01 count invariant the repo
   already tests). The promotion case need not be repeated for all 18 -- one promoted fixture
   exercising the mechanism is enough, since promotion is config-driven and code-independent
   (CURRENT-AUDIT C confirms this generalizes). **CAVEAT I must flag (Frustrations directive):
   NG8011 and NG8021 are 80xx, not 81xx -- I have NOT verified they honor
   `defaultCategory` or what their default category is.** They may be hard errors. The suite
   must assert each one's ACTUAL observed default category (discovered empirically against the
   real compiler at implementation), not assume WARNING. This is the top FACTS-NEEDED item.

5. **A completeness tripwire derived from the enum -- the regression-detection payload.** This
   is the highest-leverage item from my lens and is ABSENT from all prior art. Add a spec that
   imports `ExtendedTemplateDiagnosticName` from `@angular/compiler-cli` at test time, and
   asserts `Object.values(ExtendedTemplateDiagnosticName).sort()` equals the set of `name`s the
   catalog table covers. When Angular 22.x/23 adds a 19th member (or renames one), this spec
   goes RED immediately with a located, named failure -- "the catalog is missing
   `<newName>`" -- instead of the suite silently staying green while a new diagnostic goes
   unasserted. This is the analogue of the existing `typecheck-drift` gate (which pins the
   `Program` type shape) but for the diagnostic NAME set, and the analogue of `schema-parity`
   (keys-equal-interface) but for enum-equals-catalog. It directly serves "detect regressions
   when Angular changes," which is half my lens. NOTE: `@angular/compiler-cli` is ESM, so this
   tripwire must `await import()` it (the integration tier already does), and it belongs in the
   `test` job (in-plugin spec, auto-covered, CURRENT-AUDIT A.4) so it runs on every PR across
   all 6 matrix cells -- meaning a contributor bumping the Angular peer sees the failure.

Factual basis (consolidated): the 18-member enum + code map (verified this session);
`result.diagnostics`/`errorCount`/`warningCount` already exposed (read `run-typecheck`
consumers + the v13 spec); committed-fixture substrate established (`git ls-files fixtures/`);
promotion mechanism already tested (`fixtures/extended-promoted` + promotion spec);
`typecheck-drift` + `schema-parity` precedents for contract-pinning tripwires (CURRENT-AUDIT
A.1, A.4).

Facts I am missing (orchestrator can verify against the real compiler at implementation):

- **The default `.category` and promotion behavior of NG8011 and NG8021** (the two 80xx
  members) -- are they WARNING-by-default and `defaultCategory`-promotable like the 81xx set,
  or hard errors? This determines their fixture's tsconfig and their assertion.
- **The exact minimal trigger for `controlFlowPreventingContentProjection` (8011)** -- the
  `error_code.d.ts` comment gives a multi-root-node `@if` projected at a component root; needs
  empirical confirmation it fires under a plain `strictTemplates` fixture.
- **Whether NG8112 (`unusedLetDeclaration`) requires any flag beyond `strictTemplates`** to
  emit (it is enum-listed but docs-absent).
- Which baseline NG codes from the catalog (NG2003/2005/2007/2009, NG1001, NG3003, NG6100,
  NG8002, NG8004) are reproducible from a single committed fixture vs need NgModule scaffolding
  (NG6100 needs a real `@NgModule({id: module.id})`).

What would change my position:

- If the orchestrator finds that several of the 18 are NOT reliably reproducible from a static
  committed fixture under Angular 22 (e.g. one needs a generated multi-project graph), I would
  move ONLY those to the e2e tier's programmatic-injection approach and keep the data-driven
  table for the rest -- I would not abandon the enum-keyed table.
- If `ExtendedTemplateDiagnosticName` turned out NOT to be importable at test time without
  pulling the full ESM compiler into the unit tier cheaply, I would still keep the tripwire but
  run it in the integration tier (it already `await import()`s the compiler), accepting the
  cost.

---

## D3 -- Executor-against-workspace test (mid-tier)

**Position (lens-scoped): from the diagnostic-correctness lens this mid-tier is OPTIONAL and
LOW priority -- it adds no diagnostic-detection coverage that the core integration tier and
the tarball e2e do not already provide. Do not let it absorb effort budgeted for the D2
catalog. If added for the OTHER lenses' reasons (path resolution, normalizeOptions against a
real project.json), it should NOT re-assert diagnostic codes -- diagnostic correctness belongs
at the core `runTypecheck` integration tier where the seam is cleanest.**

Factual basis:

- Diagnostic detection is fully exercised at the core tier: `runTypecheck({ tsConfigPath })`
  returns the diagnostics array, and the 11 integration specs assert against it directly
  (CURRENT-AUDIT A.1). The executor is a thin CJS adapter over that core (FACTS sec.2); it does
  not change which diagnostics the compiler emits.
- The gap CURRENT-AUDIT A.2 identifies for the mid-tier is `context.root`->`tsConfig` path
  resolution and `normalizeOptions` against a real target -- ORCHESTRATION concerns, not
  diagnostic-surface concerns. The published-id binding and the full on-disk path are already
  proven at the tarball e2e (`install-smoke`, `matrix-5types`).

Facts I am missing: none on my lens.

What would change my position: if the executor (not the core) were found to FILTER or
TRANSFORM the diagnostic set in a way the core specs don't see -- e.g. a boundary/dependency
filter or a `quiet`/errors-only mode applied in the adapter rather than the core. FACTS sec.2
says filtering lives in the core (`filter-diagnostics`, `evaluate-result`) and the executor
maps to `{ success }`, so this trigger is not currently active. If a v0.0.4 `quiet`-style mode
(CONNECT sec.4) lands in the executor, then a mid-tier test asserting "warnings suppressed but
errors still fail" becomes lens-relevant and I would want it -- with category-based assertions
(never message-string matching, per CONNECT sec.4c).

---

## D4 -- Generator e2e

**Position (lens-scoped): largely OUTSIDE my lens. From the correctness lens the ONLY thing a
generator e2e must prove is the closing-the-loop fact: the target the generator writes, when
RUN, actually surfaces an Angular template/extended diagnostic end-to-end (not just exit
non-zero). Recommend extending the EXISTING tarball harness with ONE such "generate target ->
run target -> a real NG diagnostic surfaces" smoke case, using a sentinel assertion on the
emitted diagnostic, rather than a new Verdaccio mechanism.**

Factual basis:

- The generator's value to a USER of a type-checker is that the wired target produces the
  correct diagnostics; an e2e that only asserts `project.json` shape (in-memory generator unit
  test territory) does not prove the wired tsConfig actually drives a real compiler run that
  catches a template error. The sandbox e2e proved this with a sentinel token in stdout
  (SANDBOX sec.6 scenario 3, sec.9 item 6) -- a robust cross-subprocess way to assert "the
  right diagnostic surfaced."
- The repo already has a tarball harness (`install-smoke` packs + installs + runs on a
  clean and an injected-error project, CURRENT-AUDIT A.1) and deliberately avoids Verdaccio
  (CURRENT-AUDIT B.3, with a Windows `execFileSync(nx)` caveat for the Verdaccio path).
  Reusing it keeps one e2e mechanism.

Facts I am missing: none on my lens. (Whether to add a NEW e2e project vs extend `install-e2e`
is a CI/ownership question -- D5 / the orchestrator.)

What would change my position: if the generator's wired tsConfig differs by project type in a
way that changes WHICH diagnostics are checked (e.g. an app `tsconfig.editor.json` with a
different `strictTemplates`/`extendedDiagnostics` block than a lib `tsconfig.lib.json` --
CONNECT sec.3b shows apps got an explicit strict editor tsconfig). Then I would want a
per-project-type e2e smoke that each wired config actually promotes/checks template diagnostics
as intended, because a generator that wires a tsConfig with `strictTemplates` OFF would silently
disable the entire extended-diagnostic surface -- a catastrophic correctness regression that
only an end-to-end run catches.

---

## D5 -- CI mapping

**Position: the D2 catalog specs and the completeness tripwire MUST run as in-plugin
`*.integration.spec.ts` / `*.spec.ts` under `packages/angular-typechecker/src/`, so they land
automatically in the existing 6-cell `test` matrix with NO ci.yml change and run on every
PR across all 6 OS/Node cells. The completeness tripwire in particular must run in `test`
(not `e2e`) so it fires on the cell that a contributor bumping the `@angular/compiler-cli`
peer will see. A generator e2e, IF a new project, must be added by NAME to the `e2e` job's
explicit `-p` list.**

Factual basis:

- CURRENT-AUDIT A.4 + the read `ci.yml`: the `test` job runs
  `npx nx run-many -t typecheck-drift test -p angular-typechecker` on
  `{ubuntu:22,24,26; windows:24,26; macos:24}`; any new in-plugin spec matching the vitest
  include glob runs there with no workflow edit. The `e2e` job runs an EXPLICIT project list
  (`-p angular-typechecker-install-e2e angular-typechecker-cache-e2e
angular-typechecker-matrix-e2e`), so a new e2e project is invisible until named (ci.yml lines
  141-143).
- Running the catalog across all 6 cells is correctness-valuable: Angular's
  template-type-check is pure JS/ngtsc (no native arch dependence), but ESM-loading the
  compiler via `await import()` is exactly the kind of thing that breaks on
  Windows-newest-Node (the matrix's stated rationale, ci.yml lines 73-83). A diagnostic that
  fails to surface because the compiler failed to load on one cell is a real regression the
  matrix catches.

Facts I am missing: the per-`it` time cost of running all 18 fixtures cold (each is a fresh
cold `performCompilation`; FACTS sec.3 notes the integration suite sets 30000ms timeouts).
Eighteen+ cold compilations x 6 cells could be the slowest part of `test`. The orchestrator can
measure; if it is a problem, fixtures that share a tsconfig/program could be batched into one
`runTypecheck` call asserting multiple codes from one result (the repo's `run-typecheck`
already returns ALL diagnostics in one pass -- the `ENG-02` "both errors in one run" case
proves a single compilation can carry multiple codes), cutting compilations dramatically.

What would change my position: if cold-compile cost made the full catalog infeasible in the
6-cell matrix, I would (a) batch multiple diagnostics per fixture/program to reduce
compilations, and only as a last resort (b) run the FULL catalog on the Linux/Node-24 cell and
a REDUCED smoke subset on the other 5 -- but I would keep the completeness tripwire on all 6
because it is cheap (it imports an enum and compares a set; no compilation).

---

## D6 -- Scope

**Position (lens-scoped): the diagnostic-completeness work (D2 -- assert all 18 enum members +
the baseline TS/NG catalog by exact code/category, plus the enum-derived completeness
tripwire) is the HIGHEST-VALUE item in this milestone from my lens and should be the scope
anchor -- it is the core promise of the tool ("the COMPLETE Angular type-check"). The
`typecheck-configuration` generator is a reasonable companion (it is the named milestone
scope and is genuinely small per prior art), but from the correctness lens it is SECONDARY and
must not crowd out the catalog. If the milestone must shed scope, shed generator e2e
sophistication (D4) and the mid-tier executor test (D3) before shedding any of the 18-member
catalog coverage.**

Factual basis:

- CURRENT-AUDIT A.3: today only **2 of the 16** documented extended diagnostics (NG8101,
  NG8109) are asserted by exact code; **14 are missing**, and 2 of the enum's 18 (NG8011,
  NG8021) are not even in the catalog's "documented" framing. For a tool whose Core Value
  (CLAUDE.md / PROJECT.md) is delivering the COMPLETE Angular diagnostic set, asserting only
  2/18 is the headline correctness gap. Closing it is the milestone's reason to exist from my
  lens.
- The generator is genuinely small (sandbox's is 33 lines, SANDBOX sec.1; CURRENT-AUDIT B.1
  gives the Nx 23 shape) and its testing is well-understood (in-memory tree, CURRENT-AUDIT
  recommendation), so it is low-risk to include -- but it adds ZERO diagnostic-surface
  coverage. Its correctness value is only realized via the D4 "generated target runs and
  surfaces a real diagnostic" loop.
- Versioning (FACTS sec.8): a `feat` (generator) and the `test` additions (catalog) both fit a
  single 0.0.3->0.0.4 patch bump; scope is not constrained by release mechanics.

Facts I am missing: the milestone's named-scope commitment strength -- whether
`typecheck-configuration` is a hard deliverable or a "if time permits." FACTS sec.1 says the
milestone scope IS "a `typecheck-configuration` generator plus testing work," which reads as
both being in-scope.

What would change my position: if the generator were on the critical path for the catalog
(e.g. if the catalog fixtures were to be GENERATED by the generator as in the sandbox's
dogfooding, SANDBOX sec.5/sec.9 item 3). They are not here -- the repo's catalog uses static
committed fixtures, so the generator and the catalog are independent and can be sequenced or
de-scoped independently.

---

## Summary of lens-critical asks (for the orchestrator)

1. Key the catalog taxonomy on the 18-member `ExtendedTemplateDiagnosticName` enum, NOT the
   "NG81xx" numeric pattern -- two members (NG8011, NG8021) are 80xx and a numeric filter drops
   them.
2. Add an enum-derived completeness tripwire (enum members === catalog rows) in the `test` job
   -- this is the regression-detection half of the lens and is absent from all prior art.
3. Verify the default category + promotion behavior of NG8011 and NG8021 empirically before
   writing their assertions; do not assume WARNING/promotable.
4. No new seam is needed for code/count assertions -- `runTypecheck` already returns
   `result.diagnostics` + counts; the v13 spec is the template to generalize.

---

POSITIONS
D1: Keep diagnostic correctness on the existing committed-fixture + real-`performCompilation` (`runTypecheck`) substrate; never assert a compiler diagnostic on any Tree/FsTree substrate; generator substrate is out-of-lens (defer, in-memory is fine).
D2: One data-driven table keyed on the 18 `ExtendedTemplateDiagnosticName` enum members (not NG81xx, not file-per-major), committed per-diagnostic fixtures, assert exact code + category + count + one promotion case, plus an enum-derived completeness tripwire; assert all 18 + baseline TS/NG codes.
D3: Mid-tier executor-against-workspace test is optional/low-priority on this lens and must not re-assert diagnostic codes (those stay at the core integration tier); add it only for orchestration coverage or a future executor-level quiet mode.
D4: Generator e2e is mostly out-of-lens; require exactly one "generate target -> run target -> a real NG diagnostic surfaces (sentinel assertion)" smoke case on the existing tarball harness, not Verdaccio.
D5: Catalog specs + completeness tripwire run as in-plugin specs in the existing 6-cell `test` matrix (no ci.yml edit); tripwire MUST be in `test` (cheap, fires on peer bumps); a new generator e2e project must be named in the `e2e` `-p` list; batch fixtures per program if cold-compile cost is high.
D6: The 18-member catalog completeness + tripwire is the scope anchor and highest-value item; the generator is a fine but SECONDARY companion; shed D4 sophistication and D3 before shedding any catalog coverage.
FACTS-NEEDED: default `.category` and `extendedDiagnostics.defaultCategory`-promotability of NG8011 (controlFlowPreventingContentProjection) and NG8021 (deferTriggerMisconfiguration) against the real Angular 22.0.4 compiler; minimal static-fixture reproducibility of all 18 members (esp. 8011 multi-root projection, 8112 unusedLetDeclaration flag requirements) and of the baseline NG codes (NG6100 NgModule scaffolding); cold-compile time cost of the full 18-fixture catalog x 6 matrix cells; whether `ExtendedTemplateDiagnosticName` is importable cheaply enough to run the completeness tripwire in the unit tier vs needing the integration tier's `await import()`.
WOULD-CHANGE-MIND: D1 -> a diagnostic only reproducible by generating a real Angular project (none found); D2 -> several of the 18 not reproducible from static committed fixtures under Angular 22 (move only those to programmatic injection, keep the enum table); D3 -> a v0.0.4 quiet/errors-only mode landing in the executor (then a category-based mid-tier suppression test becomes lens-relevant); D4 -> per-project-type wired tsConfigs differing in strictTemplates/extendedDiagnostics (then per-type e2e smokes proving each config still checks template diagnostics); D5 -> infeasible cold-compile cost (batch per program, then reduce per-cell catalog but keep tripwire on all cells); D6 -> the generator becoming critical-path for catalog fixtures (it is not; fixtures are static).
