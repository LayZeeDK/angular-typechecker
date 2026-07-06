---
phase: 18
phase_name: "Packaged-tarball e2e + docs"
project: "angular-typechecker"
generated: "2026-07-06"
counts:
  decisions: 4
  lessons: 4
  patterns: 3
  surprises: 3
missing_artifacts: []
---

# Phase 18 Learnings: Packaged-tarball e2e + docs

## Decisions

### D-01 advisory is pure-detect-in-core + render-in-executor, verdict stays green
The `.mdx` / `.tsx`-without-`jsx` "not type-checked" notice was shipped as a new
`CoreResult.notTypeCheckedDeclaredFiles` field populated by a pure `detect-unchecked-declared.ts`
(no `console`/`process`; `ts.sys` allowed) on BOTH the walk and direct engine paths, rendered by a
single executor `logger.warn`. The field is deliberately kept OUT of `evaluate-result.ts`'s
`EvaluateInput` so it can never flip the verdict.

**Rationale:** Criterion 3 requires a loud advisory but a GREEN verdict; the existing
`skippedReferences`/`suppressedInGraphFiles` detection-vs-render split already models this, and
"green by omission from EvaluateInput" is enforceable with a negative test.
**Source:** 18-01-PLAN.md, 18-01-SUMMARY.md

### Committed generator-shaped Storybook fixtures + force-install, not a live generator run
The packaged-tarball e2e uses committed `consumer-storybook-{a,b}` fixtures and force-installs
`@storybook/angular@10.4.6` at runtime, rather than running `nx g @nx/angular:storybook-configuration`
live per e2e.

**Rationale:** A live Storybook generator install per OS-matrix job is heavy and fragile; committed
fixtures are deterministic and the spike-007 forced-SB10 scaffold was scratchpad-only.
**Source:** 18-CONTEXT.md D-02, 18-04-SUMMARY.md

### Two-tier test split: boundary semantics in-repo, shipped artifact in e2e
Fast in-repo `src/core/*.integration.spec.ts` prove the boundary semantics (T5/T6/T9/T10/T11); the
e2e tier proves only the SHIPPED artifact (criterion 1). Phase-17's T1/T2/T3/T4/T7/T8 were NOT
duplicated.

**Rationale:** Keeps the fast feedback loop fast and reserves the service-heavy e2e for the one thing
only it can prove — that the packed tarball installs and catches the error.
**Source:** 18-CONTEXT.md D-03, 18-RESEARCH.md RQ1

### Docs phase authors prose only — no release cut
Phase 18 wrote the README `## Storybook` section + the curated `## 0.1.2` CHANGELOG with the
green->red callout, but did NOT bump the version or create a tag (D-05).

**Rationale:** The release cut runs through the AGENTS.md Release-PR flow after the milestone closes;
`package.json` stays `0.1.1` and no `angular-typechecker@0.1.2` tag exists.
**Source:** 18-05-SUMMARY.md, 18-VERIFICATION.md (D-05 check)

---

## Lessons

### `ts.parseJsonConfigFileContent` silently drops `extraFileExtensions` with `ScriptKind.Unknown`
Enumerating declared `.mdx` files via `extraFileExtensions: [{ extension: 'mdx', scriptKind:
ts.ScriptKind.Unknown }]` produced ZERO `.mdx` in `fileNames` — TypeScript's wildcard file matcher
silently drops an extra extension registered as `Unknown`. The fix is `ScriptKind.Deferred` (the
canonical plugin-handled-extension value), verified against `typescript@6.0.3`.

**Context:** The T11 integration proof (18-03) caught this latent bug in the just-shipped 18-01
detector; the pure unit test (synthetic input) had not exercised the real `parseJsonConfigFileContent`
path. Fixed inline as commit `cd6cc6a`.
**Source:** 18-03-SUMMARY.md

### `nx add` re-resolves the whole dep tree and forwards no flags — install order matters for B-03
`nx add angular-typechecker` re-resolves the ENTIRE dependency tree; with Storybook already installed
(peer-capped Angular `<22`), it aborted on the foreign peer conflict. Installing angular-typechecker
FIRST (against a Storybook-free tree, override-free) then force-installing Storybook (`--legacy-peer-deps`,
separate step) keeps the B-03 no-override peer check honest — it STRENGTHENS B-03, not weakens it.

**Context:** The research recipe installed Storybook first; the executor reordered when `nx add` aborted.
**Source:** 18-04-SUMMARY.md

### The `.tsx`-without-`jsx` advisory over-reports (WR-01 follow-up)
A non-JSX `.tsx` file IS fully type-checked, yet the D-01 detector lists it as "not type-checked"
whenever `compilerOptions.jsx` is unset. The advisory wording should distinguish "JSX/TSX syntax not
checked" from "file not checked". Advisory-only (no verdict impact); flagged as a minor code-review
follow-up, deferred (rare in Angular — no JSX).

**Context:** Code review WR-01 (WARNING, non-blocking). Anticipated by 18-RESEARCH Assumption A1 / Pitfall 3.
**Source:** 18-REVIEW.md

### The verifier returns `human_needed` for service-heavy e2e; the orchestrator can discharge it
The gsd-verifier declined to re-run the ~20-40 min Verdaccio + Storybook install e2e (exceeds its
spot-check budget) and routed criterion 1 to `human_needed`. The orchestrator discharged it by running
the `storybook-tarball` spec directly (green, both layouts) and upgraded the status to `passed` with a
transparent re-verification note.

**Context:** Independent runtime confirmation resolved the gate without a human round-trip.
**Source:** 18-VERIFICATION.md

---

## Patterns

### Advisory `CoreResult` field: `[] -> undefined` conditional-spread + one `logger.warn`, locked green by a negative test
Add a `readonly string[]` advisory field, populate it via pure detection on the surviving-leaf tail
(never before a walk skip `continue`), spread it `walk.x.length > 0 ? { x } : {}`, render it in ONE
executor `logger.warn`, and keep it out of `evaluate-result.ts` — then add a negative test asserting a
result carrying the field with `errorCount===0` stays `{ success: true, outcome: 'clean' }`.

**When to use:** Any new "surface this to the user but never change the verdict" signal in the engine.
**Source:** 18-01-SUMMARY.md

### Packaged-tarball e2e: new FILE in the serialized install-e2e project, foreign peers force-installed separately
Add the e2e as a NEW `*.int.spec.ts` inside `angular-typechecker-install-e2e` (never a new e2e project
— the three e2e projects race on the shared dist tarball). Reuse the `generator-e2e`/`nx-add-npm` harness
(`buildCleanEnv({ stripAllNpmConfig: true })`, `writeVerdaccioNpmrc`, localhost-registry assert). Install
our artifact override-free; force-install foreign peer-capped deps with `--legacy-peer-deps` in a SEPARATE
step. Assert distinct FULL code tokens (`TS2322`/`NG8002`), never bare 4-digit substrings.

**When to use:** Proving a shipped Nx-plugin tarball behaves against a real (peer-incompatible) consumer stack.
**Source:** 18-04-SUMMARY.md, [[e2e-projects-share-one-tarball-serialize]]

### Integration tests over real fixtures catch latent bugs that synthetic unit tests miss
The pure unit test for the `.mdx`/`.tsx` detector passed while the real-`parseJsonConfigFileContent`
integration test failed — the `ScriptKind.Unknown` drop only manifests against the real compiler API.

**When to use:** Any detector/parser that wraps a third-party API — pair the synthetic unit test with a
real-fixture integration test that exercises the actual API surface.
**Source:** 18-03-SUMMARY.md

---

## Surprises

### The T11 integration proof caught a bug in the same milestone's just-shipped engine, mid-phase
18-03's integration fixture immediately exposed that 18-01's `.mdx` enumeration never worked
(`ScriptKind.Unknown`). The integration test paid for itself within the same phase, before any release.

**Impact:** A silent coverage gap (declared `.mdx` never reported) would have shipped in 0.1.2 had the
integration proof been weaker. Fixed inline (`cd6cc6a`).
**Source:** 18-03-SUMMARY.md

### `nx add` aborted on a foreign peer even though the package was pre-installed
Because `nx add` re-resolves the whole tree, a pre-installed but peer-capped `@storybook/angular` still
triggered ERESOLVE — the fix was ordering, not an override.

**Impact:** Reordering install steps (angular-typechecker before Storybook) both fixed the e2e and made
the B-03 honesty guarantee stronger.
**Source:** 18-04-SUMMARY.md

### A phase titled "e2e + docs" contained a net-new engine surface
Success criterion 3 (the `.mdx`/`.tsx` notice) turned out to be net-new engine + executor code, not
just testing/docs — surfaced during discuss-phase by verifying no such notice existed, and flagged in
CONTEXT.md D-01 so the planner shaped the phase correctly.

**Impact:** The phase was planned as "small engine addition + e2e + docs" rather than under-scoped as
pure e2e/docs; avoided a mid-execution scope surprise.
**Source:** 18-CONTEXT.md D-01, 18-RESEARCH.md
