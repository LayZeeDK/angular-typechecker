# Phase 19: Stretch -- Layout C / non-TS story formats / strict mode - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

The FINAL v0.1.2 phase. Two pillars, both locked this discussion:

1. **Meet the stretch (SB-08) selectively** -- ship the ONE low-risk, board-blessed item
   (opt-in strict mode); record the other two SB-08 items (Layout C committed support;
   `.mdx`/`.tsx` type-check) as "not warranted" with rationale, satisfying phase-19 success
   criterion 1 ("a decision is recorded for Layout C support beyond the no-silent-pass guard").
2. **Add Storybook Composition as a supported topology** (NEW, added this discussion) -- via a
   fixture + docs recipe + tests, with NO core-engine change.

Plus a **post-phase, real-OSS verification** of the whole v0.1.2 milestone as an installed
tarball (informational, manual -- board D5).

Every shipped item carries a negative test (phase-19 success criterion 2).

**Not in this phase:** Layout C committed support beyond the guard; `.mdx`/`.tsx` type-check
beyond the shipped advisory; Angular CLI / `ng add` support (all deferred -- see Deferred Ideas).
No breaking change; additive-only (0.x semver, `feat` -> patch 0.1.1 -> 0.1.2).

</domain>

<decisions>
## Implementation Decisions

### Stretch scope -- SB-08 disposition
- **D-01 (SHIP): opt-in strict mode.** Add a `strict` executor/core option (DEFAULT `false`) that
  escalates the existing coverage-incomplete outcome (`suppressedInGraph > 0`) from non-clean to a
  HARD FAIL. It is a thin escalation on top of the SB-04 split counter + coverage-incomplete
  outcome already shipped in Phase 17 (`evaluate-result.ts`); additive, board-blessed (CONSENSUS D2
  residual: "reserve fail-on-`suppressedInGraph` for a future opt-in strict mode"). NOT a default
  (default stays coverage-incomplete). Negative test (criterion 2): a host with a dropped in-graph
  diagnostic FAILs under `strict:true`, stays coverage-incomplete under the default.
- **D-02 (DEFER, record "not warranted"): Layout C committed support beyond the guard.** Rationale
  (evidence-backed): NO exact-stack (Ng22/Nx23) flat Layout C repo exists (OSS-CANDIDATES.md); it is
  a rare deliberate pattern; the DIRECT path ALREADY checks a flat tsconfig's declared stories
  (`run-typecheck.ts` dispatch keys on `parsed.rootNames.length === 0`, NOT on references -- a flat
  tsconfig with a populated `include` takes the direct single-leaf path and checks its rootNames incl.
  stories); board D7 ("Exclude from committed support ... Build nothing else"). We VERIFY the
  no-silent-pass guard on a real Layout C repo (bitwarden, informational) but ship NO committed-support
  code or claim.
- **D-03 (DEFER, record "not warranted"): `.mdx`/`.tsx` type-check beyond the shipped advisory.**
  Rationale: `.stories.mdx` is Storybook-6 legacy, REMOVED in Storybook 7+ (nonexistent in current
  repos); `.stories.tsx` is used by NO Angular + `@storybook/angular` repo (`jsx` unset everywhere) --
  no real-world consumer to justify a fragile MDX->TS extraction pipeline. The `.mdx` "not
  type-checked" advisory (`detect-unchecked-declared.ts`, Phase 18) ALREADY ships; we verify it on
  radix-ng.

### Storybook Composition (NEW supported topology)
- **D-04 (engine: NONE).** Composition is a multi-project TOPOLOGY, not a tsconfig layout: each
  composed project AND the host are per-project Layout A projects; the host `main.ts` `refs` object is
  type-checked as ordinary TS config today. Coverage = per-project `typecheck` + Nx graph-driven
  fan-out (`nx affected -t typecheck` / `nx run-many`). The Nx graph edge (`implicitDependencies` --
  e.g. radix-ng's host declares `implicitDependencies: ["primitives"]`), NEVER the ref URL, is the
  source of truth. REJECTED: resolving `refs` URLs to source (partial -- remote refs like
  `https://ds.example.com` are unmappable; fragile -- ports/async/env; redundant with the graph;
  charter-coupling to Storybook config -- board D4 "no coupling to Storybook packages").
- **D-05 (`dependsOn: ["^typecheck"]` DX = docs recipe + test, NOT generators).** The "one command
  checks the composed set" DX ships as a recipe in the `README.md ## Storybook` section (RESOLVED
  2026-07-07: no `docs/` dir exists; README is the shipped consumer doc where the SB-07 coverage claim
  already lives -- keeping the whole Storybook story in one place) + an automated test that exercises it.
  NOT wired into `init`/`configuration` generators, because `^typecheck` fans out to ALL dependencies
  unconditionally -- as a generator default it would silently change every consumer's typecheck target
  semantics/graph. (Opt-in generator flag is the fallback if ever wanted turnkey; not now.)
- **D-06 (Composition fixture = synthetic hybrid).** Stock `nx g @nx/angular:storybook-configuration`
  on 2 libs + a hand-added composing host `main.ts` with `refs` per Storybook docs. Negative test: a
  broken composed story FAILs via its OWN project's target; a mistyped host `refs` entry FAILs.
  Real-repo verify: `blackbaud/skyux` (exact-stack, stock `@storybook/angular` Composition via `refs`),
  informational.

### Angular CLI (deferred -- confirmed)
- **D-07 Angular CLI / `ng add @storybook/angular` shape stays DEFERRED** (GEN-FUT-01 `angular.json`
  support + GEN-FUT-02 `ng add` schematic; a FUTURE milestone) -- NOT built in v0.1.2. The default
  Angular CLI layout is a base `tsconfig.json` + per-target/per-project leaf tsconfigs orchestrated by
  `angular.json`, with NO `references[]` and NO solution tsconfig -- distinct from the supported Nx
  Layout A/B. The SCAFFOLDER determines the layout: `ng add` yields the no-references shape even inside
  an Nx workspace (`mushilu-san/Mushilu-San-UI` is a real exact-stack example). Docs caveat words this
  as PLANNED/deferred, NOT "unsupported." `mushilu-san` is a forward-looking reference for the GEN-FUT
  work, NOT a phase-19 verification target.

### Execution split + Layout A proof
- **D-08 (split).** (a) DETERMINISTIC SHIP bucket -- strict mode + Composition fixture/recipe + docs +
  negative tests -- is planned + executed autonomously (`--chain`) and CI-gated. (b) OSS real-repo
  VERIFY bucket is a MANUAL, informational post-phase checklist (exact repos + commands in
  OSS-CANDIDATES.md), run interactively, NOT inside the autonomous executor and NOT a CI gate (board
  D5: "OSS repos are informational only").
- **D-09 (Layout A proof off-stack).** Accept `cuentoneta` OFF-STACK (Ng 21, `--legacy-peer-deps`) as
  a forward-compat indicator rather than performing the Ng21->22 upgrade, because Layout A is ALREADY
  proven on-stack by the in-repo generator fixtures (Phases 17-18). The Angular upgrade is not
  undertaken.

### Docs (SB-07 extension)
- **D-10 Docs additions:** a Storybook Composition section (per-project model + graph fan-out + the
  `dependsOn: ["^typecheck"]` recipe); a Layout C verification note; the Angular-CLI planned/deferred
  caveat; and a precise Composition coverage claim in the board trust-lens style -- MUST: "each
  composed project's declared TS surface is type-checked when a `typecheck` target points at that
  project's solution tsconfig; `nx run-many`/`affected` covers the set." MUST NOT: "we verify the
  composed refs resolve or deploy" (those are runtime URLs).

### Claude's Discretion
- The exact `strict` option name/schema wording, the fixture directory layout, and test-file
  organization -- standard patterns; planner/executor decide. The `strict` SEMANTICS (FAIL on
  `suppressedInGraph > 0`, default off, pure option threaded through `evaluateResult`) are LOCKED.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v0.1.2 governing records
- `.planning/ROADMAP.md` -- Phase 19 goal + two success criteria (decision recorded + negative test).
- `.planning/REQUIREMENTS.md` -- SB-08 (the three stretch items), GEN-FUT-01/02 (deferred Angular CLI),
  Out of Scope.
- `.planning/research/v0.1.2-storybook/board/CONSENSUS.md` -- D2 residual (strict mode is the blessed
  future opt-in), D4 (no Storybook coupling / no version gate), D5 (OSS informational only), D7 (Layout
  C excluded from committed support, "build nothing else").

### OSS verification (this discussion's research)
- `.planning/research/v0.1.2-storybook/OSS-CANDIDATES.md` -- THE verification target set (all layouts +
  Composition + stretch formats), exact versions, evidence, suitability, and the recommended
  target->repo mapping. (Supersedes the Layout-A-only `OSS-EXAMPLES.md`.)
- `.planning/research/v0.1.2-storybook/OSS-EXAMPLES.md` -- prior Layout A research (context).

### Engine (the code strict mode + the fixtures touch)
- `.claude/skills/spike-findings-angular-typechecker/` -- shipped engine + the Storybook input-set
  boundary blueprint (`references/storybook-input-set-boundary.md`).
- `packages/angular-typechecker/src/core/run-typecheck.ts` -- walk-vs-direct dispatch (keys on
  `rootNames.length`, explains the Layout C direct-path behavior in D-02).
- `packages/angular-typechecker/src/core/evaluate-result.ts` -- the coverage-incomplete outcome strict
  mode (D-01) escalates.
- `packages/angular-typechecker/src/core/detect-unchecked-declared.ts` -- the `.mdx`/`.tsx` advisory
  (D-03) already shipped.
- `packages/angular-typechecker/src/core/filter-diagnostics.ts` (`keep()`), `walk-references.ts` --
  boundary + walk (referenced by the Composition per-project model, D-04).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Coverage-incomplete outcome + `suppressedInGraph` split counter** (SB-04, `evaluate-result.ts`) --
  strict mode (D-01) is a thin escalation on top; NO new signal needed.
- **`configuration` / `init` generators** (Phase 14) -- wire `typecheck` targets for the Composition
  fixture's per-project setup.
- **Packaged-tarball e2e harness** (Phase 18, Verdaccio `nx add`) -- the pattern for both the
  Composition fixture e2e and the manual OSS verification.
- **`detect-unchecked-declared.ts` + `notTypeCheckedDeclaredFiles`** -- the shipped `.mdx` advisory
  verified (not extended) on radix-ng.

### Established Patterns
- **Pure core** (no Nx devkit / `console` / `process`): `strict` must be a pure option threaded
  `CoreOptions -> evaluateResult -> exit code`; the executor renders. Negative-test-as-acceptance-gate
  (board D5).
- **Storybook install reality:** `@storybook/angular@10` on Angular 22 needs `--legacy-peer-deps`;
  `nx add` on pnpm hits `ERR_PNPM_IGNORED_BUILDS` (use the `allowBuilds`/`--ignore-scripts` workaround
  proven in the 260704-wnq e2e specs).

### Integration Points
- `strict` flows `CoreOptions -> evaluateResult -> toExitCode` + executor render (one thin path).
- Composition recipe touches `docs/*.md` + a NEW synthetic-hybrid fixture + its negative test; NO
  engine/boundary/walk change (D-04).

</code_context>

<specifics>
## Specific Ideas

Concrete verification targets (exact versions/evidence/suitability in `OSS-CANDIDATES.md`):
- **Layout B (on-stack):** `radix-ng/primitives` (Ng 22.0.2 / Nx 23.1.0-beta.1 / TS 6.0.3, MIT,
  as-is; pnpm workaround) -- also covers the `.mdx` advisory.
- **Layout B external-`templateUrl` kill-shot:** `geonetwork/geonetwork-ui` (Ng 20.3 / Nx 22.0.4,
  off-stack) -- the only real repo that exercises the T3 NG8002 case.
- **Layout A:** `cuentoneta/cuentoneta` (Nx 23.0.1 exact, Ng 21, stock `@storybook/angular`) --
  off-stack indicator (D-09).
- **Layout C guard:** `bitwarden/clients` (Ng 21 / Nx 22.6, flat, off-stack).
- **Composition:** `blackbaud/skyux` (Ng 22.0.1 / Nx 23.1.0-beta.2 / TS 6.0.3, stock, exact-stack).
- **Angular CLI shape (deferred reference only):** `mushilu-san/Mushilu-San-UI` (exact stack).

Charter constant throughout: NEVER a silent false pass; over-report (false FAIL) is the acceptable
degradation direction. No Storybook coupling, no ngtsc internals.

</specifics>

<deferred>
## Deferred Ideas

- **Layout C committed support beyond the guard** (SB-08) -- verify the guard only (D-02); stays
  deferred.
- **`.mdx`/`.tsx` story type-checking beyond the advisory** (SB-08) -- advisory only (D-03); stays
  deferred. (No real-world formats exist: `.stories.mdx` is SB-6-legacy-removed; `.stories.tsx`
  unused in Angular.)
- **Angular CLI `angular.json` support (GEN-FUT-01) + `ng add` Angular CLI schematic (GEN-FUT-02)** --
  a future milestone (D-07). `mushilu-san` is the forward-looking reference.
- **Strict mode as a DEFAULT** -- stays opt-in (D-01).
- **URL-based `refs` resolution for Composition** -- rejected (infeasible/partial/charter, D-04).
- **`dependsOn: ["^typecheck"]` as a generator default/flag** -- docs recipe + test only for now
  (D-05); opt-in generator flag is a future fallback.

None of the above is abandoned -- each is a tracked Future Requirement.

</deferred>

---

*Phase: 19-stretch-layout-c-non-ts-story-formats-strict-mode*
*Context gathered: 2026-07-06*
