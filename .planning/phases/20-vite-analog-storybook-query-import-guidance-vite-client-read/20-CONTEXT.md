# Phase 20: Vite/Analog Storybook query-import guidance -- Context

**Gathered:** 2026-07-07
**Status:** Ready for planning
**Mode:** `--auto --analyze --chain` (autonomous single-pass; recommended option locked per gray area)

<domain>
## Phase Boundary

The FINAL v0.1.2 phase. Deliver SB-09: a clear, proven path for consumers when angular-typechecker
(correctly) reports `TS2307` on Vite/Analog Storybook bundler-query imports (`?raw` / `?url` /
`?worker` / `?inline`, virtual modules) -- WITHOUT weakening the never-a-silent-false-pass charter.
Both SB-09 signals are in scope for v0.1.2 (user committed both 2026-07-07):

1. **Signal 1 (required, docs-only, ZERO engine change):** restructure the README `## Storybook`
   Vite caveat to LEAD with the proven fix (`"types": ["vite/client"]` on the CHECKED tsconfig) and
   name the hand `declare module '*?query'` `.d.ts` as the no-`vite`-dependency fallback. Grounded in
   spike 009 (radix-ng: 227 `?query` `TS2307` -> 0, no-false-pass preserved).
2. **Signal 2 (in scope, ENGINE + executor change):** a verdict-neutral detection advisory beside
   `notTypeCheckedDeclaredFiles` that flags unresolved `TS2307` whose module specifier contains a `?`
   bundler query. Builder-agnostic (no Storybook/framework coupling), self-gating (silent once the
   consumer adds the shim), NEVER suppresses a diagnostic. Grounded in spike 010.
3. **Charter guard (required):** a test proves a plain missing module (no `?`) still FAILs `TS2307`
   and that no `?query` `TS2307` is ever auto-suppressed.

**Not in this phase:** auto-suppression of any `?query` `TS2307` (rejected -- masks genuine missing
modules); Storybook-framework-based detection (`.storybook/main.ts` `framework` sniffing -- couples to
Storybook, violates D4); a public option to toggle the advisory (always-on + self-gating, like the
shipped advisories). No breaking change; additive-only. Signal 2 is a `feat` (0.x -> patch, 0.1.1 -> 0.1.2).

**User-added phase-end gates (HARD, 2026-07-07):**
- **Gate A -- pushed + green CI.** The feature branch MUST be pushed and reach GREEN required CI checks
  (`ci` + CodeQL `Analyze (actions)` / `Analyze (javascript-typescript)`) via a PR before the phase ends.
- **Gate B -- real-OSS tarball verification.** The behavior MUST be verified with the locally-packed dist
  tarball installed into a REAL OSS project (`radix-ng/primitives`, the proven `?query` repo): the
  advisory fires on the unresolved `?query` `TS2307`, and `"types": ["vite/client"]` drives them to 0
  with no false pass. This ELEVATES the normally-informational OSS verify (Phase 19 D-08 / board D5) to a
  REQUIRED phase-completion gate for Phase 20 only.

</domain>

<decisions>
## Implementation Decisions

### Signal 2 -- engine advisory (the version-bumping `feat`)
- **D-01 (data shape).** Add ONE additive `CoreResult` field, a `readonly string[]` of the deduped
  unresolved bundler-query module specifiers (recommended name `bundlerQueryImports`; exact name is
  Claude's discretion), mapping `[]` -> `undefined` so consumers branch on presence -- EXACTLY the
  shipped `notTypeCheckedDeclaredFiles` / `skippedReferences` shape. No richer object, no count-only.
- **D-02 (detector = pure module over the KEPT diagnostic set).** New pure `detect-bundler-query-imports.ts`
  (mirrors `detect-unchecked-declared.ts`: pure, no `console`/`process`, returns `readonly string[]`).
  Detection (blueprint spike 010): for each diagnostic where `code === 2307`, extract the specifier via
  `/Cannot find module '([^']+)'/` over `ts.flattenDiagnosticMessageText(d.messageText, '\n')`; flag those
  whose specifier `.includes('?')` (a `?` in a module specifier is a bundler query -- TS/Node never use one).
  Run it ONCE in `run-typecheck` `finalize` over the FINAL KEPT (post-boundary-filter) diagnostic set, so it
  covers the walk and direct single-leaf paths uniformly with one call site and only advises about `TS2307`
  the consumer actually SEES (never flags a correctly node_modules-suppressed `?query`).
- **D-03 (always-on + self-gating -- NO option).** The advisory is always computed; it falls silent
  automatically once the consumer adds `vite/client` (keys on the PRESENCE of unresolved `?query` `TS2307`).
  No new public executor/core option -- consistent with the three shipped advisories and the D4
  no-new-public-option posture. (An opt-out flag would be over-engineering; not built.)
- **D-04 (executor render).** One loud `logger.warn` mirroring `warnNotTypeChecked`: names the count, the
  recommended `"types": ["vite/client"]` fix, and states "ADVISORY: the TS2307 are NOT suppressed." Renders
  ONLY in the executor tier (core stays pure). Wording is Claude's discretion.

### Charter guard (never a silent false pass)
- **D-05 (verdict semantics -- state precisely).** A `?query` `TS2307` is an ERROR, so the run correctly
  FAILs on it (`errorCount` includes it). "Verdict-neutral" means the ADVISORY DETECTION never suppresses,
  drops, or flips anything (`evaluateResult` does not read the new field) -- the underlying `TS2307` drives
  the verdict as normal. The advisory annotates an already-failing run with the fix; it does NOT make the
  run clean.
- **D-06 (guard test -- acceptance gate).** A test proves: (a) a plain missing module (specifier with NO
  `?`) still FAILs `TS2307` and is NOT flagged by the advisory (no false positive); (b) a `?query` `TS2307`
  is KEPT and reported (never dropped/suppressed) AND the advisory fires (present + non-empty). Pure unit
  tier over synthetic diagnostics, mirroring the existing advisory specs.

### Signal 1 -- README restructure (docs-only, no engine change)
- **D-07 (lead with the fix).** Rewrite the existing Vite caveat bullet in `packages/angular-typechecker/README.md`
  (currently ~432-443, which BURIES the fix) to LEAD with `"types": ["vite/client"]` on the checked tsconfig;
  name the hand `declare module '*?query' { ... }` `.d.ts` as the no-`vite`-dependency fallback (INCOMPLETE by
  construction -- only covers enumerated suffixes; prefer `vite/client`); be honest about the ONE wildcard
  blind spot (an ambient `*?raw` matches the SPECIFIER not the file, so a `?query` import of a MISSING base
  resolves and will NOT error -- same as Vite's own build-vs-typecheck split); cross-reference the new Signal 2
  advisory field; reaffirm the diagnostics are NEVER auto-suppressed. Keep the whole Storybook story in the
  README (no `docs/` dir; consistent with Phase 18/19 D-05).
- **D-08 (changelog).** Fold both signals into the curated v0.1.2 `CHANGELOG.md` entry (Signal 1 as a docs/
  guidance note, Signal 2 as a `feat` advisory line). Prose only in this phase -- NO release cut (see D-11).

### Verification + delivery (user-added gates)
- **D-09 (autonomous ship bucket -- what `--chain` delivers).** Signal 2 engine + executor + Signal 1 README/
  changelog + the D-06 charter guard test + a hermetic in-repo test proving the advisory fires and
  `vite/client` clears it (spike 009's 5 -> 0 fixture is the pattern) -- all planned + executed autonomously
  and CI-gated. Push the branch, open the PR, drive Gate A (green CI) autonomously.
- **D-10 (real-OSS verify = REQUIRED, manual/interactive -- Gate B).** Verify against `radix-ng/primitives`
  (the proven `?query` repo, spike 009: 227 -> 0; exact-stack Layout B) with the LOCALLY-PACKED dist tarball
  (`nx build` -> `npm pack` on dist, NOT the published npm artifact), mirroring the Phase 19 OSS UAT harness.
  This is a HARD phase-completion gate (per the user), run interactively -- NOT baked into CI (an external
  large checkout) and NOT self-approved by the autonomous chain.
- **D-11 (merge/release stay human-gated -- NOT auto).** The chain drives up to "PR open + green CI" only.
  Merging the PR to `main` (PR-only ruleset; empty bypass) and any v0.1.2 release cut/publish are HUMAN-gated
  and MUST NOT be auto-approved by the chain (repo rules + never-approve-deployments). The phase is not
  "complete" until Gate A (green CI) AND Gate B (real-OSS tarball verify) are both met; surface both to the
  user rather than silently marking done.

### Claude's Discretion
- Exact new field NAME (`bundlerQueryImports` recommended), the detector module filename, the executor
  `logger.warn` wording, and test-file organization -- standard patterns; planner/executor decide. The
  detector ALGORITHM (D-02), the SHAPE (D-01), always-on/self-gating (D-03), the verdict semantics (D-05),
  and the guard assertions (D-06) are LOCKED.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 20 blueprint + requirements
- `.claude/skills/spike-findings-angular-typechecker/references/vite-analog-query-imports.md` -- THE
  blueprint (spikes 009 + 010): the `vite/client` recipe, the hand-shim fallback, the detector pseudo-code,
  the wildcard blind spot, what to avoid (no auto-suppress, no Storybook detection), proven versions.
- `.planning/REQUIREMENTS.md` -- SB-09 (both signals + charter constraint); Out of Scope (no version gate /
  no Storybook coupling, D4).
- `.planning/ROADMAP.md` -- Phase 20 goal + three success criteria (Signal 1 / Signal 2 / charter guard).
- `.planning/research/v0.1.2-storybook/board/CONSENSUS.md` -- D4 (no Storybook coupling / no new public
  option), D5 (OSS repos informational -- ELEVATED to required here for Gate B).

### Spike source records
- `.planning/spikes/009-vite-ambient-shim-resolves-query-imports/` -- the fix (README + harness.mjs +
  forensic-log.json + fixture); radix-ng 227 -> 0 acceptance.
- `.planning/spikes/010-vite-query-detection-advisory/` -- the advisory detector (VALIDATED).
- `.planning/phases/19-stretch-layout-c-non-ts-story-formats-strict-mode/19-UAT.md` -- SB-09 origin.
- `.planning/research/v0.1.2-storybook/OSS-CANDIDATES.md` -- radix-ng/primitives suitability + exact
  versions + the pnpm `allowBuilds` workaround for the tarball install.

### Engine + docs files this phase touches (mirror the shipped advisory pattern)
- `packages/angular-typechecker/src/core/detect-unchecked-declared.ts` -- the pure-detector shape Signal 2
  mirrors (`readonly string[]`, no runtime globals).
- `packages/angular-typechecker/src/core/run-typecheck.ts` -- `CoreResult` field decls (~80-112, add the new
  field beside `notTypeCheckedDeclaredFiles`:111); `finalize` detector call site + `[] -> undefined` mapping
  (~378-387); walk-merge (~461-463).
- `packages/angular-typechecker/src/core/walk-references.ts` -- how `notTypeCheckedDeclaredFiles` threads
  through the walk (~68, 133, 286-301); the new field either threads the same way OR is computed once over the
  final diagnostic set (D-02 prefers the single finalize call site).
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` -- `warnNotTypeChecked` (~219-231) is the
  render template for D-04.
- `packages/angular-typechecker/README.md` -- `## Storybook` (line 353) + the Vite caveat bullet (~432-443)
  restructured by D-07.
- `packages/angular-typechecker/src/core/not-type-checked.integration.spec.ts`,
  `evaluate-result.spec.ts`, `executors/typecheck/executor.spec.ts` -- the advisory test patterns to mirror
  for D-06.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`detect-unchecked-declared.ts` + `notTypeCheckedDeclaredFiles`** (Phase 18, D-01) -- the EXACT
  pure-detector + additive-`CoreResult`-field + `[]`->`undefined` + one-`logger.warn` pattern Signal 2 clones.
  Signal 2 is strictly SIMPLER: it reads the diagnostics array (already held post-compile), not the tsconfig.
- **`warnNotTypeChecked` in `executor.ts`** -- copy for the Signal 2 `logger.warn` (count + fix + "ADVISORY:
  ... NOT suppressed").
- **Phase 19 OSS UAT tarball harness** (`nx build` -> `npm pack` dist -> install into an external checkout;
  pnpm `allowBuilds`/`--ignore-scripts` workaround) -- the Gate B (radix-ng) verification pattern.
- **Spike 009 hermetic fixture (5 -> 0)** -- the pattern for the in-repo D-09 test.

### Established Patterns
- **Pure core, executor-only logging.** The detector is pure (no `console`/`process`); ONLY the executor
  adapter logs (`logger.warn`). `evaluateResult` must NOT read the new field (verdict-neutral, D-05).
- **Additive `[] -> undefined` optional fields** so consumers branch on presence (0.x additive, non-breaking).
- **Builder-agnostic / public-fields-only.** Key on the PUBLIC `TS2307` message text specifier -- never
  ngtsc internals, never Storybook config (D4). No `*.stories.ts` selector.

### Integration Points
- New field: `CoreResult` (run-typecheck.ts) <- detector call in `finalize` over the kept diagnostics ->
  executor `logger.warn`. One thin additive path; no boundary/walk semantics change.
- Signal 1 is docs-only (README + CHANGELOG); zero code coupling.

</code_context>

<specifics>
## Specific Ideas

- **Detector specifier extraction:** `/Cannot find module '([^']+)'/` on the flattened `TS2307` message;
  flag when the captured specifier `.includes('?')`. Deterministic; no false positive on a plain missing
  module. (Blueprint spike 010.)
- **Gate B target:** `radix-ng/primitives` (Ng 22.0.2 / Nx 23.1.0-beta.1 / TS 6.0.3, MIT). Proven: 227
  `?query` `TS2307` -> 0 with `"types": ["vite/client"]`; plain missing modules still fail; value-type misuse
  still `TS2322`. Locally-packed dist tarball, not the npm artifact.
- **Wildcard blind spot (must be documented, D-07):** an ambient `*?raw` matches the SPECIFIER, not the
  file -- a `?query` import of a NONEXISTENT base resolves through the wildcard and will NOT error. Narrow;
  the same build-vs-typecheck split Vite itself has.

Charter constant: NEVER a silent false pass; over-report (false FAIL) is the acceptable degradation
direction. No Storybook coupling, no ngtsc internals, never auto-suppress `?query` `TS2307`.

</specifics>

<deferred>
## Deferred Ideas

- **A public option to toggle/opt-out of the advisory** -- not built; always-on + self-gating is the
  shipped-advisory convention (D-03). Fallback only if a consumer ever asks.
- **Per-file location in the advisory field** (`{specifier, file}[]`) -- specifier-only string list ships
  (D-01); enrich later only if a reporter/JSON surface needs it (reporters are out of scope this milestone).
- **CI-baked OSS verification** -- stays manual/interactive (D-10); an external large checkout does not
  belong in CI.
- **v0.1.2 release cut/publish + PR merge** -- human-gated (D-11), not part of this phase's autonomous work.

None of the above is abandoned.

</deferred>

---

*Phase: 20-vite-analog-storybook-query-import-guidance-vite-client-read*
*Context gathered: 2026-07-07*
