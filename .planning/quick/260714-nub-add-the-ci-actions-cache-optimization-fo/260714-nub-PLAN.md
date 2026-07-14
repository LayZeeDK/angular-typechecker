---
phase: quick-260714-nub
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/ci.yml
  - .planning/quick/260714-nub-add-the-ci-actions-cache-optimization-fo/260714-nub-MEASUREMENTS.md
  - .planning/quick/260714-nub-add-the-ci-actions-cache-optimization-fo/260714-nub-SUMMARY.md
autonomous: false
requirements:
  - QT-260714-nub-ci-verdaccio-cache
user_setup: []

must_haves:
  truths:
    - "The e2e job in ci.yml has an actions/cache/restore step (after npm ci, before nx run-many -t e2e) and an actions/cache/save step (job's last step)."
    - "The cache path is tmp/local-registry/storage EXCLUDING angular-typechecker + .htpasswd; the key hashes the fixture lockfiles/manifests + plugin package.json + ci.yml; broad restore-keys prefix."
    - "The job stays contents: read -- NO new permissions scope, no OIDC-posture change."
    - "The throwaway PR is based on the FEATURE branch (clearStorage:false e2e setup), NOT main -- so the cache is actually exercised and the measurement is meaningful."
    - "Miss (run 1), hit (rerun), and 2nd-hit (2nd rerun) e2e-step wall-clocks are captured from real CI runs, all runs green (4/4 e2e projects)."
    - "The cache step is applied to the real feature branch ONLY if the HIT e2e-step beats MISS beyond hit-vs-hit noise; otherwise discarded and the null result recorded honestly."
    - "The code review of the ci.yml diff is clean (0 unresolved findings) before the throwaway PR is opened."
    - "The throwaway draft PR is closed and the scratch branch is deleted (origin + local); no package.json version mutation anywhere."
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "The two actions/cache steps in the e2e job (applied to the feature branch only if measured faster)"
      contains: "actions/cache/restore"
    - path: ".planning/quick/260714-nub-add-the-ci-actions-cache-optimization-fo/260714-nub-MEASUREMENTS.md"
      provides: "Miss/hit/2nd-hit e2e-step durations, verdict, keep/discard decision, honest caveat"
    - path: ".planning/quick/260714-nub-add-the-ci-actions-cache-optimization-fo/260714-nub-SUMMARY.md"
      provides: "Quick-task summary"
  key_links:
    - from: "actions/cache/save step"
      to: "actions/cache/restore step (id: verdaccio-storage)"
      via: "key: steps.verdaccio-storage.outputs.cache-primary-key + if: success() && cache-hit != 'true'"
      pattern: "verdaccio-storage.outputs.cache-primary-key"
    - from: "throwaway draft PR"
      to: "the feature branch e2e setup (clearStorage:false)"
      via: "gh pr create --base gsd/v0.2.1-angular-cli-workspace-support"
      pattern: "base = feature branch, not main"
---

<objective>
Add a SHA-pinned `actions/cache` restore+save split to the `e2e` job in `.github/workflows/ci.yml`
to persist Verdaccio's proxied npmjs uplink storage (`tmp/local-registry/storage`) across CI runs --
the cross-run counterpart to the already-landed `clearStorage:false` in-run reuse (quick-260714-1gr).
Then MEASURE the real CI wall-clock win via a THROWAWAY DRAFT PR (miss vs hit), and APPLY the step to
the real feature branch ONLY if the HIT e2e-step beats MISS beyond CI noise. Code-review the ci.yml
diff before opening the PR.

Purpose: the existing `setup-node cache: npm` only warms `~/.npm` (client -> Verdaccio, npm-only);
it does NOTHING for the Verdaccio -> npmjs uplink hop, which starts EMPTY on every fresh runner. yarn
(fresh per-fixture cacheFolder + enableMirror:false) and pnpm (uncached store) get ZERO help from
`~/.npm` and re-fetch the whole Angular 22 / Nx 23 / TS 6 toolchain through the uplink every run.
Caching `tmp/local-registry/storage` removes that uplink fetch for all three package managers. Honest
caveat: the e2e step is dominated by CPU-bound typecheck assertions, so the wall-clock delta is a
FRACTION of the step -- the win is real but likely modest, which is exactly why we measure before we keep.

Output: a reviewed ci.yml cache-step diff (applied to the feature branch iff proven faster), plus
MEASUREMENTS.md (miss/hit/2nd-hit durations + verdict) and SUMMARY.md.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md

**ORCHESTRATOR-DRIVEN, NOT hands-off.** T2 and T3 involve outward-facing git/gh/CI steps
(push a scratch branch, open a draft PR in THIS repo, trigger + re-run CI ~3 times, close the PR,
delete the branch) and a code-review agent gate in T1. The executor CANNOT watch a ~20-minute CI run,
so the orchestrator drives those steps per the documented protocol below. Each full `ci` run's e2e job
is ~20 min; the measurement is ~3 CI runs = inherently slow. The user has AUTHORIZED all of these
outward-facing actions by choosing the throwaway-PR measurement path.
</execution_context>

<context>
@.planning/quick/260714-nub-add-the-ci-actions-cache-optimization-fo/260714-nub-RESEARCH.md
@.github/workflows/ci.yml
@.planning/quick/260714-1gr-apply-lever-1-persist-verdaccio-uplink-c/260714-1gr-MEASUREMENTS.md
@AGENTS.md
@CLAUDE.md

<notes>
- **The exact YAML to copy is in RESEARCH.md Section 2 ("Exact design").** Copy it verbatim: SHA
  `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` (actions/cache v6.1.0), restore id `verdaccio-storage`,
  path `tmp/local-registry/storage` with `!.../angular-typechecker` + `!.../.htpasswd` excludes, key
  `verdaccio-storage-${{ runner.os }}-${{ hashFiles('e2e/**/fixtures/**/package.json',
  'e2e/**/fixtures/**/package-lock.json', 'e2e/**/fixtures/**/pnpm-lock.yaml',
  'packages/angular-typechecker/package.json', '.github/workflows/ci.yml') }}`, broad restore-keys,
  save gated on `if: success() && steps.verdaccio-storage.outputs.cache-hit != 'true'` re-using
  `cache-primary-key`. Keep the RESEARCH's explanatory comment block above the restore step.
- **ORCHESTRATOR CORRECTION (LOAD-BEARING) to RESEARCH Section 3:** RESEARCH said `--base main`.
  That is WRONG for a MEANINGFUL measurement -- origin/main does NOT carry this session's e2e-perf
  work, so it still runs `clearStorage:true`, which WIPES `tmp/local-registry/storage` every run and
  makes the cache a NO-OP. Base the throwaway PR on the FEATURE branch
  (`gsd/v0.2.1-angular-cli-workspace-support`) instead. The PR-scoped-cache miss->hit rule (run 1
  saves to the PR merge-ref scope, a re-run restores) is unchanged by the base branch.
- Current state (verified): on `gsd/v0.2.1-angular-cli-workspace-support`, 176 commits ahead of
  origin/main, fully pushed, NO open PR from this branch, committer = public gmail. `on: pull_request: {}`
  fires for a PR against ANY base branch, and draft PRs DO fire `pull_request`.
- `.github/workflows/ci.yml` is itself a `code` file for dorny/paths-filter (not .planning, not *.md,
  not docs), so it alone sets `code=true`; the trivial `e2e/**` touch is belt-and-suspenders to
  guarantee the e2e job runs. The e2e touch MUST be a comment in a spec file (NOT a fixture
  package.json/lockfile) so the cache key stays byte-identical to the real-branch apply.
</notes>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author the actions/cache steps in ci.yml + code-review the diff</name>
  <files>.github/workflows/ci.yml</files>
  <action>
Edit the `e2e` job in `.github/workflows/ci.yml` to add the two `actions/cache` steps EXACTLY as
specified in RESEARCH.md Section 2 (copy the YAML verbatim, including the explanatory comment block).
Placement: insert the `actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0` step
(id `verdaccio-storage`) immediately AFTER the existing `- run: npm ci` (ci.yml:178) and BEFORE
`- run: npx nx run-many -t typecheck -p tag:type:e2e`; insert the matching
`actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0` step as the job's LAST step,
after `- run: npx nx run-many -t e2e --parallel=2` (ci.yml:211). Use the path (with the
`angular-typechecker` + `.htpasswd` excludes), key (hashFiles of the fixture manifests/lockfiles +
plugin package.json + ci.yml), broad restore-keys, and save `if:` guard
(`success() && steps.verdaccio-storage.outputs.cache-hit != 'true'`) exactly per the design. Do NOT
add or modify any `permissions:` block -- the e2e job MUST stay on the top-level `contents: read`
(actions/cache authenticates via ACTIONS_CACHE_URL/ACTIONS_RUNTIME_TOKEN, not the permissions block).
Do NOT touch any other job, any e2e spec, or any package.json. Leave the change as an UNCOMMITTED
working-tree edit on the current feature branch (T2 carries it to a scratch branch; the real-branch
apply is deferred to T3).

Then the ORCHESTRATOR runs the user-required code review on this ci.yml diff: spawn gsd-code-reviewer
on the uncommitted `.github/workflows/ci.yml` diff; if it returns findings, spawn gsd-code-fixer to
resolve them. The reviewer must confirm: (i) the SHA pin `v6.1.0 -> 55cc8345863c7cc4c66a329aec7e433d2d1c52a9`;
(ii) no new permission scope; (iii) the excludes + key inputs + save-guard match the design. This
review STANDS for the identical real-branch apply in T3 -- do not re-review there.
  </action>
  <verify>
    <automated>node -e "const y=require('js-yaml');const fs=require('fs');const d=y.load(fs.readFileSync('.github/workflows/ci.yml','utf8'));const e=d.jobs.e2e.steps;const names=JSON.stringify(e);if(!names.includes('actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9'))throw new Error('restore step missing');if(!names.includes('actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9'))throw new Error('save step missing');if(d.jobs.e2e.permissions)throw new Error('e2e job must not add a permissions block');console.log('OK: cache steps present, no new permissions scope')"</automated>
    <human-check>gsd-code-reviewer returns 0 unresolved findings on the ci.yml diff (gsd-code-fixer applied any findings).</human-check>
  </verify>
  <done>ci.yml e2e job has the SHA-pinned restore (after npm ci) + save (last step) with the correct path/excludes/key/restore-keys/save-guard; no new permissions scope; YAML parses; code review clean. Change is uncommitted on the feature branch. Note: CI's own `lint-workflows` (actionlint) + `act-compat` jobs are the authoritative structural gate and run on the PR in T2.</done>
</task>

<task type="auto">
  <name>Task 2: Measure miss vs hit via a throwaway draft PR (ORCHESTRATOR-DRIVEN)</name>
  <files>.github/workflows/ci.yml</files>
  <action>
ORCHESTRATOR-DRIVEN outward-facing protocol (the executor cannot watch ~20-min CI runs; the user
authorized these actions). Commits use the public gmail identity and NO AI attribution; stage files
by name (never `git add .`).

1. Create the scratch branch off the current feature HEAD, carrying the uncommitted ci.yml cache-step
   edit: `git switch -c 260714-nub-ci-cache-probe` (the working-tree change follows into the new branch).
2. Add a TRIVIAL `e2e/**` touch: a one-line comment in any `e2e/**/*.e2e.spec.ts` (NOT a fixture
   `package.json`/lockfile -- the cache key must stay byte-identical to the real-branch apply). This
   guarantees dorny/paths-filter's `code` output is non-`false` so the e2e job runs.
3. Commit both by name: `git add .github/workflows/ci.yml <the-touched-spec>` then commit
   `ci(260714-nub): probe Verdaccio uplink cache (throwaway; not for merge)`. Push:
   `git push -u origin 260714-nub-ci-cache-probe`. Switch back to the feature branch
   (`git switch gsd/v0.2.1-angular-cli-workspace-support`) and confirm its working tree is clean
   (the ci.yml change now lives only on the scratch branch).
4. Open the throwaway DRAFT PR with base = FEATURE branch (NOT main):
   `gh pr create --draft --base gsd/v0.2.1-angular-cli-workspace-support --head 260714-nub-ci-cache-probe
   --title "throwaway: measure Verdaccio uplink cache" --body "Throwaway measurement PR. Do not merge."`
   This yields a small clean diff (cache step + one comment) and fires `on: pull_request`.
5. Wait for run 1 to finish (the e2e cache is a MISS; the save writes the PR's merge-ref-scoped cache).
   Confirm the `ci` gate is green (4/4 e2e projects). Read the e2e-step duration.
6. `gh run rerun <run-id>` -> run completes with a cache HIT (same-PR re-run restores the PR-scoped
   cache). Read the e2e-step duration.
7. `gh run rerun <run-id>` a 2nd time -> HIT #2, to size hit-vs-hit CI noise. Read the e2e-step duration.
8. Collect durations via `gh run view <run-id> --json jobs` after each attempt completes, using the jq
   in RESEARCH.md Section 3 (select the `e2e` job, the `run-many -t e2e` step, `completedAt-startedAt`).
   Also capture the whole-e2e-job duration for context.
  </action>
  <verify>
    <automated>MISSING -- the measurement is real CI runs (~3 x ~20 min); the executor cannot run or watch them. The orchestrator captures three e2e-step durations (miss, hit, 2nd hit) via `gh run view <run-id> --json jobs` and records them in T3's MEASUREMENTS.md. CI's lint-workflows (actionlint) + act-compat jobs green on the PR is the authoritative YAML structural validation.</automated>
  </verify>
  <done>Scratch branch pushed; draft PR open with base = feature branch; run 1 (MISS) + rerun (HIT) + 2nd rerun (HIT2) all completed with a green `ci` gate (4/4 e2e projects); three e2e-step wall-clocks captured for T3.</done>
</task>

<task type="auto">
  <name>Task 3: Decide, apply-or-discard, cleanup, report (ORCHESTRATOR-DRIVEN)</name>
  <files>.github/workflows/ci.yml, .planning/quick/260714-nub-add-the-ci-actions-cache-optimization-fo/260714-nub-MEASUREMENTS.md, .planning/quick/260714-nub-add-the-ci-actions-cache-optimization-fo/260714-nub-SUMMARY.md</files>
  <action>
Decision (per the user's "apply ONLY if proven faster" criterion): KEEP iff the HIT e2e-step is faster
than MISS by a clear double-digit-second reduction that EXCEEDS the hit-vs-hit spread (HIT vs HIT2);
otherwise DISCARD and record the null result honestly. The delta is diluted by the cache-independent
CPU-bound typecheck floor, so a within-noise result is a legitimate, expected outcome.

APPLY path (proven faster): on the feature branch, re-apply the ci.yml cache step ONLY (NOT the trivial
e2e touch -- that existed only to fire the paths-filter). This is byte-identical to T1's reviewed diff,
so the T1 code review stands (no re-review). Commit by name:
`git add .github/workflows/ci.yml` then
`ci(core): cache Verdaccio uplink storage in the e2e job (quick-260714-nub)`. Do NOT push directly to
main (main is PR-only); this commit rides the eventual Release-PR, whose first `main` run seeds main's
cache for all future PRs.

DISCARD path (within noise / negligible): do NOT apply any ci.yml change to the feature branch; the
one-hunk revert is simply not committing it.

CLEANUP (both paths): `gh pr close <pr-number> --delete-branch` (closes the draft PR + deletes the
remote scratch branch); then delete the local scratch branch: `git branch -D 260714-nub-ci-cache-probe`.
Verify no scratch branch remains on origin or locally, and the feature branch has NO `package.json`
version mutation.

REPORT: write MEASUREMENTS.md with the three e2e-step durations (miss / hit / 2nd-hit) + the whole-job
durations, the hit-vs-hit noise spread, the KEEP/DISCARD verdict with the numeric justification, and
the honest caveat (the typecheck floor dilutes the fetch-savings delta; the local 1gr flagship win --
ng-cli yarn 93.4s->44.7s -- is the mechanism, this CI read is the wall-clock adjudication). Then write
SUMMARY.md per the template.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const b='.planning/quick/260714-nub-add-the-ci-actions-cache-optimization-fo/';for(const f of ['260714-nub-MEASUREMENTS.md','260714-nub-SUMMARY.md']){if(!fs.existsSync(b+f))throw new Error('missing '+f)}const pj=JSON.parse(fs.readFileSync('packages/angular-typechecker/package.json','utf8'));if(pj.version!=='0.2.0')throw new Error('version mutated: '+pj.version);console.log('OK: reports exist, no version mutation')"</automated>
  </verify>
  <done>KEEP/DISCARD decision recorded with numeric justification; ci.yml cache step applied to the feature branch (ci.yml-only) iff proven faster, else not applied; draft PR closed + scratch branch deleted (origin + local); no package.json version mutation; MEASUREMENTS.md + SUMMARY.md written.</done>
</task>

</tasks>

<threat_model>
Trust boundary: the e2e installs pull dependencies through Verdaccio's npmjs uplink, whose proxied
bytes this task now persists across CI runs. Threat (Tampering / supply-chain): a cached storage could
in principle serve a stale or poisoned upstream dependency into the installs. Mitigated by construction:
(1) the cache key hashes every fixture lockfile/manifest + the plugin manifest, so any dependency-set
change busts the key and forces a fresh uplink fetch; (2) `uplinks.npmjs.maxage:60m` makes Verdaccio
revalidate stale metadata against npmjs while serving tarballs from disk; (3) `resetVerdaccioPublishState`
deletes `storage/angular-typechecker` + `storage/.htpasswd` at run start (also excluded from the cache
path), so our freshly built plugin and the publish token are never served stale. The cache holds ONLY
proxied npmjs bytes -- exactly what Verdaccio would re-fetch identically -- so it can change SPEED only,
never correctness. No new permission scope: `actions/cache` authenticates via ACTIONS_CACHE_URL /
ACTIONS_RUNTIME_TOKEN, not the `permissions:` block, so the job stays `contents: read` with no
OIDC-posture change; fork PRs get read-only cache (restore, cannot save) -- fine for a public repo.
The `actions/cache` action is first-party (`actions/` org), SHA-pinned, adds no npm/PyPI/crates package.
</threat_model>

<verification>
- ci.yml e2e job: restore step (after npm ci) + save step (last step), SHA-pinned v6.1.0, correct
  path/excludes/key/restore-keys/save-guard; no new `permissions:` scope.
- CI structural gate on the PR: `lint-workflows` (actionlint) + `act-compat` green; `ci` aggregate
  green (4/4 e2e projects) on all three attempts.
- Measurement: three e2e-step wall-clocks captured (miss, hit, hit2) via `gh run view --json jobs`.
- Apply-or-discard honors the "faster beyond noise" criterion; on apply, ci.yml-only (no e2e touch).
- Cleanup: draft PR closed, scratch branch gone (origin + local); no package.json version mutation.
</verification>

<success_criteria>
- The reviewed ci.yml cache-step diff exists and is code-review-clean.
- The measurement was run against the FEATURE branch's clearStorage:false e2e setup (PR base = feature
  branch), so the cache was actually exercised.
- Miss/hit/2nd-hit e2e-step durations are recorded, with a clear KEEP/DISCARD verdict.
- The cache step is on the feature branch iff proven faster; otherwise the null result is recorded.
- The throwaway PR is closed, the scratch branch is deleted, and no version was mutated.
</success_criteria>

<output>
Create `.planning/quick/260714-nub-add-the-ci-actions-cache-optimization-fo/260714-nub-MEASUREMENTS.md`
and `.planning/quick/260714-nub-add-the-ci-actions-cache-optimization-fo/260714-nub-SUMMARY.md` when done.
</output>
