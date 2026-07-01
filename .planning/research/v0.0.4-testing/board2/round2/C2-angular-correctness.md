# C2 -- Angular compiler diagnostic correctness and completeness (ROUND 2)

LENS: faithful detection/assertion of the full Angular compiler diagnostic surface
(TypeScript + template + the 18 `ExtendedTemplateDiagnosticName` members + baseline NG/TS
codes) and regression detection when Angular changes.

A HOLD is valid here ONLY if a specific compiler fact shows the reconciliation (§D) gets
something wrong. I re-verified the load-bearing facts against the installed
`@angular/compiler-cli@22.0.4` this round. Result: CONVERGE on all decisions. One finding
sharpens (does not contradict) the §D-D2 wording; I record it as guidance, not a HOLD.

---

## Round-2 verification against the installed compiler

1. `ExtendedTemplateDiagnosticName` (`extended_template_diagnostic_name.d.ts`) -- re-read
   verbatim: **exactly 18 members**, unchanged from round 1. Confirms §A2 / FACTS sec.4.
2. `error_code.d.ts`: `CONTROL_FLOW_PREVENTING_CONTENT_PROJECTION = 8011`,
   `DEFER_TRIGGER_MISCONFIGURATION = 8021`, `UNUSED_LET_DECLARATION = 8112`. Confirms the
   §A2 code map (two members outside the 81xx range; 8112 in-range).
3. **NEW, lens-critical (sharpens my round-1 FACTS-NEEDED on 8011/8021):** the
   `extended/checks/` factory directory holds **16** registered extended-check factories.
   `deferTriggerMisconfiguration` (8021) HAS one (`defer_trigger_misconfiguration/index.d.ts`
   -> `TemplateCheckFactory<ErrorCode.DEFER_TRIGGER_MISCONFIGURATION, ...>`), so despite its
   80xx code it is a config-driven, `extendedDiagnostics`-promotable extended check.
   `controlFlowPreventingContentProjection` (8011) has **NO** factory directory; it is emitted
   through the out-of-band recorder (`oob.d.ts` `controlFlowPreventingContentProjection(...,
category: OutOfBandDiagnosticCategory, ...)`), i.e. the core template type-checker supplies
   its category, NOT `extendedDiagnostics.defaultCategory`. So of the 18 enum members, **17
   are configurable extended checks and exactly one (8011) is not**.

Why this does NOT sustain a HOLD: §D-D2 commits only to "assert each member by exact code +
`DiagnosticCategory` + count, plus ONE severity-promotion case." It does NOT assert that all
18 are uniformly `defaultCategory`-promotable. The wording already requires asserting each
member's OBSERVED category (so 8011's out-of-band category is captured empirically, not
assumed) and pins the single promotion case to the mechanism (which I now know to ride one of
the 17 genuinely-promotable extended checks -- not 8011). The reconciliation is therefore
faithful; my finding is implementation guidance for the executor of D2, recorded below.

---

## Per-decision

### D1 -- CONVERGE

§D keeps the generator's unit tests on in-memory `createTreeWithEmptyWorkspace` and authors no
`createFsTree`. From my lens the only constraint is that NO Tree/FsTree substrate is ever used
to assert a compiler diagnostic (none runs the Angular compiler -- NX-FSTREE-INTERNALS), and
diagnostic correctness stays on the existing committed-`fixtures/` + real `performCompilation`
(`runTypecheck`) substrate. §D does exactly this. I re-checked round 1's mind-change trigger (a
diagnostic only reproducible by GENERATING a real Angular project): all 18 triggers reduce to a
minimal component+template+tsconfig, proven by the existing `fixtures/extended-v13`. Trigger
not active. Nothing in §D contradicts a verified fact. CONVERGE.

### D2-organization -- CONVERGE

§D adopts a single data-driven `it.each` table keyed on the enum members with
introduction-version as a row field (not a file split) -- my exact round-1 position. Fact A7
(the `angular17` file was renamed because its version signal was false) independently confirms
the per-version-file axis is a poor fit. No fact opposes. CONVERGE.

### D2-scope -- CONVERGE

§D asserts all 18 members + the baseline TS/NG codes by exact code + `DiagnosticCategory` +
count, plus one promotion case, and marks any member not reproducible by a static fixture as
`it.skip` with a written reason (never silent). This matches my lens (all 18, exact code, never
coarse pass/fail). The `it.skip`-with-reason clause is the correct handling for any member that
needs scaffolding a static fixture cannot provide. CONVERGE.

GUIDANCE for the D2 executor (does not change the decision):

- 8011 (`controlFlowPreventingContentProjection`) is out-of-band, not a `TemplateCheckFactory`;
  assert its ACTUAL observed `DiagnosticCategory` and do NOT route it through the single
  `defaultCategory: "error"` promotion case. Use one of the 17 factory-registered extended
  checks (e.g. 8101) as the promotion exemplar.
- 8021 (`deferTriggerMisconfiguration`) DOES have a factory, so it behaves like the 81xx set
  for promotion despite its 80xx code -- do not numeric-filter it out.
- Key the table on enum membership (the §D wording already does), never on the `NG81\d\d`
  pattern, or 8011 and 8021 silently drop.

### D2-tripwire -- CONVERGE

§D mandates a completeness tripwire asserting catalog rows === the `ExtendedTemplateDiagnosticName`
enum -- the regression-detection half of my lens and the single highest-leverage item, absent
from all prior art. It was proposed by this lens in round 1 and is now in the reconciliation
verbatim. CONVERGE. (Implementation note: the enum is `@publicApi` and string-valued; the
tripwire compares the set of enum VALUES to the catalog's `name`s and must run in the `test`
job so a peer bump fails CI -- consistent with D5.)

### D3 -- CONVERGE

§D adds no separate executor-against-workspace tier and, if a `context.root`-relative `tsConfig`
case is missing, adds it to `normalize-options.spec.ts` (unit), not a new tier. Fact A4 verified
that resolution is a pure two-branch unit-covered function with a spec present; A3 verified the
core does no per-code branching and the executor is a thin adapter that does not transform the
diagnostic set. So no diagnostic-surface coverage is lost by omitting the tier. My round-1
mind-change trigger (a v0.0.4 executor-level quiet/errors-only mode) is excluded from scope by
§D-D6, so it is not active. CONVERGE.

### D4 -- CONVERGE

§D folds ONE generator scenario into `install-e2e` (ship `generators.json` + generator, add an
un-wired project, `nx g`, assert `project.json`, then `nx run <proj>:angular-typecheck`
`--skip-nx-cache`); no new e2e project, no Verdaccio. Fact A6 verified `install-e2e` can host
this (it needs an un-wired project, which the scenario adds). My lens asks only that the loop
prove a wired target, when run, surfaces a real diagnostic end-to-end; the scenario's run step
on a project the generator just wired delivers that. Decision B fixes the generator to edit
`project.json` only with no per-project-type branching, so my round-1 per-type-tsConfig
mind-change trigger (apps getting a different `strictTemplates`/`extendedDiagnostics` block) is
NOT met. CONVERGE.

### D5 -- CONVERGE

§D: no `ci.yml` change for in-plugin specs (they auto-route into the 6-cell `test` matrix);
generator e2e rides `install-e2e`; add the set-equality `-p`-list guard (fact A5: none exists);
single `ci` gate; no `test`-target split. Fact A1 measured the budget comfortable (~0.5s cold
compile per fixture; ~9s added compile work per cell, parallelized by Vitest workers) -- so my
round-1 cold-compile-cost concern is empirically retired; the "reduce per-cell catalog" fallback
is not needed. My one lens requirement -- the tripwire runs in `test` (cheap; fires on a
`@angular/compiler-cli` peer bump) -- is satisfied because it is an in-plugin spec. CONVERGE.

### D6 -- CONVERGE

§D scopes the milestone to generator unit + schema parity + the 18-member catalog + completeness
tripwire + one folded generator e2e + the `-p` guard, excluding `createFsTree`, the mid-tier,
Verdaccio, the jscodeshift toolkit, and cache/ordering/mode tests. The catalog completeness +
tripwire (my scope anchor and highest-value item, closing the 2/18-asserted gap that is the
tool's core promise) is retained intact; the de-scoped items are the ones I ranked below it.
Fact A1 confirms the catalog fits the budget, so it need not be traded against the generator.
CONVERGE.

---

## Net

No verified compiler fact contradicts §D. The one new fact (8011 is out-of-band, not a
configurable extended check; 8021 IS configurable) refines HOW the D2 executor writes two
assertions but is fully accommodated by §D's "assert observed category + one promotion case +
`it.skip`-with-reason" wording -- it is guidance, not a HOLD. CONVERGE on all eight.
