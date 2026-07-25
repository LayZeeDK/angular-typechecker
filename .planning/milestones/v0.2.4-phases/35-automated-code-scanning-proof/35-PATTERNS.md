# Phase 35: Automated Code Scanning proof - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 11 (7 new, 4 modified)
**Analogs found:** 11 / 11

Every new/modified file has a concrete in-repo analog. This phase is CI/fixture/test-only (D-04) -- no published-surface file is touched, so no reporter/adapter analog is a "copy" target (they are read-only contract references). The dominant pattern is "second instance of an existing shape": a second `tools/ci/*.mjs` script, a second Code Scanning job, a fifth SARIF-integration `describe` block, and additive entries in two config files.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tools/ci/assert-code-scanning.mjs` (NEW) | utility (CI helper) | request-response (poll `gh api` + assert) | `tools/ci/merge-sarif.mjs` | role-match (exact shape) |
| `tools/sarif-proof-fixture/tsconfig.json` (NEW) | config (fixture solution) | file-I/O (engine input) | `fixtures/solution-style-all-missing/tsconfig.json` + `fixtures/layout-b-host/tsconfig.json` | exact |
| `tools/sarif-proof-fixture/tsconfig.fixture.json` (NEW) | config (fixture leaf) | file-I/O (engine input) | `fixtures/extended-content-projection/tsconfig.app.json` | exact |
| `tools/sarif-proof-fixture/type-error.ts` (NEW) | fixture source | transform (TS2322 input) | (trivial one-liner; research example) | partial |
| `tools/sarif-proof-fixture/proof.component.ts` (NEW) | component (fixture) | file-I/O (external template) | `fixtures/layout-b-aggregated/card.component.ts` | exact |
| `tools/sarif-proof-fixture/proof.component.html` (NEW) | template (fixture) | transform (NG8002 + NG8xxx) | `fixtures/layout-b-aggregated/card.component.html` (NG8002) | exact (NG8002) |
| `.github/workflows/ci.yml` (MOD -- new `code-scanning-proof` job) | config (CI workflow) | event-driven (`pull_request`) + request-response | the existing `code-scanning` job (same file, L539-613) | exact |
| `machine-reporters-sarif.integration.spec.ts` (EXTEND) | test (integration) | transform (CLI -> SARIF assert) | itself -- the 4 existing `describe` blocks (L236-437) | exact |
| `assert-code-scanning` matcher unit test (NEW) | test (unit) | transform (pure tuple-match) | `packages/angular-typechecker/src/cli/parse-args.spec.ts` | role-match |
| `.fallowrc.jsonc` (MOD -- `overrides` entry) | config | n/a | the `fixtures/**` `overrides` block (L231-258) | exact |
| `.prettierignore` (MOD -- fixture `.html`) | config | n/a | the `extended-batch-*` entries (L21-29) | exact |

## Pattern Assignments

### `tools/ci/assert-code-scanning.mjs` (utility, request-response)

**Analog:** `tools/ci/merge-sarif.mjs` (primary), `tools/ci/list-typecheck-projects.mjs` (exported-pure-function + CLI-entry split).

**CORRECTION to the phase brief:** these scripts have **NO `#!/usr/bin/env node` shebang.** The real shape is: comment header -> `import` from `node:*` -> exported pure function(s) -> a `process.argv[1] === fileURLToPath(import.meta.url)` CLI-entry guard. Follow the real files, not the brief's shebang claim.

**Module/CLI-entry shape** (`merge-sarif.mjs` L22-24, L124-132):
```javascript
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// ... exported pure function(s) above ...
// CLI entry: only runs when invoked directly (not when imported by a spec).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  // ...
}
```

**Injection-safe subprocess spawn** (`merge-sarif.mjs` L86-95) -- fixed arg array, NO `shell: true`, NO interpolated PR data. The research skeleton uses `execFileSync('gh', ['api', pathAndQuery], ...)`; that is the same guarantee (arg array, not a shell string). Mirror the `maxBuffer` bump for large JSON:
```javascript
const result = spawnSync(process.execPath, args, {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
```

**Export the pure matcher so the unit test can import it (load-bearing for the unit-test analog).** `merge-sarif.mjs` exports the pure `mergeSarifRuns(entries)` separately from the CLI entry (L39-64); `list-typecheck-projects.mjs` exports `listTypecheckProjects` (L35) which a GUARD spec imports. Do the same: export something like `missingTuples(alerts, expected)` (pure: takes a parsed alerts array + expected set, returns the missing tuples) and keep the `gh api` polling in the CLI-entry side. The unit test imports the pure matcher; nothing hits GitHub.

**Fail-loud-on-empty precedent** (`list-typecheck-projects.mjs` L83-87) -- throw (non-zero exit) rather than silently pass when discovery/assert finds nothing. This is exactly PROOF-02 (exit non-zero on any missing tuple OR timeout):
```javascript
if (out.length === 0) {
  throw new Error('list-typecheck-projects: no ... discovered under apps/ or libs/');
}
```

**JSDoc typing, not TS** -- these `.mjs` files are JSDoc-typed (`merge-sarif.mjs` L31-38). Match that; do not introduce a `.ts`.

**Env-not-argv for PR data** -- the research skeleton reads `process.env.PR_NUMBER` / `process.env.SARIF_ID`. This mirrors the `e2e` job's `PROJECT` env pattern (see the ci.yml assignment below); the script never sees an interpolated shell string.

---

### `tools/sarif-proof-fixture/tsconfig.json` (config, solution style)

**Analog:** `fixtures/solution-style-all-missing/tsconfig.json` (the missing-reference half -> ATC90002) + `fixtures/layout-b-host/tsconfig.json` (the surviving-reference solution shape).

**`solution-style-all-missing/tsconfig.json` (full file)** -- the `files:[] + references:[missing paths]` shape that synthesizes `ATC90002` (`tool`, error):
```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compileOnSave": false,
  "files": [],
  "references": [
    { "path": "./tsconfig.missing-a.json" },
    { "path": "./tsconfig.missing-b.json" }
  ]
}
```

**`layout-b-host/tsconfig.json` (full file)** -- a solution referencing ONE real leaf:
```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compileOnSave": false,
  "files": [],
  "references": [{ "path": "./.storybook/tsconfig.json" }]
}
```

**Combine them** (the research Pattern 1, all four families in ONE run): `files: []` + `references: [ {path: ./tsconfig.fixture.json} (surviving leaf), {path: ./tsconfig.missing.json} (ABSENT on disk) ]`. `../../tsconfig.base.json` is the correct `extends` depth from `tools/sarif-proof-fixture/` (two levels to repo root, same as `fixtures/*`). Do NOT create `tsconfig.missing.json` -- its absence is what fires ATC90002.

---

### `tools/sarif-proof-fixture/tsconfig.fixture.json` (config, surviving leaf)

**Analog:** `fixtures/extended-content-projection/tsconfig.app.json` (full file) -- explicit `files:[...]` leaf with `strictTemplates` (required for NG8002 + extended NG8xxx to fire):
```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "target": "es2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "emitDecoratorMetadata": false,
    "experimentalDecorators": false
  },
  "angularCompilerOptions": { "strictTemplates": true },
  "files": ["parent.component.ts", "child.component.ts"]
}
```
Copy verbatim; swap `files` to the proof sources (`["type-error.ts", "proof.component.ts"]`). `strict: true` gives TS2322; `strictTemplates: true` gives NG8002 + the extended NG8xxx.

---

### `tools/sarif-proof-fixture/type-error.ts` (fixture source, TS2322)

**Analog:** none needed -- a one-line type error. Research example: `export const proofTypeError: number = 'not a number';`. `diagnostic-family.spec.ts` L40-42 confirms `rawCode 2322` in a `.ts` -> `typescript` family. `ponytail:` a trivial one-liner needs no dedicated analog.

---

### `tools/sarif-proof-fixture/proof.component.ts` (component, external template)

**Analog:** `fixtures/layout-b-aggregated/card.component.ts` (full file) -- the PROVEN standalone-component-with-external-`.html` shape whose template fires NG8002 (de-risks research Assumption A2). Also `fixtures/extended-content-projection/child.component.ts` (standalone + `templateUrl`).
```typescript
import { Component } from '@angular/core';
// (drop the makeTitle cross-dir import -- proof fixture is self-contained)
@Component({
  selector: 'app-card',
  standalone: true,
  templateUrl: './card.component.html',
})
export class CardComponent {
  title = makeTitle();   // proof fixture: use a plain `readonly value = 1;` or `title = 'x';`
}
```
Model the proof component on this: `standalone: true`, `templateUrl: './proof.component.html'`, one property the template binds to. Keep it self-contained (no cross-dir import like `card`'s `makeTitle`).

---

### `tools/sarif-proof-fixture/proof.component.html` (template, NG8002 + NG8xxx)

**Analog (NG8002 half):** `fixtures/layout-b-aggregated/card.component.html` (full file) -- the PROVEN external-`.html` NG8002 (unknown property on a native element). This is what the layout-b-host integration block catalogs as `NG8002` -> `template-type-check` (spec L272, L281):
```html
<div [nonExistentProp]="title"></div>
```
Use this exact NG8002 shape (bind to the component's own property). It is proven; prefer it over the research's assumed `[unknownProperty]`.

**Analog (warning NG8xxx half):** the extended-diagnostics warning is a SEPARATE concern. `fixtures/extended-content-projection` fires `NG8011` (warning) proven at `machine-reporters-sarif.integration.spec.ts` L371-382 (`extended-diagnostics` tag, warning level). Pick a deterministic warning-level NG8xxx (`NG8011` is the safe proven fallback per research A1). If NG8002 and the extended code interfere in one template, split into two elements/components (still one SARIF run) -- the drift-lock spec catches interference before merge.

**Whitespace-sensitivity caveat:** `.prettierignore` already carries two templates whose reflow changes which NG fires (L28-29). Add this fixture's `.html` there (see `.prettierignore` assignment).

---

### `.github/workflows/ci.yml` (config, new `code-scanning-proof` job)

**Analog:** the existing `code-scanning` job (L539-613) -- copy its structure verbatim, changing only: PR-only gate, dedicated category, and the assert step.

**Job-scoped least-privilege + fork/produced gating** (`code-scanning` job L539-613). Copy the permissions block and the checkout/setup pins:
```yaml
code-scanning:                          # -> rename code-scanning-proof
  needs: changes
  if: ${{ needs.changes.outputs.code != 'false' }}   # -> add: github.event_name == 'pull_request' &&
  runs-on: ubuntu-latest
  permissions:
    contents: read
    security-events: write              # covers BOTH upload and the alerts/analyses READ (D-02c)
  env:
    NX_DAEMON: false
  steps:
    - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
      with:
        persist-credentials: false
        fetch-depth: 0
    - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
      with:
        node-version: 24
        cache: npm
    - run: npm ci
    - run: npx nx build angular-typechecker
```

**The `|| true` + `[ -s file ]` produced-guard** (`code-scanning` job L570-573) -- the fixture CLI run fails with exit 1 (it has diagnostics) but still writes valid SARIF; tolerate the exit, guard on non-empty:
```yaml
- id: atc-sarif
  run: |
    node tools/ci/merge-sarif.mjs || true
    if [ -s angular-typechecker.sarif ]; then echo "produced=true" >> "$GITHUB_OUTPUT"; else echo "produced=false" >> "$GITHUB_OUTPUT"; fi
```
For the proof, swap the merge script for the single CLI call: `node dist/packages/angular-typechecker/src/cli/bin.js -c tools/sarif-proof-fixture/tsconfig.json --format sarif > proof.sarif || true`.

**SHA-pinned upload with the fork+produced gate** (`code-scanning` job L600-604) -- reuse the EXACT pin; add the dedicated `category`:
```yaml
- name: Upload angular-typechecker SARIF
  if: ${{ (github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false) && steps.atc-sarif.outputs.produced == 'true' }}
  uses: github/codeql-action/upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1
  with:
    sarif_file: angular-typechecker.sarif
    # proof job ADDS: category: angular-typecheck-proof
    # proof job ADDS: id: upload   (to read steps.upload.outputs['sarif-id'])
```

**PR-metadata via `env:`, never shell-interpolated** (`e2e` job L212-219) -- the injection-safe pattern for passing `github.event.pull_request.number` into the assert step:
```yaml
env:
  NX_DAEMON: false
  # The matrix project is passed to the run steps through this env var, never
  # interpolated as ${{ matrix.project }} into a shell command.
  PROJECT: ${{ matrix.project }}
```
Proof analog: `PR_NUMBER: ${{ github.event.pull_request.number }}`, `SARIF_ID: ${{ steps.upload.outputs['sarif-id'] }}` (bracket syntax -- the hyphen parses as minus in dot syntax), `GH_TOKEN: ${{ github.token }}`, then `run: node tools/ci/assert-code-scanning.mjs`.

**The `discover` job's separate-assignment `set -e` loud-fail idiom** (L171-174) -- use for any `x=$(node ...)` substitution so a script failure fails the job loud rather than writing an empty output and exiting 0:
```yaml
- id: list
  run: |
    projects=$(node tools/ci/list-e2e-projects.mjs)
    echo "projects=$projects" >> "$GITHUB_OUTPUT"
```

**STAYS OUT of the `ci` aggregate `needs[]`** (L630-644) -- the `ci` job lists every required job; the existing `code-scanning` job is deliberately ABSENT from it (L493-497 comment). The new `code-scanning-proof` job MUST also be absent (D-02d; promotion is Phase 36). Do NOT add it to L631-644.

---

### `machine-reporters-sarif.integration.spec.ts` (test, EXTEND -- local drift-lock)

**Analog:** itself. The file already has 4 `describe` blocks, one per family source, each running the CLI over a fixture and asserting the family tag + level. Add a 5th block for the proof fixture asserting ALL FOUR tuples in one run.

**Fixture-path + `runSarif` helper** (L94-130) -- add a `proofFixtureTsConfig` const alongside the existing ones and reuse `runSarif`:
```typescript
const layoutBHostTsConfig = join(workspaceRoot, 'fixtures', 'layout-b-host', 'tsconfig.json');
// ADD: const proofFixtureTsConfig = join(workspaceRoot, 'tools', 'sarif-proof-fixture', 'tsconfig.json');
async function runSarif(tsConfig: string): Promise<string> {
  const { stdout } = await run(['-c', tsConfig, '--format', 'sarif'], env);
  return stdout;
}
```

**The exact family-tag assertion shape** (the layout-b-host block L271-288 + extended block L371-382 + tool block L410-418). This is the drift-lock's core -- assert the emitted rule set carries the four family/level tuples the CI assert expects:
```typescript
it('catalogs exactly the two fired ruleIds ...', () => {
  expect(ruleIds(payload)).toEqual(['NG8002', 'TS2322']);
  expectEveryResultResolvesToItsRule(payload);
});
it('tags the external-template NG8002 rule template-type-check and the TS2322 rule typescript ...', () => {
  const ng8002 = ruleById(payload, 'NG8002');
  const ts2322 = ruleById(payload, 'TS2322');
  expect(ng8002.properties?.tags).toEqual(['template-type-check']);
  expect(ts2322.properties?.tags).toEqual(['typescript']);
  for (const rule of [ng8002, ts2322]) {
    expect(rule.defaultConfiguration?.level).toBe('error');
  }
});
```
The proof block asserts all four: `TS2322`->typescript/error, `NG8002`->template-type-check/error, the extended code (e.g. `NG8011`)->extended-diagnostics/warning, `ATC90002`->tool/error. Reuse the existing `ruleIds`/`ruleById`/`rulesOf`/`expectEveryResultResolvesToItsRule` helpers (L181-223) -- do NOT re-implement them.

**Strongest form (single source of truth, research-recommended):** put the four expected tuples in `tools/sarif-proof-fixture/expected-families.json` and read it from BOTH this spec and `assert-code-scanning.mjs`. The JSON-read idiom is proven in `parse-args.spec.ts` L16-21 (`JSON.parse(readFileSync(...))`). Plain duplication with a cross-reference comment is the acceptable fallback.

**Note:** this spec runs under the `integration` nx target (real cold compiler), NOT `nx test` (which excludes `*.integration.spec.ts`) -- see the ci.yml `test` job L139 (`nx run-many -t integration`).

---

### `assert-code-scanning` matcher unit test (test, NEW -- pure tuple-matching)

**Analog:** `packages/angular-typechecker/src/cli/parse-args.spec.ts` (pure-logic unit spec, direct calls, no `vi.mock`) or `diagnostic-family.spec.ts` (a `record()` factory feeding a pure classifier).

**Direct-call, factory-fed unit shape** (`diagnostic-family.spec.ts` L12-24, L33-65) -- build minimal input objects and assert the pure function's output, including the negative case:
```typescript
function record(rawCode: number, file: string | null): DiagnosticRecord { /* minimal */ }
describe('familyOf (...)', () => {
  it('classifies ... as typescript', () => {
    expect(familyOf(record(2322, 'src/util.ts'))).toBe('typescript');
  });
});
```

**Assertion-helper + narrowing idiom** (`parse-args.spec.ts` L26-33) if the matcher returns a discriminated result. The unit test MUST cover the RED case (a missing tuple -> `missingTuples` returns non-empty) to prove PROOF-02's fail-loud path without hitting GitHub. Import the pure `missingTuples` (or equivalent) exported from `assert-code-scanning.mjs` -- exactly how the merge-sarif unit path imports `mergeSarifRuns`.

**Location:** this must be a `.spec.ts` under `nx test` (not `integration`), OR a `.mjs` sibling test -- planner's call. If it imports the `.mjs` matcher directly, a co-located `tools/ci/*.spec.mjs` run by vitest is simplest. (There is no existing `tools/ci/*.spec.*` precedent, so a plugin-side `.spec.ts` importing the `.mjs` is the safer analog match.)

---

### `.fallowrc.jsonc` (config, MOD -- `overrides` entry)

**Analog:** the `fixtures/**` `overrides` block (L231-258) -- copy this shape for `tools/sarif-proof-fixture/**`:
```jsonc
{
  "files": ["fixtures/**", "e2e/**/fixtures/**", "libs/**"],
  "rules": {
    "unrendered-components": "off",
    "unused-component-inputs": "off",
    "unused-files": "off"
  }
}
```
Add a new `overrides` entry `{ "files": ["tools/sarif-proof-fixture/**"], "rules": { "unused-files": "off", "unrendered-components": "off", "unused-component-inputs": "off" } }`. **Why `tools/` is not already covered:** `tools/**` appears ONLY under `health.ignore` (L205, complexity-only) -- NOT in the `unused-files` overrides. The proof fixture's `.ts`/`.component.ts` are imported by nothing (-> `unused-files`, error-tier, WILL fire the fallow gate). If the broken template/imports trip `unresolved-imports`, mirror the narrow `fixtures/vite-query-imports/**` block (L259-275) which scopes `unresolved-imports: off` for one fixture.

**Gate context:** `audit.gate: new-only` (L301-304) means the PR fails only on findings it INTRODUCES -- the fixture is new, so it WILL be attributed as new. Verify locally with `npx fallow audit --format human --base origin/main` before pushing (research Pitfall 1).

---

### `.prettierignore` (config, MOD -- fixture `.html`)

**Analog:** the whitespace-sensitive-template entries (L21-29) -- add the fixture `.html` if its reflow changes which NG diagnostics fire:
```
# Whitespace-sensitive diagnostic fixtures -- Angular templates whose exact
# whitespace/reflow changes which NG diagnostics fire and HOW MANY ...
/fixtures/extended-batch-fn/error.component.html
/fixtures/extended-batch-expression/error.component.html
```
Add `/tools/sarif-proof-fixture/proof.component.html` with an analogous comment. The `.ts` fixture files are safe to keep Prettier-clean (research Pitfall 2). The `format-lint` job checks only PR-changed files (L385-400), so the new files WILL be inspected.

## Shared Patterns

### CI security invariants (apply to the new `code-scanning-proof` job)
**Source:** `.github/workflows/ci.yml` top-of-file threat model (L1-21) + the `code-scanning` job (L539-613).
**Apply to:** the new job, verbatim.
- SHA-pin every action (full 40-char + `# vX.Y.Z`): reuse `upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1` (L602), `checkout@9c091bb... # v7.0.0`, `setup-node@48b55a... # v6.4.0`. Add NO new marketplace action (prefer `gh api`).
- `persist-credentials: false` on checkout (every job).
- `fetch-depth: 0` (L552 -- the proof needs it for the same reasons the code-scanning job does).
- Job-level `security-events: write` + restated `contents: read` (L543-545); top-level stays `contents: read` (L29-30).
- Fork gate: `github.event.pull_request.head.repo.fork == false` (L601/L610).
- No PR metadata in any `run:` shell string -- pass via `env:` (L212-219 pattern).

### Pure-`node` `tools/ci/*.mjs` shape
**Source:** `tools/ci/merge-sarif.mjs` + `list-typecheck-projects.mjs` + `list-e2e-projects.mjs`.
**Apply to:** `assert-code-scanning.mjs`.
- Comment header explaining WHY -> `node:*` imports -> exported pure function(s) -> `if (process.argv[1] === fileURLToPath(import.meta.url))` CLI entry.
- NO shebang. JSDoc types, not TS.
- Injection-safe subprocess (arg array, no `shell: true`), `maxBuffer: 64 * 1024 * 1024`.
- Throw (non-zero exit) on the failure/empty case -- never a silent pass.
- Export the pure core so a unit test imports it without side effects.

### The family/level contract the proof locks (read-only source of truth)
**Source:** `packages/angular-typechecker/src/core/diagnostic-family.spec.ts` (L40-79 -- the proven `familyOf` mapping) + `machine-reporters-sarif.integration.spec.ts` (L271-437 -- the four family tags over real fixtures).
**Apply to:** the fixture design, the drift-lock spec's expected set, and `assert-code-scanning.mjs`'s `EXPECTED` array. The four tuples: `typescript`/error, `template-type-check`/error, `extended-diagnostics`/warning, `tool`/error. `diagnostic-family.spec.ts` L62-64 confirms `90002` -> `tool` and L56-60 confirms non-catalog NG (like `NG8002`) -> `template-type-check`.

## No Analog Found

None. Every file has an in-repo analog. The one near-exception:

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `tools/ci/*.spec.*` (if the unit test co-locates with the `.mjs`) | test | transform | No existing `tools/ci/*.spec.*` precedent. The pure-logic unit-spec STYLE is proven (`parse-args.spec.ts`/`diagnostic-family.spec.ts`); only the LOCATION (a spec beside a `tools/ci` script) is new. Safer: a plugin-side `.spec.ts` that imports the `.mjs` matcher, matching the existing spec location convention. |

## Metadata

**Analog search scope:** `tools/ci/`, `fixtures/` (root), `packages/angular-typechecker/src/{core,cli}/`, `.github/workflows/`, repo-root config files.
**Files scanned:** 15 (3 tools/ci scripts, 6 fixture files across 3 fixtures, 2 unit specs, 1 integration spec, ci.yml, .fallowrc.jsonc, .prettierignore).
**Pattern extraction date:** 2026-07-21
