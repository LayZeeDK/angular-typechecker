# Phase 4: Nx Executor Adapter + Cacheable Target - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 4-nx-executor-adapter-cacheable-target
**Mode:** `--analyze --auto --chain` (auto-lock evidence-backed gray areas; escalate trap-quadrant decisions to the user; auto-advance to plan-phase). Phase-specific research performed before locking; a 5-member Opus review panel (cache-correctness, test-determinism, packaging/hygiene, API-contract, delivery lenses) then red-teamed the decision set at the user's request.
**Areas discussed:** Cacheable target input recipe (EXE-06), TEST-04 fixture topology (TEST-04), Executor adapter composition + schema (EXE-01), EXE-07 runtime verification

---

## Cacheable target input recipe (EXE-06)

| Option | Description | Selected |
|--------|-------------|----------|
| `^production` inlined-source model + executor-id targetDefaults | Hash the dep SOURCE (Angular has no TS project refs) | partial |
| `@nx/js` project-references model (`dependentTasksOutputFiles` + dep `.d.ts`) | The `@nx/js` typecheck approach | |
| `^default` inlined-source model + executor-id targetDefaults | As above but `^default` (covers dep files `production` excludes) | ✓ |

**Resolution:** Auto-locked from source-verified research, then panel-refined `^production`->`^default` for whole-program correctness. HIGH impact + HIGH confidence after research (Nx Rust hasher verified) -> outside the trap quadrant -> auto-locked. See CONTEXT D-07/D-08/D-09/D-10.
**Notes:** Residual hole R1 (the consumer->dep project-graph edge must exist) is the one real way to ship a lying type-checker; guarded by a blocking `nx show target inputs --check` pre-flight in TEST-04.

---

## TEST-04 fixture topology (TEST-04)  — ESCALATED TO USER

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated committed libs | `libs/typecheck-consumer-dep` (non-buildable) + `libs/typecheck-consumer`, paths alias to source, real graph projects | ✓ |
| Reuse the Phase-1 spike app | `apps/ng-spike-app` as consumer + one non-buildable dep | |
| Generate workspace at test time | Throwaway Nx workspace in `tmp/` per run | |

**User's choice:** Dedicated committed libs (Recommended). Rejected alternatives: reuse-spike (couples a churning spike artifact to a determinism-sensitive test), generate-at-test-time (hits the Nx fixture-discovery trap on gitignored `tmp/` + slow).
**Notes:** Escalated because it is HIGH impact (Phase 5 packaging excludes + Phase 6 e2e inherit it) and research left it only a "slight lean" = trap quadrant. The panel CONFIRMED the choice (no panelist rejected it) and hardened it: must be REAL main-graph projects (non-negotiable for the cache test); tag `scope:fixture` + `private:true` + namespaced alias; R1 graph-edge guard; crash-safe revert (not `git checkout`); a dedicated serialized test project (avoid nested-Nx/parallel-forks cache races); run on the main tree. See CONTEXT D-11..D-17.

---

## Executor adapter composition + schema (EXE-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Ship `includeDeps`/`maxWarnings`/`failFast` in Phase 4 | Full schema now; executor is v0.0.1's only user surface | ✓ |
| Defer all three to Phase 5 | Phase 4 ships only `tsConfig` | |
| Ship `includeDeps` only | Middle ground | |

**User's choice:** Ship all three in Phase 4 (Recommended).
**Notes:** Schema scope was the ONE decision the panel genuinely split on (packaging + API lenses: ship now; delivery lens: defer — EXE-03/04/05 are Phase-3 requirements). Escalated to the user as a public-contract decision. The adapter composition itself (auto-locked + panel-refined): hexagonal-lite split (`executor.ts` + pure `normalize-options.ts`), DROP the stale `internal/exit-code.ts`, and ADD a new `renderReport` core seam — the panel found (verified against source) that `formatReport` cannot be called by the adapter as-is (`loadTypescript` private; `runTypecheck` returns no module handles). tsConfig resolves workspace-root-relative; output via raw `process.stdout` + `outputCapture: "direct-nodejs"`. See CONTEXT D-01..D-06.

---

## EXE-07 runtime verification

| Option | Description | Selected |
|--------|-------------|----------|
| Add an executor-boundary RUNTIME proof | Real `nx run` returns NG/template diagnostics (ESM loaded at runtime) | ✓ |
| Reuse the Phase-1 build-time `import(` grep | GATE A only | |

**Resolution:** Auto-locked (LOW-MEDIUM impact, HIGH confidence). GATE A covers the build-time half; Phase 4 adds the runtime half via the TEST-04 `nx run`. No custom hasher (would void the `--check` guard). See CONTEXT D-05.

---

## Claude's Discretion

- Exact fixture project names / `scope:fixture` label / alias string; the injected error code; consumer as app vs lib; the `renderReport` signature; the `normalize-options` return shape; whether to also add a `require()`-the-built-executor int test.
- Verify the non-buildable lib generator flags against Nx 23.0.1 (do NOT copy Nx 19.8 prototype flags); or hand-author the fixture.
- LIVE-verify the consumer->dep graph edge forms before relying on TEST-04 (the R1 guard).
- 5-min spike: confirm a nested `nx` call inside Vitest honors `NX_CACHE_DIRECTORY`.

## Deferred Ideas

- Phase-5 packaging hand-off: `release.projects` scope, `files` allowlist, `tar -tf` tarball assertion, `attw --pack` fixture-alias check, README full `targetDefaults` recipe.
- Buildable/publishable lib fixture + `dependentTasksOutputFiles` PROOF + full 5-project-type matrix + pnpm + mixed-case -> Phase 6.
- One e2e smoke against the packed tarball -> Phase 5.
- `createNodesV2` inference + `typecheck` override -> deferred milestone.
- CLI bin / Angular builder / `ng add`/`nx add` -> deferred milestones (reuse `renderReport`).
- A `mode` enum alongside `failFast` -> not v0.0.1.
