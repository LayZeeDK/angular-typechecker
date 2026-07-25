# Quick Task 260725-cs0: Fix the fallow file-less SARIF upload bug - Research

**Researched:** 2026-07-25
**Domain:** SARIF 2.1.0 / GitHub Code Scanning ingestion / fallow 3.x SARIF emitter
**Confidence:** HIGH on every load-bearing fact (all reproduced locally or read from real CI logs/API); the
only REAL-CI-ONLY residual is whether GitHub accepts a **dotfile** `artifactLocation.uri`.

## Summary

The bug is **real, reproduced locally, and NOT fixed upstream**. It is not a project-level /
dependency finding as CONTEXT.md hypothesised -- it is **exactly one finding kind**:
`fallow/code-duplication` as emitted by the **`fallow audit` dupes sub-analysis**. That result is
emitted with the `locations` key **omitted entirely**, and GitHub rejects the **whole multi-run
upload** as a result, losing the sibling dead-code and health runs too.

Ladder rung 1 is CLOSED in both directions: fallow's config schema has **no** `sarif` / `location` /
`anchor` knob, and fallow **3.9.1** (latest, vs 3.6.0 pinned) still emits the same location-less
result. So a SARIF post-process is the only mechanism, exactly as CONTEXT.md decision 1 assumed.

Gray area 3 answer: anchor at **`.fallowrc.jsonc`**, region-less. This is not a guess -- fallow
itself already anchors its project-level findings at **the config file the maintainer would edit**
(`package.json` for every dependency-hygiene rule, verified below), and `.fallowrc.jsonc`
(`duplicates.ignore`) is the corresponding file for a clone group. It also matches
`angular-typechecker`'s own file-less precedent (ATC90002 -> `tsconfig.json`), whose region-less
location is **proven accepted** by GitHub in this repo's CI.

**Primary recommendation:** a `tools/ci/normalize-fallow-sarif.mjs` mirroring `merge-sarif.mjs`
(pure exported transform + thin I/O wrapper) that gives every location-deficient result a
region-less location on `.fallowrc.jsonc`, replacing the inline `node -e` while keeping the
`automationDetails.id = "fallow/" + i` stamping byte-identical.

<phase_requirements>
## Task Boundary Check

| Locked decision | Research verdict |
|---|---|
| 1. Fix lives in a `tools/ci/` ESM script, not inline `node -e` | CONFIRMED necessary -- but see **Pitfall 1**: the spec must drive the script as a SUBPROCESS, it cannot import it |
| 2. Synthesize a location; never drop the finding | CONFIRMED viable -- a region-less anchor is proven-accepted |
| 3. Preserve fail-loud + not-a-gate-tool contracts | CONFIRMED -- and the `automationDetails` overwrite is **load-bearing**, see Finding 6 |
| 4. Unit-test with the in-repo SARIF validator | CONFIRMED but INSUFFICIENT ALONE -- see **Pitfall 2** (the validator ACCEPTS the rejected payload) |
| Gray area 3 (anchor path) | RESOLVED -> `.fallowrc.jsonc`, region-less. See Finding 5 |
</phase_requirements>

## Findings

### Finding 1 -- The bug is REAL and has fired twice in this repo's CI

Two real `code-scanning` job failures, both at the `Upload fallow SARIF` step:

| Run | Branch | Date | Step outcome |
|---|---|---|---|
| `30004691193` (job `89197848941`) | `probe/atc-single-run` | 2026-07-23 | `failure` |
| `29772473095` (job `88453796187`) | `gsd/quick-260720-t8u-code-scanning-sarif` | 2026-07-20 | `failure` |

Exact log tail from job `89197848941`:

```
Successfully uploaded results
##[group]Waiting for processing to finish
##[error]Code Scanning could not process the submitted SARIF file:
locationFromSarifResult: expected at least one location
```

*Verified:* walked the last 60 `ci.yml` runs via `gh api
repos/LayZeeDK/angular-typechecker/actions/workflows/ci.yml/runs`, inspected the `code-scanning`
job's step conclusions (55 jobs, exactly 2 fallow-step failures), then fetched
`gh api repos/LayZeeDK/angular-typechecker/actions/jobs/89197848941/logs`. **PROVEN**, not inferred.

Note the upload step reports `Successfully uploaded results` **first** -- the rejection happens
asynchronously during wait-for-processing. A reader skimming the log for "upload failed" will miss it.

### Finding 2 -- GitHub rejects the WHOLE upload, not just the offending run or result

The failing run's fallow SARIF contained **3 runs**; the dead-code run carried a perfectly-located
`fallow/unused-file` result. **Zero** fallow analyses exist for that commit:

```
gh api "repos/LayZeeDK/angular-typechecker/code-scanning/analyses?tool_name=fallow&per_page=100"
# fallow analyses at commit e1d25ce (the failing run): 0
# (14 fallow analyses exist in the same 2-hour window, all from OTHER commits)
```

*Verified:* filtered the analyses list on `commit_sha` prefix `e1d25ce` (the failing run's head SHA,
from `gh api repos/.../actions/runs/30004691193`). **PROVEN.** One location-less result costs the
entire fallow analysis -- consistent with the same error's documented behaviour on
`angular-typechecker`'s own SARIF in `35-UAT.md` ("The whole SARIF is rejected").

### Finding 3 -- The emitted shape is `locations` KEY ABSENT (not `[]`, not a location without `physicalLocation`)

Reproduced locally. The repo currently emits **zero** fallow findings (the working tree matches
`origin/main`, so `fallow audit` sees 0 changed files, and repo-wide `fallow`/`fallow dupes` find
nothing -- the `.fallowrc.jsonc` suppressions are comprehensive). So I recreated the exact finding
from the failing run -- the clone group that run reported was
`tools/ci/merge-sarif-single.mjs` x `tools/ci/merge-sarif.mjs` -- by adding a temporary
`tools/ci/zz-repro-scratch.mjs` duplicating `merge-sarif.mjs`'s `collectEntries` body, then:

```
npx fallow audit --format sarif -o <out> --base origin/main
```

The complete offending run, verbatim:

```json
{
  "tool": { "driver": { "name": "fallow", "version": "3.9.1",
    "informationUri": "https://github.com/fallow-rs/fallow" } },
  "automationDetails": { "id": "fallow/audit/dupes" },
  "results": [
    { "ruleId": "fallow/code-duplication", "level": "warning",
      "message": { "text": "Clone group 1 (44 lines, 2 instances)" } }
  ]
}
```

So: `locations` **omitted entirely**. Also note `tool.driver.rules` is absent and there are **no**
`partialFingerprints` on this result (both present on every other fallow run).

**Critical consequence for the fix design:** the SARIF result carries **no file information at all**.
The clone group's instance paths exist only in fallow's `--format json` output
(`duplication.clone_groups[].instances[].file` + `start_line`/`end_line`, verified) -- they are
**not recoverable from the SARIF**. A SARIF-only post-processor therefore *cannot* anchor the alert
at a real source file; a repo-level anchor is the only option. This is what settles gray area 3.

*Verified:* `node` inspection of the emitted file; scratch file removed afterwards
(`git status --porcelain` clean apart from this quick-task directory). **PROVEN.**

### Finding 4 -- Which findings are file-less: ONLY audit's dupes run. The project-level hypothesis is FALSE

CONTEXT.md's leading hypothesis was that fallow's PROJECT-level findings (the ones that "bypass the
diff filter") are the location-less ones. **That is wrong.** I surfaced 84 findings across 9 rule
kinds by running with a stripped config (`{"rules":{}}`, dropping the repo's `ignoreDependencies` /
rule-off suppressions):

```
npx fallow dead-code --format sarif -c <bare-config> -o <out>
# results: 84  |  locations KEY ABSENT: 0  |  locations [] EMPTY: 0
#              |  loc w/o physicalLocation: 0  |  physLoc w/o artifactLocation.uri: 0
# ruleIds: unused-file 45, unused-dev-dependency 13, unlisted-dependency 11,
#          unused-enum-member 7, dev-dependency-in-production 4, unused-type 1,
#          test-only-dependency 1, unresolved-import 1, unused-component-input 1
```

Every project-level dependency finding is located. **ZERO** location-less results.

Enumeration of the file-less set, as established:

| Emitter | Location-less? | Evidence |
|---|---|---|
| `fallow audit` dupes sub-analysis (`fallow/code-duplication`) | **YES** | Finding 3 |
| `fallow dupes` standalone (same clone group!) | NO -- one located result **per instance**, with `uri` + `region` + fingerprints | `npx fallow dupes --format sarif` -> 2 results, both located |
| `fallow audit` / `dead-code` run (all 46 dead-code + boundary + dependency rules) | NO | 84/84 located, above |
| `fallow audit` health run (21 complexity/CSS rules) | Not observed with findings; 0 location-less in any run seen | repo has no complexity findings |

The standalone-vs-audit divergence on the *identical* clone group is the actual upstream defect: the
audit path's dupes renderer drops the per-instance locations that the standalone renderer emits.

### Finding 5 -- The anchor: `.fallowrc.jsonc`, region-less (gray area 3, RESOLVED)

Three converging lines of evidence, none of them speculation:

**(a) fallow's OWN convention is "anchor a project-level finding at the config file you would edit."**
Verified by inspecting the URIs of the project-level findings from Finding 4:

| Rule | Anchor URI | Region |
|---|---|---|
| `fallow/unused-dev-dependency` | `package.json` | line 24 |
| `fallow/dev-dependency-in-production` | `package.json` | line 21 |
| `fallow/test-only-dependency` | `package.json` | line 64 |
| `fallow/unlisted-dependency` | the importing `.ts` file | line 7 (it *has* a real site) |

fallow anchors a dependency finding at `package.json` -- the manifest the maintainer edits -- not at
some arbitrary importer. The exact analogue for a clone group is `.fallowrc.jsonc`, because
`duplicates.ignore` (already used in this repo for two intentional clone groups) is literally where a
maintainer acts on one.

**(b) `angular-typechecker`'s own file-less precedent does the same thing.** `sarif-report.ts:205-219`
anchors a file-less record at the relativized `tsConfigPath` -- "its always-present owner" -- with
**no region** (`{ fileUri: relativizePath(result.tsConfigPath, pathBase) }`).

**(c) `.fallowrc.jsonc` is guaranteed to exist** and is a committed repo-root file (`20265` bytes);
fallow logs `loaded config: .../.fallowrc.jsonc` on every CI run.

**A region-less location IS accepted by GitHub -- proven live in THIS repo.** The `ATC90002`
file-less alert from the Phase 35 proof landed and GitHub normalized the missing region to line 1:

```
gh api ".../code-scanning/alerts?tool_name=angular-typechecker-red-proof&state=dismissed&ref=refs/pull/55/merge"
  ATC90002 {"path":"tools/sarif-proof-fixture/tsconfig.json",
            "start_line":1,"end_line":1,"start_column":1,"end_column":1}
```

This matters because GitHub's docs are **misleading** here. The `physicalLocation` object table marks
`region.startLine` / `startColumn` / `endLine` / `endColumn` as **Required**, yet a region-less
location is empirically accepted and back-filled to 1:1. Only two things are truly enforced:

| Property | Docs | Enforced? |
|---|---|---|
| `location.physicalLocation` | Required | **YES** -- this is what `locationFromSarifResult` fires on |
| `artifactLocation.uri` | Required | **YES** (recommended repo-root-relative, e.g. `src/main.js`) |
| `region.*` | Required | **NO** -- region-less accepted, normalized to line 1 col 1 (proven above) |

*Verified:* GitHub docs "SARIF support for code scanning" fetched via `markdown.new`; required/optional
flags read from the rendered tables. Empirical acceptance from the live alerts API. **PROVEN.**

**Minimal acceptable synthesized location:**

```json
{ "physicalLocation": { "artifactLocation": { "uri": ".fallowrc.jsonc" } } }
```

**Residual risk (REAL-CI-ONLY, honestly flagged):** I have not proven GitHub accepts a **dotfile**
`artifactLocation.uri`. Every region-less URI proven accepted so far (`tsconfig.json`, `package.json`)
is a non-dotted name. I judge the risk low -- the URI is an opaque repo-relative path and dotfiles are
ordinary repository files -- but it is unproven locally and only real CI can settle it. If it ever
misbehaves, `package.json` is the drop-in fallback (fallow's own project-level anchor, and
already-proven acceptable as a URI shape). Keep the anchor a single named constant so swapping it is a
one-line change.

### Finding 6 -- The `automationDetails.id` scheme: frozen, and the overwrite is LOAD-BEARING

Non-obvious and decision-relevant: **fallow now sets its own `automationDetails.id` on the dupes
run** (`"fallow/audit/dupes"`, Finding 3). The current inline `node -e` **overwrites** it with
`fallow/<index>`. That overwrite must be preserved, because of how GitHub derives the category:

```
gh api ".../code-scanning/analyses?tool_name=fallow&per_page=100"
# total: 98 | distinct categories: fallow
#           | distinct analysis_keys: .github/workflows/ci.yml:code-scanning
```

All 98 analyses report category **`fallow`** -- GitHub takes the text **before the final `/`** of
`automationDetails.id`. So `fallow/0`, `fallow/1`, `fallow/2` all map to category `fallow`, keeping the
`(analysis_key, category, environment)` tuple stable. Leaving fallow's own `fallow/audit/dupes` in
place would yield category **`fallow/audit`** -- a **NEW tuple**, which is exactly the orphaned-config
hazard AGENTS.md GATE-02 step 0 warns about.

**Constraint for the fix:** keep the text before the final `/` equal to `fallow`. Since the fix only
touches `result.locations`, it cannot perturb this -- **provided the stamping loop is carried over
verbatim** into the new script. The planner must port
`(j.runs||[]).forEach(function(r,i){r.automationDetails={id:"fallow/"+i}})` semantics exactly.

*Also worth recording (explicitly OUT OF SCOPE, do not fix here):* the run **count is variable** --
2 runs when there are no dupes findings, 3 when there are. Because the id is index-based, the health
run is `fallow/1` in the 2-run case and `fallow/2` in the 3-run case. Category stays `fallow` either
way so there is no orphan risk, but a sub-analysis's identity does shift between uploads. Note it;
changing the scheme is forbidden by CONTEXT.md decision 3.

### Finding 7 -- Ladder rung 1: no config knob, and NOT fixed upstream

**No config option exists.** `npx fallow config-schema` (88274 bytes) contains **zero** matches for
`sarif`, `location`, or `anchor`. The only dupes-related keys are `duplicates` / `dupesBaseline`. The
only config-only lever would be disabling duplication analysis outright (`--no-dupes` / a
`duplicates` toggle), which **drops the finding** and is forbidden by locked decision 2.

**Not fixed in the latest release.** Installed/declared: `fallow@3.6.0` (exact-pinned devDependency).
Latest on the registry: **3.9.1** (published 2026-07-23; 3.7.0, 3.7.1, 3.8.0, 3.8.1, 3.9.1 all
released since 3.6.0). Re-ran the exact reproduction under 3.9.1:

```
npx -y fallow@3.9.1 audit --format sarif -o <out> --base origin/main
# run[1] automationDetails={"id":"fallow/audit/dupes"}  locations KEY ABSENT: 1
```

**Byte-identical defect in the newest version.** So "just upgrade" is not a fix. (An upgrade is
independently reasonable maintenance, but it is a separate concern and must not be presented as
resolving this bug.)

**`fallow report` cannot help either.** It re-renders a saved `--format json` file, but "v1 renders the
GitHub-native formats only: `--format github-annotations` or `--format github-summary`" -- so the
richer JSON clone-group data cannot be re-rendered into SARIF.

*Verified:* `npx fallow config-schema`; `curl -s https://registry.npmjs.org/fallow`;
`npx -y fallow@3.9.1 audit`; `npx fallow report --help`. **PROVEN.**

## Common Pitfalls

### Pitfall 1: The spec CANNOT import the `tools/ci/` module -- it must drive it as a subprocess

CONTEXT.md decision 1 says the fix is "a pure, exported, unit-testable function." It should be
exported for clarity, but `merge-sarif.spec.ts:26-32` documents why the spec does **not** import it:

> It does NOT import `mergeSarifRuns` or any tools/ci module by any mechanism: a
> pathToFileURL/file:// dynamic import of a cross-project .mjs fails vitest's module runner (it
> cannot resolve a file URL outside this project's root), and a relative `../../../tools/ci/...`
> import fails @nx/enforce-module-boundaries at maxWarnings:0 (a required format-lint gate).

**Copy that pattern:** `execFileSync('node', [script], { cwd: tempRoot })` against a `mkdtempSync`
temp dir containing a fixture `fallow.sarif`, then assert on the rewritten file. This is *easier* here
than for `merge-sarif.mjs` -- no stub CLI is needed, since the fallow script's only input is a file.

### Pitfall 2: The in-repo SARIF validator ACCEPTS the payload GitHub rejects

Locked decision 4 (validate with `libs/test-util`'s `validateSarif`) is correct but **cannot detect
this bug**. I ran the exact GitHub-rejected payload through the committed schema:

```
SARIF 2.1.0 schema valid (the GitHub-REJECTED payload): true
```

`result.locations` is **optional** in SARIF 2.1.0; GitHub is stricter than the spec. *Verified:* ajv
compile of `libs/test-util/src/lib/sarif-2.1.0.schema.json` against the saved offending file.

**So the spec needs two distinct assertions:** (a) `validateSarif` still passes (the envelope was not
broken -- a regression guard), and (b) an **explicit** assertion that every `result` has
`locations[0].physicalLocation.artifactLocation.uri`. Assertion (b) is the one that actually guards
the bug. Do not let (a) stand in for (b).

### Pitfall 3: Fix all three deficient shapes, not just the observed one

Only the key-absent shape is proven. But GitHub enforces `location.physicalLocation` as required, so a
`locations` entry lacking `physicalLocation` would be rejected too, and `locations: []` trivially
fails "at least one location." Normalizing all three costs one extra condition and makes the guard
robust to a future fallow renderer change. One guard, all shapes -- rather than a guard per observed
symptom.

### Pitfall 4: The bug is invisible on a clean tree -- do not "verify" by running fallow locally

The repo emits zero fallow findings today (working tree == `origin/main` -> 0 changed files; and the
`.fallowrc.jsonc` suppressions clear the repo-wide scan). A local `npx fallow audit --format sarif`
produces 2 empty runs and looks perfectly healthy. Reproduction **requires** manufacturing a clone
group (Finding 3). Any verification step that just runs fallow and inspects the output will
false-pass.

### Pitfall 5: `Successfully uploaded results` is printed before the rejection

The upload step logs success, then fails asynchronously in "Waiting for processing to finish." The
existing `produced=true/false` guard cannot catch this at all -- it only checks that a non-empty file
was written locally. Keep that guard as-is (decision 3), but do not expect it to cover this failure.

## Recommendation

A planner can turn this directly into tasks.

**Task 1 -- `tools/ci/normalize-fallow-sarif.mjs`** (new; mirrors `merge-sarif.mjs`'s shape: pure
exported transform + `if (process.argv[1] === fileURLToPath(import.meta.url))` I/O wrapper).

Export one pure function, e.g. `normalizeFallowSarif(doc)`, that walks `doc.runs[]` and for each run:
1. Stamps `run.automationDetails = { id: 'fallow/' + index }` -- **carried over verbatim** from the
   inline `node -e`, deliberately overwriting fallow's own `fallow/audit/dupes` (Finding 6).
2. For every `result`, if it has no usable location -- `locations` absent, `locations: []`, or no entry
   with `physicalLocation.artifactLocation.uri` -- assigns the region-less fallback:
   ```js
   result.locations = [
     { physicalLocation: { artifactLocation: { uri: FALLBACK_URI } } },
   ];
   ```
   with `const FALLBACK_URI = '.fallowrc.jsonc';` as a single named constant (so the Finding 5
   residual-risk swap to `package.json` is one line).
3. Never drops a result (decision 2).

Comment the *why* inline in this repo's house style: the `fallow audit` dupes run emits
`fallow/code-duplication` with no `locations` (fallow 3.6.0 **and** 3.9.1); GitHub rejects the WHOLE
multi-run upload with `locationFromSarifResult: expected at least one location`; the clone group's
instance files exist only in `--format json`, so a repo-level anchor is the only option; and
`.fallowrc.jsonc` is where a maintainer acts on a clone group, matching fallow's own
`package.json`-anchoring of project-level findings.

**Task 2 -- `ci.yml` `fallow-sarif` step.** Replace the inline `node -e` with
`node tools/ci/normalize-fallow-sarif.mjs`. Leave untouched: the `npx fallow audit --format sarif -o
fallow.sarif --base origin/main || true` generation, the `[ -s fallow.sarif ]` produced-guard, the
fail-loud assert step, the fork gate, and the no-`category` upload (decision 3).

**Task 3 -- spec** (`packages/angular-typechecker/src/normalize-fallow-sarif.spec.ts`, naming per
`merge-sarif.spec.ts`). Subprocess pattern (Pitfall 1): write a fixture `fallow.sarif` into a
`mkdtempSync` dir, `execFileSync('node', [script], { cwd: tempRoot })`, assert on the rewritten file.

Fixture should be the real captured shape -- a 3-run doc where run 1 reproduces Finding 3's verbatim
dupes result (no `locations`, no `rules`, `automationDetails.id: 'fallow/audit/dupes'`) and run 0
carries a properly-located `fallow/unused-file`. Assert:
- the file-less result **survives** with `locations[0].physicalLocation.artifactLocation.uri ===
  '.fallowrc.jsonc'` and **no** `region` (decision 2 + Finding 5);
- an already-located result is left **byte-unchanged** (no clobbering of real `uri`/`region`);
- **every** result in the output has a `physicalLocation.artifactLocation.uri` -- the explicit
  assertion that actually guards the bug (Pitfall 2);
- `automationDetails.id` is `fallow/0`, `fallow/1`, `fallow/2` -- including that
  `fallow/audit/dupes` was overwritten (Finding 6, orphan-tuple guard);
- `validateSarif(...)` from `@workspace/test-util` still passes -- envelope regression guard only,
  **not** the primary assertion (Pitfall 2);
- (recommended) the `locations: []` and `physicalLocation`-missing variants normalize identically
  (Pitfall 3).

**Not recommended / explicitly rejected:**
- Upgrading fallow as the fix -- 3.9.1 still has the bug (Finding 7). Upgrade separately if desired.
- Disabling duplication analysis in the SARIF path -- drops the finding, violates decision 2.
- Cross-referencing `--format json` to recover the real clone-group files -- needs a second full
  analysis (`fallow report` cannot re-render SARIF, Finding 7) for a warn-tier finding that already
  gates in the `fallow` job. Not worth it; revisit only if the anchor proves confusing in practice.
- Touching the `automationDetails.id` scheme (CONTEXT.md decision 3, Finding 6).

**Real-CI-only verification.** GitHub's acceptance of the synthesized dotfile-anchored location cannot
be proven locally (Finding 5). The authoritative check is a PR whose diff contains a fallow finding:
the `code-scanning` job's `Upload fallow SARIF` step must reach `Analysis upload status is complete.`
with no `locationFromSarifResult`, and `gh api ".../code-scanning/analyses?tool_name=fallow"` must
show a new analysis at that commit. Note that on a clean-diff PR this will **not** exercise the fix at
all (Pitfall 4) -- and a passing `ci` on such a PR is not evidence.

## Sources

| # | Claim | Verification method |
|---|---|---|
| 1 | Two real `Upload fallow SARIF` failures; exact error string | `gh api .../actions/workflows/ci.yml/runs?per_page=60` -> per-run `/jobs` step conclusions (55 `code-scanning` jobs, 2 failures) -> `gh api .../actions/jobs/89197848941/logs`. **PROVEN** |
| 2 | Whole upload rejected (0 analyses at the failing commit) | `gh api .../code-scanning/analyses?tool_name=fallow&per_page=100` filtered on `commit_sha` `e1d25ce`; head SHA from `gh api .../actions/runs/30004691193`. **PROVEN** |
| 3 | Offending finding was a clone group (dead code 0 / complexity 0 / duplication 1) | `gh api .../actions/jobs/89197848903/logs` (the `fallow` job's human report from the same run). **PROVEN** |
| 4 | Emitted shape is `locations` KEY ABSENT; no recoverable file data | Manufactured the clone group (temp `tools/ci/zz-repro-scratch.mjs`), `npx fallow audit --format sarif --base origin/main`, `node` inspection of all runs/results. **PROVEN** |
| 5 | Clone-group instance files exist only in `--format json` | `npx fallow audit --format json` -> `duplication.clone_groups[].instances[].file/start_line/end_line`. **PROVEN** |
| 6 | Project-level findings are all LOCATED (hypothesis false) | `npx fallow dead-code --format sarif -c <bare {"rules":{}} config>` -> 84 results, 0 location-less. **PROVEN** |
| 7 | fallow anchors project-level findings at `package.json` | URI/region inspection of `unused-dev-dependency`, `dev-dependency-in-production`, `test-only-dependency` results from #6. **PROVEN** |
| 8 | Standalone `fallow dupes` DOES emit per-instance locations | `npx fallow dupes --format sarif` with the scratch duplicate -> 2 results, both `uri`+`region`+fingerprints. **PROVEN** |
| 9 | Not fixed upstream (3.9.1 latest vs 3.6.0 pinned) | `curl -s https://registry.npmjs.org/fallow` (latest `3.9.1`); `npx -y fallow@3.9.1 audit --format sarif` reproduced identically. **PROVEN** |
| 10 | No config knob for sarif/location/anchor | `npx fallow config-schema` (88274 bytes), zero matches for `sarif`/`location`/`anchor`. **PROVEN** |
| 11 | `fallow report` cannot re-render SARIF | `npx fallow report --help`: "v1 renders the GitHub-native formats only". **PROVEN** |
| 12 | GitHub requires `physicalLocation` + `artifactLocation.uri`; `region.*` marked Required but NOT enforced | docs.github.com "SARIF support for code scanning" via `markdown.new`, required/optional table flags. **CITED** |
| 13 | Region-less location accepted; GitHub normalizes to line 1 col 1 | `gh api .../code-scanning/alerts?tool_name=angular-typechecker-red-proof&state=dismissed&ref=refs/pull/55/merge` -> `ATC90002` at `tsconfig.json` `start_line:1 ... end_column:1`. **PROVEN** |
| 14 | In-repo SARIF validator ACCEPTS the GitHub-rejected payload | ajv compile of `libs/test-util/src/lib/sarif-2.1.0.schema.json` against the saved offending file -> `valid: true`. **PROVEN** |
| 15 | GitHub derives category as text before the final `/`; all 98 analyses -> `fallow` | `gh api .../code-scanning/analyses?tool_name=fallow&per_page=100` -> distinct categories `fallow`, distinct analysis_keys `.github/workflows/ci.yml:code-scanning`. **PROVEN** |
| 16 | fallow itself sets `automationDetails.id = fallow/audit/dupes`; ci.yml overwrites it | Full run dump in Finding 3 vs `ci.yml:609`. **PROVEN** |
| 17 | Spec must subprocess, not import, a `tools/ci/` module | `packages/angular-typechecker/src/merge-sarif.spec.ts:26-32` (documented rationale: vitest module runner + `@nx/enforce-module-boundaries` at maxWarnings:0). **CITED (in-repo)** |
| 18 | file-less precedent shape (region-less, config-file anchor) | `packages/angular-typechecker/src/core/sarif-report.ts:205-219`. **CITED (in-repo)** |
| 19 | `.fallowrc.jsonc` is where a clone group is suppressed | `.fallowrc.jsonc` `duplicates.ignore` (4 entries, FAL-11). **CITED (in-repo)** |
| 20 | Dotfile `artifactLocation.uri` acceptance | **NOT VERIFIED -- REAL-CI-ONLY.** Every proven region-less URI is non-dotted. Low risk, unproven; `package.json` is the fallback. |

**Reproduction artifacts:** the temporary `tools/ci/zz-repro-scratch.mjs` was removed;
`git status --porcelain` shows only this quick-task directory. No SARIF files were left in the repo.

**Research date:** 2026-07-25
**Valid until:** ~30 days for the GitHub ingestion facts; re-verify the fallow claims on any fallow
upgrade (the defect is version-sensitive and was confirmed present through 3.9.1).
