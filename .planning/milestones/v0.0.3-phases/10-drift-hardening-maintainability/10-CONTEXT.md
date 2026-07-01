# Phase 10: Drift-hardening & Maintainability - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning
**Mode:** `--analyze --auto --chain` (phase-specific research performed before gray-area analysis; `--research` to be passed to plan-phase). The central HARD-01 decision was escalated out of `--auto` (HIGH-impact + initially LOW-confidence on intent) and resolved via web + GitHub prior-art research, an npm dev-dependency survey, and a 5-member Opus advisory board, then user-confirmed.

<domain>
## Phase Boundary

Make an Angular upgrade that changes the `api.Program` getter set, the `EmitFlags`
enum, or the NG error-code encoding break `nx`/CI **LOUDLY** (a build/CI failure)
instead of silently under-gathering -- and make every vendored-shim divergence
documented and greppable. Covers HARD-01..HARD-05 against the EXISTING vendored
`compiler-cli-types.ts` shim + the gatherer the COR/RES work leaves in place.

In scope (HOW to implement the five scoped HARD requirements): (HARD-01) a build-time
`tsconfig.drift.json` + `typecheck-drift` CI target asserting the shim stays
assignable FROM the real `api.Program`, plus a runtime getter-set/encoding spec;
(HARD-02) correct the fabricated `EmitFlags.None`; (HARD-03) greppable vendor markers;
(HARD-04) retain the no-op-tolerant `getNgStructuralDiagnostics()` under the assertion;
(HARD-05) a TS-99-leak regression spec. NO `NgtscProgram` migration. NO new executor
option or feature surface. Verified against stable Angular 22.0.4 only.

This is HOW to implement what is already scoped; it adds no new capabilities. The
engine is complete and faithful to `@angular/build` at 22.0.4 -- this is maintainability
hardening only.
</domain>

<decisions>
## Implementation Decisions

### HARD-01 -- the drift tripwire (board-deliberated; user-confirmed)

- **D-01 (SCOPE = `real -> shim` ProbeOnly type-gate; NOT exhaustiveness):** The
  build-time check asserts the real `@angular/compiler-cli` `api.Program` is assignable
  TO the hand-written shim `Program` (the shim is the FIXED spec; the real type is
  checked AGAINST it). This catches a REMOVED / renamed / signature-changed getter
  LOUDLY. A newly-ADDED upstream getter is intentionally NOT a build failure -- the shim
  is a deliberate subset; additions are covered out-of-band by the runtime spec (D-04).
  **AlsoAdditions / exhaustiveness (`Exclude<keyof>` or exact-equality) was REJECTED by
  all 5 board members:** a plain probe structurally cannot catch additions (TS width
  subtyping, empirically confirmed @ tsc 6.0.3); forcing it fires on every benign Angular
  minor AND hits the index-signature gotcha; and there is ZERO public prior art for
  exhaustiveness against a vendored FOREIGN subset (web + GitHub research).
- **D-02 (CONSTRUCTION = hand-written shim + per-member probe; NOT `Pick`-derived):**
  Keep the hand-written `compiler-cli-types.ts` as production source of truth. Write the
  assertion as a per-member TUPLE OF PAIRS (one assignability assertion per called
  getter), NOT a single whole-object assignment, so HARD-04's "retained and covered" is
  literally checkable with a precise failure site. **`Pick<api.Program, ...>`-derivation
  was REJECTED:** a `Pick` AUTO-TRACKS upstream (a removed getter silently resolves to
  fewer keys instead of breaking -- a follower, not a tripwire), AND is mechanically
  unavailable here (Pick needs the real type, which only resolves under the classic-node
  drift tsconfig, never the production `nodenext` build that ships the shim). The
  asymmetry (shim fixed, real checked against it) IS the alarm.
- **D-03 (TOOLING = PlainTS; ZERO new dev dependency):** Use a one-line
  `type AssertAssignable<From, To extends From> = true;` helper + the tuple of pairs +
  the call-site probes (D-05). `expect-type` (already transitive via Vitest 4.1.9 ->
  `expect-type@1.4.0`, runs under our TS 6) was the board's CLOSEST call (2/5) and is
  defensible for readability, but at ~7 one-shot assertions it earns nothing and would
  add a `@nx/dependency-checks`-policed direct devDep + a runtime import in the drift
  file. **`tsd` REJECTED** (bundles its own `@tsd/typescript@5.9` -> assertions would run
  under TS 5.9, not our TS 6.0.3, defeating drift fidelity). `ts-expect` (2021) /
  `conditional-type-checks` (2022) stale.
- **D-04 (ADDITIONS + RUNTIME-DRIFT compensating control = a runtime Vitest spec; NOT
  api-extractor):** A lightweight spec runs against the REAL
  `await import('@angular/compiler-cli')` surface (the executor's actual load path) and
  asserts: (a) the `api.Program` getter set equals a frozen expected set of the gathered
  getters -- so a NEW or renamed getter fails LOUDLY, forcing a "do we now miss
  diagnostics?" review (this is the cheap, in-suite closure of the ProbeOnly additions
  blind-spot); (b) the encoding mirror: `NG(8001) === ngErrorCode(8001) === -998101`-style
  round-trip and `UNKNOWN_ERROR_CODE === 500`. This ALSO closes runtime-semantic drift
  that NO type check can catch (the `ngErrorCode` arithmetic / the `-99` encoding that
  `diagnostic-codes.ts` reimplements as `NG(code) = -990000 - code`).
  **A committed `@microsoft/api-extractor` `.api.md` report-diff was REJECTED** as
  disproportionate / scope-creep for this milestone (board 3/5): a sizable new tool + a
  per-bump regen/review ritual to guard a low-probability event.
- **D-05 (type-system traps the probe MUST handle -- empirically verified @ tsc 6.0.3):**
  - **`optional -> required` param change is SILENT** under assignability (method-param
    bivariance + arity tolerance). The shim's `getNgSemanticDiagnostics(fileName?)` and
    `getNgStructuralDiagnostics(cancellationToken?)` would stay GREEN if Angular made a
    param required while the gatherer's call breaks. MITIGATION: add CALL-SITE probes
    invoking each getter at the EXACT arity the gatherer uses (`real.getNgSemanticDiagnostics()`
    no-arg AND `real.getNgSemanticDiagnostics('x.ts')`, `real.getNgStructuralDiagnostics()`).
  - **`getGlobalDiagnostics` lives on `ts.Program`** (the `TsProgram = ts.Program & {
useCaseSensitiveFileNames() }` intersection), NOT `api.Program`. A Program-level probe
    misses it; cover it with a call-site probe `real.getTsProgram().getGlobalDiagnostics()`.
  - Returns stay `readonly ts.Diagnostic[]` (real returns readonly; readonly->mutable
    ERRORS, mutable->readonly is safe). The shim already declares readonly -- keep it.
  - Value-level constants need their OWN assertions (not members of `api.Program`):
    `const _: 500 = UNKNOWN_ERROR_CODE` and the `EmitFlags` member assertions.
- **D-06 (WIRING):** Drift file at
  `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts` (co-located with the
  shim). `packages/angular-typechecker/tsconfig.drift.json`: classic `module` +
  `moduleResolution: node` (which IGNORES the package `exports` map and DOES resolve the
  real barrel's extensionless `export *` chains -- the exact reason the production
  `nodenext` shim has to exist), `noEmit: true`, `include` ONLY the drift file, extends
  `tsconfig.base.json` (already classic node). Exclude `*.drift.ts` from `tsconfig.lib.json`
  so it NEVER ships. `typecheck-drift` target via `nx:run-commands` running
  `tsc --noEmit -p packages/angular-typechecker/tsconfig.drift.json` (NOT `@nx/js:tsc` --
  this is a check, not a build; it emits nothing and needs the distinct classic-node
  resolution). Add `typecheck-drift` to `ci.yml`; it is OS-independent (depends only on the
  installed compiler-cli), so a single invocation suffices (fold into the existing
  `nx run-many` or a dedicated lean step -- Claude's discretion).
- **D-07 (REQUIREMENT-WORDING FIX -- flag for the planner + code-review gate):** HARD-01's
  acceptance text says BOTH "a new OR removed diagnostic getter breaks the build" AND
  "real->shim direction only (deliberate subset)" -- internally contradictory (real->shim
  cannot break on a NEW getter). Minimal correction the planner should apply when (re)writing
  the requirement / Success Criterion 1 so the deliverable is not measured against an
  impossible criterion: _"a REMOVED, renamed, or signature-changed diagnostic getter (among
  the getters we call) breaks the build via the real->shim assignability assertion;
  newly-ADDED upstream getters are intentionally NOT a build failure (deliberate subset) and
  are surfaced instead by the runtime getter-set spec."_ (Per AGENTS.md, a REQUIREMENTS/SC
  wording change is code-reviewed -- the `code_review_gate` satisfies this.)

### HARD-02 -- EmitFlags.None correction

- **D-08:** The real `@angular/compiler-cli@22.0.4` `EmitFlags`
  (`src/transformers/api.d.ts:74`) has **NO `None` member**; members are `DTS=1, JS=2,
Metadata=4, I18nBundle=8, Codegen=16, Default=19, All=31` (verified against the installed
  package). Correct the shim's fabricated `None = 0` by MIRRORING the real members verbatim
  (most faithful; stays correct if the drift assertion covers `EmitFlags`) and DROP the fake
  `None`. KEEP the `emitFlags: 0` call site as a DOCUMENTED literal -- numeric-enum looseness
  makes `0` assignable to the `EmitFlags` type even without a `None` member, and `0` =
  "emit nothing", semantically correct under `noEmit: true`. Add a value-level drift
  assertion for the `EmitFlags` members the engine relies on.

### HARD-03 -- greppable vendor markers

- **D-09:** Add the greppable `// angular-typechecker: vendored -- <reason>` marker (the
  Prettier `angular-estree-parser` idiom; already used at `diagnostic-codes.ts:56`) to EACH
  distinct narrowed/fabricated construct in `compiler-cli-types.ts`: the `Program` subset
  interface, the `TsProgram` intersection, the `EmitFlags` mirrored enum, the
  `UNKNOWN_ERROR_CODE` literal, the deliberately-non-optional `PerformCompilationResult.program`,
  and the `ParsedConfiguration` subset. A single `git grep "angular-typechecker: vendored"`
  must enumerate every divergence. (The file already carries rich WHY-comments; this adds the
  consistent greppable marker line.)

### HARD-04 -- retain getNgStructuralDiagnostics

- **D-10:** KEEP the `getNgStructuralDiagnostics()` call in the gatherer
  (`gather-diagnostics.ts:66`), documented as a deliberately forward-compatible,
  no-op-tolerant call. It is one of the called getters covered by the HARD-01 per-member
  probe (D-02) AND by the runtime getter-set spec (D-04), so a future Angular that
  REACTIVATES it (returns diagnostics again) cannot silently under-gather. No code change
  beyond the documenting comment + ensuring it is in the asserted set.

### HARD-05 -- TS-99 leak regression spec

- **D-11:** An INTEGRATION-tier spec (MUST use the REAL compiler-cli `formatDiagnostics` --
  the `TS-99 -> NG` rewrite is Angular's `replaceTsWithNgInErrors`, NOT ours; a unit fake
  would not exercise it). Feed a real NG8xxx-producing fixture's diagnostics through
  `formatReport(..., { color: false })` (the ANSI-stripped path, `format-report.ts:82`) and
  assert the output CONTAINS `NG####` and contains NO `TS-99` substring (a raw,
  un-rewritten negative NG code). Can extend the existing `extended.*.integration.spec.ts` /
  `format-report` coverage; follow the existing co-location convention.

### Claude's Discretion

- Exact tuple/helper structure in the drift file; whether the call-site probes sit in the
  same drift file or a sibling; the precise representation of the frozen getter set in the
  runtime spec (array of names vs typed tuple).
- Fixture mechanics for the HARD-05 NG8xxx integration fixture and the HARD-02 `EmitFlags`
  assertion.
- Whether `typecheck-drift` is a standalone CI step or folded into the existing
  `nx run-many` target list (OS-independent either way).
- Exact marker-comment wording per construct (must contain the literal
  `angular-typechecker: vendored` token).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements / roadmap

- `.planning/REQUIREMENTS.md` -- HARD-01..HARD-05 (note D-07: HARD-01 wording needs the
  contradiction fix when (re)writing the requirement/SC text).
- `.planning/ROADMAP.md` -- Phase 10 goal + Success Criteria 1-5 (SC1 = drift tripwire;
  SC2 = EmitFlags; SC3 = vendor markers; SC4 = retained `getNgStructuralDiagnostics`;
  SC5 = TS-99 regression spec).

### Engine source (the exact edit points)

- `packages/angular-typechecker/src/core/compiler-cli-types.ts` -- the vendored shim
  HARD-01/02/03/04 act on: the `Program` interface (`:57-80`, the 7 called getters incl.
  `getNgStructuralDiagnostics` `:73-75`), the `TsProgram` intersection (`:45-47`), the
  fabricated `EmitFlags.None = 0` (`:89-91`, HARD-02), `UNKNOWN_ERROR_CODE = 500` (`:100`),
  the non-optional `PerformCompilationResult.program` (`:143-146`).
- `packages/angular-typechecker/src/core/gather-diagnostics.ts` -- the gathered getter
  SET the HARD-01 assertion + the runtime spec must cover: 6 getters + per-file
  `getNgSemanticDiagnostics(fileName)` loop (`:62-78`) + `getTsProgram().getGlobalDiagnostics()`
  (`:80`, the `ts.Program`-side call). `getNgStructuralDiagnostics()` retained at `:66`.
- `packages/angular-typechecker/src/core/format-report.ts` -- the `color:false` ANSI-strip
  path (`:82`) and the injected real `ng.formatDiagnostics` (`:80`) HARD-05 exercises.
- `packages/angular-typechecker/src/core/diagnostic-codes.ts` -- `NG()`/`ngCodeOf()` the
  `-99` encoding mirror (`:39`,`:50`) the runtime encoding assertion (D-04) pins against the
  real `ngErrorCode`; the existing vendor marker (`:56`) is the HARD-03 idiom template.
- `packages/angular-typechecker/tsconfig.json` (production: `nodenext`, `:4-5`) +
  `tsconfig.lib.json` (ship/exclude list) + `tsconfig.base.json` (classic
  `moduleResolution: node`, `:7`) -- the drift tsconfig extends BASE, not the package
  `tsconfig.json`; exclude `*.drift.ts` from `tsconfig.lib.json`.
- `packages/angular-typechecker/project.json` -- targets (`build` `@nx/js:tsc`, `test`
  `@nx/vitest:test`); add the `typecheck-drift` `nx:run-commands` target here.
- `.github/workflows/ci.yml` -- wire `typecheck-drift` into the gate (single invocation;
  OS-independent).

### Live upstream surface (the drift assertion's source of truth -- installed package)

- `node_modules/@angular/compiler-cli/index.d.ts` -- barrel re-exports the drift file
  imports: `export * from './src/transformers/api'` (`Program`, `EmitFlags`,
  `UNKNOWN_ERROR_CODE`), `export * from './src/perform_compile'`
  (`performCompilation`/`readConfiguration`/`ParsedConfiguration`), `{ ErrorCode, ngErrorCode }`
  from `./src/ngtsc/diagnostics`.
- `node_modules/@angular/compiler-cli/src/transformers/api.d.ts` -- the real
  `interface Program` (`:122-167`), `enum EmitFlags` (`:74-82`, NO `None`),
  `UNKNOWN_ERROR_CODE = 500` (`:11`). Resolves under classic-node only.

### Prior phase context (must not be contradicted)

- `.planning/phases/09-resilience-per-file-fault-isolation-boundary-robustness/09-CONTEXT.md`
  -- the `<deferred>` cross-phase note: HARD-01's getter-set assertion MUST cover the getter
  set RES-02 left in `gather-diagnostics.ts` (incl. the per-file `getNgSemanticDiagnostics(fileName)`
  usage and COR-02's `getGlobalDiagnostics`).
- `.planning/phases/08-correctness-completeness-fixes/08-CONTEXT.md` -- the infra-vs-type
  policy + `UNKNOWN_ERROR_CODE` 500 context (D-06..D-10) HARD-01's encoding assertions touch.

### Decision provenance (the HARD-01 deliberation -- reference only)

- Web prior-art (type-drift assertion libraries) + GitHub prior-art (vendored-subset guards,
  empirically verified @ tsc 6.0.3) + npm dev-dep survey + a 5-member Opus advisory board
  (requirement-fidelity / type-system-mechanics / maintainability / adversarial-risk /
  ecosystem-dev-dep lenses). Consensus: ProbeOnly type-gate + runtime getter-set/encoding
  spec; reject exhaustiveness and api-extractor; PlainTS over `expect-type`; hand-written
  shim over `Pick`-derivation. (No standalone research file written -- captured in D-01..D-07.)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- The vendored shim already declares EVERY surface HARD-01 asserts (the 7 getters, the
  `EmitFlags` enum, `UNKNOWN_ERROR_CODE`, `ParsedConfiguration`) -- no widening needed; the
  drift file imports the REAL counterparts and asserts assignability against these.
- `diagnostic-codes.ts` `NG()` / `ngCodeOf()` are dependency-free and production-importable
  -- the runtime encoding assertion (D-04) imports them + the real `ngErrorCode` and compares.
- The existing vendor marker at `diagnostic-codes.ts:56` is the exact HARD-03 idiom to
  replicate across `compiler-cli-types.ts`.
- `tsconfig.base.json` is ALREADY classic `moduleResolution: node` -- the drift tsconfig
  extends it directly; the real barrel resolves there (the production `nodenext`
  `tsconfig.json` is what makes it resolve EMPTY, the reason the shim exists).

### Established Patterns

- CORE is framework-agnostic and PURE (eslint bans `@nx/*` / `@angular-devkit/*` + `process.exit`
  in `**/src/core/**`). The drift file is a TYPE-only assertion (erased at emit, never shipped);
  the runtime spec is a test (can `await import` the real compiler-cli, like the integration tier).
- Each change is test-gated / asserted (the v0.0.1 + Phase 8/9 convention): HARD-01's type-gate
  is the build assertion, the runtime spec is the additions/encoding gate, HARD-05 is the leak spec.
- The unconditional all-getter gatherer (Approach A / `performCompilation`) is retained;
  `NgtscProgram` migration stays deferred (PROJECT.md constraint).
- npm-published plugin policed by `@nx/dependency-checks` -- the PlainTS-over-`expect-type`
  decision (D-03) keeps the published manifest free of an unnecessary devDep.

### Integration Points

- The drift tsconfig + `typecheck-drift` target are NEW workspace artifacts (no prior
  `nx:run-commands` target or drift tsconfig exists). They sit alongside `build`/`test`/`lint`
  in `project.json` and a CI step in `ci.yml`.
- The runtime getter-set/encoding spec sits in `src/core/` next to the existing integration
  specs and `await import`s the real compiler-cli.
- HARD-02/03/04 edit `compiler-cli-types.ts` (+ the `getNgStructuralDiagnostics` comment in
  `gather-diagnostics.ts`); HARD-05 adds/extends a `format-report`/`extended.*` integration spec.

</code_context>

<specifics>
## Specific Ideas

- Empirically verified @ tsc 6.0.3 (board probes): `real -> shim` assignability PASSES on an
  upstream ADDITION (correctly ignores it), ERRORS on a removed getter / changed return; an
  `optional -> required` param change PASSES SILENTLY (the trap -> call-site probes); returns
  must be declared `readonly`; `getGlobalDiagnostics` only surfaces at the call site.
- The Angular ecosystem (`@angular/build`, AnalogJS) uses the REAL compiler-cli types directly
  -- no shim, no drift guard. angular-typechecker's vendored SUBSET is the unusual choice
  (forced by the `nodenext` empty-resolution problem), which is precisely WHY it needs an
  explicit guard the real consumers don't.
- The idiomatic prior-art shape for a vendored subset is `type AssertAssignable<From, To
extends From> = true;` over a tuple of pairs (multiple real repos). Exhaustiveness against a
  foreign subset is absent from public code.

</specifics>

<deferred>
## Deferred Ideas

- **AlsoAdditions / `Exclude<keyof>` exhaustiveness in the type-gate** -- rejected (unanimous
  board): noisy on every benign Angular minor, index-signature gotcha, no prior art. The
  runtime getter-set spec (D-04) covers additions instead.
- **`@microsoft/api-extractor` `.api.md` report-diff for additions-review** -- rejected as
  disproportionate / scope-creep for this milestone. Backlog candidate only if a heavyweight,
  human-gated upstream-API-review workflow is ever wanted.
- **`expect-type` as a type-testing dev dependency** -- not adopted now (PlainTS suffices at
  this scale). Revisit if the type-assertion surface grows past dozens of assertions where the
  readability/standardization premium would pay off.
- **`Pick<api.Program, ...>`-derived shim** -- rejected (auto-tracks upstream -> defeats the
  loud-break alarm; mechanically unavailable under production `nodenext`).
- **`NgtscProgram` migration / incremental / `--watch`** -- out of milestone (PROJECT.md
  Out of Scope); the drift guard asserts the `api.Program` surface the engine stays on.

### Reviewed Todos (not folded)

None -- `todo.match-phase 10` returned 0 matches.

</deferred>

---

_Phase: 10-drift-hardening-maintainability_
_Context gathered: 2026-06-29_
