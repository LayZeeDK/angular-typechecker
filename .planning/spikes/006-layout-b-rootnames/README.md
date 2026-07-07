---
spike: 006
name: layout-b-rootnames
type: standard
gate: G2
validates: "Given a centralized Storybook host (Layout B) whose .storybook/tsconfig.json include globs reach OUTSIDE the host dir into a sibling project, when resolved on the official stack (Angular 22.0.4 / TS 6.0.3), then the widened cross-project *.stories.ts / *.component.ts materialize as the leaf's parsed.rootNames (declared inputs, not merely imports)."
verdict: VALIDATED
related: [001, 002]
tags: [storybook, layout-b, rootnames, boundary, config-parse, gate, engine]
---

# Spike 006: Layout-B widened include -> parsed.rootNames (G2)

## What This Validates

**G2 (the HARD prerequisite of the Phase-16 GO/NO-GO gate).** Given a centralized
Storybook host (Layout B, the Nx "one-storybook-for-all" recipe) whose
`.storybook/tsconfig.json` `include` reaches OUTSIDE the host directory into a sibling
project (`../../mylib/src/**/*.stories.ts`, `../../mylib/src/**/*.component.ts`), when
resolved on the OFFICIAL stack (Angular 22.0.4 / TS 6.0.3), then the widened cross-project
files materialize as the leaf's `parsed.rootNames` -- i.e. **declared compiler inputs**, not
merely files reachable via the import graph.

Why it is the hard prerequisite: the SB-02 keep-rule keeps a diagnostic iff its file is in
the union of walked leaves' rootNames (or under the base dir). If the cross-project files did
NOT show up as rootNames, `inputTs` membership could not keep them and the whole
input-set-membership boundary primitive would have to be redesigned -> Layout B not supportable
via this design. If NO here, stop and ship Layout A only.

## Research

Grounded in `.planning/research/v0.1.2-storybook/CENTRALIZED-HOST.md`, which documents the
real-world Layout-B tsconfig shape from `radix-ng/primitives` (the actual Angular 22.0.4 / TS
6.0.3 / Storybook 10.4.6 stack): the host solution `tsconfig.json` references ONLY
`./.storybook/tsconfig.json`; that leaf `extends ../tsconfig.json` and its `include` reaches out
via relative globs (`../../../packages/primitives/**/*.stories.ts`, `**/*.component.ts`,
`**/src/**/*.ts`). That research verified file discovery on Angular 21.2.9 / TS 5.9.3 via
`tsc --listFilesOnly` (which lists roots AND imports indistinguishably).

**What this spike adds:** the precise engine signal (`readConfiguration().rootNames`, the DECLARED
input set) on the OFFICIAL Angular 22.0.4 / TS 6.0.3 stack, and the declared-vs-import-only
distinction that `--listFilesOnly` cannot show. Fixture models radix's real config (host solution
references only the `.storybook` leaf; leaf globs stories + components across `../../`).

No external Storybook install is needed: G2 is a pure config-parse / rootNames question. The
forced `@storybook/angular@10.4.6` substrate is G3/G4's concern (spike 007).

## How to Run

```bash
node .planning/spikes/006-layout-b-rootnames/harness.mjs
# exits 0 iff all assertions pass; writes forensic-log.json
```

## What to Expect

9 assertions PASS; `VERDICT: VALIDATED -- G2 = YES`. The cross-project `mylib` story and
component (physically outside the host dir) appear in `parsed.rootNames`; the local
`.storybook/main.ts` (via `"*.ts"`) appears; the import-only `untracked-helper.ts` does NOT.

## Observability

`forensic-log.json` records the environment, the leaf tsconfig path, `parsed.rootNames`, the
`performCompilation` program root file names (incl. the ngtypecheck-shim `extras`), and the
full assertion list + verdict.

## Investigation Trail

1. **Primary signal (readConfiguration).** `readConfiguration(<leaf>).rootNames` returned
   EXACTLY the 3 declared files -- the two cross-project `../../mylib` files and the local
   `.storybook/main.ts` -- with zero config-parse errors. The strict-multiset assertion (G2-h)
   confirms no surprise extras leak in from the globs. **G2 = YES.**
2. **Import-only distinction.** `untracked-helper.ts` (imported by the story, matched by NO
   include glob) is NOT a rootName. This proves rootNames == the `include`/`files`-declared set,
   not the import closure -- the exact property the keep-rule keys on.
3. **SURPRISE -- program roots are a superset (compiler is source of truth).** The initial
   cross-check asserted `program.getTsProgram().getRootFileNames() == parsed.rootNames` and it
   FAILED: the program reports 6 roots, not 3. The 3 extras are ngtsc-generated
   `<root>.ngtypecheck.ts` shims (`my.stories.ngtypecheck.ts`, `my.component.ngtypecheck.ts`,
   `main.ngtypecheck.ts`) -- synthetic, in-memory template-type-check-block files, one per
   declared root, that do not exist on disk. Expectation FIXED to reflect reality: declared
   rootNames are a subset of program roots (G2-f), and the program-root extras are exactly the
   `.ngtypecheck.ts` shims (G2-f2). No real declared file leaks in; the helper (import-only) is a
   SourceFile but neither a root nor shimmed (G2-g).

## Results

**VERDICT: VALIDATED -- G2 = YES.** On the official stack, a Layout-B host's widened
cross-project `.storybook/tsconfig.json` `include` globs DO materialize the aggregated
`*.stories.ts` / `*.component.ts` as the leaf's `parsed.rootNames`. The input-set-membership
boundary primitive is viable for Layout B; the hard prerequisite is cleared. (GO on G2.)

### Findings that carry into Phase 17

- **Build `inputTs` from `readConfiguration().rootNames` (the clean 3-member declared set), or,
  if reading off `result.program`, expect and tolerate the `.ngtypecheck.ts` shim superset.**
  `program.getTsProgram().getRootFileNames()` = declared rootNames PLUS one
  `<root>.ngtypecheck.ts` shim per root. The shims are synthetic and never match a real
  diagnostic file path, so they are harmless as extra `inputTs` members -- but the walk's
  rootName-surfacing (REQUIREMENTS SB-02: "the walk surfaces each walked leaf's rootName PATHS
  ... it already holds result.program") must not treat a shim path as a real first-party source
  (e.g. when computing `suppressedInGraph`). Preferred: key membership on the declared set.
- **Coverage nuance (informs SB-07 docs + the keep-rule).** Only files the host `include` glob
  DECLARES become rootNames. An aggregated file reached ONLY via import (like the helper) is a
  SourceFile but not a rootName -> keep-rule (c) would suppress a diagnostic on it. radix's real
  config avoids this by globbing `**/*.component.ts` + `**/src/**/*.ts` (not just `*.stories.ts`),
  so the aggregated component surface IS declared. The minimal recipe (stories-only glob) would
  leave aggregated components import-only. This is exactly why D3 mandates checking "the WHOLE set
  the tsconfig declares" and warns against a `*.stories.ts` allowlist.

### Scope note (not a silent cap)

Fixture reaches ONE level outside the host dir (`../../mylib`). radix's real config reaches three
(`../../../packages/...`); `CENTRALIZED-HOST.md` already empirically confirmed deeper `../`
globs resolve (mechanism is depth-agnostic relative-glob resolution in
`parseJsonConfigFileContent`). Not re-tested here.
