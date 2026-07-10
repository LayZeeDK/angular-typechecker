# Phase 21: Angular CLI builder + engine multi-tsConfig + GATE A' spike (GO/NO-GO) - Research

**Researched:** 2026-07-10
**Domain:** Re-exporting a shipped Nx executor as an Angular CLI builder via `convertNxExecutor`; widening the engine's `tsConfig` to `string | string[]`; empirically gating the CJS-loads-ESM-`@angular/compiler-cli` bridge through a real `ng run`.
**Confidence:** HIGH (design LOCKED by milestone research; bridge mechanics + versions re-verified against installed source and the npm registry this session)

> This phase was pre-researched at the milestone level. This document DISTILLS that
> research into a Phase-21-specific, plan-ready spec and fills the two implementation
> gaps the planner needs: the GATE A' `ng run` mechanics and the ENG-01 array seam.
> Where the milestone research's SUMMARY.md "CORRECTION & LOCKED DECISIONS" conflicts
> with anything, that section wins. Where a mid-flight user correction (below) conflicts
> with CONTEXT.md D-01/D-03/U-01, the user correction wins.

<user_constraints>
## User Constraints (from CONTEXT.md + mid-flight user correction)

### MID-FLIGHT USER CORRECTION (supersedes CONTEXT.md D-01, D-03 criterion 2, and U-01)

The GATE A' methodology was changed by explicit user direction after CONTEXT.md was written.
The planner and executor MUST follow this, not the superseded CONTEXT.md text:

- **On-stack Angular 22 ONLY for the Phase 21 GATE.** DROP the off-stack Angular 21 leg and
  DROP the synthetic `npm init @angular` sandbox as the GATE substrate. Cross-Angular-version
  breadth is NO LONGER a GO/NO-GO gate in Phase 21.
- **The GATE A' quick verification runs a REAL `ng run <project>:typecheck` against a REAL,
  already-cloned OSS Angular 22 `angular.json` workspace** that contains BOTH application and
  library projects. Substrate: `bluehalo/ngx-leaflet` (a real Angular 22 CLI workspace with an
  app + a publishable library). It is a LOCAL dev/debug substrate OUTSIDE the repo. Record it
  per the spike-007 discipline: commit the RECORD only (harness + forensic-log.json + README),
  document the repo URL + commit SHA for reproduction, NEVER commit the clone or its
  `node_modules`. Plan generically ("the cloned real Angular 22 workspace"); the exact repo is
  an execution detail, not a hard-coded planning dependency.
- **U-01 (split-result contingency) is MOOT.** With no off-stack leg there is no
  Ng22-GO/Ng21-NO-GO split to arbitrate. Do NOT plan around it.
- **ACB-02's "off-stack (Angular 21)" clause is DROPPED ENTIRELY (not deferred).** Per the
  user's 2026-07-10 AskUserQuestion answer, off-stack Angular 21 is removed from ACB-02 AND
  from ACV-01 (the Ng21 cross-check was deleted from REQUIREMENTS.md, not moved to Phase 24).
  Verification is on-stack Angular 22 ONLY. Do NOT plan any off-stack Angular 21 leg anywhere
  (Phase 21 or 24). This is the authoritative reading; CONTEXT.md + REQUIREMENTS.md agree.

### Locked Decisions (from CONTEXT.md, as adjusted by the correction above)

- **D-01 (adjusted):** Prove GATE A' with a real `ng run <project>:typecheck` against the real
  cloned Angular 22 workspace (app AND library projects). An `.mjs`-only harness is INSUFFICIENT
  -- it cannot trigger `convertNxExecutor`'s eager `retrieveProjectConfigurationsWithAngularProjects`
  project-graph prelude, which is the exact ESM-sensitive phase the gate must exercise (Pitfall 1,
  nrwl/nx#19475). [Off-stack Ng21 scaffold: SUPERSEDED -- removed.]
- **D-02:** Record the gate under `.planning/spikes/NNN-*` per CONVENTIONS.md (assertion-bearing
  harness ending `[PASS]/[FAIL]` + `VERDICT` + `process.exit`; committed `forensic-log.json`;
  README frontmatter; hermetic planted-error sources documented; commit the RECORD only, never the
  clone `node_modules`). Add the verdict row to MANIFEST.md; surface findings through the
  `spike-findings-angular-typechecker` skill (the channel that carried the Phase-16 gate 006-008).
- **D-03 (adjusted GO checklist):** A GO requires ALL of: (1) `ng run` on-stack Ng22 completes with
  NO `ERR_REQUIRE_ESM` incl. the eager prelude; (2) [Ng21 leg -- SUPERSEDED]; (3) builder diagnostics
  + `formatDiagnostics`/report human output + `BuilderOutput.success` verdict IDENTICAL to the Nx
  executor on the same inputs (ACB-01 parity is part of the gate); (4) `gate-a-static.spec.ts`
  EXTENDED to the built builder entry and still passing (retains literal `import(`, never
  `require('@angular/compiler-cli')`); (5) `nx run <project>:typecheck` still resolves after the
  `builders` field lands (`executors ?? builders` -- the ACB-03 regression assertion).
- **D-04:** The spike GATES. Prove GO FIRST, THEN ship the builder + ENG-01. A NO-GO STOPS Phase 21
  with a documented re-scope and NEVER falls back to a hand-written `@angular-devkit/architect`
  builder; downstream Phases 22-24 do not proceed against the builder until GO.
- **D-05:** Give the builder a SANITIZED `schema.json` copy (strip `cli:"nx"`, `version`, `$id`,
  and any `x-*`/`$default` -- the current executor schema has no `x-*`/`$default`) over the same TS
  options interface, guarded by a schema-parity test mirroring
  `src/executors/typecheck/schema-parity.spec.ts`. The spike CONFIRMS whether Architect accepts the
  executor `schema.json` verbatim (Pitfall 7, MEDIUM); if it does, collapse to reuse -- the sanitized
  copy is the safe default, not a hard commitment.
- **D-06:** `tsConfig: string | string[]`. An array runs each entry through the EXISTING
  single-`tsConfig` logic, UNIONs the raw per-entry diagnostics, then runs ONE `finalize`
  (boundary-filter + `ts.sortAndDeduplicateDiagnostics` + explicit `DiagnosticCategory` counts) over
  the union -- reusing the spike-001 union-then-single-`finalize` aggregation and the v0.2.0
  input-set-membership boundary over the COMBINED declared input sets. Additive-only: widen
  `CoreOptions.tsConfigPath` + the executor `schema.json` (`oneOf` string|array) + `normalize-options`
  ONLY; single-string behavior and the entire Nx path stay byte-unchanged.

### Claude's Discretion (from CONTEXT.md)

- Plan decomposition (how many plans; whether the gate runs via `/gsd:spike` or as an inline gating
  plan of Phase 21; the exact spike number NNN). See "Plan-structuring note" below -- the GATE here
  needs REAL plugin code (not a pure `.mjs` harness), which pushes toward an inline gating plan.
- Hermetic fixture contents (which planted app/spec/library errors prove parity).
- Whether optional-peer classification (ACP-01) is pulled into this phase or left to Phase 23.

### Deferred Ideas (OUT OF SCOPE for Phase 21)

- The `configuration` `angular.json` write-fork (Phase 22); `init` parity + first-party `ng-add`
  (Phase 23); real-OSS + scaffolded e2e + docs (Phase 24); optional-peer audit/docs (Phase 23,
  unless pulled forward per discretion); any hand-written `@angular-devkit/architect` builder or
  breaking change (v0.3.0 only). `createNodesV2` inference (WALK-FUT-01).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENG-01 | `tsConfig` accepts `string \| string[]`; array runs each entry through the single-`tsConfig` logic, UNIONs diagnostics, filters via the v0.2.0 input-set-membership boundary over the combined declared input sets; single-string + Nx path byte-unchanged. | "ENG-01: the tsConfig array seam" below -- exact widening points (`schema.d.ts`, executor `schema.json` `oneOf`, `normalize-options`, `CoreOptions.tsConfigPath`) + the core `handleMultiTsConfig` design that mirrors the shipped `handleSolutionWalk` union-then-single-`finalize` tail. |
| ACB-01 | `ng run <project>:typecheck` via a `convertNxExecutor`-wrapped builder produces diagnostics, human output, and exit/`BuilderOutput.success` IDENTICAL to the Nx executor. | "convertNxExecutor builder wiring" below -- 3-line re-export of the SAME executor default export; parity is structural (same code writes to the same stdout, returns the same `{ success }`). Gate criterion D-03.3. |
| ACB-02 (GATE A') | A spike proves the CJS-loads-ESM `await import()` engine survives `convertNxExecutor` + a real `ng run` on-stack Angular 22, no `ERR_REQUIRE_ESM` incl. the eager project-graph prelude. NO-GO re-scopes (documented), never a hand-written architect builder. | "GATE A' spike mechanics" below -- pack-dist -> install-into-real-clone -> wire `architect.typecheck` -> `ng run` -> scan for ESM signatures + assert diagnostics; forensic-log + spike record. Bridge mechanism re-verified against installed `@nx/devkit@23.0.1`. |
| ACB-03 | `builders.json` + `package.json` `builders` field added additively; `nx run <project>:typecheck` still resolves (`executors ?? builders`). | "Additive-safety" below -- source-verified `executors ?? builders` / `generators ?? schematics` precedence; the regression assertion. |
</phase_requirements>

## Summary

Phase 21 is two mechanically small changes gated by one empirical proof. (1) The builder is a
~3-line re-export -- `export default convertNxExecutor(typecheckExecutor)` -- registered in a new
`builders.json` with a new `builders` `package.json` field. `convertNxExecutor` ships in the already
pinned `@nx/devkit@23.0.1` (re-verified this session: exported, non-deprecated, and its returned
builder `require('@angular-devkit/architect').createBuilder(...)` + `require('rxjs')` and runs an
eager `retrieveProjectConfigurationsWithAngularProjects` prelude before our executor). (2) ENG-01
widens `tsConfig` to `string | string[]` at four additive seams; the array fan-out reuses the shipped
union-then-single-`finalize` aggregation (the exact tail `handleSolutionWalk` already embodies) so the
v0.2.0 input-set-membership boundary filters over the COMBINED declared input sets. No new production
dependencies. The Nx surface stays byte-unchanged because Nx reads `executors ?? builders`.

The headline risk is entirely in GATE A': does the shipped CJS-executor -> ESM-`@angular/compiler-cli`
`await import()` bridge survive being wrapped by `convertNxExecutor` and driven by a real `ng run`
(including the wrapper's eager, ESM-sensitive project-graph prelude)? Milestone research verdict:
SHOULD survive (the `import()` lives in the already-compiled `core/compiler-loader.js`, which the
bridge never re-transforms), LOW-to-MEDIUM residual risk. It MUST be proven by a real `ng run`, not a
unit test or `nx run`. Per the user correction the proof is on-stack Angular 22 ONLY, against a real
cloned Angular 22 workspace (`bluehalo/ngx-leaflet`) that has both an app and a library.

**Primary recommendation:** Run the GATE as an INLINE gating plan (Plan 1) that lands the minimal REAL
builder (`builder.ts` + `builders.json` + `builders` field + `files` entry + sanitized `schema.json`),
extends `gate-a-static.spec.ts` to the builder entry, then a spike-record orchestrator harness packs the
built dist, installs it into the real Ng22 clone, wires `architect.typecheck` on an app AND a library,
runs `ng run`, and scans for ESM failure signatures. On GO, keep the builder and add ENG-01 + the
parity/regression tests. On NO-GO, STOP and document the re-scope. Never hand-write an architect builder.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Builder discovery / target resolution | Angular CLI Architect (consumer runtime) | `package.json` `builders` -> `builders.json` | The CLI resolves `angular-typechecker:typecheck` via the `builders` field; not our code. |
| Builder option parsing / validation | Angular CLI schema validator (`@angular-devkit/core`) | builder `schema.json` (sanitized) | Architect's JSON-schema dialect differs from Nx's -- Pitfall 7; owned by the sanitized schema. |
| `ExecutorContext` synthesis from `BuilderContext` | `@nx/devkit` `convertNxExecutor` bridge | -- | The bridge maps `context.root = builderContext.workspaceRoot` and runs the eager project-graph prelude. Not our code; the GATE proves it. |
| Whole-program Angular type-check engine | Core (`runTypecheck`) | -- | UNCHANGED. The builder reaches the same core the executor does. |
| `tsConfig` array fan-out + union + boundary | Core (`runTypecheck` -> `handleMultiTsConfig`) | `normalize-options` (path resolution) | ENG-01. Fan-out MUST live in core so the combined-input-set boundary + single `finalize` are reused, not re-implemented. |
| CJS -> ESM compiler load | Core (`core/compiler-loader.ts`, built `nodenext`) | -- | UNCHANGED. GATE A' proves it survives the bridge + `ng run`. |
| Nx surface (`nx run <p>:typecheck`) | Nx executor loader | `executors ?? builders` precedence | UNCHANGED and byte-identical because `executors` stays declared. ACB-03. |
| Verdict -> exit code mapping | `BuilderOutput.success` <- executor `{ success }` | `convertNxExecutor` (`{success}` -> Observable -> BuilderOutput) | Structural parity: the executor already returns `{ success }`; the bridge maps it. |

## Standard Stack

### Core (no new production dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nx/devkit` `convertNxExecutor` | ships in `@nx/devkit@23.0.1` (already a pinned `dependency`) | Re-export the Nx `typecheck` executor as an Angular CLI builder | `[VERIFIED: installed source]` Exported from `dist/public-api.d.ts` L74; returns `require('@angular-devkit/architect').createBuilder(fn)`; non-deprecated. Milestone-mandated path. |

### Supporting (optional peers -- consumer-provided, NOT installed by this plugin)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@angular-devkit/architect` | `^0.2200.0` (latest `0.2200.6`) | Runtime host of the converted builder (`createBuilder`); `require()`d lazily inside the bridge | `[VERIFIED: npm registry]` `[CITED: STACK.md]` Declare as OPTIONAL peer (`peerDependenciesMeta.optional`). Present in every Angular CLI workspace. Note the `0.22xx.x` scheme, NOT `22.x`. Declaring in Phase 21 vs 23 is discretion (ACP-01 is mapped to Phase 23). |
| `rxjs` | `^7.8.0` (latest `7.8.2`) | The converted builder returns an rxjs `Observable` | `[VERIFIED: npm registry]` OPTIONAL peer. Present in any Angular workspace (`@angular/core@22` peer `^6.5.3 \|\| ^7.4.0`). |

### Development-only (throwaway; NEVER shipped)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@angular/create` | `22.0.4` (on-stack) | Scaffolded-workspace e2e substrate (Phase 24) | `[VERIFIED: npm registry]` `npm init @angular@22.0.4` is `@angular/create@22.0.4`. NOT the Phase 21 GATE substrate (that is the real clone). |
| real clone `bluehalo/ngx-leaflet` | Angular 22 CLI workspace (app + library) | Phase 21 GATE A' quick `ng run` substrate; Phase 24 final tarball gate | Local-only; document repo URL + commit SHA in the spike record; never committed. |

**Installation (shipped plugin -- runtime deps to ADD: NONE):**
```bash
# convertNxExecutor already ships in the pinned @nx/devkit@23.0.1.
# Optional peers are metadata only (nothing to npm install here):
#   "@angular-devkit/architect": "^0.2200.0" (optional)
#   "rxjs": "^7.8.0"                          (optional)
```

**Version verification (this session, 2026-07-10):** `@nx/devkit` installed `23.0.1`;
`@angular/cli` latest `22.0.6`; `@angular-devkit/architect` latest `0.2200.6`;
`@angular/compiler-cli@22` latest `22.0.6` (dev repo pins `22.0.4`); `typescript@6` in-range
(`6.0.3` installed; note `typescript` GLOBAL latest is now `7.0.2` -- OUT of the `>=6.0.0 <6.1.0`
peer; a fresh Angular 22 scaffold must resolve TS 6.0.x, not 7.x -- assert this); `rxjs` latest
`7.8.2`; `@angular/create@22.0.4` + `@21.2.19` exist.

## Package Legitimacy Audit

No NEW production dependency is added to the shipped plugin (the conversion API is already in
`@nx/devkit@23.0.1`). The optional peers and the dev-only scaffold packages are all first-party
Angular/Nx/RxJS. slopcheck (`0.6.1`) run this session:

| Package | Registry | Role | Source Repo | slopcheck | Disposition |
|---------|----------|------|-------------|-----------|-------------|
| `@nx/devkit` | npm | existing dependency (unchanged) | github.com/nrwl/nx | n/a (already shipped) | Approved |
| `@angular-devkit/architect` | npm | optional peer (consumer-provided) | github.com/angular/angular-cli | [OK] | Approved |
| `rxjs` | npm | optional peer (consumer-provided) | github.com/ReactiveX/rxjs | [OK] | Approved |
| `@angular/cli` / `@angular/create` | npm | dev-only scaffold (e2e) | github.com/angular/angular-cli | [OK] | Approved |

**Removed (slopcheck [SLOP]):** none. **Flagged (slopcheck [SUS]):** none.
**Postinstall audit:** `@angular-devkit/architect` and `rxjs` declare NO `postinstall` script (checked
via `npm view ... scripts.postinstall`). No suspicious install-time execution surface.

## Architecture Patterns

### System Architecture Diagram (Angular CLI type-check run)

```
ng run my-app:typecheck
   |
   v  Architect reads angular.json projects.my-app.architect.typecheck.builder
   |     = "angular-typechecker:typecheck"
   v  resolves package.json.builders -> builders.json -> typecheck.implementation
   v  require()s src/builders/typecheck/builder.js  (CJS, module: nodenext)
   |     default export = convertNxExecutor(typecheckExecutor) = createBuilder(fn)
   |
   v  bridge fn(options, builderContext):                        [ @nx/devkit -- NOT our code ]
   |     readNxJsonFromDisk(workspaceRoot)                        <-- eager
   |     retrieveProjectConfigurationsWithAngularProjects(...)    <-- eager, ESM-SENSITIVE (Pitfall 1)
   |     context.root = builderContext.workspaceRoot
   |     executor(options, synthesizedContext)                    <-- OUR executor, UNCHANGED
   |         normalizeOptions -> tsConfigPath (string | string[])
   |         runTypecheck(coreOptions)
   |             await import('@angular/compiler-cli')            <-- GATE A' bridge (compiler-loader.js)
   |             [array? -> handleMultiTsConfig -> union -> ONE finalize]  (ENG-01)
   |         process.stdout.write(report)                         <-- human output (identical to executor)
   |     return { success }
   v  { success } -> toObservable -> Architect BuilderOutput { success } -> exit code
```

The reader traces one `ng run` from target resolution to exit. File-to-responsibility mapping is in
the Architectural Responsibility Map above.

### Recommended Project Structure (Phase 21 delta only)

```
packages/angular-typechecker/
+-- package.json                 # MODIFIED: + "builders", + files entry, (+ optional peers, discretion)
+-- executors.json               # UNCHANGED
+-- generators.json              # UNCHANGED
+-- builders.json                # NEW  { "builders": { "typecheck": { implementation, schema } } }
+-- src/
|   +-- core/                    # run-typecheck.ts MODIFIED (ENG-01 array branch); compiler-loader.ts UNCHANGED
|   +-- executors/typecheck/     # schema.json + schema.d.ts + normalize-options.ts MODIFIED (ENG-01 widen)
|   |                            # gate-a-static.spec.ts MODIFIED (extend to builder entry)
|   +-- builders/                # NEW
|       +-- typecheck/
|           +-- builder.ts       #   export default convertNxExecutor(typecheckExecutor)
|           +-- schema.json      #   sanitized copy (no cli/version/$id); tsConfig oneOf string|array
|           +-- schema-parity.spec.ts   # NEW: mirror the executor parity test
```

### Pattern 1: Thin `convertNxExecutor` re-export (ACB-01)

**What:** The whole builder is a 3-line module. Parity with the executor is STRUCTURAL -- it is the
SAME executor default export, so it writes the same report to the same `process.stdout` and returns
the same `{ success }`. The only divergence surface is (a) option parsing (schema dialect -- Pattern 3)
and (b) `context.root <- workspaceRoot` (handled by the bridge).
**When to use:** every converted entry point.
**Must-build-CJS-nodenext:** the builder file compiles under the SAME `tsconfig.lib.json` (`module:
nodenext`) as the executor. It does no `import()` itself, but any build-graph drift that recompiled
`compiler-loader.ts` under `commonjs` re-introduces the v0.0.1 downlevel bug -- which is exactly why
`gate-a-static.spec.ts` must be EXTENDED to the builder entry.
```ts
// src/builders/typecheck/builder.ts (the WHOLE builder)
// Source: STACK.md / ARCHITECTURE.md, verified against installed convert-nx-executor.js
import { convertNxExecutor } from '@nx/devkit';
import typecheckExecutor from '../../executors/typecheck/executor';

export default convertNxExecutor(typecheckExecutor);
```
```jsonc
// builders.json (NEW sibling of executors.json)
{
  "builders": {
    "typecheck": {
      "implementation": "./src/builders/typecheck/builder",
      "schema": "./src/builders/typecheck/schema.json",
      "description": "Type-checks an Angular project (TypeScript + template + extended NG8xxx) with no emit."
    }
  }
}
```
```jsonc
// package.json additions (additive; executors/generators UNCHANGED)
"builders": "./builders.json",
"files": ["src", "executors.json", "generators.json", "builders.json", "README.md", "LICENSE"],
// optional (discretion -- ACP-01 is mapped to Phase 23; the builder runtime-needs these):
"peerDependencies": { "...": "...", "@angular-devkit/architect": "^0.2200.0", "rxjs": "^7.8.0" },
"peerDependenciesMeta": { "@angular-devkit/architect": { "optional": true }, "rxjs": { "optional": true } }
```

### Pattern 2: Additive-safety -- the Nx surface is provably untouched (ACB-03)

**What:** Nx resolves `executorsFile = packageJson.executors ?? packageJson.builders` and
`generatorsFile = packageJson.generators ?? packageJson.schematics`. Since `executors` stays declared,
Nx NEVER reads `builders.json`; the new manifest is Angular-CLI-only.
**Source-verified:** nx `command-line/run/executor-utils.js` L76; `command-line/generate/generator-utils.js` L57.
**Assert, do not assume (D-03.5):** a regression assertion that `nx run <p>:typecheck` still resolves
after the `builders` field lands. Lean form: an in-repo static spec reading `package.json` +
`executors.json` (executors field present + unchanged) plus a smoke that the Nx executor still resolves
(the existing e2e/`GUARD-01` set-equality precedent covers the resolve side).

### Pattern 3: Sanitized builder schema (Pitfall 7 / D-05)

**What:** Architect validates builder options with `@angular-devkit/core`'s JSON-schema parser, whose
dialect differs from Nx's. Give the builder its OWN `schema.json`: the executor schema MINUS the
Nx-only keys (`cli:"nx"`, `version:2`, `$id`), over the SAME option surface. The current executor
schema carries NO `x-*` and NO `$default`, so those are already absent -- the only strip is
`cli`/`version`/`$id`. Widen `tsConfig` to `oneOf` (ENG-01) in BOTH schemas.
```jsonc
// src/builders/typecheck/schema.json (sanitized)
{
  "$schema": "http://json-schema.org/schema",
  "title": "Angular type-check builder",
  "description": "Type-checks an Angular project (TypeScript + template + extended NG8xxx) with no emit.",
  "type": "object",
  "properties": {
    "tsConfig": {
      "oneOf": [
        { "type": "string" },
        { "type": "array", "items": { "type": "string" }, "minItems": 1 }
      ],
      "description": "Path (or array of paths) to the tsconfig(s) to type-check. Resolved relative to the workspace root when not absolute."
    },
    "includeDeps": { "type": "boolean", "default": false, "description": "Include out-of-project and node_modules diagnostics. Default excludes them." },
    "maxWarnings": { "type": "number", "description": "Fail when the warning count exceeds this number. 0 fails on any warning. Omit to never fail on warnings alone." },
    "failFast": { "type": "boolean", "default": false, "description": "Report only the first error (output brevity) - NOT a speed-up." },
    "strict": { "type": "boolean", "default": false, "description": "Opt-in strict mode: FAIL with the coverage-incomplete outcome when a dropped first-party in-graph warning would otherwise leave the verdict clean." }
  },
  "required": ["tsConfig"],
  "additionalProperties": false
}
```
**Parity guard (mirror `schema-parity.spec.ts`):** assert the builder schema's `properties` keys ==
`['failFast','includeDeps','maxWarnings','strict','tsConfig']`, `required == ['tsConfig']`,
`additionalProperties === false`, the same defaults, AND that `cli`/`version` are ABSENT (the inverse
of the executor parity test, which asserts `cli:"nx"`/`version:2` present). The existing executor parity
test only checks `Object.keys(properties)` + `required` + defaults, so widening `tsConfig` to `oneOf`
does NOT break it (it never asserts `tsConfig.type`).
**Spike opportunistically confirms (D-05):** whether Architect would accept the executor schema verbatim
(`cli:"nx"`/`version:2` ignored, per ARCHITECTURE.md's read -- an in-corpus DISAGREEMENT with PITFALLS).
The sanitized copy is the safe default regardless; if the spike proves verbatim works, a future cleanup
can collapse to reuse. Do NOT gate the milestone on that.

### ENG-01: the tsConfig array seam (D-06)

Four additive widening points; the single-string path and the entire Nx path stay byte-unchanged.

1. **`src/executors/typecheck/schema.d.ts`** -- `tsConfig: string` -> `tsConfig: string | string[]`.
2. **`src/executors/typecheck/schema.json`** -- `tsConfig.type: "string"` -> the `oneOf` string|array
   shown above (keep `cli`/`version` on the executor schema; only the type widens).
3. **`src/executors/typecheck/normalize-options.ts`** -- resolve each entry:
```ts
// widened resolution (mirror the existing isAbsolute ? path : joinPathFragments(context.root, path))
const resolveOne = (p: string): string =>
  isAbsolute(p) ? p : joinPathFragments(context.root, p);
const tsConfigPath = Array.isArray(options.tsConfig)
  ? options.tsConfig.map(resolveOne)
  : resolveOne(options.tsConfig);
// coreOptions.tsConfigPath is now string | readonly string[]
```
4. **`src/core/run-typecheck.ts`** -- widen `CoreOptions.tsConfigPath: string` ->
   `string | readonly string[]`; branch at the TOP of `runTypecheck`:
```ts
export async function runTypecheck(options: CoreOptions): Promise<CoreResult> {
  const start = performance.now();
  const ng = await loadCompilerCli();
  const ts = await loadTypescript();

  if (Array.isArray(options.tsConfigPath)) {
    return handleMultiTsConfig(ng, ts, options, start); // NEW
  }
  // ... existing single-string path UNCHANGED below ...
}
```

**`handleMultiTsConfig` design (reuse, do NOT re-implement):** it is the surviving-leaf tail of the
shipped `handleSolutionWalk`, sourced from an EXPLICIT path list instead of resolved references. Per
entry: `parsed = ng.readConfiguration(entry, { suppressOutputPathCheck: true })`,
`throwIfInfrastructureFailure(parsed.errors)`, `runNoEmitCompilation(ng, parsed)`; accumulate the RAW
union (`[...parsed.errors, ...result.diagnostics]`), the combined `rootNamePaths` (union of each
entry's `parsed.rootNames`), `rootNamesCount`, and `notTypeCheckedDeclaredFiles`. Then
`throwIfInfrastructureFailure` over the union, and ONE `finalize` over
`[...configDiagnostics, ...union]` with
`buildFinalizeFilter(ts, <parsed>, options, ts.sys.useCaseSensitiveFileNames, combinedRootNamePaths)`.
This reuses the spike-001 union-then-single-`finalize` + the v0.2.0 input-set-membership boundary over
the COMBINED input set -- exactly D-06.

**WRONG approach to warn the planner against:** calling `runTypecheck` per entry and merging the
`CoreResult`s. That double-implements `finalize`/dedupe/counting AND breaks the boundary -- each
per-entry `finalize` would drop the OTHER entry's files as "not in this leaf's input set". The
combined input set is load-bearing; the fan-out MUST be a single `finalize` over the union.

**Design decisions the planner must lock (flagged, not decided here):**
- **basePath for the combined `finalize`.** For the target use case `[buildLeaf, specLeaf]` co-located
  in one project dir, both entries' `resolveFilterBasePath(...)` are identical, so use the FIRST entry's
  resolved basePath. Document "array entries are expected co-located within one project"; the rare
  cross-dir case is unusual and can be a documented limitation (input-set membership, not directory
  containment, is the primary boundary now, so basePath only governs node_modules/out-of-project).
- **Zero-rootNames entry in an explicit array.** Mirror the walk's `zero-root-names` handling
  (contributes 0, feeds the coverage-incomplete outcome) rather than the direct path's hard 90001 --
  a spec leaf with no `*.spec.ts` yet should surface as coverage-incomplete, not a silent pass. Confirm.
- **Single-element array.** `tsConfig: ["x"]` should behave byte-identically to `tsConfig: "x"`. Add a
  test. (Cheapest: `handleMultiTsConfig` over one entry already yields the same union/finalize; assert it.)
- **Solution tsconfig as an array entry.** Out of scope for ENG-01 (the generator wires leaf arrays).
  A user pointing an array entry at a solution tsconfig gets that entry's zero-rootNames coverage
  signal (safe, non-silent), NOT a walk-per-entry. Recommend leaf-only MVP; note as a documented limit.

### Anti-Patterns to Avoid

- **Hand-writing an `@angular-devkit/architect` `createBuilder`** -- forbidden by charter (forks the
  engine; v0.3.0 scope). The 3-line `convertNxExecutor` re-export is the only path. A NO-GO does NOT
  license this fallback (D-04).
- **Reusing `executors.json` for the builder** -- Nx executor factories are not Angular builders;
  separate `builders.json`.
- **Widening/altering the executor schema beyond the additive `tsConfig` `oneOf`** -- changes the Nx
  executor's validated option surface (additive-only violation).
- **Touching the public barrel (`src/index.ts`)** -- a barrel change is a public-API break; the builder
  is discovered via `builders.json` by path, never via the barrel.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Angular CLI builder over the engine | A bespoke `createBuilder` + option mapping + CJS/ESM bridge | `convertNxExecutor(typecheckExecutor)` | Charter-mandated; duplicates verdict logic; re-introduces the ESM bridge by hand. |
| tsConfig-array union + dedupe + counts | A per-entry merge of `CoreResult`s | Core `handleMultiTsConfig` = union raw -> ONE `finalize` (the `handleSolutionWalk` tail) | Per-entry merge misreconciles counts AND breaks the combined-input-set boundary. |
| Combined input-set boundary | A new directory-containment check | The shipped `buildFinalizeFilter` with `inputTs = combined rootNamePaths` | v0.2.0 already switched to input-set membership; reuse it verbatim. |
| CJS -> ESM compiler load | Any change to reach compiler-cli from the builder | `core/compiler-loader.ts` UNCHANGED | The bridge does not re-transform it; GATE A' proves it survives. |
| Builder option validation | A custom validator | Sanitized `schema.json` + Architect's validator | Architect validates from the schema; a parity test keeps it honest. |

**Key insight:** Phase 21 is almost entirely REUSE. The only genuinely new logic is `handleMultiTsConfig`
(a ~40-line mirror of an existing tail) and the schema sanitization. Everything else is a re-export + a
manifest + additive type/field widening.

## GATE A' spike mechanics (the headline)

An `.mjs`-only harness (spikes 001-010 style, engine copied verbatim) is INSUFFICIENT here: the gate must
exercise the REAL `convertNxExecutor` + the REAL Architect loader + the REAL `ng run` so the eager
`retrieveProjectConfigurationsWithAngularProjects` prelude actually runs (verified present in the installed
wrapper). So the spike harness is an ORCHESTRATOR (bash/`.mjs`/`.ps1`) that drives real tooling, and the
builder code it tests is REAL plugin code (not a harness copy).

**Plan-structuring note (discretion, but strongly recommended):** because the gate needs real plugin
code, run it as an INLINE gating plan (Plan 1), not a pure `/gsd:spike`. Plan 1 lands the minimal real
builder (`builder.ts` + `builders.json` + `builders` field + `files` entry + sanitized `schema.json`) and
extends `gate-a-static.spec.ts`, then runs the orchestrator harness for the GO/NO-GO. On GO the builder
code STAYS (it is the ACB-01 deliverable); only the clone/scaffold is throwaway. The spike RECORD
(README + harness + forensic-log.json) is still committed under `.planning/spikes/NNN-*` per D-02. Next
free spike number is **011** (001-010 exist) -- confirm before use.

**Step-by-step orchestration:**

1. **Build the candidate builder into dist.** `nx build angular-typechecker` -> compiled CJS `.js` under
   `dist/packages/angular-typechecker` (the `outputPath` from `project.json` `build.options.outputPath`).
2. **Pack the DIST tarball** (NOT the source root). `npm pack` inside `dist/packages/angular-typechecker`
   -> `angular-typechecker-<version>.tgz`. CRITICAL (memory: 0.0.1-0.1.0 shipped raw `.ts`): pack the
   BUILT dist so `src/builders/typecheck/builder.js` + `builders.json` + the sanitized `schema.json` are
   real compiled artifacts. Assert the tarball contains them (`npm pack --dry-run` / `tar -tzf`).
3. **Install into the real Ng22 clone (on-stack, NO `--legacy-peer-deps`).** In the cloned
   `bluehalo/ngx-leaflet` workspace (outside the repo): `npm install <abs-path>/angular-typechecker-*.tgz
   --save-dev`. On-stack must install CLEAN -- if it needs `--legacy-peer-deps`, that itself is a finding
   (record it). `ng add` is Phase 23 (no `ng-add` schematic yet); for the GATE, install + hand-wire.
   Note: installing drags `nx` transitively (via `@nx/devkit`'s peer) and may create a `.nx/` dir --
   expected (Pitfall 4); tolerate/clean it.
4. **Wire an `architect.typecheck` target on BOTH an app AND a library project** in the clone's
   `angular.json` (`ng g` is Phase 22 -- hand-edit for the GATE):
```jsonc
"projects": {
  "<app>": { "architect": {
    "typecheck": { "builder": "angular-typechecker:typecheck",
      "options": { "tsConfig": "tsconfig.app.json" } } } },
  "<lib>": { "architect": {
    "typecheck": { "builder": "angular-typechecker:typecheck",
      "options": { "tsConfig": ["projects/<lib>/tsconfig.lib.json", "projects/<lib>/tsconfig.spec.json"] } } } }
}
```
   (Raw Angular CLI `angular.json` uses the `architect` key for the target map -- verified via nx's
   `toNewFormat` renaming `architect`->`targets`. The array form on the library also smoke-tests ENG-01
   end-to-end once ENG-01 lands; for the pure bridge GATE a single-string `tsConfig` is enough.)
5. **Plant a KNOWN type error** in one project (e.g. an app component template unknown-property -> NG8002,
   or a `.ts` `TS2322`) and keep another project clean, so the run proves real diagnostics flow (not a
   vacuous pass) and the verdict maps.
6. **Run `ng run` per project** from the clone root: `npx ng run <app>:typecheck` and
   `npx ng run <lib>:typecheck`; capture stdout + stderr + exit code each.
7. **Scan for ESM failure signatures** in stdout/stderr (the NO-GO signals):
   `ERR_REQUIRE_ESM`, `require() of ES Module`, `Cannot use import statement outside a module`, and any
   project-graph/daemon error thrown BEFORE any diagnostic. Presence of ANY = NO-GO evidence.
8. **Assert GO evidence:** `ng run` reaches the compiler and emits real diagnostics (planted error
   surfaces RED; clean project GREEN); exit code maps to the verdict; NONE of the ESM signatures present;
   builder diagnostics + report + `success` verdict IDENTICAL to the Nx executor on the same inputs
   (D-03.3 -- see Validation Architecture for how parity is proven).
9. **Write `forensic-log.json`** (environment/node/Angular versions, clone repo URL + commit SHA, per-project
   stdout excerpt + exit code, the ESM-signature scan result, and the VERDICT); end the harness with the
   `[PASS]/[FAIL]` list + `VERDICT` + `process.exit(allPass ? 0 : 1)` per CONVENTIONS.md.
10. **Commit the RECORD only** under `.planning/spikes/011-*`: README (frontmatter + What/Research/How to
    Run with the exact repo URL + SHA + pack/install commands), the orchestrator harness, `forensic-log.json`,
    and a hermetic note of the planted-error sources. NEVER the clone or its `node_modules`. Add the verdict
    row to MANIFEST.md; surface findings via the `spike-findings-angular-typechecker` skill.

**GO/NO-GO checklist (maps to Success Criteria 1-4 + D-03):**
- [ ] SC1 / ACB-02: `ng run` on-stack Ng22 (app AND library) completes, NO `ERR_REQUIRE_ESM` incl. the
      eager prelude. [Ng21 leg removed by user correction -> deferred to Phase 24 ACV-01.]
- [ ] SC1 / ACB-02: `gate-a-static.spec.ts` EXTENDED to the built builder entry passes (builder entry's
      reachable `compiler-loader.js` retains literal `import(`; builder `.js` never
      `require('@angular/compiler-cli')`).
- [ ] SC2 / ACB-01: builder diagnostics + report human output + `BuilderOutput.success` IDENTICAL to the
      Nx executor on the same inputs.
- [ ] SC4 / ACB-03: `nx run <p>:typecheck` still resolves after the `builders` field lands
      (`executors ?? builders`).
- [ ] (SC3 / ENG-01 is proven by in-repo tests, not the bridge GATE -- see Validation Architecture.)

**NO-GO handling (D-04):** STOP Phase 21, document the re-scope (e.g. builder unsupported; milestone
narrows to ENG-01 + the schematics that do not need the bridge), and do NOT hand-write an architect
builder. If the CAUSE is the eager prelude, confirm daemon/`.js`-only; if a build-config drift downleveled
`compiler-loader.js`, restore `nodenext` and re-run before declaring NO-GO.

## Common Pitfalls

### Pitfall 1: The ESM bridge fails under `ng run` (the gated risk)
**What goes wrong:** `ng run` throws `ERR_REQUIRE_ESM` / "Cannot use import statement outside a module"
before or during the compiler load.
**Why it happens:** the risk is NOT our `import()` (it lives in already-compiled `compiler-loader.js`,
never re-transformed by the bridge). It is (a) the wrapper's eager
`retrieveProjectConfigurationsWithAngularProjects` prelude (nrwl/nx#19475 -- an ESM-sensitive phase that
runs before our executor), or (b) a build-config drift recompiling `compiler-loader.ts` under `commonjs`.
**How to avoid:** GATE A' -- real `ng run` on-stack Ng22; extend `gate-a-static.spec.ts` to the builder
entry. We ship `.js` (immune to the #19475 on-the-fly-`.ts` transpile race specifically), which is why
the verdict is "SHOULD survive".
**Warning signs:** works under `nx run` but fails under `ng run`; passes on a daemon-enabled machine but
fails in daemon-off CI; the run throws before printing any diagnostic.

### Pitfall 7: Architect rejects the reused executor schema
**What goes wrong:** `ng run` errors on an unknown schema property, or `tsConfig` arrives `undefined`.
**Why it happens:** Architect's JSON-schema dialect differs from Nx's (`cli:"nx"`/`x-*`/`$default`).
**How to avoid:** the sanitized builder `schema.json` (Pattern 3) + the parity test. MEDIUM confidence
the executor schema would work verbatim (ARCHITECTURE says the Nx keys are ignored; PITFALLS says
sanitize) -- the spike confirms; the sanitized copy is the safe default.
**Warning signs:** `ng run --tsConfig=...` fails validation; `tsConfig` undefined at the executor.

### Pitfall 5: Undeclared runtime `require()`s (`@angular-devkit/architect`, `rxjs`)
**What goes wrong:** `Cannot find module '@angular-devkit/architect'`/`'rxjs'` in an unusual workspace.
**Why it happens:** the `require()`s live in `@nx/devkit`'s compiled code, invisible to
`@nx/dependency-checks`; satisfied by coincidence in any Angular CLI workspace.
**How to avoid:** declare both as OPTIONAL peers (`peerDependenciesMeta.optional`). Discretion whether in
Phase 21 or Phase 23; the real Ng22 clone always has both, so the GATE is not blocked either way.

### Pitfall (ENG-01): per-entry finalize breaks the boundary
**What goes wrong:** array entries drop each other's files as out-of-input-set; counts double-reconcile.
**Why it happens:** finalizing per entry instead of once over the union.
**How to avoid:** `handleMultiTsConfig` = union raw -> ONE `finalize` over the COMBINED input set (the
`handleSolutionWalk` tail). Never merge `CoreResult`s.

### Pitfall (packaging): the tarball packs source, not dist
**What goes wrong:** the shipped tarball ships raw `.ts` (0 `.js`) -> `ng run` fails post-publish (memory:
0.0.1-0.1.0 all shipped source; fixed 0.1.1+ via `packageRoot`).
**How to avoid:** pack the BUILT dist for the GATE; extend the tarball-content assertion to include
`src/builders/typecheck/builder.js`, the builder `schema.json`, and `builders.json`.

## Code Examples

### Extending the GATE A static assertion to the builder entry (mirror `gate-a-static.spec.ts`)
```ts
// The builder default export = convertNxExecutor(executor); the builder .js itself does NO import().
// It reaches compiler-cli through the SAME core/compiler-loader.js the executor uses. So the extension:
//   positive: core/compiler-loader.js still retains a literal import(   (already asserted)
//   negative: the built builder.js does NOT require('@angular/compiler-cli')
const builderJsPath = join(distRoot, 'src', 'builders', 'typecheck', 'builder.js');
it('negative: built builders/.../builder.js does NOT require() @angular/compiler-cli', () => {
  const code = stripCommentLines(readFileSync(builderJsPath, 'utf8'));
  expect(code).not.toMatch(/require\(["']@angular\/compiler-cli/);
});
```

### Builder schema-parity spec (mirror `schema-parity.spec.ts`, inverse cli/version assertion)
```ts
const EXPECTED_KEYS = ['failFast', 'includeDeps', 'maxWarnings', 'strict', 'tsConfig'];
it('declares exactly the TypecheckExecutorOptions properties', () => {
  expect(Object.keys(builderSchema.properties).sort()).toEqual(EXPECTED_KEYS);
});
it('keeps tsConfig required and additionalProperties:false', () => {
  expect(builderSchema.required).toEqual(['tsConfig']);
  expect(builderSchema.additionalProperties).toBe(false);
});
it('is sanitized: NO cli:"nx", NO version (Architect dialect)', () => {
  expect(builderSchema).not.toHaveProperty('cli');
  expect(builderSchema).not.toHaveProperty('version');
});
```

## Validation Architecture

**Test framework**

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 via `@nx/vitest:test` |
| Config file | per-project (`packages/angular-typechecker`) |
| Quick run command | `nx test angular-typechecker` |
| Full suite command | `nx build angular-typechecker && nx test angular-typechecker` (build-before-static-read for `gate-a-static.spec.ts`) |
| Also required (CI gates, memory) | `nx run angular-typechecker:format:check` + `nx lint angular-typechecker` (maxWarnings:0) before any Release PR |

**Three proof tiers (Phase 21 owns only the first two rows fully; the real-clone tier is Phase-21 GATE + Phase-24 final):**

| Tier | What it proves | Where it runs | Phase |
|------|----------------|---------------|-------|
| (a) In-repo Vitest -- CI-authoritative | static byte-assertion, schema parity, ENG-01 array union, Nx-surface regression | CI, no external clone | Phase 21 |
| (b) Scaffolded fresh Angular CLI workspace e2e -- repeatable AUTOMATED | `npm init @angular` + `ng g library`, plant app+spec+lib errors, per-project scoping | CI, no external clone | Phase 24 (ACV-02) |
| (c) Real-clone `ng run` | (Phase 21) quick GATE A' bridge verification + debugging; (Phase 24) FINAL tarball end-to-end gate: pack SHIPPED tarball -> `ng add` -> `ng run` -> assert planted diagnostics | Local dev/debug (Ng22 `bluehalo/ngx-leaflet`), record repo URL + SHA | Phase 21 GATE + Phase 24 final |

The real clone has TWO roles: (1) Phase 21's quick `ng run` GATE A' verification (bridge survival, this
phase), and (2) Phase 24's final tarball end-to-end gate (the on-stack Ng22 successor to v0.2.0's radix-ng
real-repo gate). The scaffolded workspace is the repeatable CI automated e2e (Phase 24, no external clone).
For PHASE 21 the real clone is ONLY the quick GATE A' verification.

**Phase Requirements -> Test Map**

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACB-02 | builder entry retains `import(`, never `require(compiler-cli)` | unit (static, built artifact) | `nx build angular-typechecker && nx test angular-typechecker` (extended `gate-a-static.spec.ts`) | Extend existing |
| ACB-02 | real `ng run` on-stack Ng22 completes, no ERR_REQUIRE_ESM incl. eager prelude | spike-harness (real clone) | orchestrator harness -> `forensic-log.json` (GO/NO-GO) | Wave 0: new spike `011-*` |
| ACB-01 | builder diagnostics + report + `success` IDENTICAL to executor | unit (structural) + spike-harness | thin-wrapper assertion + schema-parity + real `ng run` planted-error parity | Wave 0: new tests |
| ACB-01 | builder option surface parses under Architect | unit (schema parity) + `ng run` smoke | `nx test` (new builder `schema-parity.spec.ts`) + spike `ng run --tsConfig` | Wave 0: new spec |
| ENG-01 | `tsConfig: string[]` unions per-entry diagnostics + combined-input-set boundary; single-string byte-unchanged; `["x"]` == `"x"` | integration (hermetic fixture, app+spec leaves, planted errors in each) | `nx test angular-typechecker` (new integration spec mirroring `run-typecheck.integration.spec.ts`) | Wave 0: new spec + fixture |
| ENG-01 | executor/builder schema `tsConfig` `oneOf` accepts string and array | unit (schema) | `nx test` (parity specs assert oneOf) | Wave 0 |
| ACB-03 | `nx run <p>:typecheck` resolves after `builders` field lands; executors field unchanged | unit (package.json/executors.json read) + resolve smoke | `nx test` (new regression spec) + existing e2e/GUARD-01 resolve | Wave 0: new spec |

**Sampling Rate**
- Per task commit: `nx test angular-typechecker`
- Per wave merge: `nx build angular-typechecker && nx test angular-typechecker`
- Phase gate: full suite green + GATE A' spike VERDICT = GO recorded before `/gsd:verify-work`

**Wave 0 Gaps**
- [ ] Extend `src/executors/typecheck/gate-a-static.spec.ts` -- builder-entry negative assertion (ACB-02)
- [ ] `src/builders/typecheck/schema-parity.spec.ts` -- sanitized-schema parity (ACB-01/Pitfall 7)
- [ ] Integration spec + hermetic fixture for `tsConfig: string[]` union + combined boundary + `["x"]`==`"x"` (ENG-01)
- [ ] Nx-surface regression spec (`executors ?? builders`) (ACB-03)
- [ ] Spike `011-*` orchestrator harness + `forensic-log.json` + README (GATE A', real Ng22 clone)
- [ ] (Optional, discretion) architect-testing devDep for an in-repo builder parity loop -- NOT required; the real `ng run` + thin-wrapper + schema-parity cover the gate.

## Security Domain

This is a headless dev/CI type-checker with no auth/session/network/user-data trust boundary. Most ASVS
categories are N/A; the real surface is supply-chain + input validation.

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes | Builder/executor `schema.json` (`additionalProperties:false`, `required:["tsConfig"]`, typed `oneOf`) validates all options; the engine requires an ABSOLUTE tsconfig path and never reads `process.cwd()`. |
| V6 Cryptography | no | -- |
| V14 Supply chain / config | yes | No new shipped deps (convertNxExecutor is in existing devkit); optional peers documented; tarball-content audit extended to `builders.json`/builder `.js`/schema; slopcheck clean; the `nx`-transitive install + `.nx/` dir into a consumer workspace is a documented, expected tradeoff (Pitfall 4), not a vulnerability. |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/typosquat dep pulled by the builder | Tampering / Elevation | slopcheck-verified first-party peers; no new shipped deps; tarball audit |
| A crash mis-reported as a clean type-check | Repudiation (false PASS) | UNCHANGED core invariant: `UNKNOWN_ERROR_CODE` 500 re-thrown as `TypecheckInfrastructureError`; never a silent pass -- carries through the builder unchanged. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Raw Angular CLI `angular.json` uses the `architect` key for the target map (not `targets`) | GATE A' step 4 | Low -- inferred from nx `toNewFormat` (`architect`->`targets`) + ARCHITECTURE.md; if wrong, the spike wiring uses `targets` instead. Verify against the real clone's `angular.json` at spike time. |
| A2 | A fresh Angular 22 scaffold resolves TypeScript 6.0.x (not the now-latest 7.0.2) | Version verification | Low -- Angular 22 peer-constrains TS to the 6.x window; if TS 7 leaks in, the on-stack install ERESOLVEs (itself a signal). Assert TS 6.0.x resolved. |
| A3 | The optional peers (`@angular-devkit/architect`, `rxjs`) are always present in the real Ng22 clone | Pitfall 5 | Low -- both are direct/transitive deps of any Angular CLI workspace; the GATE `ng run` is the backstop. |
| A4 | ENG-01 array entries are co-located leaves within one project (shared basePath) | ENG-01 design decisions | Medium -- the generator (Phase 22) wires `[buildLeaf, specLeaf]` co-located; a cross-dir array is unusual. Document as a limitation; input-set membership (not basePath) is the primary boundary. |

## Open Questions

1. **basePath / zero-rootNames / single-element / solution-entry behavior for the ENG-01 array path.**
   - What we know: the correct aggregation is union-raw -> ONE `finalize` over the combined input set
     (the `handleSolutionWalk` tail).
   - What's unclear: the four edge decisions listed under "ENG-01 design decisions".
   - Recommendation: first-entry basePath; mirror walk's zero-rootNames -> coverage-incomplete;
     `["x"]`==`"x"` (test it); leaf-only MVP (solution-entry = documented limit). Planner locks these.

2. **Declare the optional peers (ACP-01) in Phase 21 or Phase 23?**
   - What we know: the builder runtime-needs `@angular-devkit/architect` + `rxjs`; `@nx/dependency-checks`
     will NOT flag them (imported inside devkit).
   - Recommendation: declare in Phase 21 (co-locate the honest runtime contract with the builder); leave
     the ACP-01 audit/docs to Phase 23. Discretion -- the GATE is not blocked either way.

3. **Does Architect accept the executor schema verbatim (collapse the sanitized copy)?**
   - What we know: in-corpus disagreement (ARCHITECTURE: ignored; PITFALLS: sanitize).
   - Recommendation: ship the sanitized copy (safe default); have the spike record whether verbatim would
     have worked, as a future-cleanup note. Do not gate on it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | yes | 22/24/26 (24.18.0 dev) | -- |
| npm | pack + install into clone/scaffold | yes | bundled | -- |
| `@nx/devkit` (convertNxExecutor) | builder | yes | 23.0.1 installed | -- |
| `@angular/compiler-cli` / `typescript` | engine | yes | 22.0.4 / 6.0.3 installed | -- |
| Angular CLI (`ng`) in the clone | GATE `ng run` | via clone install | 22.x | -- |
| Network (npm registry) | scaffold/clone install, tarball transitive deps | required at spike time | -- | none -- the GATE needs a real install |
| real Ng22 clone (`bluehalo/ngx-leaflet`) | GATE substrate | local clone (outside repo) | Angular 22 (app + lib) | none for Phase 21 GATE (a scaffolded workspace does NOT trigger the same real-CLI path per D-01) |

**Missing dependencies with no fallback:** the real Ng22 clone + network are prerequisites for running the
GATE; without them the GO/NO-GO cannot be recorded. (The clone is a local dev substrate; ensure it is
present + on Angular 22 before Plan 1's harness runs.)

**Windows arm64 notes (this dev machine):** use `git grep`/`rg` not `grep`; the GATE scaffolds live under
the session scratchpad / an external clone dir, NOT a git worktree, so the `node_modules` junction rule
does not apply to the spike (single gating plan, run sequentially on the main checkout). If Phase 21 is
parallelized, apply the AGENTS.md junction + link-only teardown rules.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@nx/angular` used `convertNx*` internally | `@nx/angular` removed internal `convertNx*` (Nx 17); the devkit functions REMAIN public + non-deprecated | Nx 17 | The functions are stable public API; our use is supported. |
| Angular CLI pre-solution tsconfig layout (assumed by parallel researchers) | Modern Ng CLI root `tsconfig.json` IS solution-style (`files:[]` + `references`); `ng g library` appends leaves | Verified 2026-07-10 (SUMMARY correction) | Pitfall 8 VOID; per-project coverage via `tsConfig: [buildLeaf, specLeaf]` (ENG-01). |

## Sources

### Primary (HIGH confidence)
- Installed `@nx/devkit@23.0.1` (`dist/public-api.d.ts` L70/L74; `dist/src/utils/convert-nx-executor.js`
  L15/L19/L51/L54) -- `convertNxExecutor`/`convertNxGenerator` exported, non-deprecated; the builder
  `require('@angular-devkit/architect').createBuilder`, `require('rxjs').Observable`, eager
  `readNxJsonFromDisk` + `retrieveProjectConfigurationsWithAngularProjects`. Re-verified this session.
- Repo source read this session: `src/executors/typecheck/{executor,normalize-options,schema.json,schema.d.ts,gate-a-static.spec,schema-parity.spec}.ts`,
  `src/core/{run-typecheck,walk-references,compiler-loader}.ts`, `package.json`, `executors.json`,
  `generators.json`.
- Milestone research `.planning/research/v0.2.1-angular-cli/{SUMMARY,STACK,ARCHITECTURE,PITFALLS}.md`
  (CORRECTION & LOCKED DECISIONS wins) -- bridge mechanics, additive-safety `executors ?? builders`
  (nx `executor-utils.js` L76 / `generator-utils.js` L57), Pitfalls 1/5/7/8.
- npm registry (2026-07-10): `@angular/cli 22.0.6`, `@angular-devkit/architect 0.2200.6`,
  `@angular/compiler-cli@22 22.0.6`, `rxjs 7.8.2`, `@angular/create@22.0.4`/`@21.2.19`, `typescript`
  global latest `7.0.2` (out of the 6.x peer window).
- slopcheck 0.6.1 (this session): `@angular-devkit/architect`, `rxjs`, `@angular/cli` all `[OK]`; no
  postinstall scripts on architect/rxjs.
- Spike precedent: `.planning/spikes/CONVENTIONS.md`, `MANIFEST.md`, `007-forced-sb10-compile-ng8xxx/`
  (isolated-scaffold, commit-record-only, document install reproduction).

### Secondary (MEDIUM confidence)
- nrwl/nx#19475 (converted Angular executor ESM prelude failure), #19104 (`updateProjectConfiguration`
  can't write `angular.json` -- Phase 22, not this phase), nx.dev `convertNxExecutor` doc.
- ARCHITECTURE-vs-PITFALLS disagreement on whether Architect accepts the executor schema verbatim
  (Pitfall 7) -- resolved by shipping the sanitized copy + spike confirmation.

### Tertiary (LOW confidence)
- A1/A4 assumptions (see Assumptions Log) -- verify at spike time against the real clone's `angular.json`.

## Metadata

**Confidence breakdown:**
- Standard stack / bridge: HIGH -- installed source + registry re-verified this session.
- Builder wiring + additive-safety: HIGH -- source-verified precedence + 3-line re-export.
- ENG-01 array seam: HIGH on the reuse design (mirrors shipped `handleSolutionWalk`); MEDIUM on the four
  edge decisions (flagged for the planner).
- GATE A' outcome: MEDIUM -- "SHOULD survive"; the whole point of the gate is to convert this to evidence.
- Pitfalls: HIGH (mechanism-level from source).

**Research date:** 2026-07-10
**Valid until:** ~2026-08-09 (stable stack; re-verify registry versions if the milestone slips a month).
