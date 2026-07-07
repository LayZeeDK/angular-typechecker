# Spike Wrap-Up Summary

**Date:** 2026-07-05
**Spikes processed:** 8 (001-008)
**Feature areas:** Storybook input-set boundary (v0.1.2); Reference-walk engine (v0.1.0, shipped)
**Skill output:** `./.claude/skills/spike-findings-angular-typechecker/`

## Processed Spikes

| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|
| 001 | reference-walk-aggregation | standard | VALIDATED | Reference-walk engine (shipped) |
| 002 | module-boundary-guard | standard | VALIDATED | Reference-walk engine (shipped) |
| 003 | double-compile-cost | benchmark | VALIDATED | Reference-walk engine (shipped) |
| 004 | d03a-surgical-split | standard | VALIDATED | Reference-walk engine (shipped) |
| 005 | coarse-single-target-caching | standard | VALIDATED | Reference-walk engine (shipped) |
| 006 | layout-b-rootnames | standard | VALIDATED (G2 = YES) | Storybook input-set boundary |
| 007 | forced-sb10-compile-ng8xxx | standard | VALIDATED (G3=YES, G4=YES) | Storybook input-set boundary |
| 008 | external-template-attribution | standard | VALIDATED (G1=html, G5=PASS 4a) | Storybook input-set boundary |

## Key Findings

**Phase-16 gate = GO.** Layout B (centralized Storybook host) is type-checkable on the official
stack (Nx 23.0.1 / Angular 22.0.4 / TS 6.0.3, `@storybook/angular@10.4.6` force-installed). All
three HARD kill gates passed and the selectors resolved:

- **G2 = YES** (006): a Layout-B host's widened cross-project `.storybook/tsconfig.json` `include`
  globs materialize the aggregated `*.stories.ts`/`*.component.ts` as the leaf's declared
  `readConfiguration().rootNames`. Landmine: `program.getRootFileNames()` is a superset (+ one
  `.ngtypecheck.ts` shim per root) -> key `inputTs` on the declared set.
- **G3 = YES** (007): forced `@storybook/angular@10.4.6` (installed `--legacy-peer-deps` against the
  real ERESOLVE) compiles via `performCompilation`; a clean story passes clean. D4 proven: its 48
  TS6 `.d.ts` errors are all `node_modules`-attributed and suppressed -- no false FAIL.
- **G4 = YES** (007, positive): NG8002 (core) + NG8102 (extended, promoted) fire RED in-project on
  aggregated components -- the "complete type-check incl. NG8xxx" claim is honest on green.
- **G1 = html + G5 = PASS -> branch 4a** (008): external-template diagnostics attribute to the
  `.html`, and each carries `relatedInformation` -> owning component `.ts` ("occurs in the template
  of component X"), a stable public signal. Phase 17 maps `.html` -> owning rootName `.ts` via
  `relatedInformation`, keep iff in-graph (exact + isolation-correct), default-keep the unmappable
  edge.

Implementation blueprint (keep-rule, split counter, tripwire, constraints, validation matrix):
`./.claude/skills/spike-findings-angular-typechecker/references/storybook-input-set-boundary.md`.

---

**Date:** 2026-07-07
**Spikes processed:** 2 (009-010)
**Feature areas:** Vite/Analog query-import support (v0.1.2 UAT follow-up)
**Skill output:** `./.claude/skills/spike-findings-angular-typechecker/references/vite-analog-query-imports.md`

## Processed Spikes (session 2)

| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|
| 009 | vite-ambient-shim-resolves-query-imports | comparison | VALIDATED | Vite/Analog query-import support |
| 010 | vite-query-detection-advisory | standard | VALIDATED | Vite/Analog query-import support |

## Key Findings (session 2)

Origin: the phase-19 OSS real-repo UAT found ~228 `TS2307` on radix-ng's Vite `?raw` imports (the
tool is CORRECT to surface them -- a story is a declared rootName -> in-project -> kept).

- **009 -- the fix is one consumer-side line:** `"types": ["vite/client"]` on the checked tsconfig
  declares the full Vite query family (`*?raw`/`*?url`/`*?worker`/`*?inline`/...) as ambient wildcard
  modules. Hermetic 5 `?query` TS2307 -> 0; radix-ng **227 -> 0**. No-false-pass PRESERVED on both
  axes: a plain missing module still `TS2307` (radix's 1 pre-existing plain-miss kept + a planted one
  still errored), and `?raw` is typed `string` so misuse still `TS2322`. Hand `declare module` shim is
  a fallback but incomplete (missed `?inline`). Auto-suppression rejected. Blind spot: a `?query`
  import of a missing base resolves via the wildcard (TS can't verify base existence through a
  wildcard).
- **010 -- an in-tool advisory is feasible + optional:** detect unresolved `TS2307` whose specifier
  contains `?` (a bundler query; TS/Node specifiers never use `?`) -> emit a verdict-neutral advisory
  pointing at `vite/client`. Builder-agnostic (no Storybook coupling), no false positive on plain
  missing modules, never suppresses, self-gating (silent once resolved).

Signal for the build: ship the docs recipe first (phase-19 README already carries the caveat;
strengthen it to lead with `vite/client`); the advisory is later DX polish. Blueprint:
`./.claude/skills/spike-findings-angular-typechecker/references/vite-analog-query-imports.md`.
