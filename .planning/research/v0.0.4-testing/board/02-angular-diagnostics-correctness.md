# Board Member 02 -- Angular compiler correctness & diagnostics fidelity

LENS: The product IS correctness. A complete, faithful Angular type-check. I bias toward
COMPLETENESS and NEVER-SILENTLY-UNDER-ASSERTING. The 14-of-16 NG8xxx gap is the milestone's
real defect; the generator is supporting cast. Where the existing brief and I disagree on a
fact, I flag a DISSENT.

---

## NEW VERIFIED FINDING (load-bearing for D2/D6 -- the catalog count is WRONG)

I read the INSTALLED `@angular/compiler-cli@22.0.4` directly:
`node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name.d.ts`
declares `enum ExtendedTemplateDiagnosticName` with **18 entries** -- and
`.../error_code.d.ts` maps each to a code:

| #   | Name                                       | Code       |
| --- | ------------------------------------------ | ---------- |
| 1   | invalidBananaInBox                         | NG8101     |
| 2   | nullishCoalescingNotNullable               | NG8102     |
| 3   | optionalChainNotNullable                   | NG8107     |
| 4   | missingControlFlowDirective                | NG8103     |
| 5   | missingStructuralDirective                 | NG8116     |
| 6   | textAttributeNotBinding                    | NG8104     |
| 7   | uninvokedFunctionInEventBinding            | NG8111     |
| 8   | missingNgForOfLet                          | NG8105     |
| 9   | suffixNotSupported                         | NG8106     |
| 10  | skipHydrationNotStatic                     | NG8108     |
| 11  | interpolatedSignalNotInvoked               | NG8109     |
| 12  | **controlFlowPreventingContentProjection** | **NG8011** |
| 13  | **unusedLetDeclaration**                   | **NG8112** |
| 14  | uninvokedTrackFunction                     | NG8115     |
| 15  | unusedStandaloneImports                    | NG8113     |
| 16  | unparenthesizedNullishCoalescing           | NG8114     |
| 17  | uninvokedFunctionInTextInterpolation       | NG8117     |
| 18  | deferTriggerMisconfiguration               | NG8021     |

`UNSUPPORTED_INITIALIZER_API_USAGE = 8110` exists in `ErrorCode` but is NOT in the enum, so it
is NOT a user-configurable extended diagnostic -- correctly excluded.

**Consequence:** DIAGNOSTIC-CATALOG.md asserts "16 documented" and explicitly calls
`NG8112 = UNUSED_LET_DECLARATION` an "undocumented compiler diagnostic." That is FALSE against
the installed compiler: NG8112 (and NG8011) ARE in the public `ExtendedTemplateDiagnosticName`
enum -- they are the SAME class of configurable extended diagnostic as the other 16, just
absent from the angular.dev docs page. **The faithful set of extended diagnostics the engine
must assert is 18, not 16.** A correctness tool keyed to the docs page (16) under-asserts by 2
relative to the compiler's own configurable surface. This is exactly the "docs lag the
compiler" trap the catalog warned about for the introduction-version column -- it bit the
COUNT too. DISSENT recorded under D2.

---

## D1 -- SUBSTRATE per tier (diagnostic tiers are my concern; generator substrate I defer)

**Recommendation (diagnostic tiers):** Keep the EXISTING real-compiler integration substrate
unchanged -- committed `fixtures/<scenario>/` directories + leaf tsconfig + `runTypecheck({ tsConfigPath })`
returning the structured `CoreResult` (`diagnostics`, `errorCount`, `warningCount`,
`suppressedCount`). This is the only substrate that produces FAITHFUL diagnostics: it runs the
real `performCompilation` + the unconditional all-getter gatherer against real `.ts`/`.html` on
disk, which is what `@angular/build` does. Do NOT move NG8xxx assertions to an in-memory Tree
or to mocked `ts.Program` stubs -- those cannot emit a real NG8xxx and would assert nothing
about compiler fidelity.

**On generator substrate (deferring to the substrate-lens members, but with one correctness
caveat):** I have NO correctness stake in whether the generator unit test uses in-memory
`createTreeWithEmptyWorkspace` or the bespoke real-disk `createFsTree`. The generator emits
config, not diagnostics. BUT -- the bespoke `createFsTree` earns its keep at exactly ONE
correctness-relevant point: a test that flushes the generator's emitted tsconfig to a temp
dir and then runs the REAL type-check against it, proving "the config this generator writes
produces a runnable, correct Angular type-check." That is a fidelity proof in-memory cannot
give. If the board adopts the in-memory default (CURRENT-AUDIT recommends it), the generated
config's runnability MUST be proven at the generator-e2e tier instead (D4) -- it cannot be
silently dropped. RISK if neither tier proves it: the generator could wire a tsConfig that the
executor cannot actually type-check, and no test would catch it.

DISSENT (mild): PROJECT.md line 34 says "default leans real-disk wrapper to stay faithful to
the prior art." Faithfulness-to-prior-art is not a correctness argument; the only correctness
argument for real-disk is the flush-then-typecheck proof above. If that proof lives at the
e2e tier, the in-memory default is correct and the real-disk wrapper is optional. Do not author
the quarantined deep-import + drift tripwire purely to honor a prior-art aesthetic.

---

## D2 -- NG8xxx CATALOG (MY CORE DECISION)

### Organization: data-driven `it.each` table, NOT per-version drop-in files

**Recommendation: a SINGLE data-driven table keyed on the 18 extended codes (plus the
baseline NG/TS codes in a sibling table), iterated with `it.each`, NOT one `it` per
hand-written file.** The catalog and sandbox prescribe per-introduction-version files
(`extended.angularNN.integration.spec.ts`); I dissent on that being the right ASSERTION
structure, while keeping the introduction-version as a DATA COLUMN.

Rationale (correctness-first):

- **A table makes under-assertion structurally impossible to hide.** With a single
  `EXTENDED_DIAGNOSTICS` array of `{ code, name, introduced, fixture, defaultCategory }`,
  the suite count equals the array length. If a code is missing from the array, that is a
  one-line, reviewable omission -- not a missing file nobody notices. The current state (2 of
  16 asserted, scaffold "exists but unpopulated beyond v13") is the FAILURE MODE of the
  per-file approach: the structure existed and stayed empty for an entire milestone.
- **The introduction version is metadata, not a test-file boundary.** All 18 run on Angular 22. The catalog itself says the version split is "a coverage taxonomy, not a multi-version
  test matrix." A taxonomy belongs in a data column (`introduced: 'v14'`), surfaced in the
  `it.each` title (`'NG%s (%s, introduced %s)'`), not in nine sparsely-populated files where
  14 of them would have one `it` each.
- **Future-major drop-in becomes a DATA edit, not a new file.** Adding Angular 23's new
  extended diagnostic = append one row to the array + add one fixture. The drift-hardening
  test (below) then FORCES that append to happen (the test goes red until the row exists). A
  new-file convention has no such forcing function.

DISSENT (explicit, vs DIAGNOSTIC-CATALOG.md:60-62, SANDBOX-TECHNIQUES.md, and PROJECT.md:36
which all prescribe the per-version file split): I recommend the data-driven table instead.
The per-version split is defensible for human readability and matches the existing
`extended.angular13.integration.spec.ts` naming, so this is a genuine board disagreement to
synthesize, not a clear error. Compromise that preserves both: ONE file
`extended-catalog.integration.spec.ts` containing the `it.each` table, with the introduction
version in each row + test title -- you get the taxonomy in the output AND the
completeness-by-construction of a table. Keep the existing `baseline.angular13` /
`extended.angular13` files as-is or fold them in; do NOT create `angular14..angular22` empty
shells.

### How to assert each diagnostic: code + category + count + promotion

The repo's existing idiom is already correct and faithful (verified in
`extended.angular13.integration.spec.ts` and `extended.promotion.integration.spec.ts`). Keep
it and apply it to all 18. For each extended code, assert ALL of:

1. **Presence by EXACT code via `NG()`** -- `result.diagnostics.find(d => d.code === NG(8102))`
   `.toBeDefined()`. NEVER the bare positive code (the `NG()` negative-encoding helper exists
   precisely because `8102` would never match `-998102`; this is L-4 / Pitfall E).
2. **Category** -- `expect(diag.category).toBe(ts.DiagnosticCategory.Warning)` in the default
   fixture; `ts.DiagnosticCategory.Error` in the promoted fixture. Category is the severity
   contract; assert it explicitly, never infer it from the code sign.
3. **Count** -- assert the code appears the EXPECTED number of times (usually exactly 1 in a
   minimal fixture): `expect(result.diagnostics.filter(d => d.code === NG(8102)).length).toBe(1)`.
   Count matters because a fixture that accidentally triggers the same check twice (or a
   neighboring check) would otherwise pass a `.find`-only assertion while misrepresenting the
   engine. Also keep the D-01 invariant `errorCount + warningCount <= diagnostics.length`.
4. **Promotion works** -- for the extended set, prove `extendedDiagnostics.defaultCategory:
"error"` flips the SAME code from Warning into `errorCount`. The existing promotion spec
   proves this for NG8101 only and notes it is VERSION-INDEPENDENT. Generalize it: a second
   `it.each` row-set over the same fixtures with the promoted tsconfig, asserting each code
   now lands in `errorCount`. This is the load-bearing severity test -- it proves the engine
   honors the consumer's category config, which is the whole point of "complete and faithful."

### Committed fixtures vs programmatic injection: COMMITTED fixtures, one per diagnostic

\*\*Recommendation: committed `fixtures/extended-catalog/<code>/` (a component `.ts` + `.html`

- leaf tsconfig per code), NOT jscodeshift/programmatic injection.\*_ This is where I diverge
  from the sandbox's `inject_` AST-mutation toolkit.

Rationale (correctness-first):

- The repo ALREADY uses committed fixtures (`fixtures/extended-v13/`,
  `fixtures/extended-promoted/`, `ts-baseline`, `ng-baseline`, ...) and `TESTING.md` documents
  this as the established substrate. Consistency matters; do not introduce a second fixture
  mechanism.
- **A committed fixture is the authoritative, reviewable specification of "what triggers
  NG8102."** When a reviewer or a future maintainer asks "does this minimal template really
  trigger only NG8102 and nothing else?", they read one small committed file. A jscodeshift
  injector hides the triggering shape behind AST-manipulation code that itself can drift and
  can accidentally trigger neighboring checks.
- Programmatic injection's value (per CONNECT/SANDBOX) is for GENERATING dozens of throwaway
  workspace fixtures at e2e time. For the integration tier, where each fixture is tiny and
  permanent, committed wins on auditability -- and auditability IS correctness for a tool
  whose product is correctness.

Reuse the TWO tsconfig variants the repo already has: each `fixtures/extended-catalog/<code>/`
needs a `tsconfig.warning.json` (`strictTemplates: true`, no `defaultCategory` -> default
category) AND the catalog table points the promotion rows at a `tsconfig.error.json`
(`extendedDiagnostics.defaultCategory: "error"`). Mirror `extended-v13` (warning) and
`extended-promoted` (error). NG8021 and NG8011 may need their own minimal `@defer` /
content-projection shapes.

RISK: committed fixtures can drift out of triggering their target code across an Angular
upgrade (a template that triggered NG8105 in v22 might stop in v23). MITIGATION: the count
assertion (exactly-1) + the drift-hardening test below turn "fixture stopped triggering" into
a red test, not a silent pass. This is acceptable and self-correcting.

### Drift-harden the code/category encoding (MY strongest recommendation)

The existing `compiler-cli-types.drift.ts` pins the GETTER SET and the `UNKNOWN_ERROR_CODE` /
`EmitFlags` values, but pins NOTHING about the extended-diagnostic code/name set. **Add a
drift tripwire on the extended-diagnostic catalog itself** so an Angular upgrade that adds,
removes, renames, or renumbers an extended diagnostic fails LOUDLY instead of silently
under-asserting. Two complementary layers:

1. **Build-time enum pin (preferred, in the existing `typecheck-drift` target).** The
   `ExtendedTemplateDiagnosticName` enum lives at the deep path
   `@angular/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name`, and
   `tsconfig.drift.json` already uses classic `moduleResolution: node` (which can reach deep
   paths -- it is how the drift file imports the real barrel today). Add a type-level pin in
   `compiler-cli-types.drift.ts` (or a sibling drift file) that asserts the enum still has
   EXACTLY the 18 members the catalog table covers, mapped to their exact codes. If Angular
   23 adds a 19th, the pin goes red on `nx build` -- forcing the catalog table to grow before
   the build is green. This is the SAME pattern HARD-05 already established for the getter set;
   extend it to the diagnostic set.
2. **Runtime catalog-completeness spec (`it.each` self-check).** A small spec that imports the
   `EXTENDED_DIAGNOSTICS` table and asserts: (a) every `ExtendedTemplateDiagnosticName` enum
   value has a matching row (no enum member is un-covered), and (b) every row's code matches
   the compiler's `ErrorCode` for that name. If the enum is reachable at runtime under the
   spec's nodenext resolution (it is a deep import; verify), this is the cleaner tripwire; if
   not, the build-time pin (layer 1) is the fallback and is sufficient on its own.

This is the single most important correctness deliverable of the milestone after the 14/16(/18)
gap itself: it converts "we asserted the right codes once" into "we CANNOT silently stop
asserting the right codes on an Angular upgrade."

RISK: deep-import drift (the enum path could move in a future Angular). MITIGATION: same
quarantine posture as the existing drift file -- it is build-time-only, never ships, and a
moved path fails `nx build` loudly (which is the desired alarm, not a hidden break).

---

## D3 -- IN-MEMORY EXECUTOR VARIANT: low correctness value; thin gap-fill at best

**Recommendation: NOT a correctness priority. Add it only as a thin mid-tier seam test, and
do NOT let it consume effort that belongs to the NG8xxx gap.** The executor's adapter
composition is already unit-tested (mocked seams) and its real behavior is proven at the
real-compiler integration tier (`runTypecheck` directly) and the tarball e2e tier. A
`createTreeWithEmptyWorkspace`-seeded executor test would cover `context.root` -> `tsConfig`
path resolution and `normalizeOptions` against a real `project.json` -- genuinely a gap
(CURRENT-AUDIT A.2), but a PATH-RESOLUTION gap, not a DIAGNOSTIC-FIDELITY gap. It asserts
nothing about whether the compiler emits the right codes.

From my lens it is redundant for correctness: the integration tier already proves the
diagnostics, and the e2e tier already proves `context.root` resolution end-to-end. RISK of
skipping: none for diagnostic fidelity; a minor path-resolution regression could slip to the
e2e tier instead of being caught mid-tier (acceptable -- e2e catches it). If the
substrate-lens members want it for the generator's sake, fine, but it is not on my critical
path.

---

## D4 -- GENERATOR E2E: extend the existing tarball harness; assert the wired config RUNS

**Recommendation: extend the EXISTING `npm pack` + tmp-install harness
(`install-smoke.int.spec.ts` pattern), NOT Verdaccio.** This is outside my core lens, but I
have one correctness REQUIREMENT for whichever harness wins: the generator e2e MUST prove not
just that the target was WRITTEN, but that `nx run <proj>:angular-typecheck` then RUNS and
returns the correct verdict on (a) a clean project (exit 0) and (b) a project with a planted
diagnostic (non-zero + the code surfaces). The sandbox's e2e did exactly this with a
sentinel-token stdout assertion proving the diagnostic TEXT reached the user. Carry that: a
generator that writes a syntactically-valid but semantically-wrong tsConfig (e.g. points at a
tsconfig the executor cannot consume) is a correctness defect only the run-it assertion
catches. Reuse over Verdaccio keeps ONE e2e mechanism (the repo already rejected Verdaccio,
and the Windows `execFileSync(nx)` Verdaccio caveat reinforces it).

---

## D5 -- CI JOBS: zero new diagnostic-fidelity wiring needed; keep single required check

**Recommendation: keep the single required `ci` aggregate; the NG8xxx catalog specs need NO
ci.yml change.** Per CURRENT-AUDIT A.4, in-plugin `*.integration.spec.ts` files land
automatically in the 6-cell `test` matrix glob the moment they exist -- so the entire NG8xxx
catalog (18 extended + baseline) runs on Node 22/24/26 x 3 OS for free. That cross-OS
execution is itself a correctness asset: it proves the diagnostic set is stable across
platforms (the repo's recurring Windows-arm64 concerns).

Two CI requirements from my lens:

- **The new extended-catalog drift tripwire (D2 layer 1) MUST run in CI.** It belongs in the
  existing `typecheck-drift` target (already in the `test` job's run-many). If it lives in a
  new drift file, add that file's path to the `typecheck-drift` target `inputs` (project.json
  ~48-55), mirroring the existing drift input wiring.
- **Generator e2e (if a new Nx project) MUST be added by NAME to the `e2e` job's explicit
  `-p` list** (ci.yml ~142-143) or it is invisible to CI. Platform: Linux-only is fine for the
  generator e2e (matches the existing e2e posture); the DIAGNOSTIC catalog already gets the
  cross-OS coverage in the `test` matrix, which is where platform-fidelity matters.

No dissent. Single required check stays; this is the right least-surprise wiring.

---

## D6 -- SCOPE/RISK: close the diagnostic gap first; the generator is a real deliverable but a

secondary one

**The generator is NOT a distraction -- but it is NOT the correctness work either, and the
milestone framing risks inverting the priority.** PROJECT.md frames v0.0.4 as "the generator

- adopt the testing-technique stack," using the generator as "the vehicle for the missing
  FsTree generator-testing technique." From my lens that is backwards in EMPHASIS: the generator
  is a small, well-understood 33-line config-edit (the sandbox proves it); the
  NEVER-SILENTLY-UNDER-ASSERTING correctness gap (currently 2 of 16, truly 2 of 18 extended +
  ~2 of ~11 baseline NG codes asserted against the real compiler) is the milestone's real
  defect. A "complete, faithful Angular type-check" tool that asserts only 2 of its 18
  configurable extended diagnostics is not yet proven complete.

**Minimal strategy that closes the gap WITHOUT over-engineering:**

1. ONE `extended-catalog.integration.spec.ts` with an `it.each` table over all 18 extended
   codes -- code + category + count, default-category rows + promoted rows. (Closes the 14/16,
   really 16/18, gap.)
2. ONE committed `fixtures/extended-catalog/<code>/` per code (tiny component + template +
   two tsconfigs reused across the table). (The fixture substrate; no new mechanism.)
3. Extend `baseline.angular13.integration.spec.ts` (or a `baseline-catalog` table) to assert
   the real-compiler-emitted baseline NG codes the catalog lists that are currently
   unasserted (NG2003/2005/2007/2009, NG1001, NG3003, NG6100, NG8002, NG8004) -- code +
   category. (Closes the baseline gap.)
4. ONE drift tripwire pinning the `ExtendedTemplateDiagnosticName` enum -> code set, in the
   existing `typecheck-drift` target. (Makes the catalog self-defending against Angular
   upgrades.)

**Over-engineering to AVOID:** a jscodeshift injection toolkit (the repo uses committed
fixtures -- do not add a second mechanism); nine sparsely-populated per-version files (use one
table); a bespoke real-disk `createFsTree` authored solely to honor prior-art aesthetics when
the generated-config-runs proof can live at the e2e tier; chasing the in-memory executor
variant as if it were correctness work.

**Biggest RISK:** the milestone ships the generator + the FsTree utilities + generator tests
(all the "vehicle" work), declares victory, and the 18-code catalog table slips because it was
framed as one of several "testing gaps" rather than THE deliverable. The generator could be
cut to a follow-up milestone and the milestone would still deliver its core value (a complete
faithful type-check, proven); the catalog cannot be cut without the tool remaining unproven on
its central promise. Sequence the catalog table + drift pin FIRST.

---

## Recommended strategy (this lens)

Treat the COMPLETE extended-diagnostic catalog as the milestone's primary deliverable, not one
testing gap among many. Build ONE data-driven `extended-catalog.integration.spec.ts` that
iterates an `EXTENDED_DIAGNOSTICS` table over all **18** configurable extended diagnostics
(the installed `ExtendedTemplateDiagnosticName` enum -- NG8011 and NG8112 included, contra the
catalog's "16"), asserting each by exact `NG()`-encoded code, by `ts.DiagnosticCategory`
(Warning by default; Error under `defaultCategory: "error"` promotion), and by exact count,
upholding the D-01 invariant -- reusing the repo's existing committed-fixture +
structured-`CoreResult` substrate, NOT a new jscodeshift mechanism and NOT nine sparse
per-version files. Add a sibling baseline table for the unasserted baseline NG codes. Then
DRIFT-HARDEN the catalog itself: pin the `ExtendedTemplateDiagnosticName` enum -> code mapping
in the existing build-time `typecheck-drift` target so any Angular upgrade that adds, removes,
renames, or renumbers a diagnostic fails CI loudly and forces the table to grow -- converting
"asserted once" into "cannot silently stop asserting." The generator, its FsTree substrate,
and the in-memory executor variant are real but SECONDARY; the generator's only correctness
obligation is a generator-e2e assertion that the wired target actually RUNS and surfaces the
right verdict (clean -> 0, planted error -> non-zero + code visible), reusing the existing
tarball harness. The CI single-required-check posture is already correct; the catalog rides
the existing cross-OS `test` matrix for free, and only the new e2e project (if any) + the new
drift input need explicit wiring.

---

## Top 3 priorities (this lens)

1. **Close the extended-diagnostic gap completely -- assert all 18 (not 16) configurable
   extended diagnostics by exact code + category + count, with default-category AND promoted
   rows, via one data-driven `it.each` table on committed fixtures.** This is THE milestone
   correctness deliverable.
2. **Drift-harden the catalog: pin `ExtendedTemplateDiagnosticName` enum -> code set in the
   existing `typecheck-drift` build-time target** so an Angular upgrade that changes the
   diagnostic surface fails loudly and forces the table to grow -- never-silently-under-assert,
   enforced by construction.
3. **Correct the catalog's count from 16 to 18 (NG8011 controlFlowPreventingContentProjection,
   NG8112 unusedLetDeclaration are in the installed public enum) and close the baseline NG-code
   gap** (NG2003/2005/2007/2009/1001/3003/6100/8002/8004) by exact code + category against the
   real compiler.
