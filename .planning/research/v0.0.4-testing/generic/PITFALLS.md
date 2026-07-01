# Pitfalls Research

**Domain:** Nx 23 plugin v0.0.4 — adding a `typecheck-configuration` config generator + an exhaustive extended-diagnostic catalog + a generator e2e (to the existing `angular-typechecker` plugin)
**Researched:** 2026-07-01
**Confidence:** HIGH (verified against the installed `@angular/compiler-cli@22.0.4`, the repo's `ci.yml` / fixtures / e2e harness, and a unanimous 8-lens Opus board)

> **Scope + provenance.** This file catalogs the failure modes specific to v0.0.4's three feature
> areas (generator, diagnostic catalog, generator e2e + CI). The testing strategy is already
> ratified — `board2/CONSENSUS.md` (D1–D6) — so this file BUILDS ON that consensus: it consolidates
> the pitfalls the board surfaced (chiefly the failure-modes lens `round1/A2-failure-modes.md` and
> the Angular-correctness lens `round1/C2-angular-correctness.md`, with maximalist context from
> `round1/A3-maximalist.md`), cites them, and adds any that were implicit. Where the consensus
> EXCLUDED something (bespoke `createFsTree`, a mid-tier executor-vs-workspace tier, Verdaccio,
> jscodeshift injection, cache/`dependsOn` tests), it did so for a pitfall reason recorded below.
> Phases per `.planning/REQUIREMENTS.md`: **Phase 12** = catalog + tripwire (CAT/DRIFT); **Phase 13**
> = generator (GEN); **Phase 14** = generator e2e + CI guard (GE2E/GUARD).

---

## Critical Pitfalls

These are the mistakes that, for a type-checking tool, produce the one catastrophic failure mode the
product cannot tolerate: a **false green** — a passing gate while the checker is silently not checking
(`A2-failure-modes.md`: "a type-checker that lies is worse than none").

### Pitfall 1: The `81xx` numeric filter silently drops NG8011 and NG8021

**What goes wrong:**
Two of the 18 `ExtendedTemplateDiagnosticName` members are NOT in the extended `81xx` range:
`controlFlowPreventingContentProjection` is **NG8011** and `deferTriggerMisconfiguration` is **NG8021**
— both in the `8000–8099` baseline template-type-check range. Any catalog built by filtering on a
numeric `NG81\d\d` pattern, a "8100–8117" loop, or a grep, omits exactly those two and stays green
while two public diagnostics go unasserted — the precise completeness hole this milestone exists to
close.

**Why it happens:**
The intuitive (and the catalog doc's original) framing is "the 18 extended diagnostics live in 81xx."
`DIAGNOSTIC-CATALOG.md` even lists only 16 "documented" and omits `controlFlowPreventingContentProjection`
entirely. The enum names them as configurable-by-name checks, but their codes sit below 8100
(`C2-angular-correctness.md` LENS-CRITICAL FINDING #1, verified against `error_code.d.ts` at 22.0.4).

**How to avoid:**
Key the catalog taxonomy on **enum membership** (`Object.values(ExtendedTemplateDiagnosticName)`), never
on a numeric pattern. Drive the catalog from a single data table whose rows are the 18 enum members,
with the `ErrorCode` as a per-row field. Assert each by exact `code` via the `NG()` helper
(`NG(code) = -990000 - code`), not by a code range.

**Warning signs:**
A catalog with exactly 16 rows; a `for (let c = 8100; …)` loop; a regex literal `81\d\d`; the
completeness tripwire (Pitfall 2) passing with fewer than 18 rows.

**Phase to address:** Phase 12 (CAT-01, CAT-04, CAT-05).

---

### Pitfall 2: Assuming NG8011 and NG8021 are warning-default and promotable like the 81xx checks

**What goes wrong:**
A test promotes a diagnostic to error via `extendedDiagnostics.defaultCategory: "error"` and asserts
the flip — but applies that pattern uniformly to all 18. NG8011 is emitted **out-of-band** (it has no
`extended/checks/` factory) and is **not promotable** via `extendedDiagnostics`; NG8021 IS a registered
promotable check (`CONSENSUS.md` D2 implementation nuance; `C2-angular-correctness.md` FINDING #1). A
promotion assertion on NG8011 either fails spuriously or, worse, "passes" against a fabricated
expectation, masking the real behavior.

**Why it happens:**
The 81xx checks share one mechanism (default WARNING, `defaultCategory`-promotable); NG8011/NG8021 sit
in the core template type-checker and may behave differently. Their actual default category was the
single biggest UNVERIFIED fact the board flagged (`C2` FACTS-NEEDED; `A2` D2).

**How to avoid:**
Discover each row's ACTUAL observed default category empirically against the real compiler at
implementation time — do not assume WARNING. Assert NG8011's observed category and **skip its promotion
case with a written reason** (17 of 18 are promotable; NG8011 is the exception). Keep one global
promotion case (e.g. NG8101) proving the mechanism; do not repeat it for every code.

**Warning signs:**
A promotion `it` for NG8011; a row asserting `Warning` for NG8011/NG8021 without an empirical check; a
promotion test that asserts a category WITHOUT also asserting the diagnostic count is unchanged.

**Phase to address:** Phase 12 (CAT-01, CAT-02).

---

### Pitfall 3: Coarse `success`/boolean assertions — the false-green that is indistinguishable from no test

**What goes wrong:**
A fixture meant to trigger NG8115 instead trips a _different_ error (a template typo, a TS syntax
error, a tsconfig error). A `expect(result.success).toBe(false)` test passes — while NG8115 is never
exercised. The checker could stop emitting NG8115 entirely and the suite stays green. This is the
prior art's documented sin: the sandbox catalog asserts ONLY `success` (`SANDBOX-TECHNIQUES.md` §4;
`A2` D2; `A3-maximalist.md` D2).

**Why it happens:**
Boolean is the cheapest assertion and the executor historically returned only `{ success }`. But the
core `runTypecheck` already returns `result.diagnostics` (each with a numeric `code`), `errorCount`,
and `warningCount` — so no new seam is needed (`C2` FINDING #3; `TESTING.md`). The temptation is to
copy the prior-art shape rather than the repo's existing exact-code idiom.

**How to avoid:**
Assert **exact `code` + `DiagnosticCategory` + count** for every catalog row — never a bare boolean. A
count assertion additionally catches a fixture that triggers the target code TWICE or triggers an
unintended sibling (silent fixture drift). This is already the repo idiom
(`result.diagnostics.find(d => d.code === NG(8101))` then assert `.category`).

**Warning signs:**
Any catalog `it` whose only assertion is `success`/`toBe(false)`; an assertion on `errorCount > 0`
without naming the code; a row with no count invariant.

**Phase to address:** Phase 12 (CAT-01, CAT-03).

---

### Pitfall 4: A fixture that fails to trigger its intended diagnostic (silent fixture rot)

**What goes wrong:**
A committed fixture is edited (or an Angular patch changes triggering rules) so it no longer emits the
intended diagnostic — or emits it only because of an unrelated error in the file. The catalog still
reports the code as "covered." Several of the 18 have narrow preconditions: NG8011 needs a specific
multi-root `@if` projected at a component root; NG8112 (`unusedLetDeclaration`) and the 81xx checks
generally need `strictTemplates` (and often `defaultCategory: "error"`) to be observable
(`C2` FACTS-NEEDED; `SANDBOX` §5 `forceExtendedDiagnosticsAsErrors`; `A3` D2).

**Why it happens:**
Static fixtures drift; their triggering is implicit. The sandbox's own fixtures relied on the fixture
"being intentionally broken" as the only enforcement (`SANDBOX` §4).

**How to avoid:**
The exact-code + category + count assertion IS the guard against rot (couples assertion granularity to
fixture strategy — `A2` D2). Each extended-diagnostic fixture's tsconfig must set `strictTemplates`
(and `extendedDiagnostics.defaultCategory: "error"` where the code is otherwise a non-failing warning).
For any of the 18 that genuinely cannot be reproduced by a static fixture under 22.0.4, use `it.skip`
**with a written reason and keep the row in the catalog** so the completeness tripwire (Pitfall 5)
stays honest — never silently omit it (`CONSENSUS.md` D2; `A3` D2 would-change-mind).

**Warning signs:**
A fixture with multiple unrelated errors; a green row whose fixture lacks `strictTemplates`; an
`it.skip` with no reason; a code dropped from the table rather than skipped.

**Phase to address:** Phase 12 (CAT-01, CAT-04).

---

### Pitfall 5: Coverage drift goes undetected when Angular adds/renames/removes a diagnostic

**What goes wrong:**
A future `@angular/compiler-cli` adds a 19th `ExtendedTemplateDiagnosticName` member (or renames one).
The catalog silently stays green while the new diagnostic goes unasserted — the exact silent-hole this
tool exists to prevent, now reintroduced one Angular release later.

**Why it happens:**
A static catalog has no link back to the live enum; nothing fails when the enum grows. This
regression-detection layer is ABSENT from all prior art (`C2` D2 part 5).

**How to avoid:**
Add an **enum-vs-table completeness tripwire**: import `ExtendedTemplateDiagnosticName` at test time and
assert the set of enum member names EQUALS the set of catalog rows. A mismatch fails CI loudly with the
named missing/extra member. This is the analogue of the existing `typecheck-drift` gate (pins the
`Program` shape) and `schema-parity` (keys === interface), applied to the diagnostic NAME set. Because
`@angular/compiler-cli` is ESM, the tripwire must `await import()` it (the integration tier already
does). Run it in the `test` job so it fires on every PR — especially a contributor bumping the Angular
peer (`C2` D2 part 5 / D5; `DRIFT-01`).

**Warning signs:**
A catalog with no test that references the enum object itself; the tripwire living only in `e2e`
(wrong — it must be in `test`); the tripwire comparing counts but not names.

**Phase to address:** Phase 12 (DRIFT-01).

---

### Pitfall 6: The `e2e` job's explicit `-p` list — a new e2e project is invisible to CI (the silent-skip landmine)

**What goes wrong:**
`ci.yml` runs the e2e tier with a hand-maintained `nx run-many -t test -p
angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e`. A NEW
e2e project that is not added to that list runs LOCALLY but never runs in CI. Worse, the `ci` aggregate
gate tolerates `skipped` and fails only on `failure`/`cancelled` — a never-graphed project is not even
`skipped`, so the green `ci` check is computed without ever considering it. The author sees a green PR
and a passing required check while the new e2e was never tested (`A2` D4/D5 — "the single highest-severity
structural hazard already baked into this repo").

**Why it happens:**
The explicit `-p` list is an UNGUARDED human-maintenance contract; `actionlint`/`act-compat` check
expression syntax, not the SEMANTIC correctness of the list against the project graph (`A2` D5).

**How to avoid (two layers):**

1. **Do not create a new e2e project for the generator.** Fold the generator e2e into the existing
   `angular-typechecker-install-e2e`, which is ALREADY in the `-p` list — a new spec file inside it
   runs in CI with zero `ci.yml` edit (`CONSENSUS.md` D4; `A2` D4).
2. **Add the GUARD-01 set-equality test**: read `ci.yml`, parse the `e2e` job's `-p` arguments, glob
   `e2e/*/project.json` for `name`, and assert SET EQUALITY. A mismatch fails loudly with the
   missing/extra project named. This converts the silent-skip landmine into a loud, located failure —
   the board called it "the single highest-leverage test in the whole milestone" (`A2` D5). Prefer the
   pure `fs` + parse approach (glob project.json + parse the YAML `-p` line) over shelling `nx show
projects` so it is fast and cross-platform under `NX_DAEMON: false`.

**Warning signs:**
A `generator-e2e` Nx project; a green PR that adds an e2e project but no `ci.yml` diff; GUARD-01 absent
from the plan.

**Phase to address:** Phase 14 (GE2E-01 folds into `install-e2e`; GUARD-01 adds the guard).

---

### Pitfall 7: Cached-green — the post-generate run is served a stale cached PASS

**What goes wrong:**
The generator e2e runs `nx g …` then `nx run <proj>:angular-typecheck`. The `angular-typecheck` target's
`production` input excludes `*.spec.ts`, so mutating a spec does NOT bust the cache; and an injected
template/type error in a fixture may be served the CACHED green (exit 0) — the run false-passes even
though the generated target would have caught the error. `matrix-5types` learned this the hard way
(`A2` D4; `TESTING.md` notes the `buildCleanEnv`/`--skip-nx-cache` discipline).

**Why it happens:**
Nx caching is the product's feature; in an e2e it becomes a correctness hazard because the cache key may
not reflect the injected error.

**How to avoid:**
Run the post-generate target with **`--skip-nx-cache`** (mandated by `CONSENSUS.md` D4 / `GE2E-02`), or
strip `NX_*` env via the existing `buildCleanEnv` pattern. Assert BOTH directions: clean → success, and
an injected template/type error → failure WITH the diagnostic code/sentinel visible in output (not just
a non-zero exit — see Pitfall 8).

**Warning signs:**
A generator-e2e `nx run` without `--skip-nx-cache`; an injected-error case that passes suspiciously
fast; a single-direction assertion (only the clean case).

**Phase to address:** Phase 14 (GE2E-02).

---

### Pitfall 8: The generator writes a target the executor cannot consume (broken generator + executor contract)

**What goes wrong:**
The generator produces a `project.json` target with a `tsConfig` path that does not exist for that
project type (e.g. defaults an application to `tsconfig.lib.json`, or points a target at
`tsconfig.lib.prod.json` which is emit-on), or wires a config with `strictTemplates` off — silently
disabling the entire extended-diagnostic surface. The in-memory generator unit test asserts the
`project.json` SHAPE and passes; the broken contract is invisible until a real run
(`C2` D4 would-change-mind: "a generator that wires a tsConfig with strictTemplates OFF would silently
disable the entire extended-diagnostic surface — a catastrophic correctness regression").

**Why it happens:**
The generator unit test (in-memory tree) can only prove "the generator wrote target X"; it cannot prove
"the wired tsConfig actually drives a real compiler run that catches a template error" (`C2-angular-correctness.md`
D1/D4). Per-project-type `tsConfig` defaulting (app → `tsconfig.app.json`, lib → `tsconfig.lib.json`,
spec → `tsconfig.spec.json`) is an OPEN design decision (`GEN-02`/`GEN-03`), so it is exactly where a
wrong default lands.

**How to avoid:**
The generator e2e must close the loop: generate the target, then RUN it and assert a real NG diagnostic
surfaces end-to-end (sentinel/code assertion — see `SANDBOX` §6 scenario 3, `C2` D4). Validate the
per-project-type default against the actual tsconfig files Nx generators emit for each type. Skip prod
tsconfigs (`tsconfig.lib.prod.json`) deliberately (no-emit) — document why. Confirm the wired config
inherits `strictTemplates`.

**Warning signs:**
A generator default `tsConfig` not verified against a real project of that type; an e2e that asserts
`project.json` shape but never runs the target; a wired tsconfig with `strictTemplates` unset.

**Phase to address:** Phase 13 (GEN-02, GEN-03) for the defaults; Phase 14 (GE2E-02) for the run-the-target proof.

---

### Pitfall 9: Generator not registered / not packaged — `nx g` cannot resolve it from the tarball install

**What goes wrong:**
The generator works in the dev repo but `nx g angular-typechecker:typecheck-configuration` fails for a
consumer because one of the packaging links is missing: the `generators` field is absent from the
published `package.json`; `generators.json` is not globbed into `dist` by the build `assets`; or
`generators.json`/`schema.json` are not in the tarball `files` whitelist. The existing `install-e2e`
harness was built for `nx run`, not `nx generate` — whether `nx g` resolves from a tarball install in
that harness is an UNPROVEN assumption (`A2` D4 facts-missing).

**Why it happens:**
An Nx plugin needs four linked pieces for a generator to ship: (1) `generators.json` with a
`factory`/`schema` entry, (2) `"generators": "./generators.json"` in `package.json`, (3) the build
`assets` glob copying `generators.json` (and the executor already globs `executors.json` — mirror it),
(4) the `files` whitelist including the generator dir + JSON (`SANDBOX` §1, §7; `STACK.md` executors.json
conventions). Missing any one is a clean local run but a broken install.

**How to avoid:**
Add `generators.json` + the `generators` field + the build-asset glob in the SAME change as the
generator. The repo's `package-manifest.spec.ts` (asserts published `package.json` deps/peers/files/
exports) and `tarball-audit` (`publint`/`attw`/file-set gates) are the right place to add a "generators
field + generators.json present in tarball" assertion. The GE2E-01 scenario must actually run `nx g`
from the installed tarball (proving resolution), not just assert files exist.

**Warning signs:**
`generators.json` present but no `package.json` `generators` field; `tarball-audit` not extended for the
generator; `nx g` only ever run in the dev repo, never from the install.

**Phase to address:** Phase 13 (GEN-05 packaging) + Phase 14 (GE2E-01 proves install-time resolution).

---

### Pitfall 10: Generator is not idempotent — re-run clobbers user config or duplicates the target

**What goes wrong:**
Re-running the generator on an already-wired project overwrites a user's customized `tsConfig`/options,
or (less likely with a whole-object assign) leaves a half-merged target. The sandbox generator's
idempotency was only PARTIAL — it overwrites `targets.typecheck` wholesale every run, with no
"skip if present" guard and no overwrite warning (`SANDBOX` §1). Connect tested idempotency explicitly
("seed a project that already has the target with a DIFFERENT value, run, assert byte-for-byte
unchanged" — `CONNECT-TECHNIQUES.md` §2b).

**Why it happens:**
The happy path (target absent → add) is the obvious case; the re-run case is easy to forget, and a
naive `targets.typecheck = {…}` assignment silently clobbers.

**How to avoid:**
Decide the idempotency contract explicitly (skip-if-present vs. update-cleanly) and TEST it on the
in-memory tree: seed a project that already has a `typecheck`/`angular-typecheck` target with a custom
value, run the generator, assert the value is unchanged (or updated per the chosen contract — but never
duplicated, never partially merged). Use `projectConfig.targets ??= {}` defensively (`GEN-04`, `GEN-06`).

**Warning signs:**
No re-run test; a test that only covers "target absent → added"; a generator that unconditionally
assigns the target object.

**Phase to address:** Phase 13 (GEN-04, GEN-06).

---

### Pitfall 11: `/virtual` workspace leakage in `createTreeWithEmptyWorkspace` generator unit tests

**What goes wrong:**
A generator unit test on the in-memory tree accidentally resolves against the REAL workspace instead of
the `/virtual` root (nx#32588), so it reads the dev repo's real `project.json` and false-greens — the
generator appears to work against a project it never actually created in the tree.

**Why it happens:**
`createTreeWithEmptyWorkspace` is the public, version-stable substrate the consensus chose (D1), but it
has two documented hazards. Leakage occurs when a spec reads `process.cwd()`, skips seeding via
`addProjectConfiguration`, or asserts against non-`/virtual` paths (`A2` D1). The open-handle hang
(nx#26346) is the second hazard (`@nx/devkit` loads native bindings + a pseudo-terminal that keeps
Vitest alive).

**How to avoid:**
Mandate the Nx spec idiom: `import 'nx/src/internal-testing-utils/mock-project-graph'` as the first
side-effecting import, always seed projects via `addProjectConfiguration`, never read `process.cwd()`,
assert against `/virtual`-rooted paths. `NX_DAEMON: false` (already set in every CI cell) plus the
plugin's `testTimeout: 30000` mitigate the open-handle hang (`A2` D1). Note the irony: the
leakage-mitigation import is itself a `nx/src/internal-testing-utils/*` deep import — but it is the
dominant Nx spec idiom (452 spec files) and far lower-risk than `nx/src/generators/tree`.

**Warning signs:**
A generator spec missing the `mock-project-graph` import; assertions against repo-real paths; Vitest
hanging after the generator suite "finishes."

**Phase to address:** Phase 13 (GEN-06).

---

### Pitfall 12: Cold-compile cost across the 6-cell matrix makes the catalog slow (and slow tiers get disabled)

**What goes wrong:**
Each catalog fixture is a cold `performCompilation` (ESM load + whole-program check). Naively running
18+ fixtures × 6 matrix cells multiplies cold compiles; if the `test` matrix wall-clock balloons, the
pressure is to mark a tier allow-fail or split it — and a tier that times out and is marked allow-fail
is "a false green wearing a yellow hat" (`A2` threat-lens; `A3` D5 / `C2` D5 measure the cost concern).

**Why it happens:**
The ESM load of `@angular/compiler-cli` dominates cold start (`CONCERNS.md` Performance Bottlenecks); a
per-fixture program pays it each time. The board estimated ≈0.5s/fixture, ~9s/cell parallelized —
comfortable — but only IF fixtures are batched, not one-program-per-code (`CONSENSUS.md` D5).

**How to avoid:**
**Batch fixtures per program where practical** — `runTypecheck` returns ALL diagnostics in one pass, so
one compilation can carry multiple codes (the existing `gate-b-error` fixture proves TS2322 + NG8109 in
one program; `C2` D5; `CONSENSUS.md` D2 "batch fixtures per program"). Keep the completeness tripwire on
all 6 cells regardless (it imports an enum and compares a set — no compilation; `C2`/`A3` D5). If cost is
still a problem, the documented fallback is full catalog on one Linux cell + a reduced smoke subset on
the other 5, keeping ≥1 Windows cell exercising case-fold/realpath — but measure before splitting.

**Warning signs:**
One fixture program per diagnostic with no batching; `test` matrix wall-clock climbing toward the
timeout; any proposal to make `test` allow-fail.

**Phase to address:** Phase 12 (CAT-01 fixture design); CI mapping confirmed in Phase 14 context (no `ci.yml` structural change — specs auto-route).

---

### Pitfall 13: Internal-import fragility — the reason bespoke `createFsTree` is excluded

**What goes wrong:**
Building `createFsTree`/`flushFsTreeChanges` requires the deep import `nx/src/generators/tree`, which is
NOT in any public `@nx/devkit` barrel and carries NO semver guarantee — an Nx upgrade can move, rename,
or change its behavior silently. The proposed mitigation (an arity/method-name drift tripwire) is itself
shallow: Nx can change `flushChanges`/`normalize()` SEMANTICS while keeping arity and method names
identical, so the tripwire goes green while the helper silently misbehaves — corrupting a real-disk
generator test (`A2` D1; `NX-FSTREE-INTERNALS` per board).

**Why it happens:**
The prior-art `FsTree` helper is alluring (it was a planned-but-never-delivered v0.0.1 artifact). But it
lived ONLY in an _executor e2e_ (real-workspace edits a real compiler reads back), never in a generator
unit test. The v0.0.4 generator edits `project.json` ONLY — 100% of its behavior is a Tree
transformation the in-memory tree captures perfectly; nothing reads its own emitted files from disk
mid-run (`A2` D1; `CONSENSUS.md` D1; `A3` D1 would-change-mind concedes this if the generator never
emits files).

**How to avoid:**
Do NOT author `createFsTree`. Use the public in-memory `createTreeWithEmptyWorkspace` for all generator
specs; real-disk fidelity comes from the existing tarball e2e (higher fidelity than a hand-rolled
FsTree). Track the helper as a deferred FUTURE requirement (`FSTREE-01`) gated on a future
file-emitting generator — the ONLY condition that would justify it is a generator that consumes its own
emitted file from disk DURING generation (`A2` D1 would-change-mind).

**Warning signs:**
Any `import … from 'nx/src/generators/tree'` in source; a new `*.drift.ts` pinning FsTree arity; a
generator spec writing to a temp dir.

**Phase to address:** Phase 13 (decision already locked by CONSENSUS.md D1 — do not reopen without the file-emission trigger).

---

## Technical Debt Patterns

| Shortcut                                                        | Immediate Benefit                         | Long-term Cost                                                                                                                       | When Acceptable                                                                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assert only `result.success` per catalog row                    | One-line assertions; copy prior art       | False green indistinguishable from no test; a dropped code goes unnoticed                                                            | **Never** — exact code + category + count is the repo idiom and non-negotiable for a completeness tool                                                    |
| Filter the 18 codes by an `81xx` numeric pattern                | Terse catalog construction                | Silently drops NG8011 + NG8021                                                                                                       | **Never** — key on the enum                                                                                                                               |
| Catalog organized one-file-per-Angular-major                    | Git-blame locality; "drop-in a new major" | False taxonomy that rots (the repo already renamed `extended.angular17` → `extended.promotion` because the version signal was a lie) | Only if the per-major files are GENERATED FROM / checked against the one enum table (`C2` D2 part 2)                                                      |
| Skip a non-reproducible code by omitting the row                | Avoids a failing/`it.skip` line           | The completeness tripwire (count===18) breaks OR is loosened; the code is silently uncovered                                         | **Never** — use `it.skip` with a written reason, keep the row                                                                                             |
| New `generator-e2e` Nx project (vs. folding into `install-e2e`) | Clean separation                          | Silent-skip landmine via the explicit `-p` list; CI greens without it                                                                | Only with the `-p`-list addition + `implicitDependencies` + GUARD-01 in the SAME commit (`A3` D4 would-change-mind) — but folding is strictly better here |
| Generator e2e `nx run` without `--skip-nx-cache`                | Slightly faster e2e                       | Cached-green false pass on the injected-error case                                                                                   | **Never** for the generator/executor verdict run                                                                                                          |
| Bespoke `createFsTree` real-disk helper now                     | "Resolves the v0.0.1 drift"               | Permanent internal-import upgrade fragility for fidelity the config-edit generator does not need                                     | **Never** in v0.0.4 — only when a future generator emits files a compiler reads back (FSTREE-01)                                                          |
| jscodeshift error-injection toolkit (1373 LOC prior art)        | Surgical fixture mutation                 | New dep + Nx-scaffold-shape fragility + a large infra surface that can itself produce the wrong diagnostic                           | **Never** here — committed static fixtures are deterministic, reviewable, cross-platform (`A2` D2; `A3` D2)                                               |

## Integration Gotchas

| Integration                                 | Common Mistake                                                                               | Correct Approach                                                                                                                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@angular/compiler-cli` enum at test time   | `require()` it (it is ESM-only)                                                              | `await import('@angular/compiler-cli')` for the completeness tripwire and any real-compiler spec (`C2` D2 part 5; `TESTING.md`)                                                                                                     |
| `generators.json` packaging                 | Add the file but forget the `package.json` `generators` field and/or the build `assets` glob | Wire all four links (generators.json entry + `generators` field + assets glob mirroring `executors.json` + `files` whitelist) in one change; assert in `package-manifest`/`tarball-audit` (`SANDBOX` §1/§7)                         |
| `nx g` from a tarball install               | Assume the `install-e2e` harness (built for `nx run`) resolves `nx generate`                 | Prove it in GE2E-01 by actually running `nx g` from the installed tarball; add the un-wired target project to the consumer fixture so the add is observable                                                                         |
| Nx project-graph after generator edits      | Edit `project.json` without `NX_DAEMON=false` in e2e and trust a stale daemon graph          | Set `NX_DAEMON: false` (already CI-wide) and `--skip-nx-cache` for the post-generate run; strip `NX_*` via `buildCleanEnv` (`A2` D1/D4; `SANDBOX` §9.2)                                                                             |
| `formatFiles(tree)` in generator unit tests | Let Prettier run and couple assertions to formatting                                         | Pass `skipFormat: true` (or the schema's `skipFormat`) in tests; confirm `createTreeWithEmptyWorkspace`'s seeded `.prettierrc` matches the repo's `singleQuote: true` if a format assertion is unavoidable (`CONNECT` §2b; `A2` D1) |
| `schema.json` ↔ `schema.d.ts`              | Hand-author both and let them drift                                                          | Add a schema-parity spec asserting `schema.json` keys === the `schema.d.ts` interface keys (extend the existing `schema-parity.spec.ts` idiom) (`GEN-06`; `TESTING.md`)                                                             |

## Performance Traps

| Trap                                                     | Symptoms                                                                             | Prevention                                                                                                                                                                                             | When It Breaks                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| One cold `performCompilation` per catalog code × 6 cells | `test` matrix wall-clock climbs; timeouts on Windows-arm64                           | Batch multiple codes into one fixture program; keep the tripwire compilation-free (`CONSENSUS.md` D5; `C2` D5)                                                                                         | When the catalog reaches ~18 unbatched fixtures across all 6 cells |
| Verdaccio long-running registry process                  | Port races, zombie processes, storage-dir leaks; Windows `execFileSync(nx)` failures | Excluded by consensus — use the existing `npm pack` + tmp-install harness (one mechanism) (`A2` D4; `CONNECT` §7)                                                                                      | On the Windows-arm64 primary dev env immediately                   |
| Parallel e2e workers racing on shared dist/`.tgz`        | Flaky tarball builds, intermittent ENOENT                                            | The e2e configs already serialize (`singleFork`, `fileParallelism: false`, `sequence.concurrent: false`, 300000ms timeout) — keep the generator scenario inside that serialized project (`TESTING.md`) | When a new e2e spec is added to a parallel pool                    |

## Security Mistakes

| Mistake                                                                                                           | Risk                                                                                                            | Prevention                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-enabling `changelog.workspaceChangelog.createRelease: "github"` while adding release-adjacent generator wiring | nx 23 hard-errors (`GIT_PUSH_FALSE_WITH_CREATE_RELEASE`) or silently pushes an un-curated tag to PR-only `main` | Keep `release.git.push: false` + `createRelease: false` (load-bearing — `AGENTS.md` LANDMINE; `CONCERNS.md`). v0.0.4 touches no release config — do not drift it             |
| Leaking fixture/`@fixtures` content or test files into the published tarball                                      | Bloated/incorrect package; the `tarball-audit` no-leak gate would catch it late                                 | Keep generator + schema in the `files` whitelist; keep `*.spec`/`*.drift`/fixtures excluded by `tsconfig.lib.json`; assert via `tarball-audit` (`CONCERNS.md`; `TESTING.md`) |
| Auto-approving the `npm-publish` environment when the milestone publishes 0.0.4                                   | HARD RULE violation — environment gates are human-only                                                          | Stop at the gate and hand off (MEMORY.md "Never approve GitHub deployments")                                                                                                 |

## "Looks Done But Isn't" Checklist

- [ ] **Diagnostic catalog:** Often missing NG8011 + NG8021 — verify the table has exactly 18 enum-keyed rows (not 16) and neither was dropped by a numeric filter.
- [ ] **Diagnostic catalog:** Often missing the count assertion — verify each row asserts code + category + count, not just code.
- [ ] **NG8011 promotion:** Often wrongly asserted as promotable — verify its promotion case is `it.skip`'d with a reason and its observed category is asserted as-is.
- [ ] **Completeness tripwire:** Often missing or in the wrong job — verify it imports the live enum, compares NAMES (not counts), and runs in `test` (so a peer bump fails it).
- [ ] **Generator:** Often missing the re-run/idempotency test — verify a seeded-custom-target re-run asserts no clobber and no duplicate.
- [ ] **Generator packaging:** Often missing the `package.json` `generators` field or the build-asset glob — verify `nx g` resolves from the installed tarball, not just the dev repo.
- [ ] **Generator defaults:** Often the wrong per-type `tsConfig` — verify app→`tsconfig.app.json` / lib→`tsconfig.lib.json` / spec→`tsconfig.spec.json` against real generated projects, and that prod tsconfigs are deliberately skipped.
- [ ] **Generator e2e:** Often asserts `project.json` shape only — verify it RUNS the generated target with `--skip-nx-cache` and asserts a real diagnostic surfaces (both clean and injected-error directions).
- [ ] **CI `-p` list:** Often a new e2e project is unguarded — verify GUARD-01 set-equality exists, or that the generator e2e is folded into `install-e2e` (already listed).

## Recovery Strategies

| Pitfall                                         | Recovery Cost | Recovery Steps                                                                                                          |
| ----------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Numeric filter dropped NG8011/NG8021            | LOW           | Re-key the catalog on the enum; the completeness tripwire would have caught it — add the tripwire if absent             |
| Coarse boolean assertions shipped               | MEDIUM        | Rewrite each row to exact code + category + count; mechanical but touches every catalog `it`                            |
| Fixture stopped triggering its code             | LOW–MEDIUM    | The exact-code assertion fails loudly; fix the fixture or `it.skip` with reason; re-verify against the real compiler    |
| New e2e project invisible in CI                 | LOW           | Fold into `install-e2e` or add to `-p` list + GUARD-01; the guard makes recurrence impossible                           |
| Cached-green false pass                         | LOW           | Add `--skip-nx-cache` to the post-generate run; re-run the injected-error case                                          |
| Generator not packaged                          | LOW           | Add the `generators` field + assets glob + `files` entry; extend `tarball-audit`/`package-manifest`                     |
| Bespoke FsTree authored against internal import | MEDIUM        | Remove it; migrate generator specs to `createTreeWithEmptyWorkspace`; real-disk proof already exists at the tarball e2e |
| Catalog too slow in the matrix                  | MEDIUM        | Batch fixtures per program first; only then consider full-on-1-cell + smoke-on-5 (keep tripwire on all cells)           |

## Pitfall-to-Phase Mapping

| Pitfall                                      | Prevention Phase                          | Verification                                                                        |
| -------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| 1. `81xx` numeric filter drops NG8011/NG8021 | Phase 12 (CAT-01/04/05)                   | Catalog has 18 enum-keyed rows; completeness tripwire green                         |
| 2. NG8011/NG8021 wrongly assumed promotable  | Phase 12 (CAT-01/02)                      | NG8011 promotion `it.skip`'d with reason; observed category asserted                |
| 3. Coarse boolean assertions                 | Phase 12 (CAT-01/03)                      | Every row asserts code + category + count                                           |
| 4. Fixture fails to trigger its diagnostic   | Phase 12 (CAT-01/04)                      | Exact-code assertion passes against the real compiler; skips carry reasons          |
| 5. Coverage drift undetected                 | Phase 12 (DRIFT-01)                       | Tripwire fails loudly when the enum/table diverge; runs in `test`                   |
| 6. `-p` silent-skip landmine                 | Phase 14 (GE2E-01 fold + GUARD-01)        | GUARD-01 set-equality green; no new e2e project                                     |
| 7. Cached-green                              | Phase 14 (GE2E-02)                        | Injected-error run with `--skip-nx-cache` fails as expected                         |
| 8. Generator/executor contract broken        | Phase 13 (GEN-02/03) + Phase 14 (GE2E-02) | Generated target RUNS and surfaces a real NG diagnostic per type                    |
| 9. Generator not registered/packaged         | Phase 13 (GEN-05) + Phase 14 (GE2E-01)    | `nx g` resolves from the installed tarball; `tarball-audit` asserts generators.json |
| 10. Not idempotent                           | Phase 13 (GEN-04/06)                      | Seeded-custom-target re-run asserts no clobber/duplicate                            |
| 11. `/virtual` leakage / open-handle hang    | Phase 13 (GEN-06)                         | `mock-project-graph` imported; assertions `/virtual`-rooted; suite exits cleanly    |
| 12. Cold-compile cost in the matrix          | Phase 12 (CAT-01 fixture batching)        | Batched programs; `test` matrix wall-clock within budget; tripwire compilation-free |
| 13. Internal-import fragility (FsTree)       | Phase 13 (locked by CONSENSUS.md D1)      | No `nx/src/generators/tree` import in source; FSTREE-01 stays deferred              |

## Sources

- `.planning/research/v0.0.4-testing/board2/CONSENSUS.md` — ratified D1–D6 (HIGH)
- `.planning/research/v0.0.4-testing/board2/round1/A2-failure-modes.md` — false-green threat lens, `-p` silent-skip, cached-green, FsTree internal-import fragility, `/virtual` leakage (HIGH)
- `.planning/research/v0.0.4-testing/board2/round1/C2-angular-correctness.md` — verified 18-member enum + code map (NG8011/NG8021 outside 81xx), NG8011 out-of-band/not-promotable, completeness tripwire, exact-code seam already exists (HIGH, verified against `@angular/compiler-cli@22.0.4`)
- `.planning/research/v0.0.4-testing/board2/round1/A3-maximalist.md` — risk ledger, baseline-NG coverage, would-change-mind conditions for the excluded items (HIGH)
- `.planning/research/v0.0.4-testing/SANDBOX-TECHNIQUES.md` — 33-line generator + schema + generators.json registration + build-asset glob; coarse-boolean caveat; per-major file rot; sentinel-token e2e; `forceExtendedDiagnosticsAsErrors` (HIGH, prior-art archaeology)
- `.planning/research/v0.0.4-testing/CONNECT-TECHNIQUES.md` — in-memory generator tree + idempotency test; app-vs-lib `tsConfig` asymmetry; `skipFormat` in tests; FsTree-only-in-executor-e2e (HIGH, sanitized prior art)
- `.planning/codebase/CONCERNS.md` — vendored shim drift gates, release-config landmine, manual-wiring debt (HIGH)
- `.planning/codebase/TESTING.md` — repo test tiers, `NG()` helper, `--skip-nx-cache`/`buildCleanEnv`, schema-parity/package-manifest/tarball-audit precedents (HIGH)
- `.planning/REQUIREMENTS.md` — v0.0.4 requirement-to-phase mapping (Phase 12/13/14) (HIGH)

---

_Pitfalls research for: angular-typechecker v0.0.4 (generator + extended testing strategy)_
_Researched: 2026-07-01_
