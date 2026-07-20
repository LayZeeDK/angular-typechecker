# Quick Task 260720-t8u: Dogfood angular-typechecker + fallow SARIF -> GitHub Code Scanning - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning
**Mode:** --full --auto (gray areas auto-resolved; none hit the high-impact + low-confidence trap quadrant)

<domain>
## Task Boundary

Wire CI to upload two SARIF reports to GitHub Code Scanning via the
`github/codeql-action/upload-sarif` action:

1. **angular-typechecker's own SARIF** -- dogfooded by running the built standalone
   CLI (`--format sarif`) on this repo's own Angular app.
2. **fallow's SARIF** -- fallow's code-quality findings.

Scope is `.github/workflows/ci.yml` (+ the `tools/act/act-compat.sh` trigger guard).
No source/runtime changes to the plugin. The README already documents the recipe.
</domain>

<decisions>
## Implementation Decisions (auto-resolved under --auto)

### D1 -- Job placement: one dedicated `code-scanning` job, NOT folded into existing gates
A single new job produces + uploads BOTH SARIFs. It is deliberately kept OUT of the
required `ci` aggregate's `needs`. Rationale: SARIF upload is additive reporting, not
a merge gate. The real gates stay put (angular-typechecker type-check in `test`,
fallow new-only in `fallow`). Decoupling means a Code Scanning outage or a fork-PR
upload skip never deadlocks the PR-only merge button. IMPACT: medium, CONFIDENCE: high.

### D2 -- Least-privilege permissions
Top-level `contents: read` is untouched. `security-events: write` is granted at the
JOB level only (job-level permissions REPLACE the top-level block, so `contents: read`
is restated for checkout). Matches the file's existing least-privilege posture.

### D3 -- Fork-PR handling
On a fork PR the `GITHUB_TOKEN` is read-only, so `upload-sarif` cannot write security
events. Each upload step is gated to skip fork PRs
(`github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false`).
The analysis still RUNS on fork PRs; only the upload is skipped. Keeps the job safe
under the SAFE `pull_request` trigger the file already uses.

### D4 -- Distinct categories
Each upload carries a distinct `category` (`angular-typechecker`, `fallow`) so the two
tools' analyses are tracked separately and never overwrite each other.

### D5 -- Dogfood target: `apps/ng-spike-app` (the repo's real Angular app)
Run from the repo ROOT so SARIF `artifactLocation.uri` values stay repo-relative
(README: "Run from the repository root"). The standalone CLI (built to
`dist/packages/angular-typechecker/src/cli/bin.js` after `nx build`) writes a byte-pure
SARIF payload to stdout; advisories stay on stderr. `nx typecheck` is NOT used for
capture -- Nx frames the executor's stdout.

### D6 -- fallow SARIF via `--format sarif -o fallow.sarif`, not `--sarif-file`
Verified locally: `--sarif-file` writes NOTHING when there are 0 changed files (clean
tree / post-merge push), which would break the upload. `--format sarif -o` ALWAYS writes
a valid file. The existing `fallow` gate job (human, new-only) is left 100% untouched;
this job runs fallow a second time only to produce the report file. The generation step
is `continue-on-error` so a fail verdict (exit 1) still reaches the upload.

### Claude's Discretion
Exact comment prose in ci.yml; whether to add act-compat assertions for the new job
(decided YES -- matches the repo's trigger-fidelity guard convention).
</decisions>

<specifics>
## Specific Ideas / Verified Facts

- Action pin: `github/codeql-action/upload-sarif@b7351df727350dca84cb9d725d57dcf5bc82ba26 # v3.37.1`
  (resolved via `gh api repos/github/codeql-action/tags`; SHA-pinning is a hard repo rule).
- angular-typechecker SARIF verified locally: `$schema` sarif-2.1.0, driver `angular-typechecker`,
  18 NG8xxx rules, clean run -> empty `results` (valid, uploadable). Exit code preserved across formats.
- fallow 3.6.0 `audit`: `--format sarif` (alias `-f`), `-o/--output-file <PATH>`, `--gate new-only` default,
  `--sarif-file` (adjunct, changed-files-scoped), `--ci` = `--format sarif --fail-on-issues --quiet` (NOT used --
  it flips the gate off new-only).
- Public repo -> Code Scanning is free/available; third-party SARIF (distinct tool names) coexists with any
  CodeQL default setup.
</specifics>

<canonical_refs>
## Canonical References

- `packages/angular-typechecker/README.md` (SARIF and GitHub Code Scanning section, incl. "Run from the repository root").
- `.github/workflows/ci.yml` (existing `fallow` job, least-privilege + SHA-pin + path-gate conventions).
- `AGENTS.md` (main is PR-only; required check is `ci`; no direct push to main).
- `tools/act/act-compat.sh` (per-trigger job-selection guards).
</canonical_refs>
