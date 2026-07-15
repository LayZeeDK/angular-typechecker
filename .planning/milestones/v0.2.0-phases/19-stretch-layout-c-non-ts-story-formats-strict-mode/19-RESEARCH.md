# Phase 19: Stretch -- Layout C / non-TS story formats / strict mode - Research

**Researched:** 2026-07-07
**Domain:** Nx executor verdict policy (opt-in strict mode) + Storybook Composition topology (fixture/docs/tests), all additive, CI-gated, pure-core
**Confidence:** HIGH (all engine claims verified in-repo; two external doc facts CITED)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (SHIP): opt-in strict mode.** Add a `strict` executor/core option (DEFAULT `false`) that
  escalates the existing coverage-incomplete outcome (`suppressedInGraph > 0`) from non-clean to a
  HARD FAIL. Thin escalation on top of the SB-04 split counter + coverage-incomplete outcome already
  shipped in Phase 17 (`evaluate-result.ts`); additive, board-blessed (CONSENSUS D2 residual). NOT a
  default. Negative test: a host with a dropped in-graph diagnostic FAILs under `strict:true`, stays
  coverage-incomplete/clean under the default.
- **D-02 (DEFER, record "not warranted"): Layout C committed support beyond the guard.** No committed
  code or claim. Verify the no-silent-pass guard on a real Layout C repo (bitwarden, informational).
- **D-03 (DEFER, record "not warranted"): `.mdx`/`.tsx` type-check beyond the shipped advisory.** The
  `.mdx` advisory (`detect-unchecked-declared.ts`, Phase 18) ALREADY ships; verify it on radix-ng.
- **D-04 (Composition engine: NONE).** Composition is a multi-project TOPOLOGY, not a tsconfig layout.
  Coverage = per-project `typecheck` + Nx graph fan-out (`nx affected -t typecheck` / `nx run-many`).
  The Nx graph edge (`implicitDependencies`), NEVER the ref URL, is the source of truth. REJECTED:
  resolving `refs` URLs to source.
- **D-05 (`dependsOn: ["^typecheck"]` DX = docs recipe + test, NOT generators).** Ships as a recipe in
  docs + an automated test that exercises it. NOT wired into `init`/`configuration` generators.
- **D-06 (Composition fixture = synthetic hybrid).** Stock `nx g @nx/angular:storybook-configuration`
  on 2 libs + a hand-added composing host `main.ts` with `refs` per Storybook docs. Negative test: a
  broken composed story FAILs via its OWN project's target; a mistyped host `refs` entry FAILs.
- **D-07 Angular CLI / `ng add @storybook/angular` shape stays DEFERRED** (GEN-FUT-01 + GEN-FUT-02).
  Docs caveat words this as PLANNED/deferred, NOT "unsupported."
- **D-08 (split).** (a) DETERMINISTIC SHIP bucket planned + executed autonomously and CI-gated. (b) OSS
  real-repo VERIFY bucket is a MANUAL, informational post-phase checklist (OSS-CANDIDATES.md), NOT
  inside the autonomous executor and NOT a CI gate.
- **D-09 (Layout A proof off-stack).** Accept `cuentoneta` OFF-STACK as a forward-compat indicator;
  Layout A is ALREADY proven on-stack by the in-repo generator fixtures (Phases 17-18).
- **D-10 Docs additions:** a Storybook Composition section (per-project model + graph fan-out + the
  `dependsOn: ["^typecheck"]` recipe); a Layout C verification note; the Angular-CLI planned/deferred
  caveat; and a precise Composition coverage claim (MUST/MUST-NOT) in the board trust-lens style.

### Claude's Discretion
- The exact `strict` option name/schema wording, the fixture directory layout, and test-file
  organization -- standard patterns; planner/executor decide. The `strict` SEMANTICS (FAIL on
  `suppressedInGraph > 0`, default off, pure option threaded through `evaluateResult`) are LOCKED.

### Deferred Ideas (OUT OF SCOPE)
- Layout C committed support beyond the guard (verify only).
- `.mdx`/`.tsx` story type-checking beyond the advisory.
- Angular CLI `angular.json` support (GEN-FUT-01) + `ng add` Angular CLI schematic (GEN-FUT-02).
- Strict mode as a DEFAULT (stays opt-in).
- URL-based `refs` resolution for Composition (rejected).
- `dependsOn: ["^typecheck"]` as a generator default/flag (docs recipe + test only for now).
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs are formally mapped to this phase. SB-08 is the stretch umbrella; phase-19 success =
(1) a recorded decision for Layout C support beyond the no-silent-pass guard, and (2) a negative test
for every shipped item.

| Success criterion | Description | Research Support |
|-------------------|-------------|------------------|
| Criterion 1 | A decision is recorded for Layout C support beyond the no-silent-pass guard | D-02 rationale + the run-typecheck.ts DIRECT-path evidence below; record as a decision note + README caveat (no code) |
| Criterion 2 | Any item actually shipped carries a negative test | Strict: evaluate-result.spec flip; Composition: broken-composed-story + mistyped-refs e2e; recipe: dependsOn fan-out test |
| SB-08 (stretch umbrella) | Ship the one blessed item (strict); record the other two "not warranted" | D-01 ships; D-02/D-03 record-only |
</phase_requirements>

## Summary

This is the FINAL v0.1.2 phase and it is deliberately small. Everything shippable is additive on top
of infrastructure that already exists: the SB-04 split counters + `coverage-incomplete` outcome
(Phase 17), the `.mdx` advisory (Phase 18), the Layout A/B integration fixtures (Phase 17), and the
Verdaccio `nx add` packaged-tarball e2e with `@storybook/angular@10.4.6` force-installed (Phase 18).
No engine (`run-typecheck.ts`, `filter-diagnostics.ts`, `walk-references.ts`) change is needed for any
item.

**Strict mode (D-01)** is a single new gate in the pure `evaluateResult` function. A critical,
verified finding: the coverage-incomplete ERROR case (`suppressedInGraphErrorCount > 0`) ALREADY hard-
fails by default (evaluate-result.ts:97) -- strict does NOT change it. The ONLY case where strict
changes behavior is a dropped in-graph WARNING when `maxWarnings` is unset, which today passes CLEAN
(evaluate-result.ts:124-129; asserted at evaluate-result.spec.ts:143). Strict flips exactly that case
to `coverage-incomplete`. The negative test that demonstrates the FLIP must therefore use a dropped
in-graph WARNING, not an error.

**Storybook Composition (D-04..D-06)** requires no core code: a composed project and the host are each
ordinary Layout A projects; the host's `refs` object is type-checked as plain TypeScript. Coverage is
per-project `typecheck` plus Nx graph fan-out. The fixture and negative tests belong as a NEW spec file
inside the existing `e2e/angular-typechecker-install-e2e` project (never a new e2e project -- the three
e2e projects share one tarball and are serialized).

**Docs (D-10)** extend the existing `## Storybook` section in
`packages/angular-typechecker/README.md` (there is no `docs/` directory; the package README is the
shipped consumer doc and is in the `files` whitelist).

**Primary recommendation:** Thread `strict` as a boolean through `TypecheckExecutorOptions ->
normalizeOptions -> evaluateResult({ maxWarnings, strict })`, changing exactly ONE line in
`evaluateResult` (the suppressed-in-graph-WARNING gate). Do NOT touch `run-typecheck.ts`/`CoreOptions`
or `exit-codes.ts`. Ship the Composition fixture + two negatives + the fan-out recipe test in a new
install-e2e spec. Record D-02/D-03 as a short decision note and reflect them in README caveats.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Strict verdict escalation | Core verdict (`evaluate-result.ts`, pure) | Executor adapter (options plumbing) | The verdict is pure core; the executor only forwards the option and reads `.success` |
| Strict option surface (schema/normalize) | Executor adapter (`executors/typecheck/*`) | -- | Options live in the Nx-facing tier; core stays framework-agnostic |
| Composition per-project type-check | Core engine (unchanged; walk of each project's solution tsconfig) | -- | Each composed project == Layout A; already covered |
| Composition set coverage (fan-out) | Nx graph / task orchestration (`dependsOn`, `run-many`, `affected`) | Docs recipe | The Nx graph, not angular-typechecker, owns "check the whole set" |
| Composition `refs` correctness | Core engine (ordinary TS check of host `main.ts`) | -- | `refs` is plain TypeScript in the host's declared input set |
| Docs / recorded decisions | Package README + phase decision note | -- | Consumer-facing docs + planning record |

## Standard Stack

No new packages. Everything uses the already-locked stack (Nx 23.0.1, Angular 22.0.4,
TypeScript 6.0.3, Vitest via `@nx/vitest`). The Composition e2e reuses the Phase-18 harness that
force-installs `@storybook/angular@10.4.6` transiently.

### Core (already installed; verify, do not add)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nx/devkit` | `23.0.1` (dependency) | `ExecutorContext`, `logger`, `joinPathFragments` in the adapter | Shipped [VERIFIED: packages/angular-typechecker/package.json usage] |
| `typescript` | `>=6.0.0 <6.1.0` (peer) | `ts.DiagnosticCategory`, diagnostic shapes | Locked peer [CITED: CLAUDE.md constraints] |
| `@angular/compiler-cli` | `^22.0.0` (peer) | The type-check engine reached via `await import()` | Locked peer [CITED: CLAUDE.md constraints] |
| `vitest` | `4.x` (via `@nx/vitest@23.0.1`) | Unit + integration + e2e runner | Existing test infra [VERIFIED: vitest specs in-repo] |

### Supporting (transient e2e only)
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `@storybook/angular` | `10.4.6` (force-installed in the e2e, NOT a repo dep) | Provides `StorybookConfig`/`refs` types so the composing host `main.ts` type-checks | Only inside the Composition e2e spec, via `npm install @storybook/angular@10.4.6 --legacy-peer-deps` [VERIFIED: e2e/.../storybook-tarball.int.spec.ts:67,136] |
| `verdaccio` | existing (`.verdaccio/`) | Local registry so `nx add angular-typechecker` resolves the freshly-built dist tarball | Reused from Phase-18 global-setup [VERIFIED: e2e harness] |

**Installation:** none. `npm view`/`pip`/`cargo` verification is N/A -- this phase adds zero
dependencies to any `package.json`.

## Package Legitimacy Audit

**No new external packages are installed by this phase.** The Composition e2e force-installs
`@storybook/angular@10.4.6` transiently into a throwaway tmp workspace (never into the repo), exactly
as the shipped Phase-18 `storybook-tarball.int.spec.ts` already does. That package is pre-existing,
well-known (official Storybook framework package), and already exercised in CI. slopcheck was not run
because no package is being added to a tracked manifest.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | -- | No new dependency added; audit N/A |

## Architecture Patterns

### System Architecture Diagram (strict mode data flow)

```
nx typecheck <proj> --strict
        |
        v
TypecheckExecutorOptions { tsConfig, includeDeps?, maxWarnings?, failFast?, strict? }
        |
        v
normalizeOptions(options, context)  ---> NormalizedOptions {
        |                                   coreOptions,        (NO strict -- engine unaware)
        |                                   maxWarnings?,
        |                                   failFast, color,
        |                                   strict              (NEW: options.strict ?? false)
        v                                 }
runTypecheck(coreOptions)  --> CoreResult { ..., suppressedInGraphErrorCount,
        |                                        suppressedInGraphWarningCount, ... }
        |                        (counts computed UNCONDITIONALLY -- no strict input needed)
        v
evaluateResult(result, { maxWarnings, strict })   <=== the ONLY behavioral change
        |
        |  errorCount>0            -> type-error (fail)
        |  suppressedInGraphErr>0  -> coverage-incomplete (fail)      [unchanged by strict]
        |  templateCheckAborted    -> coverage-incomplete (fail)
        |  zero-root-names leaf    -> coverage-incomplete (fail)
        |  warningCount>maxWarnings-> warnings-exceeded (fail)
        |  suppressedInGraphWarn>0 -> coverage-incomplete IFF (maxWarnings set OR strict)  <=== strict edit
        |  else                    -> clean (pass)
        v
{ success } --> Nx maps to exit 0/1
```

Note the engine tier (`runTypecheck`/`CoreOptions`) is intentionally NOT on the strict path: it
already emits the split counters unconditionally. CONTEXT phrasing "threaded CoreOptions" is loose;
the actual, minimal threading is `EvaluateOptions`-only.

### Pattern 1: Pure verdict option (mirror `maxWarnings`)
**What:** `strict` is a verdict-only knob, exactly like the existing `maxWarnings`. It lives in
`EvaluateOptions`, is defaulted defensively, and never enters `CoreOptions`.
**When to use:** Any additive gate that reshapes the pass/fail decision without changing what the
engine gathers.
**Example (the exact `evaluate-result.ts` edit):**
```typescript
// Source: packages/angular-typechecker/src/core/evaluate-result.ts (current shape verified)
export interface EvaluateOptions {
  maxWarnings?: number;
  // D-19-01: opt-in strict mode. When true, a dropped in-graph WARNING forces a
  // coverage-incomplete verdict regardless of maxWarnings (a dropped in-graph ERROR
  // already fails unconditionally above). Default false -> current behavior.
  strict?: boolean;
}

// inside evaluateResult, replacing the current gates-only branch (lines 124-129):
const { maxWarnings, strict = false } = options;
// ...gatesWarnings computed as today...
const suppressedInGraphWarningCount = result.suppressedInGraphWarningCount ?? 0;

if ((gatesWarnings || strict) && suppressedInGraphWarningCount > 0) {
  return { success: false, outcome: 'coverage-incomplete' };
}
```

### Pattern 2: Composition = per-project Layout A + Nx graph fan-out (NO engine change)
**What:** The host `.storybook/main.ts` declares `refs` pointing at other Storybooks; the Nx graph
edge (`implicitDependencies` on the host) makes those composed projects upstream dependencies. Running
`nx typecheck` with `dependsOn: ["^typecheck"]` on the host, or `nx run-many -t typecheck` / `nx
affected -t typecheck`, checks the whole set.
**When to use:** The Composition topology. Each composed project's `typecheck` target is ordinary
Layout A (already proven).
**Example (host project.json + recipe target):**
```jsonc
// Source: Nx project-configuration docs [CITED] + repo conventions
{
  "name": "storybook-host",
  "projectType": "library",
  "implicitDependencies": ["lib-buttons", "lib-cards"], // the graph edge = source of truth (D-04)
  "targets": {
    "typecheck": {
      "executor": "angular-typechecker:typecheck",
      "options": { "tsConfig": "storybook-host/tsconfig.json" },
      "dependsOn": ["^typecheck"] // D-05 recipe: fan out to composed deps first
    }
  }
}
```

### Pattern 3: Composition `refs` shape (for the mistyped-refs negative test)
```typescript
// Source: Storybook Composition docs, Storybook 10.4 [CITED: storybook.js.org/docs/sharing/storybook-composition]
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  framework: '@storybook/angular',
  stories: ['../src/**/*.stories.@(ts|tsx|mdx)'],
  refs: {
    'lib-buttons': { title: 'Buttons', url: 'http://localhost:7008' }, // local running/built SB
    'lib-cards': { title: 'Cards', url: 'http://localhost:7009' },
  },
};
export default config;
```
A mistyped entry (e.g. `url: 123`, or an unknown key when the object type is strict) yields an ordinary
`TSxxxx` on `main.ts`, so the host's own `typecheck` FAILs -- this is the D-06 "mistyped host refs
entry FAILs" negative. It requires `@storybook/angular`'s `StorybookConfig` type, which is why the test
belongs in the force-install e2e.

### Anti-Patterns to Avoid
- **Adding `strict` to `CoreOptions`/`runTypecheck`.** The engine already computes the counts;
  routing strict through the engine is dead plumbing. Keep it in `EvaluateOptions`.
- **Adding `strict` to `toExitCode` (`exit-codes.ts`).** That function is dead scaffold for the
  deferred CLI (no live consumer; comment at exit-codes.ts:54-59 says to mirror only when the CLI
  gains a live consumer + a maxWarnings option). Adding strict there now is dead code.
- **Using a dropped in-graph ERROR for the strict negative test.** It fails under BOTH default and
  strict (no flip) -- a meaningless negative. Use a dropped in-graph WARNING with `maxWarnings` unset.
- **Resolving `refs` URLs to source** (rejected, D-04). The graph edge, not the URL, is the source of
  truth.
- **A new e2e project for Composition.** The three e2e projects race on the shared dist tarball; add a
  NEW spec FILE to `angular-typechecker-install-e2e` (inherits serialized singleFork /
  fileParallelism:false).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Check the whole composed set" | A ref-URL resolver / cross-Storybook crawler | Nx `dependsOn: ["^typecheck"]` + `run-many` / `affected` | Rejected in D-04; Nx graph already owns fan-out; URLs are runtime and unmappable |
| Composition graph edge | Parse `refs` to infer dependencies | `implicitDependencies` in project.json | D-04: the declared graph edge is the source of truth |
| Storybook config types for the refs test | A hand-written `StorybookConfig` shim | Force-installed `@storybook/angular@10.4.6` types (transient, e2e-only) | Faithful to real consumer shape; already the Phase-18 pattern |
| Strict as a new outcome/exit code | A new `Outcome` variant or exit code | Reuse `coverage-incomplete` (success:false) | It IS coverage-incomplete; a new label breaks the D-06 additive contract |

**Key insight:** every "harder" version of this phase re-implements something Nx or the shipped engine
already does. The correct scope is a one-line verdict gate + a fixture + docs.

## Runtime State Inventory

Not applicable. This is a greenfield-additive phase (new option, new fixture, new tests, docs). No
rename/refactor/migration; no stored data, live-service config, OS-registered state, secrets, or build
artifacts carry a renamed string. Section omitted per the researcher protocol.

## Common Pitfalls

### Pitfall 1: Strict "escalates coverage-incomplete" is misread as changing the error case
**What goes wrong:** Implementing strict to also touch the `suppressedInGraphErrorCount` branch, or
writing the negative test against an error, produces no observable flip and wastes effort.
**Why it happens:** CONTEXT D-01 phrases strict as escalating "the existing coverage-incomplete outcome
(`suppressedInGraph > 0`)"; the error sub-case already fails by default (evaluate-result.ts:97).
**How to avoid:** Change ONLY the suppressed-in-graph-WARNING gate. Assert the error case still fails
identically with and without strict (regression guard), and assert the WARNING case flips.
**Warning signs:** A strict negative test that fails under both `{}` and `{ strict: true }`.

### Pitfall 2: schema.json / schema.d.ts / parity spec drift
**What goes wrong:** Adding `strict` to only one of the three surfaces makes the parity test red or
the runtime contract diverge from the type contract.
**Why it happens:** Three coupled files: `schema.json` `properties`, `schema.d.ts`
`TypecheckExecutorOptions`, and `schema-parity.spec.ts` `EXPECTED_KEYS`.
**How to avoid:** Update all three in one change. New sorted `EXPECTED_KEYS`:
`['failFast', 'includeDeps', 'maxWarnings', 'strict', 'tsConfig']`. Add
`expect(schema.properties.strict.default).toBe(false);` [VERIFIED: schema-parity.spec.ts:28,49-52].
**Warning signs:** `schema.json <-> schema.d.ts parity (D-06)` spec failing.

### Pitfall 3: `@storybook/angular@10.4.6` install order + peer cap in the Composition e2e
**What goes wrong:** Installing Storybook before angular-typechecker, or without `--legacy-peer-deps`,
aborts the install on Storybook's peer cap (Angular `>=18 <22`, TS `^4.9||^5`).
**Why it happens:** Documented SB10-on-Ng22 incompatibility [VERIFIED: SKILL storybook-input-set-boundary.md:97-102].
**How to avoid:** Mirror `storybook-tarball.int.spec.ts` EXACTLY: fixture `npm install` -> `nx add
angular-typechecker` (no override, checks OUR peers honestly) -> `npm install @storybook/angular@10.4.6
--legacy-peer-deps` (separate step) -> `nx g angular-typechecker:configuration <proj> --skipFormat`
[VERIFIED: e2e/.../storybook-tarball.int.spec.ts:105-147]. On pnpm, the `ERR_PNPM_IGNORED_BUILDS`
workaround applies (not needed for the npm-based e2e).
**Warning signs:** ERESOLVE on `@angular-devkit/build-angular` during `nx add`.

### Pitfall 4: Composition fan-out concurrency under the shared node_modules junction
**What goes wrong:** If executed in a worktree with a shared `node_modules` junction, concurrent `nx`
runs race on `node_modules/.cache/nx`.
**Why it happens:** Documented worktree constraint [CITED: AGENTS.md worktree section].
**How to avoid:** For any `nx run-many`/`affected` invocation in a shared-junction worktree, set
`NX_DAEMON=false` and pass `--skip-nx-cache` (the e2e `run` helper already passes `skipNxCache: true`).

## Code Examples

### Strict negative test (the FLIP -- criterion 2)
```typescript
// Source: model on evaluate-result.spec.ts (verified current patterns)
it('strict escalates a dropped in-graph WARNING (maxWarnings unset) to coverage-incomplete; default stays clean', () => {
  const dropped = {
    errorCount: 0,
    warningCount: 0,
    suppressedInGraphWarningCount: 1,
  };

  // default (strict off): CLEAN -- the current behavior locked at evaluate-result.spec.ts:143
  expect(evaluateResult(dropped)).toEqual({ success: true, outcome: 'clean' });

  // strict on: the same dropped in-graph warning now FAILS
  expect(evaluateResult(dropped, { strict: true })).toEqual({
    success: false,
    outcome: 'coverage-incomplete',
  });
});

it('strict does NOT change the error case -- a dropped in-graph ERROR fails either way (regression guard)', () => {
  const droppedError = {
    errorCount: 0,
    warningCount: 0,
    suppressedInGraphErrorCount: 1,
  };

  expect(evaluateResult(droppedError).outcome).toBe('coverage-incomplete');
  expect(evaluateResult(droppedError, { strict: true }).outcome).toBe(
    'coverage-incomplete',
  );
});
```

### Executor threading (executor.ts + normalize-options.ts)
```typescript
// normalize-options.ts: add to NormalizedOptions + return
//   strict: options.strict ?? false
// executor.ts: destructure and forward
const { coreOptions, maxWarnings, failFast, color, strict } =
  normalizeOptions(options, context);
// ...
const { success } = evaluateResult(result, { maxWarnings, strict });
```

### Composition negative-test scaffolding (new install-e2e spec, model on storybook-tarball.int.spec.ts)
```typescript
// Break a composed lib's story -> its OWN typecheck FAILs AND the host's
// dependsOn:["^typecheck"] fan-out FAILs (proves D-05 recipe covers the set).
writeFileSync(join(tmp, 'lib-buttons', 'src', 'button.stories.ts'),
  original.replace('count: 3,', `count: ${JSON.stringify('nope')},`));
const own = run(tmp, 'lib-buttons:typecheck', { env, skipNxCache: true });
expect(own.code).not.toBe(0);
expect(own.stdout).toContain('TS2322');
const fanout = run(tmp, 'storybook-host:typecheck', { env, skipNxCache: true }); // ^typecheck fans out
expect(fanout.code).not.toBe(0);
// Mistyped host refs -> host main.ts FAILs on ordinary TS
writeFileSync(join(tmp, 'storybook-host', '.storybook', 'main.ts'),
  hostMain.replace("url: 'http://localhost:7008'", 'url: 123'));
const badRefs = run(tmp, 'storybook-host:typecheck', { env, skipNxCache: true });
expect(badRefs.code).not.toBe(0);
```
Reuse the `@workspace/test-util` barrel (`findWorkspaceRoot`, `run`, `sh`, `buildCleanEnv`,
`writeVerdaccioNpmrc`, `removeTmpDir`, `inject('verdaccioUrl'/'verdaccioToken')`) [VERIFIED: e2e specs].

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single silent `suppressedCount` | Split `suppressedThirdParty` + `suppressedInGraph*` feeding `coverage-incomplete` | Phase 17 (SB-04) | strict is a thin escalation on this, not new signal |
| `.stories.mdx` (Storybook 6) | Removed in Storybook 7+; plain `.mdx` docs only | SB 7 | Confirms D-03: no real `.stories.mdx` consumer exists |
| Storybook Composition `refs` | Object of `{ title, url, expanded?, sourceUrl? }`; local `http://localhost:*` or remote HTTPS | Storybook 10.4 (current) | Shape for the docs section + mistyped-refs test [CITED] |

**Deprecated/outdated:** `.stories.mdx` (SB6 legacy, removed SB7+); `.stories.tsx` unused by any
Angular + `@storybook/angular` repo (`jsx` unset everywhere) -- both are the evidence base for D-03.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The observable strict FLIP is the dropped in-graph WARNING with `maxWarnings` unset (the error case already fails); the negative test must use the warning case | Summary / Pitfall 1 | If the planner wants strict to also re-label the error case, the one-line edit is insufficient -- but LOCKED semantics ("FAIL on suppressedInGraph > 0") are satisfied by the one-line edit, so risk is low. Flag for planner ratification. |
| A2 | Docs land in `packages/angular-typechecker/README.md ## Storybook` (no `docs/` dir exists; README is the shipped consumer doc) rather than a new `docs/*.md` file | Docs recommendation | CONTEXT D-05/D-10 literally say `docs/*.md`; if a separate file is preferred, create `docs/storybook-composition.md` and link it from the README. Cosmetic placement only. |
| A3 | The Composition e2e belongs in `angular-typechecker-install-e2e` (shared-tarball serialization) as a new spec file | Composition placement | If placed in a new e2e project it would race the shared tarball (ENOENT). Low risk -- pattern is established. |
| A4 | A `strict:true` executor-level integration test against a REAL dropped-in-graph-warning fixture is optional; the pure unit flip + executor threading test suffice | Validation Architecture | Constructing a deterministic in-graph WARNING fixture is nontrivial; pure-core discipline makes the unit test authoritative. |

## Open Questions

1. **Does strict need any observable effect on the ERROR case?**
   - What we know: `suppressedInGraphErrorCount > 0` already returns `coverage-incomplete`
     (success:false) by default; strict cannot escalate it further within the existing `{ success }`
     -> exit 0/1 contract.
   - What's unclear: whether the planner wants a louder executor notice under strict (e.g. rendering
     "strict mode: coverage-incomplete treated as failure"). Not required by D-01.
   - Recommendation: implement the one-line warning-gate edit; keep executor rendering unchanged.
     Optionally add a one-line `logger` note when `strict && (suppressedInGraph* > 0)` for operator
     clarity -- discretion, not required.

2. **Where to record the D-02 / D-03 "not warranted" decisions (criterion 1)?**
   - What we know: README already carries Layout C "not a supported layout" and `.mdx`/`.tsx`
     caveats (README.md:392-405). CONTEXT rationale is the authoritative source.
   - What's unclear: whether a dedicated `19-DECISIONS.md` note is expected in addition.
   - Recommendation: record a short decision note in the phase (cite CONSENSUS D7/D2 + OSS-CANDIDATES
     evidence + the run-typecheck.ts DIRECT-path fact) AND confirm the README caveats reflect it. No
     code. This satisfies criterion 1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm | all | Yes | per engines | -- |
| `typescript` + `@angular/compiler-cli` | unit/integration specs, engine | Yes (node_modules) | 6.0.3 / 22.0.x | -- |
| Vitest (`@nx/vitest`) | all specs | Yes | 4.x | -- |
| Verdaccio local registry | Composition e2e (`nx add`) | Yes (`.verdaccio/`, Phase-18 harness) | existing | -- |
| `@storybook/angular@10.4.6` | Composition e2e refs typing | Force-installed transiently in the spec (NOT a repo dep) | 10.4.6 via `--legacy-peer-deps` | -- |
| `@nx/angular:storybook-configuration` generator | Building the 2 stock composed libs in the fixture | Yes (`@nx/angular` present) | 23.0.1 | Hand-author the Layout A tsconfig shape if the generator is undesirable in the committed fixture |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none blocking. Note: the D-06 fixture may commit the
generator's OUTPUT (a static Layout A shape) rather than run the generator at test time -- consistent
with the existing `consumer-storybook-a/b` fixtures which are hand-committed generator-shaped trees
[VERIFIED: e2e fixture trees].

## Validation Architecture

nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Config file | `vitest.workspace.ts` (root) + per-project vitest configs |
| Quick run command | `npx nx test angular-typechecker` (unit + integration) |
| Full suite command | `npx nx run-many -t test` (adds `angular-typechecker-install-e2e`, serialized) |
| Composition e2e command | `npx nx test angular-typechecker-install-e2e` (Verdaccio + force-install) |

### Phase Requirements -> Test Map
| Item | Behavior (observable) | Test Type | Automated Command | File Exists? |
|------|-----------------------|-----------|-------------------|--------------|
| Strict FLIP | dropped in-graph WARNING (maxWarnings unset): clean by default, coverage-incomplete under `strict:true` | unit | `npx nx test angular-typechecker` (evaluate-result.spec.ts) | Extend existing spec |
| Strict no-op on errors | dropped in-graph ERROR fails under both (regression guard) | unit | same | Extend existing spec |
| Strict schema surface | `strict` present in schema.json + schema.d.ts, default false | unit | same (schema-parity.spec.ts) | Extend existing spec + `EXPECTED_KEYS` |
| Strict option plumbing | `normalizeOptions` forwards `strict` (default false); executor passes it to `evaluateResult` | unit | same (normalize-options.spec.ts, executor.spec.ts) | Extend existing specs |
| Composition: broken composed story | composed lib's OWN `typecheck` FAILs (TS2322) | e2e | `npx nx test angular-typechecker-install-e2e` | NEW spec `storybook-composition-*.int.spec.ts` |
| Composition: dependsOn fan-out | `nx typecheck storybook-host` with `dependsOn:["^typecheck"]` FAILs when a composed lib is broken (recipe covers the set) | e2e | same | NEW spec + NEW fixture `consumer-storybook-composition/` |
| Composition: mistyped host refs | host `main.ts` refs type error -> `nx typecheck storybook-host` FAILs | e2e | same | NEW spec |
| Composition: clean baseline | `nx run-many -t typecheck` (or host typecheck) exits 0 | e2e | same | NEW spec |
| Docs coverage claim | README carries the MUST claim + MUST-NOT + Composition/Layout-C/Angular-CLI caveats | unit (content assertion, optional/light) | `npx nx test angular-typechecker` | Optional NEW `storybook-docs.spec.ts` (grep README strings) |

### Sampling Rate
- **Per task commit:** `npx nx test angular-typechecker` (fast unit/integration; strict + schema + plumbing).
- **Per wave merge:** `npx nx test angular-typechecker-install-e2e` (Composition e2e; serialized, ~minutes).
- **Phase gate:** full suite + `format:check` + `lint` (maxWarnings:0) green before `/gsd:verify-work`
  [CITED: MEMORY verify-format-and-lint-before-release].

### Wave 0 Gaps
- [ ] NEW e2e fixture `e2e/angular-typechecker-install-e2e/fixtures/consumer-storybook-composition/`
      (2 Layout A libs with stories + a composing host with `refs` + `implicitDependencies` +
      `dependsOn:["^typecheck"]`).
- [ ] NEW e2e spec `e2e/angular-typechecker-install-e2e/src/storybook-composition-*.int.spec.ts`
      (clean baseline + 2 negatives + fan-out) -- inherits the serialized harness; force-install
      `@storybook/angular@10.4.6` per Pitfall 3.
- [ ] Extend `evaluate-result.spec.ts`, `schema-parity.spec.ts`, `normalize-options.spec.ts`,
      `executor.spec.ts` for strict.
- [ ] (Optional) `storybook-docs.spec.ts` content-assertion tripwire for the MUST/MUST-NOT claim.

*Existing test infrastructure covers everything else -- no framework install needed.*

## Security Domain

`workflow.security_enforcement` is absent from config.json (treated as enabled). This phase's security
surface is minimal (a boolean verdict option + docs + test fixtures; no auth, no crypto, no network
input, no untrusted data ingestion).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes (minor) | `strict` is a boolean (`?? false`); reuse the existing defensive pattern -- the schema constrains type, and `evaluateResult` treats absent as false. No numeric/NaN class as with `maxWarnings` (already handled at evaluate-result.ts:114-118, "Security V5 / T-03-03"). |
| V6 Cryptography | no | -- |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed option flips verdict to false PASS | Tampering / charter breach | strict can only make the verdict STRICTER (never looser); a bad value defaults false = current behavior |
| e2e fetches an unexpected registry | Spoofing | Reuse `buildCleanEnv({ stripAllNpmConfig: true })` + Verdaccio localhost assertion [VERIFIED: storybook-tarball.int.spec.ts:95,156] |

Charter constant (from CONTEXT/SKILL): NEVER a silent false pass; over-report (false FAIL) is the
acceptable degradation direction. strict only tightens, consistent with the charter.

## Sources

### Primary (HIGH confidence)
- In-repo engine (read this session, current shape):
  `packages/angular-typechecker/src/core/evaluate-result.ts` (verdict + coverage triggers, lines
  87-132), `exit-codes.ts` (dead scaffold; 54-59), `run-typecheck.ts` (dispatch keys on
  `rootNames.length === 0`, line 288 -- the Layout C DIRECT-path evidence for D-02),
  `filter-diagnostics.ts` split counters (referenced), `executors/typecheck/executor.ts` (adapter
  render + warn* helpers), `normalize-options.ts`, `schema.json`, `schema.d.ts`,
  `schema-parity.spec.ts`, `evaluate-result.spec.ts` (line 143 = the clean warning case strict flips).
- In-repo tests/fixtures: `layout-a.integration.spec.ts`, `layout-b.integration.spec.ts`,
  `story-less-guard.integration.spec.ts`, `fixtures/story-less-flat/`, `fixtures/layout-b-*`,
  `e2e/angular-typechecker-install-e2e/src/storybook-tarball.int.spec.ts` + its
  `fixtures/consumer-storybook-a|b/`.
- `.claude/skills/spike-findings-angular-typechecker/SKILL.md` + `references/storybook-input-set-boundary.md`.
- `.planning/research/v0.1.2-storybook/board/CONSENSUS.md` (D2 residual strict-mode, D4, D5, D7,
  trust-lens coverage claim), `.planning/research/v0.1.2-storybook/OSS-CANDIDATES.md`.
- CONTEXT: `19-CONTEXT.md` (all D-01..D-10 decisions).

### Secondary (MEDIUM->HIGH, CITED external)
- Storybook Composition docs (Storybook 10.4): `refs` object shape `{ title, url, expanded?,
  sourceUrl? }`, local + remote support -- https://storybook.js.org/docs/sharing/storybook-composition
- Nx project configuration docs: `dependsOn: ["^typecheck"]` (`^` = run target on all upstream
  dependencies), `implicitDependencies` in project.json -- https://nx.dev/reference/project-configuration

### Tertiary (LOW confidence)
- none (no unverified claims retained).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new deps; all versions locked and verified in-repo.
- Architecture (strict wiring): HIGH -- exact current shape of every touched file read this session.
- Architecture (Composition): HIGH -- model exists (storybook-tarball e2e); external facts CITED.
- Pitfalls: HIGH -- each anchored to a verified line or a shipped test.

**Research date:** 2026-07-07
**Valid until:** ~2026-08-07 (stable; strict is a one-line edit, Composition uses established patterns).
