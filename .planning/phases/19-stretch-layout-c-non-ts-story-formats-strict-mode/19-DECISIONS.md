# Phase 19 Decisions -- deferred SB-08 dispositions ("not warranted")

**Recorded:** 2026-07-07
**Closes:** phase-19 success criterion 1 ("a decision is recorded for Layout C
support beyond the no-silent-pass guard").

Phase 19 ships ONE SB-08 stretch item (opt-in strict mode, plan 19-01) and adds
Storybook Composition as a supported topology (plan 19-02). The two remaining
SB-08 items are recorded here as NOT WARRANTED for v0.1.2, with cited rationale.
Neither is abandoned -- each stays a tracked Future Requirement (SB-08).

## Decision 1: Layout C committed support beyond the no-silent-pass guard -- NOT WARRANTED

**Disposition (19-CONTEXT.md D-02):** Ship the no-silent-pass guard only (already
in place); build no committed-support code or coverage claim for a flat Layout C
tsconfig (a flat root `tsconfig.json` with no `references[]`).

**Rationale (evidence-backed):**

- **Board CONSENSUS D7 ("Flat Layout C"):** "Exclude from committed support;
  guarantee no silent pass. ... Add ONE guard test ... Build nothing else." D1
  reaffirms Layout C is EXCLUDED from committed support (different architecture,
  low ROI; the split counter covers it uniformly).
- **No exact-stack repo exists (OSS-CANDIDATES.md):** there is no Angular 22 / Nx
  23 flat Layout C repo -- every exact-stack workspace uses `tsconfig.base.json`
  plus per-project solution tsconfigs. Flat Layout C is a rare, deliberate pattern;
  the best available target (`bitwarden/clients`, Ng 21 / Nx 22.6) is off-stack and
  informational only.
- **The engine ALREADY type-checks a flat tsconfig's stories** via the direct
  single-leaf path. `run-typecheck.ts` dispatch keys on
  `parsed.rootNames.length === 0`, NOT on `references[]`: a flat tsconfig with a
  populated `include` has non-empty `rootNames`, so it takes the DIRECT single-leaf
  path and type-checks its declared rootNames -- including its `*.stories.ts`. An
  empty / story-less config (zero rootNames) hits the guard and reports
  coverage-incomplete, never a silent clean pass. The guard already delivers the
  charter floor (never a false pass) with no Layout-C-specific code.
- **Guard verified informationally** on a real Layout C repo (`bitwarden/clients`,
  off-stack) per the board D5 OSS-informational rule -- not a CI gate.

**What committed support beyond the guard would add, and why it is not warranted
now:** a Layout-C-specific coverage claim and fixture matrix on a stack no real
repo uses, for a pattern the direct path already checks correctly. Deferred as
SB-08 until an exact-stack consumer need appears.

## Decision 2: `.mdx` / `.tsx` story type-check beyond the shipped advisory -- NOT WARRANTED

**Disposition (19-CONTEXT.md D-03):** Keep the shipped advisory (`.mdx` never
type-checked; `.tsx` checked only when `compilerOptions.jsx` is set), surfaced via
`notTypeCheckedDeclaredFiles`; build no MDX-to-TS extraction or JSX story pipeline.

**Rationale (evidence-backed):**

- **`.stories.mdx` is Storybook-6 legacy, REMOVED in Storybook 7+**
  (OSS-CANDIDATES.md stretch-format findings): nonexistent in current Angular repos
  (Storybook 8-10 all use plain `.mdx` docs); only stale ancient forks still
  contain it. There is no real-world `.stories.mdx` consumer to justify a fragile
  MDX-to-TS extraction pipeline.
- **`.stories.tsx` is used by NO Angular + `@storybook/angular` repo:** `jsx` is
  unset in every real Angular tsconfig inspected (radix-ng, skyux, analog). The
  `.tsx`-gated-on-`jsx` path can only be exercised by a synthetic fixture that sets
  `jsx`.
- **The advisory ALREADY ships** (`detect-unchecked-declared.ts`, Phase 18): a
  declared-but-uncheckable `.mdx` / JSX-free `.tsx` surfaces as a loud advisory
  notice that does not change the verdict, and the `.mdx` advisory was verified
  informationally on `radix-ng/primitives`. No real diagnostic is dropped -- the
  files are declared-but-uncheckable, and the advisory names them.

**What type-checking these beyond the advisory would add, and why it is not
warranted now:** an MDX-to-TS extraction pipeline and a JSX story path for formats
no current Angular consumer authors. Deferred as SB-08 until a real-world format
appears.

## Consistency check

The README `## Storybook` caveats (after plan 19-03 Task 1) reflect BOTH
dispositions:

- The Layout C caveat states it is not a committed-supported layout but never
  silently passes (the direct single-leaf path checks a flat config's declared
  stories; an empty / story-less config is guarded).
- The `.mdx` / `.tsx` caveat states `.mdx` is never type-checked and a `.tsx` story
  is checked only when `compilerOptions.jsx` is set, surfaced as a loud advisory
  via `notTypeCheckedDeclaredFiles`.

Both remain tracked Future Requirements under SB-08; neither is abandoned. This
note satisfies phase-19 success criterion 1.
