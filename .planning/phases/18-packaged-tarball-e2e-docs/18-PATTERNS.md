# Phase 18: Packaged-tarball e2e + docs - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 10 (2 new source, 3 modified source, 3 new/extended test tiers, 2 modified docs)
**Analogs found:** 10 / 10 (every file has a shipped in-repo precedent -- this phase is pattern-following, not invention)

All analogs were read this session and every line number below is verified against the
live tree. The D-01 engine work mirrors the shipped `skippedReferences` /
`templateCheckAborted` detection-vs-render split EXACTLY; the e2e work reuses the
`generator-e2e` / `nx-add-npm` harness verbatim; the docs edits extend existing sections.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/detect-unchecked-declared.ts` (NEW) | utility (pure core detection) | transform (`ParsedConfiguration` -> `readonly string[]`) | `src/core/run-typecheck.ts` `detectTemplateCheckAborted` (exported pure fn) + `walk-references.ts` | exact (detection-family) |
| `src/core/detect-unchecked-declared.spec.ts` (NEW) | test (pure unit) | n/a | `src/core/evaluate-result.spec.ts` (minimal-literal pure fn) + `run-typecheck.spec.ts` (detector unit) | exact |
| `src/core/run-typecheck.ts` (MODIFY) | service (core engine) | transform | itself -- `skippedReferences` conditional-spread + `CoreResult` field family + `finalize` | exact (self-precedent) |
| `src/core/walk-references.ts` (MODIFY) | service (core walk) | transform | itself -- `rootNamePaths` surviving-leaf aggregation (line 268) + `WalkResult` shape | exact (self-precedent) |
| `src/executors/typecheck/executor.ts` (MODIFY) | controller (Nx adapter) | request-response (render) | itself -- the `suppressedInGraph` / `suppressedThirdParty` `logger.warn`/`logger.info` blocks | exact (self-precedent) |
| `src/core/evaluate-result.spec.ts` (MODIFY: add negative case) | test (pure unit) | n/a | itself -- the coverage-incomplete + "stays clean" cases | exact (self-precedent) |
| `src/core/*.integration.spec.ts` + `fixtures/*` (NEW: T5/T6/T9/T10/T11) | test (integration) + fixtures | file-I/O (cold `performCompilation` over committed fixtures) | `src/core/layout-a.integration.spec.ts`, `layout-b.integration.spec.ts`; `fixtures/layout-b-host/*` | exact |
| `e2e/.../src/storybook-tarball.int.spec.ts` (NEW) | test (e2e) | file-I/O + request-response (pack/install/run) | `e2e/.../src/generator-e2e.int.spec.ts` + `nx-add-npm.int.spec.ts` | exact |
| `e2e/.../fixtures/consumer-storybook-{a,b}` (NEW) | fixture (committed workspace) | file-I/O | `e2e/.../fixtures/consumer-generator/*` skeleton + `fixtures/layout-a-storybook`/`layout-b-host` layout | role-match |
| `packages/angular-typechecker/README.md` (MODIFY) | docs | n/a | itself -- Contents / How it compares / Limitations / Programmatic-API sections | exact (self-precedent) |
| `CHANGELOG.md` (MODIFY) | docs | n/a | itself -- the `0.1.1` / `0.1.0` entries + ref-link footer | exact (self-precedent) |

## Pattern Assignments

### `src/core/detect-unchecked-declared.ts` (NEW -- utility, transform)

**Analog:** `src/core/run-typecheck.ts` `detectTemplateCheckAborted` (the exported pure detector) + `walk-references.ts` (pure `ts.sys` usage in core).

The D-01 detection is a NEW pure function file (or a pair of small exported fns) in `src/core/`.
It has NO shipped equivalent, but its SHAPE is the exported-pure-detector precedent
`detectTemplateCheckAborted` establishes: a pure `readonly`-returning function, exported so the
unit tier can prove it with synthetic input, imported by `run-typecheck.ts` / `walk-references.ts`.

**Pure-detector precedent to copy** (`run-typecheck.ts` lines 610-625) -- exported, no `console`/`process`, returns `undefined`/empty on the common path:
```ts
export function detectTemplateCheckAborted(
  diagnostics: readonly ts.Diagnostic[],
): TemplateCheckAborted | undefined {
  const fatal = diagnostics.find(
    (diagnostic) => diagnostic.code === TCB_GENERATION_FATAL_DIAGNOSTIC_CODE,
  );

  if (fatal === undefined) {
    return undefined;
  }
  // ...
}
```

**`ParsedConfiguration` shape the detector reads** (`compiler-cli-types.ts` lines 144-151) -- `.tsx`-without-`jsx` filters `rootNames` and checks `options.jsx`:
```ts
export interface ParsedConfiguration {
  project: string;
  options: ts.CompilerOptions & { basePath?: string };
  rootNames: readonly string[];
  projectReferences?: readonly ts.ProjectReference[];
  emitFlags: EmitFlags;
  errors: readonly ts.Diagnostic[];
}
```
- `.tsx`-without-`jsx` half (RESEARCH RQ2): `parsed.options.jsx === undefined || parsed.options.jsx === 0` (`ts.JsxEmit.None`), then `parsed.rootNames.filter((n) => n.endsWith('.tsx'))`. `.tsx` is always a TS-supported extension, so it is already in `rootNames`.
- `.mdx` half (RESEARCH RQ2): needs a SECOND parse via `ts.parseJsonConfigFileContent(..., extraFileExtensions: [{ extension: 'mdx', isMixedContent: false, scriptKind: ts.ScriptKind.Unknown }])` and `parsed.fileNames.filter((n) => n.endsWith('.mdx'))`. Do NOT hand-roll a glob (Don't-Hand-Roll table).

**`ts.sys` in core is allowed** (walk-references.ts lines 109-113 already does it) -- eslint bans only `console`/`process` under `src/core/**`:
```ts
const canonicalize = createCanonicalizer({
  useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  realpath: (filePath: string): string =>
    ts.sys.realpath?.(filePath) ?? filePath,
});
```

---

### `src/core/run-typecheck.ts` (MODIFY -- service, transform)

**Analog:** itself. Add a `readonly string[]` advisory field to `CoreResult` and attach it via the SAME conditional-spread idiom as `skippedReferences`.

**`CoreResult` field family to extend** (lines 88-99) -- the new field joins `templateCheckAborted?` / `skippedReferences?` with the same additive/advisory doc discipline:
```ts
  templateCheckAborted?: TemplateCheckAborted;
  // D-02 (Phase 13): references skipped or reclassified during a solution-tsconfig
  // walk. ...  ADVISORY only -- recording a skip NEVER changes the verdict.
  skippedReferences?: readonly SkippedReference[];
```
Add (RESEARCH recommends the name `notTypeCheckedDeclaredFiles: readonly string[]`): a `readonly string[]` of un-checked declared paths, `undefined` when empty, documented ADVISORY / verdict-unchanged, in the `suppressedInGraphFiles` family.

**Conditional-spread `[] -> undefined` idiom to copy** (lines 296-299, applied at 325/353) -- the walk path:
```ts
const skipped =
  walk.skippedReferences.length > 0
    ? { skippedReferences: walk.skippedReferences }
    : {};
// ...later:  return { ...result, ...skipped };
```
The new field aggregates from `walk.<newArray>` on the walk path (same spot) and from the single-leaf `parsed` on the direct path.

**`finalize` return + `templateCheckAborted` conditional spread to mirror** (lines 579-591) -- the direct single-leaf path attaches its field here:
```ts
  return {
    tsConfigPath,
    rootNamesCount,
    diagnostics: reported,
    errorCount,
    warningCount,
    // ...suppressed counters...
    durationMs: performance.now() - start,
    ...(templateCheckAborted !== undefined ? { templateCheckAborted } : {}),
  };
```

**Direct single-leaf compute point** -- the non-references branch returns via `finalize(...)` at lines 414-427 with `parsed.rootNames` in scope; compute the direct-path detection from that `parsed` and spread it onto the `finalize` return (or onto the returned object like `skipped`). The `.mdx` re-parse needs `options.tsConfigPath` (the leaf path), already in scope.

**Existing `.tsx`/`.ngtypecheck` LIMITATION doc to leave intact** (lines 637-644) -- this is a SEPARATE concern (shim-name mapping for the abort notice), NOT the D-01 declared-surface scan. Do not conflate; the D-01 field is net-new.

---

### `src/core/walk-references.ts` (MODIFY -- service, transform)

**Analog:** itself. Add a parallel `readonly string[]` aggregation to `WalkResult`, populated in the SAME surviving-leaf tail as `rootNamePaths` (Pitfall 7: must be AFTER every skip `continue`).

**`WalkResult` field to extend** (lines 40-63) -- add alongside `rootNamePaths`:
```ts
export interface WalkResult {
  rawDiagnostics: readonly ts.Diagnostic[];
  rootNamesCount: number;
  rootNamePaths: readonly string[];   // <- the aggregation pattern to mirror
  skippedReferences: readonly SkippedReference[];
}
```

**Surviving-leaf tail -- the EXACT insertion point** (lines 259-269) -- each surviving leaf contributes its declared-uncheckable paths here, after every `continue`:
```ts
    rawDiagnostics.push(...parsed.errors);
    rawDiagnostics.push(...result.diagnostics);
    rootNamesCount += parsed.rootNames.length;
    // D-02: surface this surviving leaf's DECLARED rootName paths ... This
    // push lives in the surviving-leaf tail AFTER every skip/not-found/
    // zero-root-names `continue`, so an out-of-project or non-surviving leaf
    // contributes nothing (T-17-06).
    rootNamePaths.push(...parsed.rootNames);
    // NEW: push this leaf's declared .mdx / .tsx-without-jsx paths here too.
```
The loop already holds `parsed` (the leaf `ParsedConfiguration`) and `leafPath` -- both inputs the detector needs. Return the new array in the final object (line 271: `return { rawDiagnostics, rootNamesCount, skippedReferences, rootNamePaths };`).

---

### `src/executors/typecheck/executor.ts` (MODIFY -- controller, request-response render)

**Analog:** itself. Add ONE `logger.warn` block gated on the new field's length, placed AFTER the `suppressedInGraph` block and BEFORE `renderReport` (RESEARCH: so it is not buried under a codeframe dump).

**The `suppressedInGraph` render block to mirror** (lines 132-145) -- names files from the pure structured field, verdict decided elsewhere:
```ts
    if (
      result.suppressedInGraphErrorCount > 0 ||
      result.suppressedInGraphWarningCount > 0
    ) {
      logger.warn(
        `angular-typechecker: this run's coverage is INCOMPLETE -- ` +
          // ...
          `Dropped file(s): ${result.suppressedInGraphFiles.join(', ')}.`,
      );
    }
```

**The `suppressedThirdParty` `logger.info` (quieter, never verdict-affecting) for tone reference** (lines 120-125). The D-01 notice is `logger.warn` (louder than info, but explicitly ADVISORY: "the verdict is unchanged").

**Insertion boundary** -- add the new block right after line 145 (end of the `suppressedInGraph` block) and before `renderReport` at line 147. Gate: `if (result.notTypeCheckedDeclaredFiles?.length) { logger.warn(...); }` (optional-chained length check is sufficient because core sets the field only when non-empty -- same rule as `skippedReferences` at line 74).

**RESEARCH-supplied copy** (RQ2, executor render point): the `.mdx`-never / `.tsx`-only-with-`jsx` advisory naming the consumer's OWN declared files (never dependency text -- the isolation rule at lines 127-131).

---

### `src/core/evaluate-result.ts` UNCHANGED + `evaluate-result.spec.ts` (MODIFY -- add negative case)

**Analog:** `evaluate-result.spec.ts` itself. `evaluate-result.ts` is NOT touched -- the new field must NOT enter `EvaluateInput` (Pitfall 2). The negative test locks it green.

**`EvaluateInput` to leave alone** (`evaluate-result.ts` lines 62-71) -- the new field is deliberately absent, so an absent field reads as nothing:
```ts
type EvaluateInput = Pick<CoreResult, 'errorCount' | 'warningCount'> &
  Partial<Pick<CoreResult,
    | 'suppressedInGraphErrorCount'
    | 'suppressedInGraphWarningCount'
    | 'templateCheckAborted'
    | 'skippedReferences'
  >>;
```

**Negative-case shape to copy** (`evaluate-result.spec.ts` lines 120-131 -- "stays clean" advisory case) -- the new test asserts a result carrying the D-01 field but `errorCount: 0` and no other trigger returns `{ success: true, outcome: 'clean' }`:
```ts
  it('stays clean when skippedReferences are only advisory non-zero-root reasons (out-of-project / duplicate)', () => {
    expect(
      evaluateResult({
        errorCount: 0,
        warningCount: 0,
        skippedReferences: [
          { referencePath: '/x/tsconfig.json', reason: 'out-of-project' },
          { referencePath: '/y/tsconfig.json', reason: 'duplicate' },
        ],
      }),
    ).toEqual({ success: true, outcome: 'clean' });
  });
```
The new test passes a literal with the D-01 field present (via a cast, since `EvaluateInput` does not declare it) + `errorCount: 0` and asserts `{ success: true, outcome: 'clean' }`. Also mirror the "Suggestion/Message-only drop stays clean under maxWarnings 0" case (lines 153-165) for the maxWarnings-gated variant.

---

### D-01 pure unit spec `src/core/detect-unchecked-declared.spec.ts` (NEW -- test)

**Analog:** `evaluate-result.spec.ts` (minimal-literal, no compiler) for the `.tsx`/`jsx` half; `run-typecheck.spec.ts` (synthetic detector inputs) for the detector-fn discipline.

Feed a synthetic `rootNames` + `jsx` into the `.tsx` detector: assert `.tsx`-without-`jsx` detected, `.tsx`-WITH-`jsx` not, no false positives on a `.ts`-only set. The `.mdx` half needs real `ts.parseJsonConfigFileContent`, so its exact-enumeration proof belongs at the integration tier (RESEARCH RQ2).

---

### In-repo integration specs + fixtures for T5/T6/T9/T10/T11 (NEW/EXTEND -- test + fixtures)

**Analog:** `src/core/layout-a.integration.spec.ts` + `layout-b.integration.spec.ts`; fixtures under repo-root `fixtures/` (e.g. `fixtures/layout-b-host/`).

**The integration-spec skeleton to copy** (`layout-a.integration.spec.ts` lines 29-53) -- `findWorkspaceRoot`, fixture-tsconfig helper, cold `runTypecheck`, `evaluateResult`:
```ts
const TS2322 = 2322;
const workspaceRoot = findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)));

function fixtureTsConfig(name: string): string {
  return join(workspaceRoot, 'fixtures', name, 'tsconfig.json');
}
// ... it('...', async () => {
//   const result = await runTypecheck({ tsConfigPath: fixtureTsConfig('<name>') });
//   expect(result.rootNamesCount).toBeGreaterThan(0);
//   expect(evaluateResult(result).success).toBe(...);
// });
```
Cold-compiler timeout is inherited from `vitest.config.mts` (`testTimeout 30000`) -- do NOT add a per-file `testTimeout` (both integration specs say so).

**Fixture layout to copy** -- the Layout-B host shape (`fixtures/layout-b-host/tsconfig.json` + `.storybook/tsconfig.json`):
```jsonc
// fixtures/layout-b-host/tsconfig.json
{ "extends": "../../tsconfig.base.json", "compileOnSave": false,
  "files": [], "references": [{ "path": "./.storybook/tsconfig.json" }] }
// fixtures/layout-b-host/.storybook/tsconfig.json
{ "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "strict": true, "moduleResolution": "bundler", ... },
  "angularCompilerOptions": { "strictTemplates": true },
  "include": ["../../layout-b-aggregated/**/*.ts"] }
```

**Per-T assignments:**

- **T5 (thin)** -- Analog: `filter-diagnostics.spec.ts` (the node_modules `suppressedThirdParty` cases at lines 74, 353, 390, 412, 433) + `run-typecheck.integration.spec.ts` line 154 (`includeDeps` foldback, but on a first-party sibling where `suppressedThirdParty === 0`). Residual: assert a `node_modules`-attributed diagnostic is suppressed-by-default AND `suppressedThirdParty > 0` AND folded back under `includeDeps`. **Verify before writing** -- `git grep suppressedThirdParty` shows no existing `>0` + `includeDeps` foldback integration case; the pure cases exist in `filter-diagnostics.spec.ts` but not the integration foldback. The `layout-b.integration.spec.ts` dependency-isolation block (lines 111-137) is the closest integration precedent for suppressed-counter assertions.

- **T6** -- Analog: `walk-references.spec.ts` (the "skips a zero-rootNames leaf and records the notice" unit) + `evaluate-result.spec.ts` `zero-root-names -> coverage-incomplete` (lines 108-118). Residual: ONE real-config fixture (flat/story-less tsconfig) proving the run is NOT a silent clean pass (either the 90001 zero-rootNames guard fires -- see `run-typecheck.ts` `synthesizeZeroRootNamesDiagnostic` lines 457-477 -- or coverage-incomplete).

- **T9 (= criterion 2)** -- Analog: `layout-b.integration.spec.ts` (aggregated-import shape). NEW fixture: a Layout-B host where an aggregated story imports a sibling via a workspace `@org/*` alias declared in `paths` of the base tsconfig the `.storybook/tsconfig.json` `extends`. Assert NO spurious `TS2307` and `evaluateResult(result).outcome === 'clean'`.

- **T10 (thin)** -- Analog: `layout-b.integration.spec.ts` itself. `fixtures/layout-b-host` IS the "host referencing only `./.storybook/tsconfig.json`" shape (verified above). Residual: add ONE explicit assertion to the existing layout-b flow that no `ZERO_ROOT_NAMES` (90001) diagnostic appears -- `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE` is imported in `run-typecheck.ts` line 10. RESEARCH Open-Q2: may be judged redundant with T2; low-risk either way.

- **T11 (= D-01 net-new)** -- Analog: `layout-a.integration.spec.ts` (green-verdict proof). NEW fixture whose `.storybook/tsconfig.json` `include` declares a `.mdx` (and/or a `.tsx` with `jsx` unset). Assert `result.notTypeCheckedDeclaredFiles` is non-empty AND `evaluateResult(result).outcome === 'clean'`. A negative fixture (no `.mdx`, `jsx` set) asserts the field is empty/undefined. **Pitfall 3 / Assumption A1:** a `.tsx` containing JSX with `jsx` off emits a hard TS error (TS17004 class) and turns the verdict RED -- to demonstrate the GREEN case, the fixture's `.tsx` must be JSX-free (or use `.mdx`). Verify with the fixture during planning.

---

### `e2e/.../src/storybook-tarball.int.spec.ts` (NEW -- e2e test) + `fixtures/consumer-storybook-{a,b}`

**Analog:** `generator-e2e.int.spec.ts` (pack shared dist, DISTINCT-token, `buildCleanEnv`, `removeTmpDir`) + `nx-add-npm.int.spec.ts` (Verdaccio `nx add` path). **MUST be a NEW `*.int.spec.ts` FILE in the SAME `angular-typechecker-install-e2e` project** -- never a new e2e project (Don't-Hand-Roll table: separate projects race on the shared tarball).

**Serialization is inherited, not re-declared** (`e2e/.../vitest.config.mts` lines 33-39) -- staying in this project inherits singleFork + `fileParallelism:false`:
```ts
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 300000,
    hookTimeout: 300000,
```
The `global-setup.ts` already builds dist ONCE + publishes to Verdaccio ONCE; specs consume `inject('verdaccioUrl')` / `inject('verdaccioToken')`.

**Clean-env / B-03 honesty setup to copy** (`generator-e2e.int.spec.ts` lines 79-87; `nx-add-npm.int.spec.ts` lines 49-54):
```ts
const env = buildCleanEnv({ stripAllNpmConfig: true });
```

**Verdaccio `nx add` path (RESEARCH recommendation, path 1)** -- `nx-add-npm.int.spec.ts` lines 65-95:
```ts
cpSync(fixtureDir, tmp, { recursive: true });
writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);
const npmEnv = { ...env, npm_config_userconfig: join(tmp, '.npmrc.nonexistent') };
sh('npm install', { cwd: tmp, env: npmEnv });
sh('npx nx add angular-typechecker', { cwd: tmp, env: npmEnv });
```

**Direct-tarball path (alternative, path 2)** -- `generator-e2e.int.spec.ts` lines 92-131 (`npm pack --json` in `beforeAll`, `npm install <tgz>` with NO override, `rm` the `.tgz` in `afterAll`). Planner picks ONE (RESEARCH Open-Q1); either proves the shipped artifact.

**Storybook force-install as a SEPARATE `--legacy-peer-deps` step (D-02a, B-03)** -- the ONLY place the override is legitimate; the angular-typechecker install keeps NO override:
```ts
sh('npm install @storybook/angular@10.4.6 --legacy-peer-deps', { cwd: tmp, env });
```

**Planted-error assertion discipline to copy VERBATIM** (`generator-e2e.int.spec.ts` lines 41-61 constants, 196-234 injection+assert) -- DISTINCT full code tokens, `JSON.stringify` for ASCII-safe injected lines, no bare 4-digit substrings (Pitfall 6):
```ts
const LIB_LEAF_CODE = 'TS2322';   // full token, distinct per leaf
const BROKEN_LIB_CONST = `export const x: number = ${JSON.stringify('str')};`;
// ...
expect(bad.code).not.toBe(0);
expect(bad.stdout).toContain(LIB_LEAF_CODE);      // for Layout B also NG8002
expect(bad.stdout).not.toMatch(/ERR_REQUIRE_ESM/); // CJS->ESM bridge survived packaging
expect(bad.stdout).not.toContain('infrastructure error');
```

**Per-run recipe** (RESEARCH RQ3): copy fixture into tmp -> Storybook force-install (`--legacy-peer-deps`) -> angular-typechecker install (NO override) -> `nx g angular-typechecker:configuration <project> --skipFormat` -> clean baseline run (exit 0) -> plant error -> re-run -> assert. `finally { removeTmpDir(tmp); }`.

**Committed fixture skeleton to copy** (`e2e/.../fixtures/consumer-generator/`) -- `package.json` (pinned `@angular/*@22.0.4`, `nx@23.0.1`, `typescript@6.0.3`), `project.json` (`sourceRoot`/`projectType`), `nx.json`, `tsconfig.json`/`tsconfig.lib.json`/`tsconfig.spec.json`. Layers the Storybook `.storybook/` + story files ON TOP, following the repo-root `fixtures/layout-a-storybook` (Layout A) and `fixtures/layout-b-host` (Layout B) tsconfig shapes. Produce ONCE via a real `nx g @nx/angular:storybook-configuration`, commit MINUS `node_modules` (RESEARCH: the spike-007 forced-SB10 scaffold was scratchpad-only, so this is net-new committed material). Story files carry a CLEAN baseline; the spec plants the error at runtime.

---

### `packages/angular-typechecker/README.md` (MODIFY -- docs)

**Analog:** itself. Add a `## Storybook` section between `## How it compares` (lines 328-348) and `## Limitations` (lines 350-366), plus a matching `## Contents` entry (lines 28-42).

**Contents list to extend** (lines 39-40):
```md
- [How it compares](#how-it-compares)
- [Limitations](#limitations)
```
Add `- [Storybook](#storybook)` between them.

**Limitations bullet to REWRITE (WR-01 fold)** -- the current bullet (lines 358-361) is factually wrong post-Phase-17:
```md
- The reference walk is single-level. It checks the solution tsconfig's direct
  in-project leaves; references that are out-of-project, empty, or themselves
  solution tsconfigs are skipped with an advisory warning and do not change the
  verdict. Point `tsConfig` at a leaf directly for those.
```
Rewrite (RESEARCH RQ4 / D-04): a referenced in-project leaf that resolves to ZERO input files (empty, or a references-only/solution tsconfig whose inner projects are not walked) yields a non-clean **coverage-incomplete** verdict; only **out-of-project / duplicate / self-reference** remain advisory (verdict unchanged). This matches the shipped executor `verdictNote` branching (`executor.ts` lines 86-99) and the `evaluate-result.ts` `zero-root-names -> coverage-incomplete` logic (lines 105-112).

**Programmatic-API `CoreResult` shape comment to update** (lines 308-312) -- the new field must be added to this inline comment (RESEARCH RQ2: "it will appear in the README Programmatic API `CoreResult` shape comment, so pick the name deliberately"):
```ts
  // result: { tsConfigPath, rootNamesCount, diagnostics: readonly ts.Diagnostic[],
  //   errorCount, warningCount, suppressedThirdParty, suppressedInGraphErrorCount,
  //   suppressedInGraphWarningCount, suppressedInGraphFiles: readonly string[],
  //   durationMs, templateCheckAborted?,
  //   skippedReferences?: readonly SkippedReference[] }
```

**The EXACT coverage claim to place in `## Storybook`** (RESEARCH RQ4, verbatim-ready from board CONSENSUS.md) -- MUST claim / MUST NOT claim / MUST caveat wording is fully specified in 18-RESEARCH.md lines 352-366. Section prose style matches `## How it compares` (lines 328-348): short intro paragraph + bullets, ASCII-only (CLAUDE.md), `--` not em-dash.

**After the rewrite, move the WR-01 todo** `.planning/todos/pending/wr-01-readme-coverage-incomplete.md` to resolved.

---

### `CHANGELOG.md` (MODIFY -- docs)

**Analog:** itself. Add a curated `## 0.1.2 (<date>)` section ABOVE `## 0.1.1` (line 5), matching the existing entry structure.

**Entry structure to copy** (the `0.1.1` entry, lines 5-35) -- summary paragraph + `### Fixes` / `### Internal` / `### Compatibility`:
```md
## 0.1.1 (2026-07-04)

<summary paragraph>

### Fixes
- **<bold lead-in>** -- <prose>.

### Internal
- <prose>.

### Compatibility
- Nx 23, Angular 22 (`@angular/compiler-cli` `^22.0.0`), TypeScript `>=6.0.0 <6.1.0`
- Node `^22.22.3 || ^24.15.0 || ^26.0.0`
```

**Ref-link footer to extend** (lines 169-173) -- add the `0.1.2` line at the top:
```md
[0.1.2]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.1.2
[0.1.1]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@0.1.1
```

**The PROMINENT green->red callout** (RESEARCH RQ4, verbatim-ready) -- the "Behavior change (a correctness fix, not a regression)" block is fully specified in 18-RESEARCH.md lines 402-407. Curate prose only; do NOT run `nx release` / bump / tag (D-05). Use the existing `0.1.0` "Breaking Changes" section (lines 44-56) as the tone reference for a behavior-change callout.

## Shared Patterns

### Pure-detection-in-core / loud-render-in-executor split (D-01's spine)
**Source:** `src/core/run-typecheck.ts` (`detectTemplateCheckAborted`, lines 610-625) + `walk-references.ts` (`skippedReferences`) + `src/executors/typecheck/executor.ts` (render blocks lines 52-64, 74-107, 120-145)
**Apply to:** the D-01 detection (core) and its notice (executor)
- Core is PURE: eslint bans `console`/`process` under `src/core/**`; `ts.sys` and `ts.parseJsonConfigFileContent` ARE allowed (walk-references.ts uses `ts.sys`). Detection returns structured fields; the executor is the ONLY tier that touches `@nx/devkit` `logger`.

### Advisory field `[] -> undefined` conditional spread
**Source:** `src/core/run-typecheck.ts` lines 296-299 (`skippedReferences`), lines 590 (`templateCheckAborted`)
**Apply to:** the new `CoreResult` advisory field on both the walk path and the direct path
- Core maps an empty array to `undefined` so the executor's optional-chained `?.length` presence check is sufficient (executor.ts line 74).

### Verdict stays green -- do NOT wire the field into `evaluateResult`
**Source:** `src/core/evaluate-result.ts` `EvaluateInput` (lines 62-71)
**Apply to:** the D-01 field
- Simply NOT adding the field to `EvaluateInput` is sufficient; the negative unit test locks it against future accidental wiring (Pitfall 2).

### e2e: serialized shared-tarball tier + B-03 install honesty + DISTINCT tokens
**Source:** `e2e/.../vitest.config.mts` (lines 33-39), `global-setup.ts` (build+publish once), `generator-e2e.int.spec.ts` (lines 79-87, 128-131, 226-234), `nx-add-npm.int.spec.ts` (lines 49-95)
**Apply to:** the new Storybook e2e spec
- Stay INSIDE `angular-typechecker-install-e2e` (never a new project). `buildCleanEnv({ stripAllNpmConfig: true })`. `--legacy-peer-deps` for Storybook ONLY; angular-typechecker install with NO override. Full `TSxxxx`/`NGxxxx` tokens, distinct per leaf. `finally { removeTmpDir(tmp); }`.

### `@workspace/test-util` surface (reuse verbatim)
**Source:** `libs/test-util/src/index.ts`
**Apply to:** the new e2e spec
- Exports: `findWorkspaceRoot`, `buildCleanEnv`, `commandSucceeds`, `run`, `sh`, `removeTmpDir`, `expectSeededTypecheckTargetDefault`, `readTypecheckTargetDefault`, `writeVerdaccioNpmrc`.

## No Analog Found

None. Every file this phase creates or modifies has a shipped in-repo precedent. The single
genuinely new logic is the ~two-line `.tsx`/`.mdx` detection, and even that follows the exported
`detectTemplateCheckAborted` pure-detector shape exactly.

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/core/**`, `packages/angular-typechecker/src/executors/typecheck/**`, `e2e/angular-typechecker-install-e2e/**`, `libs/test-util/**`, repo-root `fixtures/**`, `packages/angular-typechecker/README.md`, `CHANGELOG.md`
**Files scanned:** ~20 (read fully: run-typecheck.ts, walk-references.ts, executor.ts, evaluate-result.ts, evaluate-result.spec.ts, layout-a/b.integration.spec.ts, generator-e2e.int.spec.ts, nx-add-npm.int.spec.ts, global-setup.ts, test-util index, compiler-cli-types.ts, README.md, CHANGELOG.md, 4 fixture tsconfigs, e2e vitest.config)
**Content search:** `git grep` (tracked files) per Windows-arm64 rule; `grep` never used
**Pattern extraction date:** 2026-07-06
