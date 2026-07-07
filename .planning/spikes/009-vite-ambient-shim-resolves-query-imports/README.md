---
spike: 009
name: vite-ambient-shim-resolves-query-imports
type: comparison
validates: "Given a tsconfig checking stories that use Vite query imports (?raw/?url/?worker/?inline), when the checked program gains ambient module declarations, then the ?query TS2307 drop to 0 AND a genuinely missing module still reports TS2307 (no-false-pass)"
verdict: VALIDATED
related: [007, 008]
tags: [storybook, vite, analog, module-resolution, ts2307, no-false-pass, engine, devex]
---

# Spike 009: Vite ambient-shim resolves query imports

## What This Validates

**Given** a tsconfig checking Storybook stories that import via Vite-specific query suffixes
(`./x?raw`, `./x?url`, `./x?worker`, `./x?inline`, virtual modules), **when** the checked
program is given ambient module declarations, **then** the `?query` `TS2307` ("cannot find
module") drop to zero **and** a genuinely missing module (no query) STILL reports `TS2307`.

Motivation: the phase-19 OSS UAT found `angular-typechecker` surfaces ~228 `TS2307` on radix-ng's
Vite `?raw` imports (`19-UAT.md` tests 2-3). The engine is right to surface them -- a story is a
declared rootName (in-project / input-set membership, `filter-diagnostics.ts`), so its `TS2307` is
KEPT. The fix must live in the **consumer tsconfig**, never by the tool auto-suppressing `TS2307`
(a missing module can be a real bug -- the never-a-silent-false-pass charter). This spike finds the
cleanest consumer-facing resolution and proves it is safe.

## Research

- **`vite/client` is the canonical ambient shim.** `node_modules/vite/client.d.ts` (vite 8.1.0 in
  this repo; present in any Vite/Analog Storybook) declares the full query family as wildcard
  ambient modules: `*?raw`, `*?url`, `*?inline`, `*?no-inline`, `*?worker`, `*?worker&inline`,
  `*?worker&url`, `*?sharedworker[&*]`, `*?url&inline`, plus asset/CSS extension wildcards. Enable
  it with `"types": ["vite/client"]` in the checked tsconfig (or `/// <reference types="vite/client" />`
  in a `.d.ts`).
- **A hand-written `declare module '*?raw' { const src: string; export default src; }` shim** works
  too but only covers the suffixes you enumerate -- incomplete by construction.
- **Neither auto-suppresses.** A wildcard ambient satisfies module RESOLUTION for the matched
  specifier only; a plain missing module (`./nope`) matches no wildcard and still fails, and the
  imported value keeps its declared type (`?raw` -> `string`) so misuse still errors.

| Approach | How | Pros | Cons | Status |
|----------|-----|------|------|--------|
| `vite/client` in `types` | `"types": ["vite/client"]` (or a `/// <reference>`) | one line; full query family; canonical + Vite-maintained | requires `vite` resolvable (it is, in any Vite/Analog SB) | **chosen** |
| Hand `declare module '*?raw'` .d.ts | ship/author a shim | no `vite` dep needed | incomplete unless every suffix enumerated; drifts vs Vite | fallback |
| Tool auto-suppresses `?query` TS2307 | filter change | zero consumer work | **violates no-false-pass** (masks real missing modules) | rejected |

**Chosen:** recommend `"types": ["vite/client"]`; hand shim as the fallback when `vite` is not a
dependency. The tool must NOT auto-suppress. (Whether the tool should *detect + advise* is spike 010.)

## How to Run

Hermetic leg (from repo root):
```
node .planning/spikes/009-vite-ambient-shim-resolves-query-imports/harness.mjs
```
Runs the same story sources under three tsconfigs (`baseline` / `hand-shim` / `vite-client`) via the
real `@angular/compiler-cli` `readConfiguration` + `performCompilation`, categorizes `TS2307` by
specifier (query vs plain) and the `TS2322` misuse, asserts, and writes `forensic-log.json`.

Real-repo leg (radix-ng, throwaway clone -- reproduction only, not committed):
clone `radix-ng/primitives`, `pnpm install`, install the tarball, wire a `typecheck` target at
`apps/radix-storybook/.storybook/tsconfig.json`, measure baseline `TS2307`, add
`"types": ["vite/client"]`, re-measure, then plant a plain missing import to confirm it still fails.

## What to Expect

Hermetic: baseline = 5 query `TS2307` + 1 plain + 0 `TS2322`; hand-shim = 1 query (`?inline`
undeclared) + 1 plain + 1 `TS2322`; vite-client = 0 query + 1 plain + 1 `TS2322`.

## Investigation Trail

1. Confirmed the engine keeps in-project `TS2307` (input-set membership, `filter-diagnostics.ts`) --
   so `?raw` surfacing is correct, and the fix belongs in the consumer tsconfig.
2. Read `vite/client.d.ts` -- enumerated the wildcard query modules it declares (source of truth).
3. Built a 3-way hermetic comparison (baseline / hand-shim / vite-client) over identical sources.
4. Added a plain-missing control (`./does-not-exist`) + a missing-base probe (`./ghost.md?raw`) +
   a typed-misuse (`const n: number = rawSnippet`) to test the no-false-pass boundary on BOTH module
   resolution and value types.

## Results

### Hermetic leg -- VALIDATED (11/11 assertions, exit 0)

| variant | query TS2307 | plain TS2307 (`./does-not-exist`) | TS2322 (misuse) |
|---|---|---|---|
| baseline | 5 | 1 | 0 (unresolved import is `any`) |
| hand-shim (`?raw`/`?url`/`?worker`) | 1 (`./extra?inline` undeclared) | 1 (still fails) | 1 (real `string` type) |
| **vite-client** | **0** | **1 (still fails)** | 1 (real `string` type) |

- **`vite/client` resolves the entire query family** -> 0 residual query `TS2307`. A hand shim only
  covers what it enumerates (left `?inline` failing).
- **No-false-pass on resolution:** the plain missing module `./does-not-exist` still reports `TS2307`
  under BOTH shims.
- **No-false-pass on types:** with a shim, `?raw` is typed `string`, so `const n: number = rawSnippet`
  still errors `TS2322` (baseline: `any`, no error). The shim satisfies resolution only, not misuse.
- **Documented blind spot:** `./ghost.md?raw` (a `?raw` import of a NONEXISTENT base file) is resolved
  by the wildcard in both shims -- TS cannot verify base-file existence through an ambient wildcard.
  This mirrors Vite itself (Vite would fail at build, not type-check); it is a property of ambient
  wildcards, not of angular-typechecker, and it is narrow (only `?query`-suffixed imports of a
  missing base).

### Real-repo leg (radix-ng) -- VALIDATED

Throwaway clone of `radix-ng/primitives` (exact stack: Angular 22.0.2 / TS 6.0.3 / Nx 23.1.0-beta /
`@storybook/angular` 10.4.6 via `@analogjs/storybook-angular`, pnpm 11; `vite` present). Tarball
installed, `typecheck` wired at `apps/radix-storybook/.storybook/tsconfig.json`.

| state | total TS2307 | of which `?query` | plain missing | other |
|---|---|---|---|---|
| baseline (no vite/client) | 228 | **227** | 1 (pre-existing) | 1 NG1010 |
| `"types": ["vite/client"]` | **1** | **0** | 1 (preserved) | 1 NG1010 |

- **Acceptance MET:** all 227 Vite `?query` TS2307 dropped to **0** with a one-line
  `"types": ["vite/client"]` on the checked tsconfig.
- **No-false-pass PRESERVED:** the 1 pre-existing plain missing-module TS2307 survived (vite/client
  resolves only the query family, never arbitrary specifiers); and a freshly planted
  `import x from './definitely-not-here'` still errored `TS2307` with vite/client present. The
  unrelated `NG1010` (`html``` tagged-template story) was untouched.
- Precision note vs 19-UAT: the ~228 was 227 Vite `?query` + 1 pre-existing plain missing module
  (not 228 query). The recipe zeroes the 227; the 1 plain is a genuine radix issue, correctly kept.

### Verdict

**VALIDATED.** The consumer-tsconfig recipe `"types": ["vite/client"]` is the clean, safe fix:
zeroes the Vite `?query` TS2307 (227 -> 0 on radix; 5 -> 0 hermetic) while preserving no-false-pass
on both module resolution (plain missing still fails) and value types (misuse still errors). Hand
`declare module '*?query'` is a viable fallback but incomplete unless every suffix is enumerated.
Auto-suppression is rejected (would mask real missing modules). One narrow, documented limitation:
a `?query` import of a NONEXISTENT base file resolves through the ambient wildcard (TS cannot verify
base existence through a wildcard; same as Vite's own build-vs-typecheck split).

**Signal for the build / docs:** the phase-19 README caveat should point consumers at
`"types": ["vite/client"]` as the recommended resolution (hand shim as the no-`vite`-dependency
fallback). Whether the tool should also DETECT-and-advise is spike 010.
