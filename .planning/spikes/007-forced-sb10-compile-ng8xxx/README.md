---
spike: 007
name: forced-sb10-compile-ng8xxx
type: standard
gate: [G3, G4]
validates: "Given @storybook/angular@10.4.6 force-installed on the official Angular 22.0.4 / TS 6.0.3 stack, when performCompilation type-checks a story surface, then it compiles with NO infra failure and a clean story passes clean (G3), and NG8xxx fire POSITIVELY (RED) on stories/aggregated components (G4)."
verdict: VALIDATED
related: [006]
tags: [storybook, sb10, ng8xxx, forced-install, peer-conflict, gate, engine]
---

# Spike 007: forced SB10 compiles + NG8xxx fire (G3, G4)

## What This Validates

The two remaining HARD kill gates of the Phase-16 GO/NO-GO:

- **G3:** forced `@storybook/angular@10.4.6` compiles via `performCompilation` with NO
  infrastructure failure, AND a CLEAN story passes clean -- no spurious Storybook-type errors
  leaking into in-project files (`main.ts`/`preview.ts`/story imports).
- **G4 (proven POSITIVELY):** NG8xxx diagnostics actually FIRE on stories/aggregated components
  on this stack -- an NG8xxx fixture goes RED. Without this, the "complete type-check incl.
  NG8xxx" claim would be false on a green verdict.

## Research

`@storybook/angular@10.4.6` peer-caps Angular at `>=18 <22` and TS at `^4.9 || ^5` (registry,
verified), so installing it on the official Angular 22.0.4 / TS 6.0.3 stack is a real ERESOLVE
peer conflict (D4). The install was done the way a consumer must -- `npm install
--legacy-peer-deps` -- deliberately exercising that path. The exact conflict recorded:

```
@storybook/angular@10.4.6
  -> peer @angular-devkit/build-angular >=18.0.0 < 22.0.0  -> @21.2.18
       -> peer @angular/compiler-cli@^21.0.0   (conflicts with the official @22.0.4)
npm error ... retry this command with --force or --legacy-peer-deps
```

Exported story types confirmed in `@storybook/angular@10.4.6`'s `dist/index.d.ts`: `Meta`,
`StoryObj`, `Preview`, `StorybookConfig` (all chain into `storybook/internal/*` + `@angular/*`).

## How to Run

The isolated scaffold (pinned official stack + forced SB10) is NOT committed -- only this
record is. To reproduce:

```bash
mkdir sb007 && cp -r <this-dir>/{package.json,fixture,harness.mjs} sb007/
cd sb007 && npm install --legacy-peer-deps --no-audit --no-fund
node harness.mjs        # exits 0 iff all assertions pass; writes forensic-log.json
```

`package.json` pins the exact official stack: `@angular/*@22.0.4`, `typescript@6.0.3`,
`@storybook/angular@10.4.6`, `storybook@10.4.6`. The harness copies the real engine functions
VERBATIM (`runNoEmitCompilation` + `gatherAllDiagnostics`, `filterDiagnostics` + canonicalizer,
`finalize`'s sort/dedup + explicit category counts).

## What to Expect

7 assertions PASS; `VERDICT: VALIDATED -- G3 = YES ... & G4 = YES ...`.

## Investigation Trail

1. **Peer conflict captured (D4).** A plain `npm install --dry-run` ERESOLVEd exactly as
   above; `--legacy-peer-deps` then installed 300 packages in ~21s. (An esbuild postinstall was
   left un-run -- irrelevant: we type-check via `@angular/compiler-cli`, we do not build/serve
   Storybook.)
2. **G3-a (skipLibCheck: true, the realistic Angular default).** `performCompilation` ran with
   no `UNKNOWN_ERROR_CODE` (500) and the clean story produced ZERO in-project diagnostics.
3. **G3-b (skipLibCheck: false, adversarial -- the D4 proof).** Forcing SB10's `.d.ts` to be
   type-checked under TS6 produced **48 diagnostics, ALL 48 `node_modules`-attributed** and
   suppressed by the boundary filter -- ZERO leaked in-project. So forced-SB10 `.d.ts` errors
   under TS6 are real BUT always out-of-project => they can never cause a false FAIL (the exact
   D4 contingency). Corollary: 48 checked `.d.ts` diagnostics + zero TS2307/TS2305 in-project
   proves the `@storybook/angular` type surface (Meta/StoryObj/StorybookConfig/Preview) GENUINELY
   RESOLVED under TS6 -- the clean-clean result is not a vacuous "module was `any`".
4. **G4-core.** `<div [nonExistentProp]="value">` fired **NG8002** (unknown property) as an
   in-project ERROR (RED) -- a core template diagnostic, attributed to the component `.ts`
   (inline template).
5. **G4-extended.** `{{ label ?? 'fallback' }}` with `label: string` fired **NG8102**
   (nullishCoalescingNotNullable), an extended diagnostic; `extendedDiagnostics.defaultCategory:
   "error"` promoted it to an ERROR (RED). Confirms both core AND extended NG8xxx fire on the
   forced-SB10 official stack.

## Results

**VERDICT: VALIDATED -- G3 = YES, G4 = YES.** Forced `@storybook/angular@10.4.6` compiles via
`performCompilation` on the official Angular 22.0.4 / TS 6.0.3 stack with no infra failure; a
clean story passes clean; its `.d.ts` errors (48 under `skipLibCheck:false`) are all
`node_modules`-attributed and suppressed (no false FAIL, D4 confirmed); and both core (NG8002)
and extended (NG8102) NG8xxx fire positively and go RED. Both remaining kill gates are cleared.

### Findings that carry into Phase 17 / docs

- **D4 confirmed:** forced-SB10 `.d.ts` errors are always `node_modules`-attributed under the
  boundary filter's segment test -- docs-only is safe, no runtime version gate needed.
- **skipLibCheck is orthogonal (board D-07):** true = 0 suppressed noise; false = 48 suppressed
  `node_modules` diagnostics. Neither leaks in-project; the in-project verdict is identical.
- **G4 confirms the NG8xxx claim on the forced stack** -- the "complete type-check incl. NG8xxx"
  release claim is honest on green (SB-07).

### Scope notes (not silent caps)

- Fixtures are single-leaf (each scenario = one tsconfig). G3/G4 are layout-agnostic (does SB10
  compile / do NG8xxx fire); the cross-project Layout-B rootNames mechanism is spike 006 (G2).
- G4 proves ONE core (NG8002) + ONE extended (NG8102) diagnostic fire. The full 18-member
  extended catalog is already gated by the shipped Phase-12 suite; G4 only needed positive proof
  that NG8xxx fire at all under forced SB10.
