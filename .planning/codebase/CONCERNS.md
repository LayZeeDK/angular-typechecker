# Codebase Concerns

**Analysis Date:** 2026-06-30

> **Context for the reader.** `angular-typechecker` v0.0.3 shipped and was audited
> "passed, 16/16, zero tech debt" (`.planning/STATE.md`). This analysis confirms that:
> there are **no** TODO/FIXME/HACK/XXX markers anywhere in `packages/`, `e2e/`, or
> `apps/` source; the known coupling points are _deliberate, documented, and guarded_;
> and the items most likely to be mistaken for debt are **intentionally-deferred future
> scope**, not shortcuts. The sections below therefore lean heavily on _fragile areas_
> (coupling that future Angular upgrades will stress) and _dependencies at risk_, and
> are explicit about what is NOT debt. Treat this as a maintenance-risk map, not a
> defect list.

## Tech Debt

**No source-level tech debt markers detected.**

- A repo-wide scan (`git grep -e TODO -e FIXME -e HACK -e XXX` over `packages/`,
  `e2e/`, `apps/`) returns **zero** matches. The known carried-forward items are
  tracked in `.planning/STATE.md` (Blockers/Concerns) and `.planning/PROJECT.md`
  (Out of Scope), not as in-code shortcuts.

**Dev-repo `.npmrc legacy-peer-deps=true` (carried-forward, NOT consumer-facing):**

- Issue: `@nx/angular@23.0.1` caps its `@angular/build` / `@angular-devkit/*` /
  `@schematics/angular` peers at `< 22.0.0`, but the locked stack is Angular 22.x.
  The dev workspace installs the Angular-22 tree against the Nx-23 plugin only with
  `legacy-peer-deps=true`.
- Files: `.npmrc` (repo root). The rationale is documented inline in that file and in
  `.planning/STATE.md:50`.
- Impact: **dev workspace only.** Verified contained: `.npmrc` lives at the repo root
  and is NOT in the published `files` whitelist (`packages/angular-typechecker/package.json`
  ships only `src`, `executors.json`, `README.md`, `LICENSE`). A clean tarball install
  on stable Angular 22.0.4 + Nx 23.0.1 needs no override. The flag does not reach
  consumers.
- Fix approach: drop the flag when a stable `@nx/angular` (the 23.1.x line) ships peers
  that admit Angular 22. Re-test a fresh `npm install` without the override at that point.

**Manual executor target wiring (intentional for this milestone, low residual cost):**

- Issue: consumers must hand-author the `angular-typecheck` target in their
  `project.json`; there is no `createNodesV2` inferred-target plugin and no
  `nx add` / `ng add` schematic yet.
- Files: documented in `README.md`; scope decision in `.planning/PROJECT.md` Out of Scope.
- Impact: a small DX papercut for consumers, not a correctness or maintenance risk.
- Fix approach: deferred to a future milestone (inferred targets / generators family).
  This is scope, not debt.

## Known Bugs

**None identified.**

- The error-handling posture is fail-safe by construction: any non-`TypecheckInfrastructureError`
  throw is RE-THROWN by the executor rather than swallowed
  (`packages/angular-typechecker/src/executors/angular-typecheck/executor.ts:76-86`),
  on the stated principle that "a type-checker that silently swallows an unknown failure
  and reports success is worse than none." Infrastructure failures (compiler crash,
  config-resolution crash) are detected by the synthesized `UNKNOWN_ERROR_CODE` (500)
  at two stages and surfaced distinctly, never counted as type errors
  (`run-typecheck.ts:167-178`, `:244-252`).

## Security Considerations

**Publish pipeline (tokenless OIDC) -- hardened, low risk:**

- Posture: `.github/workflows/release.yml` publishes via npm Trusted Publisher OIDC with
  **no `NODE_AUTH_TOKEN`** present (`:84-100`); `id-token: write` is the only elevated
  permission and it is granted on the publish job only (`:44-47`); top-level scope is
  `contents: read` (`:33-34`). Trust is pinned to the exact workflow filename
  (`release.yml`) + the `npm-publish` environment, which carries a Required-Reviewer
  manual-approval gate (`:42-43`). Every action is SHA-pinned to a 40-char commit
  (tj-actions mitigation); `persist-credentials: false` on checkout.
- Risk: the `npm-publish` environment approval is a **human-only gate** -- it must never
  be auto-approved (see `MEMORY.md` "Never approve GitHub deployments"). The OIDC
  Trusted-Publisher exact-match config (org/repo/workflow/environment) lives on npmjs.com
  and is the single off-repo dependency; a mismatch surfaces as a 404/ENEEDAUTH at publish
  (documented inline at `:64-100`).
- Current mitigation: triggers on TAG PUSH only (never the untrusted-PR-code trigger that
  was the s1ngularity vector); the publish job has a defense-in-depth `if:` re-asserting
  the release-tag ref (`:54`).
- Recommendations: keep the manual environment gate; keep `NODE_AUTH_TOKEN` unset; never
  re-enable `changelog.workspaceChangelog.createRelease: "github"` (the `release.git.push:
false` + `createRelease: false` pairing is load-bearing -- see `AGENTS.md` LANDMINE).

**`main` is PR-only with an empty bypass list -- a deliberate trade-off:**

- Risk: the Default-branch ruleset has an EMPTY bypass list, so even the repo owner cannot
  push directly to `main`. The cost is a **lockout** if the required `ci` check goes red or
  stops reporting -- the merge button blocks with no bypass.
- Files: enforced by GitHub repo settings (not in-tree); recovery procedure documented in
  `AGENTS.md` ("Lockout recovery").
- Current mitigation: recover by toggling the ruleset `enforcement` to `disabled`, pushing
  the fix, then re-enabling -- preferred over a standing bypass actor (which would
  permanently weaken the PR-only guarantee). Release TAGS are governed by a SEPARATE
  ruleset, so tag pushes are not blocked by the empty branch bypass.
- Recommendation: keep the empty bypass; never add a standing bypass actor to work around a
  transient red check.

**No secrets handled in source.** The plugin reads only tsconfig paths and emits no
network calls; the core layer is PURE (eslint bans `console`/`process` under
`**/src/core/**`, enforced by the fail-safe-realpath comment at `filter-diagnostics.ts:152`).

## Performance Bottlenecks

**Cold-start ESM load dominates a single run (inherent, mitigated):**

- Problem: each `runTypecheck` cold call pays the ESM module load of
  `@angular/compiler-cli` + `typescript` plus the config parse before any compilation.
  This is the dominant cold-start cost.
- Files: `run-typecheck.ts:123-137` (timer started at the very top to report honest
  wall-clock); `compiler-loader.ts:16-20` and `run-typecheck.ts:520-531` memoize the
  loaded modules after the first call.
- Cause: `@angular/compiler-cli` is ESM-only and must be reached via `await import()` from
  the CommonJS executor; the whole-program type-check itself is the separable cost the tool
  exists to isolate (this is the product's value, not a bottleneck to remove).
- Improvement path: Nx target caching (the executor is a cacheable target) amortizes
  re-runs; the loader memoization amortizes repeated in-process calls. A future
  `NgtscProgram` incremental engine (deferred) would enable warm/incremental re-checks.

**Per-file template loop over all source files (bounded, deduped):**

- Problem: the HYBRID gatherer iterates every non-declaration source file calling
  `getNgSemanticDiagnostics(fileName)` (`gather-diagnostics.ts:80-86`), which can produce
  duplicates of the residual whole-program call.
- Cause: the deliberate strict-superset choice (RES-01 spike GO=HYBRID) to avoid
  under-gathering shim-attached non-template diagnostics.
- Improvement path: none needed -- `ts.sortAndDeduplicateDiagnostics` in `finalize`
  (`run-typecheck.ts:422`) removes the duplicates for free; the filter canonicalizer
  memoizes per-path realpath resolution (`filter-diagnostics.ts:131-164`) so a hot run over
  thousands of components does not re-resolve the same directory.

## Fragile Areas

**Vendored `@angular/compiler-cli` structural shim (the single highest-coupling point):**

- Files: `packages/angular-typechecker/src/core/compiler-cli-types.ts` (the hand-declared
  structural surface), `packages/angular-typechecker/src/core/diagnostic-codes.ts`
  (the NG-code encoding + the `IMPORT_GENERATION_FAILURE = 3004` literal).
- Why fragile: the production `nodenext` build resolves `@angular/compiler-cli`'s published
  barrel EMPTY (its `index.d.ts` re-exports with extensionless relative paths that strict
  nodenext ESM resolution refuses), so the engine cannot import the real typings. The shim
  therefore **hand-mirrors** a deliberate subset of the real `api.Program` (the 6 diagnostic
  getters), the `EmitFlags` enum (`DTS=1..All=31`, NO `None`), `UNKNOWN_ERROR_CODE = 500`,
  and `ParsedConfiguration` / `PerformCompilationResult` shapes -- all pinned to
  `@angular/compiler-cli@22.0.4`. An Angular upgrade that removes, renames,
  signature-changes, or renumbers any of these would break the engine at runtime if it
  passed the build silently.
- Safe modification (the guardrails that make this _managed_ fragility, not debt):
  1. **Build-time drift tripwire** -- `compiler-cli-types.drift.ts` imports the REAL named
     types from `@angular/compiler-cli` and asserts `real -> shim` assignability per getter,
     plus value-level pins on `EmitFlags` members and `UNKNOWN_ERROR_CODE`. It compiles ONLY
     under `tsconfig.drift.json` (classic node10 resolution) via the `typecheck-drift` Nx
     target (`project.json:45-61`), is EXCLUDED from `tsconfig.lib.json`
     (`tsconfig.lib.json:18`) so it never ships, and is NOT in the `files` whitelist. CI
     runs it in every matrix cell (`ci.yml:114`). A removed/renamed/return-changed getter
     fails the build at its exact tuple slot.
  2. **Call-site arity probes** in the same file (`compiler-cli-types.drift.ts:108-140`)
     catch the silent `optional -> required` parameter change that assignability alone
     misses (method-param bivariance).
  3. **Runtime getter-set spec** (`compiler-cli-types.runtime.spec.ts`) surfaces a
     newly-ADDED upstream getter out-of-band (the shim is a deliberate subset, so additions
     are intentionally NOT a build failure).
- Test coverage: strong -- drift assertions + runtime getter-set spec + the integration
  tier (`*.integration.spec.ts`) exercise the real compiler. The fallow config declares the
  drift file an entry point and pins the `EmitFlags` / `UNKNOWN_ERROR_CODE` exports so they
  are not flagged unused (`.fallowrc.jsonc:9-21`, `:34-43`).
- **When you bump Angular: run `nx run angular-typechecker:typecheck-drift` first.** A red
  drift target is the designed signal to widen the shim. Do NOT remove the
  `getNgStructuralDiagnostics` call (`gather-diagnostics.ts:74`) or the retained getter
  without retiring its drift/runtime gates -- it returns `[]` at 22.0.4 but is kept so a
  future Angular that reactivates it cannot silently under-gather.

**`EmitFlags: 0` cast and the emit-neutralizing override:**

- Files: `run-typecheck.ts:212-239`.
- Why fragile: the engine passes the literal `0` as `emitFlags` (the emit-neutralizing
  value) which is NOT a declared `EmitFlags` member, so the call site uses an explicit
  `0 as EmitFlags` cast (a bare `: EmitFlags = 0` errors TS2322 at tsc 6.0.3). The override
  block (`noEmit`, `composite: false`, `declaration: false`, etc.) is verbatim from
  `02-CONTEXT.md` and every key is load-bearing (`emitFlags: 0` AND `noEmit: true` are BOTH
  required -- one suppresses i18n emit, the other the clean fall-through to `ts.Program.emit`).
- Safe modification: do not "simplify" the override or drop the cast; both are covered by
  the integration specs (`no-emit-override.integration.spec.ts`, `suppress-output-path.integration.spec.ts`).

**TCB-generation Fatal detection by exact code (NG3004):**

- Files: `diagnostic-codes.ts:81-94` (`IMPORT_GENERATION_FAILURE_CODE = 3004`,
  `TCB_GENERATION_FATAL_DIAGNOSTIC_CODE = NG(3004) = -993004`); detection in
  `run-typecheck.ts:474-489`; notice in `executor.ts:52-63`.
- Why fragile: this couples to a single Angular-internal behavior -- that NG3004 is the ONLY
  `FatalDiagnosticError` thrown from the Type-Check-Block path at v22.0.4, and that it aborts
  shim generation for ALL files. If a future Angular changes which Fatal code aborts TCB
  priming, the loud "template check incomplete" notice would mis-fire or miss.
- Safe modification: detection is code-only (never `source`/message-text matching, the same
  discipline as the infra-500 scans) and scans the PRE-filter set so an out-of-project Fatal
  still fires the notice. The behavior is pinned by `infra-failure.spec.ts` and
  `run-typecheck.spec.ts`; re-verify the "only NG3004 aborts TCB" assumption on any Angular
  bump (it is the same limit `@angular/build` has today).

**`.ngtypecheck.ts` shim-name string surgery:**

- Files: `run-typecheck.ts:510-518` (`normalizeShimFileName`).
- Why fragile: maps a generated shim path back to its source by stripping the
  `.ngtypecheck` infix via regex, mirroring the compiler's
  `fileName.replace(/\.tsx?$/, ".ngtypecheck.ts")`. Documented LIMITATION (WR-01): a
  `.tsx`-sourced component collapses to the same shim name, so the notice would name it
  `<name>.ts`. This affects ONLY the advisory notice's path string -- never the verdict,
  counts, or the diagnostic's own codeframe.
- Safe modification: low stakes (`.tsx` Angular sources are vanishingly rare). If `.tsx`
  support is ever in scope, resolve the source via the program's source-file map instead of
  string surgery.

## Scaling Limits

**Not applicable as a service.** This is a per-project CLI/executor invoked by Nx or CI, not
a long-running process. The relevant "scale" axis is project size (number of source files);
the per-file gather loop and the memoized realpath canonicalizer are linear in file count
with no quadratic hot paths identified.

## Dependencies at Risk

**`@angular/compiler-cli` (peer, ESM-only, pinned to 22.x behavior):**

- Risk: the entire engine is built on internal-adjacent surfaces of this package (the
  diagnostic getters on `api.Program`, `EmitFlags`, `UNKNOWN_ERROR_CODE`,
  `defaultGatherDiagnostics`, the NG3004 TCB-abort behavior). The published peer range is
  `^22.0.0`. A minor/major Angular release can shift any of these.
- Impact: silent under-gathering or a mis-fired suppression notice if a shape changes
  unguarded.
- Migration plan: the build-time drift tripwire + runtime getter-set spec are the early-
  warning system (see Fragile Areas). Widen the peer range only after the drift target is
  green against the new Angular and the integration tier passes. **Verify only against
  STABLE Angular** (22.0.4), never `next`/`rc` (`MEMORY.md` "Stable Angular only for
  verification").

**`@nx/devkit` (pinned `dependency` `23.0.1`):**

- Risk: pinned exact, and its own `nx` peer (`>= 22 <= 24 || ^23.0.0-0`) is WIDER than the
  Nx-23-only intent. The plugin cannot prevent installs on Nx 22/24 via the peer.
- Impact: a consumer on Nx 22/24 could install without an npm peer warning; behavior is only
  validated on Nx 23.
- Migration plan: documented "Nx 23 only" expectation; the `engines.node` field warns on
  unsupported Node. Re-pin in lockstep when bumping Nx.

**`typescript` (peer `>=6.0.0 <6.1.0`):**

- Risk: the `0 as EmitFlags` cast and several option-override behaviors are pinned to tsc
  6.0.x semantics (e.g. the TS2322 behavior on a bare enum assignment).
- Impact: a TS 6.1+/7 bump could change option shapes or enum assignability.
- Migration plan: deliberately narrow range (TS 7 is out of scope per PROJECT.md); widen
  only with a re-run of the full integration tier.

## Test Coverage Gaps

**No material gaps identified in the shipped scope.** Coverage is dense for a package this
size: 25 spec files (unit + integration) against 14 source files, including dedicated
drift/runtime-pin specs (`compiler-cli-types.runtime.spec.ts`), fault-isolation integration
tests (`fault-isolation.integration.spec.ts`), gate differentials
(`gate-a-static.spec.ts`, `gate-b.spec.ts`), schema parity
(`schema-parity.spec.ts`), and package-manifest assertions (`package-manifest.spec.ts`).
Three rounds of PR review hardened the test set in v0.0.3 (`.planning/STATE.md` Quick Tasks).

The genuinely uncovered behaviors are all **intentionally-deferred future scope** (see below),
not gaps in what shipped.

## Intentionally-Deferred Future Scope (NOT debt)

> These are tracked as Future Requirements in `.planning/PROJECT.md` (Out of Scope) and
> `.planning/STATE.md` (Deferred Items). They are **scope decisions, not shortcuts** --
> listed here so a future planner does not mistake them for tech debt to "fix."

| Item                                     | What is deferred                                                                                                                                                                        | Why it is scope, not debt                                                                                                                                                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **REP-RES-02b**                          | Faithful per-file TEMPLATE/extended (NG8xxx) diagnostic recovery AFTER a TCB-generation Fatal (NG3004). Today survivors' template diagnostics are suppressed and the loud notice fires. | Needs the `NgtscProgram` / `OptimizeFor.SingleFile` incremental engine. This is the SAME limitation `@angular/build` has today; v0.0.3 ships detection + a loud notice instead of silent incompleteness. Deferred to the `NgtscProgram` milestone. |
| **OBS-01**                               | A `totalFilesCount` field on `CoreResult` (`@nx/js` parity).                                                                                                                            | Deferred pending charter-fit; additive observability, no correctness impact.                                                                                                                                                                       |
| **Standalone CLI surface**               | A `bin` entry that owns the literal OS exit code `2` (consuming the pure `toExitCode` policy already present in `exit-codes.ts`).                                                       | The Nx executor maps to Nx's `{ success }` contract (0/1); literal exit `2` belongs to the deferred CLI. PROJECT.md Out of Scope.                                                                                                                  |
| **JSON / SARIF reporters**               | Machine-readable output formats. Default output is `@angular/compiler-cli`'s `formatDiagnostics` (a `tsc` superset).                                                                    | Deferred to a reporters milestone; the SARIF CI path also needs `security-events: write`, which contradicts the current `contents: read` CI posture (`ci.yml:146-150`).                                                                            |
| **Inferred targets / generators**        | `createNodesV2` auto-wiring, `nx add` / `ng add` schematics, `migrations.json`.                                                                                                         | v0.0.1/v0.0.3 ship manual target wiring deliberately (smallest valuable slice).                                                                                                                                                                    |
| **INF / GEN / SUR / REP / SUP families** | Broader feature families carried from v0.0.1.                                                                                                                                           | Roadmap scope for later milestones.                                                                                                                                                                                                                |

---

_Concerns audit: 2026-06-30_
