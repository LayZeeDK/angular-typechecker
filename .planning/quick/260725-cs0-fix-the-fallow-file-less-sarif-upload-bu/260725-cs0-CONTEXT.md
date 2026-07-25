# Quick Task 260725-cs0: Fix the fallow file-less SARIF upload bug - Context

**Gathered:** 2026-07-25
**Status:** Ready for research, then planning
**Mode:** `--full --auto` (gray areas auto-locked; see the impact x confidence discipline below)

<domain>
## Task Boundary

`ci.yml`'s `code-scanning` job uploads fallow's SARIF to GitHub Code Scanning. When fallow
emits a result carrying NO `locations`, the upload fails with
`locationFromSarifResult: expected at least one location`, so fallow's whole analysis is
skipped for that run. Logged as low-urgency in the session handoff because fallow is
deliberately NOT a required Code Scanning gate tool (its findings gate via the separate
`fallow` job), so a missing fallow analysis does not deadlock a PR -- it silently hides
fallow's alerts.

IN SCOPE: make the fallow SARIF upload survive a file-less finding without losing the
finding.

OUT OF SCOPE: changing fallow's own gating (`ci.yml`'s `fallow` job), adding fallow as a
required Code Scanning tool (AGENTS.md forbids it), and anything about the
`angular-typechecker` / `angular-typechecker-red-proof` SARIF paths.
</domain>

<auto_lock_discipline>
## How `--auto` was applied

Per the global rule, a gray area is only auto-locked when it is LOW-IMPACT **or**
genuinely evidence-backed. The trap quadrant is HIGH-IMPACT + NOT-HIGH-CONFIDENCE; anything
landing there is recorded as UNRESOLVED for a human rather than silently decided.

| # | Gray area | Impact | Confidence | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Where the fix lives | MEDIUM | HIGH (in-repo precedent + explicit CLAUDE.md rule) | AUTO-LOCKED |
| 2 | Drop file-less results vs synthesize a location | HIGH | HIGH (repo's fail-loud / no-silent-truncation posture) | AUTO-LOCKED |
| 3 | WHICH anchor path a synthesized location points at | HIGH | **NOT HIGH** -- depends on what fallow actually emits | **DEFERRED TO RESEARCH** (not auto-locked) |
| 4 | Whether to schema-validate in a unit test | LOW | HIGH (validator already exists in-repo) | AUTO-LOCKED |
| 5 | Whether to keep the fail-loud produced-guard behaviour | MEDIUM | HIGH (existing GATE-01 contract is explicit) | AUTO-LOCKED |
</auto_lock_discipline>

<decisions>
## Implementation Decisions

### 1. The fix lives in a `tools/ci/` ESM script, not the inline `node -e` (AUTO-LOCKED)

Today `ci.yml` post-processes fallow's SARIF with an inline
`node -e '...'` one-liner that stamps `automationDetails.id` per run. Two reasons this
becomes a script file:

- **In-repo precedent to reuse (ladder rung 2).** `tools/ci/merge-sarif.mjs` already does
  exactly this class of work for the angular-typechecker SARIF: an ESM script under
  `tools/ci/`, exporting a PURE function (`mergeSarifRuns`) that is unit-tested from
  `packages/angular-typechecker/src/merge-sarif.spec.ts`. The fallow post-processing should
  match that shape rather than invent a second one.
- **CLAUDE.md forbids growing it.** "Avoid inline `-e` / `-c` inline-script flags wrapped in
  double quotes" and "Avoid using inline `-e` for anything beyond a one-liner. Write the
  script to a temp file and run it." Adding location-fallback logic to that one-liner walks
  straight into the documented bash-quoting trap.

The location fallback MUST be a pure, exported, unit-testable function -- the bug is only
observable in real CI otherwise, and a CI-only-observable fix cannot be regression-tested.

### 2. Synthesize a location; NEVER silently drop the finding (AUTO-LOCKED)

Dropping location-less results would make the upload succeed while silently discarding
findings. That is contrary to this repo's posture throughout (`ci.yml`'s GATE-01
produced-guard exists precisely so a silent empty SARIF cannot pass green; the
`no silent caps` principle). A dropped finding is worse than the current failure, because
the current failure is at least loud.

### 3. Preserve the existing fail-loud + not-a-gate-tool contracts (AUTO-LOCKED)

- Keep `produced=true/false` and the `Assert fallow SARIF was produced (non-fork PR)` step
  semantics as they are.
- Keep uploading WITHOUT a `category` input -- the per-run `automationDetails.id` is the
  category, and a single category across multiple runs is rejected by GitHub. This is
  load-bearing and documented in `ci.yml`.
- Do NOT make fallow a required Code Scanning tool. AGENTS.md explicitly forbids it.
- Keep the `head.repo.fork == false` upload gate untouched.

### 4. Unit-test with the in-repo SARIF validator (AUTO-LOCKED)

`libs/test-util/src/lib/validate-sarif.ts` + `sarif-2.1.0.schema.json` already exist. The
new pure function gets a spec that feeds it a file-less result and asserts (a) the output
still validates against SARIF 2.1.0 and (b) the finding survives with a location.

### Claude's Discretion

Exact function name, file name, and spec layout -- follow the `merge-sarif.mjs` /
`merge-sarif.spec.ts` naming and structure.
</decisions>

<deferred_to_research>
## Gray area 3 -- NOT auto-locked (would be the trap quadrant)

**Which anchor path should a synthesized location point at?**

This is HIGH-IMPACT (it decides where every file-less fallow alert appears in the Code
Scanning UI, and a wrong anchor either misattributes findings to an unrelated file or gets
rejected again) and my confidence is NOT HIGH, because it depends on facts I have not
established:

- What do fallow's file-less findings actually represent? fallow flags unused code by
  import-graph reachability, and its docs describe PROJECT-level findings that "bypass the
  diff filter" -- those are the likely location-less ones, but I have not confirmed it.
- Does fallow emit `locations: []`, omit `locations` entirely, or emit a `locations` entry
  with no `physicalLocation`? The three need different handling.
- Is there a fallow config/CLI option that already suppresses or anchors project-level
  findings, making a SARIF post-process unnecessary (ladder rung 1: does this need to exist)?

Candidate anchors, to be decided by research, NOT by me now:
- `.fallowrc.jsonc` (fallow's own config -- the file a maintainer would edit to act on a
  project-level finding). Mirrors how `angular-typechecker` anchors its file-less
  `ATC90002` at `tsconfig.json`, the config the user would actually change.
- The repo root / a `README`-style anchor.
- Whatever fallow itself names in the finding's message or properties.

The `angular-typechecker` precedent (Phase 35-04, `sarif-report.ts`: "a file-less record
carries a whole-file fallback location on the relativized ...") is the pattern to mirror --
research should establish the fallow-specific equivalent and confirm GitHub accepts it.
</deferred_to_research>

<specifics>
## Specific Ideas

- Mirror `tools/ci/merge-sarif.mjs`: pure exported transform + thin I/O wrapper, spec'd from
  `packages/angular-typechecker/src/`.
- Mirror `sarif-report.ts`'s file-less whole-file fallback rather than inventing a new idea.
- The current inline stamping logic is
  `(j.runs||[]).forEach(function(r,i){r.automationDetails={id:"fallow/"+i}})` -- whatever
  replaces it must keep that exact id scheme, or previously-uploaded fallow analyses become
  ORPHANED configs (the `(analysis_key, category, environment)` tuple hazard documented in
  AGENTS.md GATE-02 step 0). Changing the id scheme is NOT in scope.
</specifics>

<canonical_refs>
## Canonical References

- `.github/workflows/ci.yml` -- the `code-scanning` job: `fallow-sarif` step, the
  produced-guard, and the no-`category` upload.
- `tools/ci/merge-sarif.mjs` + `packages/angular-typechecker/src/merge-sarif.spec.ts` --
  the structural pattern to copy.
- `packages/angular-typechecker/src/core/sarif-report.ts` -- the file-less whole-file
  fallback precedent (Phase 35-04).
- `libs/test-util/src/lib/validate-sarif.ts` + `sarif-2.1.0.schema.json` -- schema validator.
- `AGENTS.md` GATE-02 -- why fallow is not a required tool, and the orphaned-config tuple
  hazard that pins the `automationDetails.id` scheme.
- SARIF 2.1.0 spec, `result.locations`; GitHub's `upload-sarif` behaviour on a result with
  no location.
</canonical_refs>
