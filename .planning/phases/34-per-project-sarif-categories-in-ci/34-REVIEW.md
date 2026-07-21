---
phase: 34-per-project-sarif-categories-in-ci
reviewed: 2026-07-21T00:00:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - tools/ci/list-typecheck-projects.mjs
  - tools/ci/merge-sarif.mjs
  - packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts
  - packages/angular-typechecker/src/merge-sarif.spec.ts
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 34: Code Review Report (Deep Re-Review)

**Reviewed:** 2026-07-21T00:00:00Z
**Depth:** deep
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Deep re-review of a phase already put through a standard-depth pass. This report supersedes
the prior `34-REVIEW.md` in full.

**Confirmed fixed (not re-reported as open):**

- **Prior WR-01** (discovery kept only the first matching target via `.find()`, silently
  dropping a second target's `tsConfig`): confirmed fixed in `tools/ci/list-typecheck-projects.mjs`
  lines 61-75 -- `.filter()` collects every matching target, `.flatMap()` unions their
  `tsConfig`, `[...new Set(...)]` dedups (order-stable). Verified correct for the
  array/string/undefined option shapes, and independently regression-guarded by the new
  "unions tsConfig across multiple executor targets" test in
  `multi-typecheck-discovery-guard.spec.ts`.
- **Prior WR-02** (the rewired `atc-sarif` step lost its `|| true` shell-level tolerance):
  confirmed fixed in `.github/workflows/ci.yml` lines 570-573 -- restored, with the `[ -s ]`
  produced-guard immediately after. A discovery throw or merge crash now degrades to
  `produced=false` instead of failing the job and skipping fallow's reporting.
- **Prior WR-03** (per-project CLI `stderr` captured but never surfaced): confirmed fixed in
  `tools/ci/merge-sarif.mjs` lines 101-107 -- a `console.error` breadcrumb now logs the project
  name, spawn status, and the first stderr line on the empty-stdout skip path.

**Carried forward from the standard pass, still open** (renumbered below as IN-01/IN-02; not
part of the three fixes this deep pass was told to assume are closed): the `tsConfig:
string[]` multi-entry-on-one-target path is still not exercised end-to-end by either spec, and
generated `*.sarif` files are still not gitignored.

**New from this deep pass**, found by tracing the discovery -> merge -> CLI-spawn ->
workflow chain and cross-checking claims in comments against the real repository state (not
just the diff):

1. **WR-01 (this report):** per-project executor options other than `tsConfig` --
   concretely `includeDeps` -- are silently dropped between discovery and the per-project CLI
   invocation, so the dogfood SARIF for at least one real project (`typecheck-consumer`) does
   not reproduce that project's actual configured type-check scope.
2. **WR-02 (this report):** two files' comments cite an in-repo `libs/local-lib` fixture as
   discoverable, real-workspace evidence for the multi-target-union behavior; that path does
   not exist in the discoverable `apps/`+`libs/` scope -- it is a nested e2e fixture both the
   discovery script and the drift guard explicitly exclude, so the claimed coverage does not
   exist and the union behavior is proven only by a synthetic temp-dir fixture.

Three additional Info-level robustness/style observations round out the pass (IN-03..IN-05).
Nothing found rises to Critical: the reporting job stays additive/non-gating, there is no
injection surface (fixed `spawnSync` argument arrays, no `shell: true`, no PR-metadata
interpolated into any shell command), no crash, no data loss, both `.mjs` scripts use only
cross-platform `node:*` APIs with no POSIX-only assumption, and no
`packages/angular-typechecker/src/core/**` or `package.json` change is implied anywhere in
this diff (confirmed against `git diff 5cc630b..HEAD --stat`, which touches only the two
tools/ci scripts, the two specs, and ci.yml).

## Narrative Findings (AI reviewer)

### Critical Issues

None found.

### Warnings

#### WR-01: Per-project executor options (`includeDeps` et al.) are dropped between discovery and the per-project SARIF CLI invocation

**File:** `tools/ci/list-typecheck-projects.mjs:29-31,67-75`, `tools/ci/merge-sarif.mjs:77-94`

**Issue:**

`listTypecheckProjects` returns only `{ name, tsConfig }` per project (see the JSDoc return
type, line 31) -- it reads `target.options?.tsConfig` but never propagates any other option
declared on the matching target (`includeDeps`, `maxWarnings`, `strict`, `failFast`).
`collectEntries` in `merge-sarif.mjs` then builds the per-project CLI invocation from exactly
that shape: `args = [BIN]`, push `-c <leaf>` per tsConfig, push `--format sarif` -- there is no
path for any other flag.

This is not theoretical: `libs/typecheck-consumer/project.json`'s `typecheck` target sets
`"includeDeps": true`. Running `nx run typecheck-consumer:typecheck` (as the `test` job's
`nx run-many -t typecheck` does) type-checks WITH out-of-project/node_modules diagnostics
folded in. The `code-scanning` job's dogfood SARIF for the same project, generated via
`node dist/.../cli/bin.js -c libs/typecheck-consumer/tsconfig.lib.json --format sarif` (no
`--include-deps`), runs WITHOUT them: `includeDeps` defaults to `false` for any invocation that
omits the flag (`packages/angular-typechecker/src/cli/parse-args.ts:297`,
`includeDeps: values['include-deps'] ?? false`), and `includeDeps` is a format-agnostic core
filter (`core/filter-diagnostics.ts`) applied before SARIF/JSON/human rendering, not a
formatter-specific behavior. So the uploaded Code Scanning analysis for `typecheck-consumer`
silently under-reports relative to that project's own declared configuration, with no comment
anywhere in either file acknowledging this narrowing.

Because Code Scanning upload here is additive/non-gating (per the job's own header comment),
this does not break a merge gate or produce an incorrect pass/fail verdict -- but it does mean
the reporting feature this phase ships does not do what its own docstrings claim ("run
angular-typechecker on every workspace project that uses its typecheck executor" -- it runs
each project's tsConfig, but not that project's full configured options).

**Fix:** Either (a) propagate `includeDeps` (and, if desired, `maxWarnings`/`strict`/
`failFast`) through the discovered shape and forward it as a CLI flag per project:

```js
// list-typecheck-projects.mjs
const includeDeps = matchingTargets.some(
  (target) => target.options?.includeDeps === true,
);
out.push({ name: projectJson.name, tsConfig: [...new Set(merged)], includeDeps });
```

```js
// merge-sarif.mjs collectEntries
for (const { name, tsConfig, includeDeps } of listTypecheckProjects(root)) {
  const args = [BIN];
  for (const leaf of tsConfig) { args.push('-c', leaf); }
  if (includeDeps) { args.push('--include-deps'); }
  args.push('--format', 'sarif');
  ...
```

or (b), if the narrower scope (tsConfig-only, default options) is an intentional MVP
simplification, document that tradeoff explicitly in both files' header comments so a future
reader does not assume parity with each project's real configured behavior.

#### WR-02: Comments in two files cite an in-repo `libs/local-lib` fixture that does not exist in the discoverable scope

**File:** `tools/ci/list-typecheck-projects.mjs:6-7`, `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts:214-217`

**Issue:**

`list-typecheck-projects.mjs`'s header comment says a project may declare more than one
matching target, "e.g. `typecheck` + `typecheck-spec` -- see libs/local-lib's fixture." The
regression-guard block in `multi-typecheck-discovery-guard.spec.ts` repeats the claim: "the
exact shape libs/local-lib's fixture already uses -- `typecheck` + `typecheck-spec`."

There is no `libs/local-lib` directory at the workspace's top-level `libs/` root (confirmed:
`libs/*/project.json` globs to only `typecheck-walk-consumer`, `typecheck-consumer`,
`test-util`, `typecheck-consumer-dep`). The only `local-lib` in the repo lives at
`e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/libs/local-lib/` -- an e2e
fixture nested three levels under `e2e/`. That path is out of scope for BOTH the real
discovery (`list-typecheck-projects.mjs` only scans `<root>/apps` and `<root>/libs`, one level
deep) AND the independent drift-guard enumeration in the same spec file, which explicitly
subtracts any path with `rel.startsWith('e2e/')` (lines 100, 90-93 -- called out in that same
file as "LOAD-BEARING," precisely to keep e2e fixtures out of the count).

So the comments overclaim: the multi-target-union behavior has zero real-workspace coverage
today -- it is proven only by the synthetic `mkdtempSync` fixture inside the "unions tsConfig
across multiple executor targets" test in the same spec file. A future maintainer reading
either comment could reasonably (and wrongly) conclude that a live, discoverable project
already exercises this path, and skip adding one, or fail to notice that the synthetic test is
the *only* thing standing between a `.find()`-style regression and CI staying green.

**Fix:** Correct both comments to say the multi-target coverage is synthetic-only (e.g.,
"...see the 'unions tsConfig across multiple executor targets' test below; the closest
real-repo analog, `e2e/.../fixtures/consumer-workspace/libs/local-lib`, is deliberately out of
discovery scope, nested under `e2e/`"). Optionally, promote coverage by adding a second real
`typecheck-spec`-style target to one of the four actual `apps/`+`libs/` fixture projects, so
the union behavior is proven against real discovery output too, not only the temp-dir unit
test.

### Info

#### IN-01: The `tsConfig: string[]` (single target, multi-entry array) path is still not exercised end-to-end by either spec

**File:** `tools/ci/list-typecheck-projects.mjs:69-71`, `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts`, `packages/angular-typechecker/src/merge-sarif.spec.ts`

**Issue:** Carried forward from the standard-depth pass; still open. `list-typecheck-projects.mjs`'s
header comment documents `tsConfig` as normalized from `string | string[]` since v0.2.1
(`Array.isArray(raw) ? raw : raw ? [raw] : []`), and `merge-sarif.mjs`'s `collectEntries` loops
over the resulting array to push one `-c <leaf>` pair per entry. Every fixture `project.json`
written by either spec still uses a single-string `tsConfig` on each target (confirmed: no
`options: { tsConfig: [...] }` array literal appears in either spec file -- the array outputs
that do appear are the union-*across-targets* result, not a single target declaring an array).
No real `apps/`/`libs/` project in this repo uses the array form either, so this is low
priority, but it is a real gap relative to what the code explicitly claims to support.

**Fix:** add one fixture project with a single target whose `options.tsConfig` is
`['a/tsconfig.json', 'b/tsconfig.json']`, and assert the CLI receives both `-c` flags (or, for
the discovery spec, that the returned `tsConfig` array has both entries).

#### IN-02: Generated `*.sarif` files are still not gitignored

**File:** `tools/ci/merge-sarif.mjs:29` (writes `angular-typechecker.sarif` at the invocation
cwd, i.e. the repo root, per the documented "run from the repo ROOT" contract)

**Issue:** Carried forward from the standard-depth pass; still open (confirmed `.gitignore`
has no `sarif` entry). Running `node tools/ci/merge-sarif.mjs` locally writes
`angular-typechecker.sarif` into the repo root; `npx fallow audit --format sarif -o
fallow.sarif` does the same for `fallow.sarif`. Neither is listed in `.gitignore`. This
pre-dates this phase (the previous single-command form wrote the same filename at the same
location), so it is not a regression introduced here, but this phase is a natural point to
close it since it touches the same output path.

**Fix:** add `/*.sarif` to `.gitignore`.

#### IN-03: `mergeSarifRuns`'s no-run skip path has no diagnostic breadcrumb, unlike the empty-stdout skip it mirrors

**File:** `tools/ci/merge-sarif.mjs:43-56`

**Issue:** `collectEntries` logs a `console.error` breadcrumb when a project's stdout is empty
(the fixed prior WR-03). `mergeSarifRuns`'s own skip (`const run = (doc.runs ?? [])[0]; if
(!run) { continue; }`) has no equivalent logging. Today this is effectively unreachable:
`formatSarifReport` (`core/sarif-report.ts`) always emits exactly one run via
`logBuilder.addRun(runBuilder)`, and every exit-2 path in `cli/main.ts` returns `stdout: ''`
(already caught by the empty-stdout skip upstream), so a parsed doc with zero runs cannot
currently occur. If a future CLI change ever emits valid JSON with an empty/missing `runs[]`
(e.g. a new machine-format branch), this project would vanish from the merged SARIF with no
trace in the CI log -- the same silent-drop failure mode the fixed WR-03 was written to close.

**Fix:** Add a matching `console.error` inside `mergeSarifRuns`'s `if (!run) continue;` branch
(e.g. `` `merge-sarif: skipped ${name} -- doc has no runs[0]` ``) so the two skip points stay
symmetric.

#### IN-04: The empty-stdout skip breadcrumb omits `result.error` (spawn-launch failure), only `status` + stderr head

**File:** `tools/ci/merge-sarif.mjs:95-107`

**Issue:** When `spawnSync` cannot even launch the child (e.g. ENOENT on
`dist/packages/angular-typechecker/src/cli/bin.js` if the preceding `nx build` step produced
no output, or on `process.execPath` itself), Node sets `result.error` and leaves
`result.status` as `null` and `result.stdout`/`result.stderr` as `null`. The current
breadcrumb (`` `status ${result.status}${stderrLine ? ... : ''}` ``) degrades to `"empty
stdout (status null)"` with no indication that the process never started at all -- losing the
one piece of information (`result.error.message`, e.g. `spawnSync ENOENT`) that would make
that failure mode instantly diagnosable versus a generic empty-output case.

**Fix:** Include `result.error?.message` in the breadcrumb:

```js
console.error(
  `merge-sarif: skipped ${name} -- empty stdout (status ${result.status}${
    result.error ? `, spawn error: ${result.error.message}` : ''
  }${stderrLine ? `: ${stderrLine}` : ''})`,
);
```

#### IN-05: `BIN` constant hardcodes forward slashes instead of `node:path` `join()`

**File:** `tools/ci/merge-sarif.mjs:28`

**Issue:** `BIN = 'dist/packages/angular-typechecker/src/cli/bin.js'` is a literal
forward-slash string passed straight into `spawnSync`'s `args`, whereas the sibling
`list-typecheck-projects.mjs` consistently builds paths with `join()`. Node accepts
`/`-separated paths as a `node <path>` argv entry on Windows in practice, so this is not a
functional break, but it is a style inconsistency in a codebase that otherwise threads
`node:path` through for cross-platform correctness -- and it is the one path literal in this
pair of scripts not exercised by the (Linux-only) `code-scanning` job in CI, so a genuine
Windows regression here would not be caught by CI and would only surface for a developer
running the script locally (this repo's primary dev environment is Windows arm64).

**Fix:** `const BIN = join('dist', 'packages', 'angular-typechecker', 'src', 'cli', 'bin.js');`
(import `join` from `node:path`).

---

_Reviewed: 2026-07-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
