---
spike: 010
name: vite-query-detection-advisory
type: standard
validates: "Given unresolved TS2307 with ?query specifiers, when the tool inspects diagnostics, then it can deterministically emit an advisory (never auto-suppress) with no false positives, self-gating once ambient decls resolve the queries"
verdict: VALIDATED
related: [009]
tags: [storybook, vite, advisory, detection, no-false-pass, devex]
---

# Spike 010: Vite-query detection advisory

## What This Validates

**Given** a checked program that produces unresolved `TS2307` on Vite-style `?query` import
specifiers, **when** the tool inspects the diagnostics, **then** it can deterministically emit an
ADVISORY (like the existing `.mdx` / `notTypeCheckedDeclaredFiles` notices) pointing at the
`vite/client` fix -- WITHOUT auto-suppressing any diagnostic, without false positives on genuinely
missing modules, and self-gating to silence once the queries are resolved.

This is the UX half of the Idea-3 pair. Spike 009 proved the consumer-side FIX (`vite/client`).
010 asks whether the tool should also DETECT-and-guide toward it.

## Research

- **The signal is in the diagnostics, not the framework.** A `?` in a module specifier is a bundler
  (Vite/webpack) query -- TypeScript/Node module specifiers never contain `?`. So an unresolved
  `TS2307` whose specifier contains `?` is almost certainly a bundler query import. Detecting this
  needs ZERO Storybook/framework coupling (honoring the charter's "no Storybook-specific machinery"),
  works for stock and Analog/Vite alike, and reads only public `ts.Diagnostic` fields.
- **Self-gating.** The advisory keys on the PRESENCE of unresolved `?query` `TS2307`. Once the
  consumer adds `vite/client` (spike 009), those `TS2307` disappear, so the advisory falls silent on
  its own -- no separate "is a shim present?" probe needed.
- **Precedent:** mirrors the shipped advisory pattern (`notTypeCheckedDeclaredFiles` for `.mdx`/JSX)
  -- a loud notice that does NOT change the verdict.

## How to Run

```
node .planning/spikes/010-vite-query-detection-advisory/harness.mjs
```
Reuses spike 009's committed fixture. Compiles the baseline and `vite-client` variants via the real
`@angular/compiler-cli`, runs the candidate `detectViteQueryImports(diagnostics)` over each, and
asserts fire/silence + no-false-positive + never-suppressed.

## What to Expect

Baseline: advisory fires listing 5 `?query` specifiers (all matching a known Vite suffix), and does
NOT include the plain `./does-not-exist`. vite-client: advisory silent. The plain missing module is
still a `TS2307` in both (never suppressed).

## Investigation Trail

1. Considered framework detection (read `.storybook/main.ts` `framework`) -- rejected: couples to
   Storybook, violates the charter's no-Storybook-machinery rule, and is unnecessary.
2. Chose the diagnostic-based signal: `TS2307` + specifier contains `?`. Labelled confidence with a
   known-Vite-suffix regex (`?raw|?url|?inline|?no-inline|?worker|?sharedworker[&...]`) but did NOT
   gate on it (any `?`-query import benefits from the same advice).
3. Verified self-gating by running the detector on the `vite-client` variant (0 flagged).

## Results

VALIDATED (6/6 assertions, exit 0):

- **Fires correctly:** baseline advisory lists exactly the 5 `?query` specifiers
  (`?raw`/`?url`/`?worker`/`?inline`), all matching a known Vite suffix.
- **No false positive:** the plain missing module `./does-not-exist` is NOT flagged.
- **Never suppresses:** `./does-not-exist` remains a `TS2307` (the advisory is purely additive; it
  would not change the verdict, exactly like the `.mdx` advisory).
- **Self-gating:** with `"types": ["vite/client"]` the `?query` `TS2307` vanish and the advisory is
  silent -- no stale "add vite/client" notice once it's added.

### Verdict

**VALIDATED.** A detection advisory is feasible, deterministic, builder-agnostic, and safe. It keys
on unresolved `TS2307` with a `?`-query specifier (public diagnostic fields only, no Storybook
coupling), mirrors the shipped `.mdx` advisory (loud, verdict-neutral), and self-gates.

**Signal for the build:** OPTIONAL polish, not required for correctness -- spike 009's README recipe
already resolves the issue. If implemented, add it as a new advisory alongside
`notTypeCheckedDeclaredFiles` (surface `suppressed`-style: count + distinct specifiers), keyed on the
`?`-in-specifier signal, and NEVER let it touch the verdict or suppress a diagnostic. Sequencing:
ship the README recipe first (done in phase 19); consider the advisory as a later DX enhancement.
