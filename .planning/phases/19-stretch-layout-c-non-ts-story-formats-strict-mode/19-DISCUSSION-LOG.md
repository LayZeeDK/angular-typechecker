# Phase 19: Stretch -- Layout C / non-TS story formats / strict mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 19-stretch-layout-c-non-ts-story-formats-strict-mode
**Areas discussed:** Stretch scope (SB-08), Storybook Composition, OSS real-repo verification, Angular CLI layout
**Mode note:** invoked `--auto --chain --analyze`, but the discussion was ESCALATED to interactive
because the phase sits in the trap quadrant (HIGH impact + NOT-HIGH confidence: two "obvious" auto-defaults
would have reversed recorded board decisions -- D7 Layout C, T11 `.mdx`/`.tsx` -- and the OSS-verify premise
is partly infeasible as literally stated). Per the `--auto` trap-quadrant rule, decisions were surfaced to
the human rather than silently locked. User locked all as recommended.

---

## Stretch scope (SB-08 disposition)

| Option | Description | Selected |
|--------|-------------|----------|
| Strict mode only | Ship opt-in strict; defer Layout C + `.mdx`/`.tsx` with recorded rationale | [x] |
| Nothing new | Record all three deferred; ship no code | |
| Strict + Layout C committed support | Reverses board D7 | |
| All three | + `.mdx`/`.tsx` type-check (no real formats exist) | |

**User's choice:** Strict mode only (SHIP), Layout C verify-guard-only, `.mdx`/`.tsx` deferred -- "Lock all".
**Notes:** Grounded by OSS research: no exact-stack flat Layout C repo exists; the direct path already checks a
flat tsconfig's stories; `.stories.mdx` is SB-6-legacy-removed and `.stories.tsx` is unused in Angular, so
those formats have no real-world consumer. Strict mode reuses the shipped `suppressedInGraph` split counter.

## Storybook Composition (added this discussion)

| Option | Description | Selected |
|--------|-------------|----------|
| Synthetic hybrid fixture + skyux verify | Stock Nx per-project libs + hand-added composing host `refs`; verify skyux | [x] |
| skyux layout as fixture model | Mirror skyux's rootMain-spread shape | |
| Stock Nx only (no hand refs) | Does not actually exercise Composition | |

**User's choice:** Graph-driven model (Option 1); synthetic-hybrid fixture + skyux real-repo verify.
**Notes:** User confirmed Composition needs NO engine change (per-project Layout A + Nx graph fan-out; the
graph edge, not the ref URL, is the source of truth). User raised the localhost-ref sub-case (a
`localhost:PORT` ref could map to an Nx project) -- acknowledged as partially true, but URL resolution
rejected (remote refs unmappable, port heuristic fragile, redundant with the graph, charter-coupling). User
directed: `dependsOn: ["^typecheck"]` NOT in generators (does not always make sense -- fans out to all deps);
ship it as a `docs/*.md` recipe + automated test (preferred), opt-in generator flag as fallback.

## OSS real-repo verification

| Option | Description | Selected |
|--------|-------------|----------|
| Exhaustive exact-stack first, then near-hits/fallbacks | Ng22+Nx23 (stretch Nx22) first; log near-hits | [x] |
| Relaxed 1-2 versions off from the start | -- (folded into the above ordering) | |
| Skip real-OSS, in-repo fixtures only | Does not fulfill the real-OSS ask | |

**User's choice:** Find best-suited OSS candidates for ALL layouts + stretch; exact stack first, note near-hits;
1-2 versions off acceptable as forward-compat indicators. Execution split: deterministic SHIP bucket runs
autonomously; OSS VERIFY is a manual, informational post-phase checklist. Layout A proof accepted OFF-STACK
(no cuentoneta Ng21->22 upgrade).
**Notes:** Three parallel research agents (Layout A / Layout B / Layout C+stretch) -> `OSS-CANDIDATES.md`.
Key finding: exact-stack repos exist but the stack x layout matrix is nearly empty -- only `radix-ng/primitives`
is exact-stack + a target layout (Layout B). License/size relaxed (local uncommitted verification clones).

## Angular CLI layout

| Option | Description | Selected |
|--------|-------------|----------|
| Keep deferred (GEN-FUT-01/02) | Not built in v0.1.2; docs caveat as planned/deferred | [x] |
| Expand scope to target CLI / `ng add` shape | Would need standalone CLI or `angular.json` builder | |

**User's choice:** Keep deferred for now.
**Notes:** User corrected the framing -- Angular CLI support is a DEFERRED future requirement (GEN-FUT-01/02),
not "unsupported forever." Default CLI layout = base tsconfig + leaf tsconfigs orchestrated by `angular.json`,
no `references[]`, no solution tsconfig; the scaffolder (`ng add` vs `nx g`) determines the layout even inside
Nx (`mushilu-san` example). Docs caveat reworded to "planned/deferred," not "unsupported."

## Claude's Discretion

- Exact `strict` option name/schema wording, fixture directory layout, and test-file organization
  (standard patterns; planner/executor decide). The `strict` semantics are locked (FAIL on
  `suppressedInGraph > 0`, default off, pure option).

## Deferred Ideas

- Layout C committed support beyond the guard (verify guard only).
- `.mdx`/`.tsx` type-check beyond the shipped advisory.
- Angular CLI `angular.json` (GEN-FUT-01) / `ng add` schematic (GEN-FUT-02) -- future milestone.
- Strict mode as a default (stays opt-in).
- URL-based `refs` resolution for Composition (rejected).
- `dependsOn: ["^typecheck"]` as a generator default/flag (docs recipe + test only for now).
