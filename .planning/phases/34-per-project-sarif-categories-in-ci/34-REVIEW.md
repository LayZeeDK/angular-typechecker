---
phase: 34-per-project-sarif-categories-in-ci
reviewed: 2026-07-21T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - tools/ci/list-typecheck-projects.mjs
  - tools/ci/merge-sarif.mjs
  - packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts
  - packages/angular-typechecker/src/merge-sarif.spec.ts
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-07-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the two new `tools/ci/*.mjs` scripts, their two new Vitest specs, and the
`.github/workflows/ci.yml` diff that rewires the `code-scanning` job to a per-project
multi-run SARIF upload. No structural pre-pass findings were supplied for this phase
(`<structural_findings>` block absent), so this report contains narrative findings only.

Cross-checked against the real repository state (not just the diff): `git grep`-verified the
four real `apps/`+`libs/` executor consumers the specs assert against (`ng-spike-app`,
`typecheck-consumer`, `typecheck-consumer-dep`, `typecheck-walk-consumer`), confirmed the two
LOAD-BEARING exclusions (workspace-root `project.json` and `e2e/*`) are correctly applied on
both the discovery script and its independent drift-guard enumeration, traced the shipped
CLI's SARIF/exit-code contract (`sarif-report.ts`, `main.ts`, `bin.ts`) to confirm the
"exit 2 always writes empty stdout" and "always exactly one run" assumptions the merge script
relies on, and confirmed `spawnSync` is called with a fixed argument array and no `shell:
true` (no command-injection surface). No hardcoded secrets, no `eval`, no non-ASCII
characters, and no POSIX-only assumptions were found in the two `.mjs` scripts or the two
spec files -- both scripts and both specs use only cross-platform `node:*` APIs and would run
identically under Git Bash on Windows; the only POSIX shell syntax (`[ -s file ]`,
`$GITHUB_OUTPUT`) lives inside `ci.yml` `run:` blocks that execute exclusively on
`ubuntu-latest` runners, unchanged from before this phase.

The three Warnings below are genuine correctness/robustness gaps, not style nits: (1) the
discovery script silently drops coverage for a project that defines more than one target
against the executor -- and this exact shape already exists in this repo's own e2e fixture,
proving it is a realistic pattern, not a hypothetical; (2) the rewired `atc-sarif` step lost
the shell-level `|| true` tolerance the adjacent (unchanged) comment still claims exists, so an
uncaught discovery exception now fails the whole `code-scanning` job and skips fallow's
reporting too, not just angular-typechecker's; (3) per-project CLI `stderr` is captured by
`spawnSync` but never surfaced, so a silently-skipped project leaves no diagnostic trail in the
CI log -- undermining the very failure mode this phase is designed to make loud.

## Narrative Findings (AI reviewer)

### Critical Issues

None found.

### Warnings

#### WR-01: Discovery keeps only the FIRST target using the executor, silently dropping tsConfig coverage for a project with multiple such targets

**File:** `tools/ci/list-typecheck-projects.mjs:56-58`

**Issue:** 

```js
const target = Object.values(projectJson.targets ?? {}).find(
  (candidate) => candidate?.executor === EXECUTOR,
);
```

`.find()` returns only the FIRST matching target (in `Object.values` insertion order). If a
project defines two (or more) targets that both use `angular-typechecker:typecheck` --
e.g. one target for `tsconfig.lib.json` and a second for `tsconfig.spec.json` -- only the
first target's `tsConfig` is captured; the second is silently dropped from discovery,
so its diagnostics never reach Code Scanning. No error, no log line, no test failure.

This is not a hypothetical: `e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/libs/local-lib/project.json`
(already committed in this repo) defines exactly this shape --
```json
"typecheck": { "executor": "angular-typechecker:typecheck", "options": { "tsConfig": "libs/local-lib/tsconfig.lib.json", ... } },
"typecheck-spec": { "executor": "angular-typechecker:typecheck", "options": { "tsConfig": "libs/local-lib/tsconfig.spec.json", ... } }
```
That fixture demonstrates the split-target idiom as a *recommended* usage pattern for
consumers of this executor. If any real `apps/`/`libs/` project in this workspace adopts the
same idiom, the second target's coverage vanishes without any signal.

Worse, the MULTI-02 drift guard (`multi-typecheck-discovery-guard.spec.ts`) cannot catch this
class of regression: its independent enumeration (`independentTypecheckProjects`, lines
94-118) only checks "does at least one target use the executor" via `.some(...)` and compares
project-NAME sets -- it never validates per-target/tsConfig completeness. A project with two
executor targets still produces the same single project NAME on both sides of the equality
check, so the guard passes even though one target's tsConfig is silently missing from the
merged SARIF.

**Fix:**
```js
const matchingTargets = Object.values(projectJson.targets ?? {}).filter(
  (candidate) => candidate?.executor === EXECUTOR,
);

if (projectJson.name && matchingTargets.length > 0) {
  const tsConfig = matchingTargets.flatMap((target) => {
    const raw = target.options?.tsConfig;
    return Array.isArray(raw) ? raw : raw ? [raw] : [];
  });
  out.push({ name: projectJson.name, tsConfig });
}
```
(If per-target -- not just per-project -- automation IDs are desired, that is a separate
design decision; at minimum this stops the silent drop.)

#### WR-02: `atc-sarif` step lost its `|| true` tolerance -- an uncaught discovery exception now fails the whole `code-scanning` job, including fallow's reporting

**File:** `.github/workflows/ci.yml:570-573`

**Issue:**

```yaml
      - id: atc-sarif
        run: |
          node tools/ci/merge-sarif.mjs
          if [ -s angular-typechecker.sarif ]; then echo "produced=true" >> "$GITHUB_OUTPUT"; else echo "produced=false" >> "$GITHUB_OUTPUT"; fi
```

The prior version tolerated the CLI's own exit code at the shell level
(`... --format sarif > angular-typechecker.sarif || true`). The new single-line invocation has
NO such tolerance. `tools/ci/merge-sarif.mjs`'s CLI entry (lines 117-125) calls
`mergeSarifRuns(collectEntries(root))` with no try/catch, and `collectEntries` (lines 74-115)
calls `listTypecheckProjects(root)` per iteration, also unguarded. `listTypecheckProjects`
deliberately `throw`s on empty discovery (`list-typecheck-projects.mjs:73-77`) and will also
throw an uncaught `JSON.parse` `SyntaxError` (`list-typecheck-projects.mjs:55`) if ANY
`project.json` under `apps/` or `libs/` is malformed. Either throw crashes the Node process
with a non-zero exit and writes no output file.

Because GitHub Actions stops a job's remaining steps by default when a step exits non-zero
(no `continue-on-error`, no `if: always()`/`if: failure()` on the later steps), this failure
skips every subsequent step in the SAME job: the `fallow-sarif` generation step and BOTH
`upload-sarif` steps. A single malformed `project.json` anywhere under `apps/`/`libs/` (or a
transient zero-consumer state) now silently loses Code Scanning reporting for BOTH tools, not
just angular-typechecker's -- a strictly larger blast radius than before this phase.

This also makes the adjacent MED-01 comment block (lines 515-527, unchanged by this diff)
factually stale: it states "each generation step tolerates a non-zero exit (`|| true`)", which
is no longer true for this step.

**Fix:** restore shell-level tolerance so a script crash degrades to `produced=false` instead
of failing the job:
```yaml
      - id: atc-sarif
        run: |
          node tools/ci/merge-sarif.mjs || true
          if [ -s angular-typechecker.sarif ]; then echo "produced=true" >> "$GITHUB_OUTPUT"; else echo "produced=false" >> "$GITHUB_OUTPUT"; fi
```

#### WR-03: Per-project CLI `stderr` is captured but never surfaced, so a silently-skipped project leaves no diagnostic trail

**File:** `tools/ci/merge-sarif.mjs:90-100`

**Issue:**
```js
const result = spawnSync(process.execPath, args, {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const stdout = (result.stdout ?? '').trim();

// Empty stdout (exit 2 / infra failure) -> skip (the `[ -s file ]` analogue).
if (stdout.length === 0) {
  continue;
}
```
`result.stderr` is read nowhere in this file. When a per-project CLI invocation fails (a usage
error -- for example an empty `tsConfig` array producing no `-c` flag at all -- or a
`TypecheckInfrastructureError`), the project is silently skipped with zero trace in the CI job
log explaining why. Given the review's own top-named risk is "a regression here silently
drops... a Code Scanning analysis" (see WR-01), discarding the one piece of evidence
(`stderr`) that would explain a drop makes that exact failure mode harder to diagnose after
the fact, not easier.

**Fix:** log the discarded stderr when stdout is empty, so a skipped project leaves a
breadcrumb in the job log:
```js
if (stdout.length === 0) {
  const stderr = (result.stderr ?? '').trim();

  if (stderr) {
    console.error(`merge-sarif: ${name} produced no SARIF output:\n${stderr}`);
  }

  continue;
}
```

### Info

#### IN-01: The `tsConfig: string[]` (multi-entry array) path is implemented but not exercised by either new spec

**File:** `tools/ci/list-typecheck-projects.mjs:64`, `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts`, `packages/angular-typechecker/src/merge-sarif.spec.ts`

**Issue:** `list-typecheck-projects.mjs`'s header comment explicitly documents `tsConfig` as
normalized from `string | string[]` since v0.2.1, and `merge-sarif.mjs`'s `collectEntries`
loops over `tsConfig` to push one `-c <leaf>` pair per entry. Every fixture `project.json`
written by either new spec (`multi-typecheck-discovery-guard.spec.ts` and
`merge-sarif.spec.ts`) uses a single-string `tsConfig`, so the array-normalization branch
(`Array.isArray(raw) ? raw : ...`) and the multi-`-c`-flag loop are never exercised
end-to-end by either spec. No real `apps/`/`libs/` project in this repo currently uses the
array form either, so this is low priority, but it is a real gap relative to what the code
explicitly claims to support.

**Fix:** add one fixture project with `tsConfig: ['a/tsconfig.json', 'b/tsconfig.json']` to
either spec and assert the CLI receives both `-c` flags (or, for the discovery spec, that the
returned `tsConfig` array has both entries).

#### IN-02: Generated `angular-typechecker.sarif` is not gitignored

**File:** `tools/ci/merge-sarif.mjs:29` (writes `angular-typechecker.sarif` at the invocation
cwd, i.e. the repo root, per the documented "run from the repo ROOT" contract)

**Issue:** Running `node tools/ci/merge-sarif.mjs` locally (e.g. to reproduce a CI failure on
the Windows dev machine) writes `angular-typechecker.sarif` into the repo root, which is not
listed in `.gitignore`. This condition pre-dates this phase (the previous single-command form
wrote the same filename at the same location, and the pre-existing `fallow.sarif` has the same
gap), so it is not a regression introduced here, but this phase is a natural point to close it
since it touches the same output path.

**Fix:** add `/*.sarif` to `.gitignore`.

---

_Reviewed: 2026-07-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
