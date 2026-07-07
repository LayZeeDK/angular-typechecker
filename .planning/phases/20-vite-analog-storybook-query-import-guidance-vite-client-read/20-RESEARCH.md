# Phase 20: Vite/Analog Storybook query-import guidance -- Research

**Researched:** 2026-07-07
**Domain:** angular-typechecker engine (pure diagnostic detector) + Nx executor advisory + README docs; TypeScript 6.0.3 / @angular/compiler-cli 22.0.4 / Nx 23 / Vitest 4
**Confidence:** HIGH (this is a ground-the-plan pass over a fully-specified feature; every claim below is verified against the live codebase or the typescript@6.0.3 runtime in `node_modules`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Signal 2 -- engine advisory (the version-bumping `feat`)**
- **D-01 (data shape).** ONE additive `CoreResult` field, a `readonly string[]` of the deduped
  unresolved bundler-query module specifiers (recommended name `bundlerQueryImports`; exact name is
  Claude's discretion), mapping `[]` -> `undefined` so consumers branch on presence -- EXACTLY the
  shipped `notTypeCheckedDeclaredFiles` / `skippedReferences` shape. No richer object, no count-only.
- **D-02 (detector = pure module over the KEPT diagnostic set).** New pure `detect-bundler-query-imports.ts`
  (mirrors `detect-unchecked-declared.ts`). For each diagnostic where `code === 2307`, extract the specifier
  via `/Cannot find module '([^']+)'/` over `ts.flattenDiagnosticMessageText(d.messageText, '\n')`; flag those
  whose specifier `.includes('?')`. Run it ONCE in `run-typecheck` `finalize` over the FINAL KEPT
  (post-boundary-filter) diagnostic set, covering the walk and direct single-leaf paths uniformly.
- **D-03 (always-on + self-gating -- NO option).** Always computed; falls silent once the consumer adds
  `vite/client` (keys on the PRESENCE of unresolved `?query` `TS2307`). No new public option.
- **D-04 (executor render).** One loud `logger.warn` mirroring `warnNotTypeChecked`: count + the recommended
  `"types": ["vite/client"]` fix + "ADVISORY: the TS2307 are NOT suppressed." Executor tier only (core stays pure).

**Charter guard (never a silent false pass)**
- **D-05 (verdict semantics).** A `?query` `TS2307` is an ERROR; the run correctly FAILs on it. "Verdict-neutral"
  means the ADVISORY never suppresses/drops/flips anything (`evaluateResult` does not read the new field).
- **D-06 (guard test -- acceptance gate).** Proves (a) a plain missing module (NO `?`) still FAILs `TS2307` and
  is NOT flagged; (b) a `?query` `TS2307` is KEPT + reported AND the advisory fires. Pure unit tier.

**Signal 1 -- README restructure (docs-only)**
- **D-07 (lead with the fix).** Rewrite the Vite caveat bullet in `packages/angular-typechecker/README.md`
  (~432-443) to LEAD with `"types": ["vite/client"]`; name the hand `declare module '*?query'` `.d.ts` fallback
  (INCOMPLETE by construction); document the ONE wildcard blind spot; cross-reference the Signal 2 field;
  reaffirm NEVER auto-suppressed. Whole story stays in the README (no `docs/` dir).
- **D-08 (changelog).** Fold both signals into the curated v0.1.2 `CHANGELOG.md` entry. Prose only -- NO release cut.

**Verification + delivery (user-added gates)**
- **D-09 (autonomous ship bucket).** Engine + executor + README/changelog + D-06 guard test + a hermetic in-repo
  test (spike 009's 5 -> 0 fixture pattern), all planned + executed autonomously and CI-gated; push branch, open
  PR, drive Gate A.
- **D-10 (Gate B, REQUIRED, manual/interactive).** Verify against `radix-ng/primitives` with the LOCALLY-PACKED
  dist tarball (`nx build` -> `npm pack` on dist, NOT the published artifact). HARD phase-completion gate; NOT in CI.
- **D-11 (merge/release stay human-gated).** Chain drives up to "PR open + green CI" only. Merge to `main` and any
  release cut/publish are HUMAN-gated, MUST NOT be auto-approved.

### Claude's Discretion
- Exact new field NAME (`bundlerQueryImports` recommended), the detector module filename, the executor
  `logger.warn` wording, and test-file organization. The detector ALGORITHM (D-02), SHAPE (D-01),
  always-on/self-gating (D-03), verdict semantics (D-05), and guard assertions (D-06) are LOCKED.

### Deferred Ideas (OUT OF SCOPE)
- A public option to toggle/opt-out of the advisory (always-on + self-gating is the convention).
- Per-file location in the advisory field (`{specifier, file}[]`) -- specifier-only string list ships.
- CI-baked OSS verification -- stays manual/interactive (D-10).
- v0.1.2 release cut/publish + PR merge -- human-gated (D-11).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SB-09 | Vite/Analog Storybook query-import guidance: Signal 1 (README leads with `"types": ["vite/client"]` + hand-shim fallback + wildcard blind spot), Signal 2 (verdict-neutral advisory over unresolved `TS2307` whose specifier contains `?`), charter guard (plain missing still FAILs + no `?query` auto-suppress) | Signal 1: exact README location + current buried text confirmed (README ~432-443). Signal 2: exact `finalize` single-seam call site confirmed (run-typecheck.ts:623 `reported`), pure-detector shape (`detect-unchecked-declared.ts`), executor render template (`warnNotTypeChecked`, executor.ts:219-231), verdict-neutrality by construction (`EvaluateInput` Pick omits the field). Charter guard: TS2307 message text verified at ts@6.0.3; regex is deterministic; evaluate-result tripwire test pattern (evaluate-result.spec.ts:211). |
</phase_requirements>

## Summary

This is an **additive, low-risk, single-seam feature** on a mature engine, plus a docs restructure. The
approach is fully specified by spikes 009 (the `vite/client` consumer fix, radix 227 -> 0) and 010 (the
diagnostic-based detector, VALIDATED 6/6). Nothing needs re-deriving; the research value is grounding the
wiring against the live code, and it produced ONE materially simpler wiring than the CONTEXT.md hint implied.

**The key finding:** unlike `notTypeCheckedDeclaredFiles` (which is CONFIG-derived and therefore threaded
through BOTH `walk-references.ts` and `run-typecheck.ts`), the bundler-query detector is
**DIAGNOSTIC-derived**. The final kept diagnostic set already exists at exactly ONE choke point --
`finalize()` in `run-typecheck.ts`, immediately after `const reported = ts.sortAndDeduplicateDiagnostics(kept)`
(line 623). Both the direct single-leaf path and the solution-walk path route through `finalize`, so a single
detector call there covers everything with **zero walk threading** -- strictly less code than the
`notTypeCheckedDeclaredFiles` pattern it mirrors. It drops in exactly like `templateCheckAborted` (a sibling
detector already living in `finalize`), with one deliberate difference (see Pitfall 1).

`evaluateResult` needs **no change**: its input type `EvaluateInput` is an explicit `Pick` of `CoreResult`
that does not (and will not) list the new field, so verdict-neutrality (D-05) holds by construction. The new
detector module is NOT exported from `index.ts` (mirrors `detectUncheckedDeclaredFiles`); the field reaches
the public API transitively via the already-exported `CoreResult` type.

**Primary recommendation:** Add `detect-bundler-query-imports.ts` (pure, `readonly string[]`), call it once
inside `finalize` over `reported`, add the `bundlerQueryImports?` field to `CoreResult`, add
`warnBundlerQueryImports` to the executor mirroring `warnNotTypeChecked`, restructure the README caveat, and
prove it with a pure unit tier + a hermetic Vite `?query` integration fixture (vite 8.1.0 is already a
resolvable devDependency). Version bumps 0.1.1 -> 0.1.2 (`feat`, 0.x patch).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect unresolved `?query` `TS2307` specifiers | Core (pure detector over diagnostics) | -- | Pure, no `console`/`process`; reads only public `ts.Diagnostic` fields. Mirrors the three shipped pure detectors. |
| Carry the finding in the structured result | Core (`CoreResult.bundlerQueryImports`) | -- | Additive `[] -> undefined` optional field; the programmatic-API surface (barrel exports `CoreResult`). |
| Render the loud human/CI notice | Executor adapter (`logger.warn`) | -- | ONLY the Nx executor tier touches `@nx/devkit` `logger`. Core stays framework-agnostic. |
| Decide the pass/fail verdict | Core (`evaluateResult`) | -- | Unchanged. The new field is deliberately absent from `EvaluateInput`, so it can never enter the verdict. |
| Consumer-side resolution guidance | Docs (README `## Storybook`) | Changelog | Zero engine coupling; the fix lives in the consumer's checked tsconfig (`"types": ["vite/client"]`). |
| Real-OSS behavior verification (Gate B) | Manual/interactive (locally-packed dist tarball into radix-ng) | -- | External large checkout; not CI-appropriate (D-10). |

## Standard Stack

### Core -- NO new runtime or dev dependencies are added by this phase

| Library | Version (verified) | Role in this phase | Note |
|---------|--------------------|--------------------|------|
| `typescript` | 6.0.3 (installed; peer `>=6.0.0 <6.1.0`) | `flattenDiagnosticMessageText`, `Diagnostic`, `DiagnosticCategory` | TS2307 message text verified below. |
| `@angular/compiler-cli` | 22.0.4 (peer `^22.0.0`) | `readConfiguration` + `performCompilation` (integration fixture only) | Already the engine. |
| `vitest` | 4.x via `@nx/vitest:test` | test runner (unit + integration + executor tiers) | Config `packages/angular-typechecker/vitest.config.mts`. |
| `vite` | 8.1.0 (root devDependency `^8.0.0`) | supplies `node_modules/vite/client.d.ts` for the integration fixture's "cleared" leg | **VERIFIED present and resolvable in-repo AND declared as a root devDependency**, so `npm ci` in CI installs it. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `"types": ["vite/client"]` (integration "cleared" leg) | a committed hand `declare module '*?query'` `.d.ts` in the fixture | Hand shim needs no `vite` resolvable, but is incomplete by construction (missed `?inline` in spike 009). Since `vite` IS a devDependency, prefer the `vite/client` leg for the fixture's cleared variant; optionally add a hand-shim leg to demonstrate the fallback. |
| Scanning `reported` (post-filter) in `finalize` | Scanning the pre-filter `diagnostics` arg (as `templateCheckAborted` does) | LOCKED by D-02: scan the KEPT set so a boundary-filtered (e.g. node_modules) `?query` is never flagged -- the consumer neither sees nor can fix it via their tsconfig. See Pitfall 1. |

**Installation:** none. `npm install` adds nothing; the phase edits source + docs only.

## Package Legitimacy Audit

**Not applicable.** This phase installs NO external packages. Every library it touches
(`typescript`, `@angular/compiler-cli`, `vitest`, `vite`) is already present and pinned in the locked
stack / lockfile. No `npm install` / `pip install` / `cargo add` occurs. slopcheck gate: N/A (nothing to check).

## Architecture Patterns

### System Architecture Diagram

```
runTypecheck(options)                              [core, pure]
  |
  |-- readConfiguration -> parsed
  |-- (zero-rootNames guard? / solution walk? / direct leaf?)
  |
  |   DIRECT LEAF PATH                    SOLUTION WALK PATH
  |   result = runNoEmitCompilation       walk = walkReferences(...)
  |         |                                   |
  |         v                                   v
  |     finalize(ts, ..., [config+diags], filter)   <-- BOTH paths converge here
  |         |
  |         |  kept        = filterDiagnostics(...).kept        (project-boundary filter)
  |         |  reported    = sortAndDeduplicateDiagnostics(kept)   <=== the FINAL KEPT set
  |         |  errorCount  = reported.filter(Error)
  |         |  templateCheckAborted = detectTemplateCheckAborted(diagnostics)   [scans PRE-filter superset]
  |         |  ***NEW***  bundlerQueryImports = detectBundlerQueryImports(ts, reported)  [scans POST-filter]
  |         v
  |     CoreResult { ..., bundlerQueryImports? }   ([] -> undefined via conditional spread)
  |
  v
typecheckExecutor(options, ctx)                    [executor adapter, only tier that logs]
  |-- warnTemplateCheckAborted(result)
  |-- warnSkippedReferences(result)
  |-- warnSuppressed(result)
  |-- warnNotTypeChecked(result)
  |-- ***NEW*** warnBundlerQueryImports(result)    logger.warn: count + "types":["vite/client"] + ADVISORY not suppressed
  |-- renderReport(...) -> process.stdout.write     (codeframe report; advisories NOT rendered here -- logger only)
  |-- evaluateResult(result, {maxWarnings, strict}) (verdict; NEVER reads bundlerQueryImports)
  |-- return { success }
```

### Exact code seams (verified line numbers, live code)

| Edit | File | Location | What |
|------|------|----------|------|
| New module | `src/core/detect-bundler-query-imports.ts` | new file | Pure `detectBundlerQueryImports(ts, diagnostics): readonly string[]`. |
| Field decl | `src/core/run-typecheck.ts` | `CoreResult` after line 111 (`notTypeCheckedDeclaredFiles?`) | `bundlerQueryImports?: readonly string[];` with a doc comment mirroring 101-111. |
| Detector call | `src/core/run-typecheck.ts` | inside `finalize`, after line 623 (`const reported = ts.sortAndDeduplicateDiagnostics(kept);`) | Call detector over `reported`; fold into the return object via the same conditional-spread idiom as `templateCheckAborted` (line 658). |
| Executor render | `src/executors/typecheck/executor.ts` | add `warnBundlerQueryImports(result)` after line 56 (`warnNotTypeChecked(result)`); new fn after line 231 | Mirror `warnNotTypeChecked` (219-231). |
| Doc-comment count | `src/executors/typecheck/executor.ts` | lines 18 + 32 say "four advisory warn*" | Bump to "five". |
| Docs | `packages/angular-typechecker/README.md` | Vite caveat bullet ~432-443; Programmatic-API `CoreResult` comment 310-315 | D-07 restructure + add `bundlerQueryImports?: readonly string[]` to the API comment. |

**Single-seam justification (verified):** `finalize` is called on every return path -- direct leaf
(run-typecheck.ts:360), solution walk (run-typecheck.ts:441), zero-rootNames guard (308), and all-not-found
walk arm (487). Placing the detector inside `finalize` over `reported` therefore covers ALL paths with one
call and no threading. The guard/all-not-found paths carry only synthesized file-less diagnostics
(90001/90002) with no "Cannot find module" text, so the detector returns `[]` there -- harmless.

### Pattern: pure detector -> additive optional field -> executor logger.warn (the shipped triad)

**What:** Three shipped advisories already follow this exact shape: `templateCheckAborted`,
`skippedReferences`, `notTypeCheckedDeclaredFiles`. Signal 2 is the fourth instance and the SIMPLEST (it
reads the diagnostics array already held in `finalize`, not the tsconfig).

**Example (detector -- lift the spike 010 algorithm, return the LOCKED `readonly string[]` shape):**
```ts
// src/core/detect-bundler-query-imports.ts  (Source: spike 010 harness.mjs detectViteQueryImports)
import type ts from 'typescript';

/**
 * SB-09 D-02: PURE detection of unresolved bundler-query imports. A `?` in a module
 * specifier is a bundler (Vite/webpack) query -- TS/Node module specifiers never use
 * one -- so an unresolved TS2307 whose specifier contains `?` is a bundler-query import
 * the consumer can fix with `"types": ["vite/client"]`. Scans the FINAL KEPT
 * (post-boundary-filter) diagnostic set, so a node_modules-suppressed `?query` is never
 * flagged. Returns deduped, sorted specifiers; [] when none. No console/process.
 */
export function detectBundlerQueryImports(
  ts: typeof import('typescript'),
  diagnostics: readonly ts.Diagnostic[],
): readonly string[] {
  const flagged = new Set<string>();

  for (const diagnostic of diagnostics) {
    if (diagnostic.code !== 2307) {
      continue;
    }

    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    const match = /Cannot find module '([^']+)'/.exec(message);

    if (match !== null && match[1].includes('?')) {
      flagged.add(match[1]);
    }
  }

  return [...flagged].sort();
}
```

**Example (finalize wiring -- mirror the templateCheckAborted conditional spread at 645/658):**
```ts
// run-typecheck.ts finalize(), after: const reported = ts.sortAndDeduplicateDiagnostics(kept);
const bundlerQueryImports = detectBundlerQueryImports(ts, reported);
// ... in the returned object literal, beside the templateCheckAborted spread:
return {
  tsConfigPath, rootNamesCount, diagnostics: reported, errorCount, warningCount,
  suppressedThirdParty, suppressedInGraphErrorCount, suppressedInGraphWarningCount,
  suppressedInGraphFiles, durationMs: performance.now() - start,
  ...(templateCheckAborted !== undefined ? { templateCheckAborted } : {}),
  ...(bundlerQueryImports.length > 0 ? { bundlerQueryImports } : {}),
};
```

**Example (executor render -- mirror warnNotTypeChecked, executor.ts:219-231):**
```ts
function warnBundlerQueryImports(result: CoreResult): void {
  if (!result.bundlerQueryImports?.length) {
    return;
  }

  logger.warn(
    `angular-typechecker: ${result.bundlerQueryImports.length} unresolved import(s) use a bundler ` +
      `query suffix (e.g. ?raw/?url/?worker/?inline) -- these look like Vite/Analog imports. Add ` +
      `"types": ["vite/client"] to the checked tsconfig (or an ambient 'declare module' shim) to ` +
      `resolve them. This is ADVISORY: the TS2307 are NOT suppressed (a missing module can be a ` +
      `real bug). Specifier(s): ${result.bundlerQueryImports.join(', ')}.`,
  );
}
```

### Anti-Patterns to Avoid
- **Do NOT thread the field through `walk-references.ts`.** That is the config-derived pattern for
  `notTypeCheckedDeclaredFiles`. The diagnostic-derived detector belongs at the single `finalize` seam.
- **Do NOT scan the pre-filter `diagnostics` arg** (see Pitfall 1). Scan `reported`.
- **Do NOT touch `evaluateResult` / `EvaluateInput`.** Adding the field there would violate D-05.
- **Do NOT gate on a "known Vite suffix" regex.** Spike 010 used `KNOWN` only to LABEL confidence, never to
  gate. D-02 flags on any `?` in the specifier. (The LOCKED shape is a plain `string[]`, so drop the label.)
- **Do NOT export the detector from `index.ts`.** Mirror `detectUncheckedDeclaredFiles` (unexported).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Flattening a diagnostic message that may be a `DiagnosticMessageChain` | manual chain walk / `String(messageText)` | `ts.flattenDiagnosticMessageText(d.messageText, '\n')` | LOCKED by D-02; handles both `string` and chain. On a plain string it returns it unchanged. |
| Deciding "is this specifier a bundler query" | a maintained allowlist of Vite/webpack suffixes | `specifier.includes('?')` | TS/Node specifiers never contain `?`; the allowlist drifts (spike 010 finding). |
| Enumerating the final consumer-visible diagnostics | re-filtering / re-sorting in the detector | the `reported` local already computed in `finalize` | It is exactly the post-filter, sorted, deduped set. |
| Verdict neutrality | a runtime guard that "ignores" the field | the existing `EvaluateInput` `Pick` (structurally omits it) | Compile-time guarantee; no runtime code. |

**Key insight:** every mechanism this feature needs already exists in the engine. The work is 1 new pure
function + 1 field + 1 executor helper + 1 README rewrite + tests. Resist any richer object, option, or
framework coupling -- all explicitly deferred/rejected.

## Common Pitfalls

### Pitfall 1: scanning the wrong diagnostic set (pre-filter vs post-filter)
**What goes wrong:** Copying `detectTemplateCheckAborted` verbatim would scan the PRE-filter `diagnostics`
arg (the superset). That would flag a `?query` `TS2307` on a node_modules / out-of-project file that the
project-boundary filter deliberately dropped -- a file the consumer never sees and cannot fix via their
tsconfig, producing a phantom advisory.
**Why it happens:** the two detectors live in the same function and look identical, but have OPPOSITE intent.
`templateCheckAborted` MUST scan the superset (a whole-program TCB abort must fire even for an out-of-project
poison). The bundler-query advisory MUST scan the KEPT set (D-02: "only advise about TS2307 the consumer
actually SEES").
**How to avoid:** pass `reported` (post-filter, sorted, deduped) to `detectBundlerQueryImports`, not the
`diagnostics` param. Add a code comment stating the difference so a future refactor does not "unify" them.
**Warning signs:** the advisory fires on a run with `includeDeps: false` where the only `?query` diagnostics
were in node_modules.

### Pitfall 2: the regex must gate on `code === 2307`, not on the message alone
**What goes wrong:** typescript@6.0.3 has THREE "Cannot find module '{0}'..." messages: `2307` (the plain
one), `2732` (resolveJsonModule hint), `2792` (moduleResolution hint). A message-only regex would match all
three.
**Why it happens:** the shared message prefix.
**How to avoid:** the `if (diagnostic.code !== 2307) continue;` guard (D-02 LOCKED) runs first. Verified: the
2307 message is exactly `Cannot find module '{0}' or its corresponding type declarations.` -- the regex
`/Cannot find module '([^']+)'/` captures `{0}` correctly and stops at the closing quote.
**Warning signs:** specifiers captured from a `.json` import hint (2732) leaking into the advisory.

### Pitfall 3: ReDoS / malformed message safety (Security V5)
**What goes wrong:** an unsafe regex over untrusted-shaped diagnostic text could backtrack catastrophically.
**Why it happens:** greedy nested quantifiers.
**How to avoid:** `[^']+` is a linear negated character class -- no nested quantifier, no catastrophic
backtracking. `exec` returns `null` on no match (guard with `match !== null`). `messageText` is compiler-owned,
not user input, but the linear regex is safe regardless.

### Pitfall 4: forgetting the executor doc-comment count and the README API comment
**What goes wrong:** executor.ts lines 18 and 32 both say "the four advisory warn*(result) notices"; the
README Programmatic-API `CoreResult` comment (310-315) lists the optional fields. A new field that skips
these leaves stale docs.
**How to avoid:** bump "four" -> "five" in both executor doc comments; add
`bundlerQueryImports?: readonly string[]` to the README API comment block.

### Pitfall 5: changelog scope hygiene (repo release mechanics)
**What goes wrong (AGENTS.md):** `nx release` renders commit SCOPES verbatim into the changelog; internal
plan-id scopes like `feat(20-02):` leak into the public changelog and can mis-parse `[#N]` as issue links.
**How to avoid:** use release-meaningful scopes (`core`, `executor`, `docs`) on commits, and hand-curate the
v0.1.2 `CHANGELOG.md` entry (D-08). No release cut in this phase (D-11).

## Code Examples

### Pure unit test (mirror `detectTemplateCheckAborted` block in run-typecheck.spec.ts:57-149 and detect-unchecked-declared.spec.ts)
```ts
// src/core/detect-bundler-query-imports.spec.ts
import ts from 'typescript'; // real ts is cheap here (no compiler run); flatten on a string returns it
import { describe, expect, it } from 'vitest';
import { detectBundlerQueryImports } from './detect-bundler-query-imports';

const ERROR = 1 as ts.DiagnosticCategory;
function ts2307(specifier: string, code = 2307): ts.Diagnostic {
  return {
    category: ERROR, code, file: undefined, start: undefined, length: undefined,
    messageText: `Cannot find module '${specifier}' or its corresponding type declarations.`,
  };
}

describe('detectBundlerQueryImports (SB-09 D-02/D-06)', () => {
  it('flags a ?query specifier, deduped + sorted', () => {
    expect(detectBundlerQueryImports(ts, [ts2307('./b?raw'), ts2307('./a?url'), ts2307('./b?raw')]))
      .toEqual(['./a?url', './b?raw']);
  });

  it('does NOT flag a plain missing module (no ?) -- D-06(a) no false positive', () => {
    expect(detectBundlerQueryImports(ts, [ts2307('./does-not-exist')])).toEqual([]);
  });

  it('ignores non-2307 "cannot find module" codes (2732/2792 gated out)', () => {
    expect(detectBundlerQueryImports(ts, [ts2307('./x.json?raw', 2732)])).toEqual([]);
  });

  it('returns [] on an empty set (self-gating baseline)', () => {
    expect(detectBundlerQueryImports(ts, [])).toEqual([]);
  });
});
```

### Verdict-neutrality tripwire (mirror evaluate-result.spec.ts:211-222 exactly -- pass via a variable)
```ts
it('stays clean when bundlerQueryImports is non-empty and errorCount 0 -- the advisory NEVER flips the verdict', () => {
  const withBundlerQuery = { errorCount: 0, warningCount: 0, bundlerQueryImports: ['./x?raw'] };
  expect(evaluateResult(withBundlerQuery)).toEqual({ success: true, outcome: 'clean' });
});
```
> Note: passing the extra property via a `const` variable (not a fresh literal) is deliberate -- excess-property
> checks fire only on fresh literals, so this compiles AND proves the field cannot enter the verdict. This is the
> established `notTypeCheckedDeclaredFiles` tripwire pattern.

### Executor render test (mirror the notTypeCheckedCoreResult tests, executor.spec.ts:131-138, 467-503)
```ts
function bundlerQueryCoreResult(specs: readonly string[]): CoreResult {
  return { ...coreResult(2 /* the ?query TS2307 are counted errors */), bundlerQueryImports: specs };
}
// asserts: loggerWarn called once, containing 'vite/client', 'ADVISORY', and a specifier;
// verdict untouched (evaluateResult stub owns success); silent when field undefined.
```

## Runtime State Inventory

**Not applicable** -- this is a greenfield-additive feature phase, not a rename/refactor/migration. No stored
data, live-service config, OS-registered state, secrets/env vars, or build artifacts carry a renamed string.
(Verified: the phase adds a new field/module/docs; it renames nothing.)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vitest.config.mts` |
| Quick run command | `npx nx test angular-typechecker` |
| Full suite command | `npx nx test angular-typechecker` (single project; add `--coverage` for the CI gate) |
| Also-required CI gates (AGENTS.md) | `npx nx run angular-typechecker:lint` (maxWarnings 0) and Prettier `format:check` -- run before the Release PR |

Cold-compiler integration specs inherit `testTimeout 30000` from `vitest.config.mts` -- do NOT add a per-file timeout.

### Phase Requirements -> Test Map
| Req | Behavior | Test Type | Automated Command | File |
|-----|----------|-----------|-------------------|------|
| SB-09 / D-02 | detector flags `?query` specifiers, deduped+sorted | unit | `npx nx test angular-typechecker` | `src/core/detect-bundler-query-imports.spec.ts` (NEW -- Wave 0) |
| SB-09 / D-06(a) | plain missing (no `?`) NOT flagged | unit | same | same spec |
| SB-09 / Pitfall 2 | non-2307 "cannot find module" codes gated out | unit | same | same spec |
| SB-09 / D-05 | `evaluateResult` never reads the field (verdict-neutral) | unit | same | add to `src/core/evaluate-result.spec.ts` |
| SB-09 / D-04 | executor emits ONE `logger.warn` (count + `vite/client` + ADVISORY); silent when undefined | unit (mocked) | same | add to `src/executors/typecheck/executor.spec.ts` |
| SB-09 / D-06(b) + self-gating | REAL compile of a Vite `?query` fixture: field non-empty AND the `?query` `TS2307` are KEPT (errorCount includes them) on the baseline leg; field `undefined` on the `vite/client` (or hand-shim) leg; plain missing still `TS2307` on both | integration | same | `src/core/bundler-query-imports.integration.spec.ts` (NEW -- Wave 0) + `fixtures/vite-query-imports/` (NEW) |
| SB-09 / Signal 1 | README caveat leads with `"types": ["vite/client"]`, names the hand-shim fallback + blind spot + Signal-2 cross-ref + never-auto-suppressed | manual review + Prettier/lint | `npx nx run angular-typechecker:lint`; manual read | `packages/angular-typechecker/README.md` |
| SB-09 / Gate A | branch pushed, PR opened, required CI green | manual/CI | GitHub Actions `ci` + CodeQL checks | -- |
| SB-09 / Gate B (D-10) | locally-packed dist tarball installed into `radix-ng/primitives`: advisory fires on unresolved `?query` `TS2307`, `"types": ["vite/client"]` drives them to 0, plain missing still fails | manual/interactive | `nx build` -> `npm pack` on dist -> install into external radix checkout (mirror Phase 19 OSS UAT harness; pnpm `allowBuilds`/`--ignore-scripts` workaround) | external checkout, NOT committed |

### Mapping to SB-09's three success criteria
- **Criterion 1 (Signal 1, docs):** README manual-review + lint/format gates; **Gate B empirically confirms the
  recipe works** (radix 227 -> 0).
- **Criterion 2 (Signal 2, engine advisory):** detector unit tests + integration "fires on baseline / silent on
  vite-client" + executor render test.
- **Criterion 3 (charter guard):** the D-06(a) unit no-false-positive test + the verdict-neutrality tripwire +
  the integration assertion that the `?query` `TS2307` remain COUNTED errors (never suppressed).

### Sampling Rate
- **Per task commit:** `npx nx test angular-typechecker` (the touched specs run in well under 30s except the one
  cold-compiler integration spec).
- **Per wave merge:** full `npx nx test angular-typechecker` + `lint` + Prettier `format:check` on the merged tree.
- **Phase gate:** full suite + lint + format green (Gate A CI), then Gate B manual verify, before marking complete.

### Wave 0 Gaps
- [ ] `src/core/detect-bundler-query-imports.ts` -- the pure detector (source).
- [ ] `src/core/detect-bundler-query-imports.spec.ts` -- unit tier (covers D-02, D-06(a), Pitfall 2).
- [ ] `fixtures/vite-query-imports/` -- hermetic fixture (mirror spike 009 fixture + `fixtures/not-type-checked-mdx/`
      layout: a `tsconfig.base.json`, a baseline tsconfig, and a `vite/client` (and/or hand-shim) tsconfig, plus
      story-like sources with `?raw`/`?url`/`?worker`/`?inline` + one plain-missing control).
- [ ] `src/core/bundler-query-imports.integration.spec.ts` -- real-compiler integration tier.
- No new framework install needed (Vitest + vite + compiler-cli all present).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `typescript` | detector + everything | Yes | 6.0.3 | -- |
| `@angular/compiler-cli` | integration fixture | Yes | 22.0.4 | -- |
| `vitest` (`@nx/vitest:test`) | all test tiers | Yes | 4.x | -- |
| `vite` (`node_modules/vite/client.d.ts`) | integration fixture "cleared" leg | Yes (root devDep `^8.0.0`, resolved 8.1.0) | 8.1.0 | hand `declare module '*?query'` `.d.ts` leg (no `vite` needed) |
| `radix-ng/primitives` checkout + package manager (pnpm) | Gate B (D-10) | NOT in-repo (external) | Angular 22.0.2 / Nx 23.1.0-beta.1 / TS 6.0.3 / `@storybook/angular` 10.4.6, pnpm 11 | none -- Gate B is a REQUIRED manual step; must clone + install the tarball interactively |

**Missing dependencies with no fallback:** none for the autonomous work. Gate B requires an external radix-ng
checkout (expected; it is a manual/interactive gate by design, not a CI dependency).

**Missing dependencies with fallback:** the integration "cleared" leg can use a hand-shim `.d.ts` if a future
environment lacks `vite`; not needed here since `vite` is present.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes (narrow) | The detector parses compiler-produced diagnostic text with a linear, non-backtracking regex (`/Cannot find module '([^']+)'/`); `exec` null-guarded. No user input reaches it. |
| V6 Cryptography | no | -- |
| V2/V3/V4 Auth/Session/Access | no | Pure in-process type-check tooling; no auth surface. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| ReDoS via a crafted diagnostic message | Denial of Service | Linear `[^']+` negated class -- no catastrophic backtracking. Messages are compiler-owned, not attacker-controlled. |
| Information disclosure via the advisory naming dependency internals | Information Disclosure | The advisory names ONLY the consumer's own module specifiers extracted from the KEPT (post-filter) set -- boundary-filtered node_modules `?query` are never in scope (Pitfall 1). Mirrors the `suppressedInGraphFiles` / `notTypeCheckedDeclaredFiles` content-isolation rule. |
| False PASS from auto-suppressing a real missing module | Tampering (integrity of the verdict) | LOCKED: NEVER suppress. The `?query` `TS2307` stays a counted error; the advisory is purely additive. Charter guard test enforces it. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The hermetic integration fixture's `vite/client` "cleared" leg resolves `vite` at test time in CI. | Validation Architecture / Env | LOW -- verified `vite` is a root devDependency (`^8.0.0`) and `node_modules/vite/client.d.ts` exists; CI runs `npm ci`. Mitigation if ever false: use the hand-shim `.d.ts` leg instead. |
| A2 | Gate B mechanics match the Phase 19 OSS UAT tarball harness (`nx build` -> `npm pack` dist -> install into external checkout; pnpm `allowBuilds`/`--ignore-scripts`). | Validation Architecture / Gate B | LOW -- corroborated by MEMORY (nx-add-fails-on-pnpm-workspaces, oss-real-repo-verification) and spike 009's real-repo leg; exact per-repo steps re-derived at Gate-B execution time. |

**No `[ASSUMED]` claims about package identity, compliance, or security standards.** Both assumptions above are
operational and low-risk, each with a verified mitigation.

## Open Questions

1. **Exact hermetic fixture shape (solution-style vs direct-leaf, and which "cleared" leg).**
   - What we know: `fixtures/not-type-checked-mdx/` uses a solution `tsconfig.json` + `references[]` ->
     `.storybook/tsconfig.json`; spike 009's fixture uses a direct-leaf tsconfig with `include: ["src/**/*.ts"]`
     and separate `baseline` / `hand-shim` / `vite-client` tsconfigs over the SAME sources.
   - What's unclear: whether the planner mirrors the direct-leaf 3-tsconfig spike shape (simplest, proves both
     legs over identical sources) or the solution-style shape.
   - Recommendation: direct-leaf, spike-009-style -- one `tsconfig.base.json` + a `baseline` and a
     `vite-client` tsconfig over shared story sources. It is the smallest fixture that proves "fires + kept" on
     baseline and "self-gated silent" on vite/client. Optionally add a `hand-shim` leg to demonstrate the fallback.

2. **Whether to also assert the exact specifier list in the integration test or just non-empty + kept.**
   - Recommendation: assert non-empty AND that the `?query` `TS2307` are counted (errorCount includes them) AND
     the plain-missing control is present but NOT flagged. Avoid brittle exact-count coupling to the fixture's
     source content (that is the unit tier's job with synthetic diagnostics).

## Sources

### Primary (HIGH confidence)
- Live codebase (read in full this session): `src/core/run-typecheck.ts` (finalize seam 588-660,
  `detectTemplateCheckAborted` 678-693, CoreResult decl 41-112), `src/core/detect-unchecked-declared.ts`,
  `src/core/walk-references.ts`, `src/core/evaluate-result.ts` (`EvaluateInput` Pick 69-78),
  `src/executors/typecheck/executor.ts` (`warnNotTypeChecked` 219-231, doc-comment "four" 18/32),
  `src/core/detect-unchecked-declared.spec.ts`, `src/core/not-type-checked.integration.spec.ts`,
  `src/core/evaluate-result.spec.ts` (tripwire 211-222), `src/executors/typecheck/executor.spec.ts`,
  `src/core/run-typecheck.spec.ts` (detector unit block 57-149), `src/index.ts`, `README.md` (Storybook
  353-464, Programmatic API 292-329).
- typescript@6.0.3 runtime, verified via `node -e`: `ts.version === '6.0.3'`; TS2307 message
  `"Cannot find module '{0}' or its corresponding type declarations."` (and confirmed 2732/2792 share the prefix).
- `vite` resolvable in-repo: `require('vite/package.json').version === '8.1.0'`; `node_modules/vite/client.d.ts`
  present; root `package.json` devDependency `vite: ^8.0.0`.
- `packages/angular-typechecker/package.json` version `0.1.1` (confirms 0.1.1 -> 0.1.2 patch on a `feat`).
- Spike records: `.planning/spikes/009-*/README.md` + `fixture/` (radix 227 -> 0, hermetic 5 -> 0, blind spot),
  `.planning/spikes/010-*/README.md` + `harness.mjs` (the detector algorithm, VALIDATED 6/6).
- `.planning/phases/20-.../20-CONTEXT.md` (locked D-01..D-11), `.planning/REQUIREMENTS.md` SB-09 (108-124),
  `.claude/skills/spike-findings-angular-typechecker/{SKILL.md,references/vite-analog-query-imports.md}`.
- Project instructions: `CLAUDE.md`, `AGENTS.md` (release mechanics, PR-only main, changelog scope hygiene,
  ASCII-only, git grep discipline).

### Secondary (MEDIUM confidence)
- MEMORY entries (operational, corroborating Gate B mechanics): `oss-real-repo-verification`,
  `nx-add-fails-on-pnpm-workspaces`, `e2e-projects-share-one-tarball-serialize`.

### Tertiary (LOW confidence)
- None. Every claim is verified in-repo or against the installed runtime.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new deps; all versions verified against `node_modules` and `package.json`.
- Architecture / wiring: HIGH -- exact line numbers read this session; single-seam claim traced through all
  four `finalize` call sites.
- Detector correctness: HIGH -- algorithm lifted from a VALIDATED spike; TS2307 message text confirmed at 6.0.3.
- Pitfalls: HIGH -- the pre/post-filter distinction and the multi-code trap are verified, not inferred.
- Gate B mechanics: MEDIUM -- external checkout; steps re-derived at execution time (A2).

**Research date:** 2026-07-07
**Valid until:** 2026-08-07 (stable stack; the only volatile input is the external radix-ng checkout for Gate B).
