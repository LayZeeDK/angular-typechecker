---
phase: 260714-gja-apply-safe-install-flags
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - e2e/angular-typechecker-install-e2e/src/nx-add-npm.e2e.spec.ts
  - e2e/angular-typechecker-install-e2e/src/nx-add-e2e.e2e.spec.ts
  - e2e/angular-typechecker-install-e2e/src/install-smoke.e2e.spec.ts
  - e2e/angular-typechecker-install-e2e/src/generator-e2e.e2e.spec.ts
  - e2e/angular-typechecker-install-e2e/src/storybook-composition.e2e.spec.ts
  - e2e/angular-typechecker-install-e2e/src/storybook-tarball.e2e.spec.ts
  - e2e/angular-typechecker-install-e2e/src/verdaccio-publish.e2e.spec.ts
  - e2e/angular-typechecker-install-e2e/src/nx-add-pnpm.e2e.spec.ts
  - e2e/angular-typechecker-matrix-e2e/src/matrix-5types.e2e.spec.ts
  - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts
  - e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-pnpm.e2e.spec.ts
  - .planning/quick/260714-gja-research-other-local-e2e-wall-clock-time/260714-gja-MEASUREMENTS.md
autonomous: true
requirements:
  - 260714-gja

must_haves:
  truths:
    - "Every intended DIRECT npm install site (11 sites across 9 files) carries `--no-audit --no-fund --prefer-offline`; the 2 provisioning pnpm installs carry `--prefer-offline` -- and nowhere else"
    - "nx add, ng add, and `corepack yarn install` commands carry NO added perf flags (fidelity: the REAL command under test forwards no flags)"
    - "The two Storybook installs still carry `--legacy-peer-deps` unchanged; no `--legacy-peer-deps`/`--force` is added anywhere new (B-03 peer-honesty + SB peer cap intact -- flags change no resolution and mask no ERESOLVE)"
    - "The pnpm-symlink `pnpm add <tgz> --config.frozen-lockfile=false --ignore-scripts` is UNCHANGED (deferred: npmjs-direct small win + its failure diagnostic is a CI status/signal; documented as measure-only)"
    - "A full instrumented e2e run is GREEN after the flags (4/4 projects, 57 tests) -- fidelity intact"
    - "260714-gja-MEASUREMENTS.md reports after-flags (gja warm) vs the 1gr WARM baseline per-PM: npm-install rows shrink modestly OR are stated within-noise honestly; yarn/nx add/ng add rows serve as the flag-free environmental control and are ~unchanged (proof the flags landed only where intended)"
    - "No package.json version mutation; no product/source change (test-harness only; one-hunk-per-site revert)"
  artifacts:
    - path: "e2e/angular-typechecker-install-e2e/src/nx-add-npm.e2e.spec.ts"
      provides: "provisioning `npm install` gains --no-audit --no-fund --prefer-offline (line ~88)"
      contains: "npm install --no-audit --no-fund --prefer-offline"
    - path: "e2e/angular-typechecker-install-e2e/src/storybook-composition.e2e.spec.ts"
      provides: "provisioning npm install (line ~97) + Storybook install keeps --legacy-peer-deps and adds the flags (line ~108)"
      contains: "--legacy-peer-deps --no-audit --no-fund --prefer-offline"
    - path: "e2e/angular-typechecker-install-e2e/src/nx-add-pnpm.e2e.spec.ts"
      provides: "provisioning `pnpm install` gains --prefer-offline (line ~142)"
      contains: "pnpm install --prefer-offline"
    - path: "e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-pnpm.e2e.spec.ts"
      provides: "provisioning `pnpm install` gains --prefer-offline (line ~246)"
      contains: "pnpm install --prefer-offline"
    - path: ".planning/quick/260714-gja-research-other-local-e2e-wall-clock-time/260714-gja-MEASUREMENTS.md"
      provides: "after-flags vs 1gr-warm per-PM comparison + honest modest/within-noise framing + measure-only/rejected levers documented as follow-ups"
      contains: "1gr"
  key_links:
    - from: "e2e/**/*.e2e.spec.ts sh(...) command strings"
      to: "the npm/pnpm perf flags"
      via: "flags appended ONLY to direct npm install / provisioning pnpm install commands, never to nx add / ng add / corepack yarn install"
      pattern: "(npm install[^`']*--no-audit --no-fund --prefer-offline|pnpm install --prefer-offline)"
    - from: "ATC_TIME_INSTALLS seam (libs/test-util sh())"
      to: "tools/e2e-timing/aggregate-install-timings.mjs -> 260714-gja-MEASUREMENTS.md"
      via: "one instrumented --parallel=2 warm run aggregated and diffed against the 1gr warm tables"
      pattern: "aggregate-install-timings"
---

<objective>
Apply the fidelity-safe LOCAL e2e install-perf flags (the RESEARCH APPLY-NOW set) to the
DIRECT package-manager install sites only, then measure the delta against the 1gr warm
baseline and document the measure-only / rejected levers.

Purpose: shave the audit/fund/metadata round-trips off every heavy npm install (a modest
LOCAL win that also helps CI) without touching resolution, `nx add`/`ng add`/yarn fidelity,
or B-03 peer-honesty. The honest expectation is MODEST -- Lever 1 (warm Verdaccio) already
collapsed the network fetch; extract+link and (on Windows) Defender are the irreducible
residual a flag cannot touch.

Output: 11 e2e spec files with the safe flags applied (one-hunk-per-site revert) +
260714-gja-MEASUREMENTS.md (after-flags vs 1gr-warm, honest framing, follow-up levers).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/quick/260714-gja-research-other-local-e2e-wall-clock-time/260714-gja-RESEARCH.md
@.planning/quick/260714-1gr-apply-lever-1-persist-verdaccio-uplink-c/260714-1gr-MEASUREMENTS.md
@AGENTS.md
@CLAUDE.md

<interfaces>
<!-- The install seam + aggregator the executor reuses UNCHANGED. No code change to measure. -->

libs/test-util/src/lib/e2e-process.ts:
- `sh(command: string, options: { cwd: string; env: NodeJS.ProcessEnv }): string`
  execSync wrapper. When `process.env.ATC_TIME_INSTALLS === '1'` it appends one JSONL
  record `{ ts, cmd, cwd, ms, ok }` per call to `ATC_TIMING_OUT` (absolute path wins).
  Un-instrumented when the flag is unset. This is the ONLY thing to change: the `command`
  string literal passed to `sh(...)` at each intended install site.

tools/e2e-timing/aggregate-install-timings.mjs:
- `node tools/e2e-timing/aggregate-install-timings.mjs <path.jsonl>` -> prints
  "Install timing by PM x scenario x action" + per-PM totals. `derivePm`/`deriveAction`
  key off the command string; the added flags do NOT change PM/action bucketing
  (deriveAction still sees `npm install` / `pnpm install` / `npm install <tgz>`).
</interfaces>

<install_sites>
<!-- CONFIRMED by git grep 2026-07-14. APPLY-NOW set from RESEARCH table (b). -->
<!-- npm sites: append ` --no-audit --no-fund --prefer-offline`. -->
<!-- pnpm sites: append ` --prefer-offline`. -->

npm (append --no-audit --no-fund --prefer-offline):
- install-e2e/nx-add-npm.e2e.spec.ts:88   sh('npm install', ...)                  (provision)
- install-e2e/nx-add-e2e.e2e.spec.ts:114  sh(`npm install ${JSON.stringify(tarballPath)}`)   (tgz)
- install-e2e/install-smoke.e2e.spec.ts:120  sh(`npm install ${JSON.stringify(tarballPath)}`) (tgz)
- install-e2e/generator-e2e.e2e.spec.ts:137  sh(`npm install ${JSON.stringify(tarballPath)}`) (tgz)
- install-e2e/storybook-composition.e2e.spec.ts:97  sh('npm install', ...)         (provision)
- install-e2e/storybook-composition.e2e.spec.ts:108 sh(`npm install ${STORYBOOK_ANGULAR} --legacy-peer-deps`)  (KEEP --legacy-peer-deps)
- install-e2e/storybook-tarball.e2e.spec.ts:123  sh('npm install', ...)            (provision)
- install-e2e/storybook-tarball.e2e.spec.ts:136  sh(`npm install ${STORYBOOK_ANGULAR} --legacy-peer-deps`)  (KEEP --legacy-peer-deps)
- install-e2e/verdaccio-publish.e2e.spec.ts:110  sh(`npm install --save-dev ${PACKAGE_NAME}`)
- matrix-e2e/matrix-5types.e2e.spec.ts:130  sh(`npm install ${JSON.stringify(tarballPath)}`) (tgz)
- ng-cli-e2e/ng-add-ng-run.e2e.spec.ts:202  sh('npm install', ...)                 (provision)

pnpm (append --prefer-offline):
- install-e2e/nx-add-pnpm.e2e.spec.ts:142  sh('pnpm install', ...)                 (provision)
- ng-cli-e2e/ng-add-ng-run-pnpm.e2e.spec.ts:246  sh('pnpm install', ...)          (provision)

DO NOT TOUCH (fidelity / deferred):
- install-e2e/nx-add-yarn.e2e.spec.ts:139       corepack yarn install   (yarn 4 has no --prefer-offline; fresh cacheFolder/enableMirror:false load-bearing)
- ng-cli-e2e/ng-add-ng-run-yarn.e2e.spec.ts:271 corepack yarn install   (same)
- ALL `npx nx add` / `ng add` / `corepack yarn nx add` / `corepack yarn ng add`  (the REAL command under test forwards no flags)
- matrix-e2e/pnpm-symlink.e2e.spec.ts:126       pnpm add <tgz> --config.frozen-lockfile=false --ignore-scripts  (DEFER: npmjs-direct small win; its failure diagnostic is a CI status/signal -- measure-only note)
</install_sites>

Line numbers are as-confirmed; treat them as anchors and match on the `sh(...)` command
text (each file has at most 2 sites, both single-line in-place edits, so numbers hold).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Apply the safe install flags to the 13 confirmed direct-install sites</name>
  <files>
    e2e/angular-typechecker-install-e2e/src/nx-add-npm.e2e.spec.ts,
    e2e/angular-typechecker-install-e2e/src/nx-add-e2e.e2e.spec.ts,
    e2e/angular-typechecker-install-e2e/src/install-smoke.e2e.spec.ts,
    e2e/angular-typechecker-install-e2e/src/generator-e2e.e2e.spec.ts,
    e2e/angular-typechecker-install-e2e/src/storybook-composition.e2e.spec.ts,
    e2e/angular-typechecker-install-e2e/src/storybook-tarball.e2e.spec.ts,
    e2e/angular-typechecker-install-e2e/src/verdaccio-publish.e2e.spec.ts,
    e2e/angular-typechecker-install-e2e/src/nx-add-pnpm.e2e.spec.ts,
    e2e/angular-typechecker-matrix-e2e/src/matrix-5types.e2e.spec.ts,
    e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts,
    e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-pnpm.e2e.spec.ts
  </files>
  <action>
    Edit ONLY the `sh(...)` command STRING at each of the 13 sites listed in the plan's
    `<install_sites>` block. For the 11 npm sites, append ` --no-audit --no-fund
    --prefer-offline` to the end of the command (after the tarball path / package name /
    existing `--legacy-peer-deps` / `--save-dev <name>` -- the added flags always come LAST,
    so the revert is a single trailing-token strip per site). For the 2 provisioning pnpm
    sites, append ` --prefer-offline`. Rationale for `--prefer-offline` inclusion: Lever 1
    (1gr, committed) keeps Verdaccio warm, so metadata revalidation is a safe local-only
    marginal shave; `--no-audit`/`--no-fund` skip the post-install advisory tree-build +
    funding walk and help CI too.

    Preserve `--legacy-peer-deps` EXACTLY on the two Storybook installs
    (storybook-composition:108, storybook-tarball:136) -- keep it, add the flags after it.
    Add `--legacy-peer-deps`/`--force` NOWHERE new (B-03 peer-honesty: none of the added
    flags change resolution or mask an ERESOLVE).

    Do NOT touch: the two `corepack yarn install` sites, any `nx add`/`ng add` command, or
    the pnpm-symlink `pnpm add <tgz> --config.frozen-lockfile=false --ignore-scripts`
    (deferred; its failure diagnostic is a CI signal).

    After editing each site, read the immediately surrounding comment; if a comment quotes
    the exact old command string it is now inaccurate -- update it minimally. (Most nearby
    comments describe the intent -- "provision the fixture's own deps", "the REAL command:
    nx add ..." -- and stay accurate; expect few or no comment edits.)
  </action>
  <verify>
    <automated>node -e "const fs=require('node:fs'),cp=require('node:child_process');const npm=cp.execSync('git grep -n \"no-audit\" -- \"e2e/**/*.e2e.spec.ts\"',{encoding:'utf8'}).trim().split('\n');const po=cp.execSync('git grep -n \"prefer-offline\" -- \"e2e/**/*.e2e.spec.ts\"',{encoding:'utf8'}).trim().split('\n');if(npm.length!==11)throw new Error('expected 11 --no-audit sites, got '+npm.length);if(po.length!==13)throw new Error('expected 13 --prefer-offline sites, got '+po.length);for(const l of npm){if(!/npm install/.test(l))throw new Error('--no-audit on a non-npm-install line: '+l);}console.log('OK 11 npm + 13 prefer-offline');"</automated>
    <automated>node -e "const cp=require('node:child_process');const yarn=cp.execSync('git grep -n \"corepack yarn install\" -- \"e2e/**/*.e2e.spec.ts\"',{encoding:'utf8'});if(/no-audit|prefer-offline/.test(yarn))throw new Error('perf flag leaked onto a yarn install');const lpd=cp.execSync('git grep -c \"legacy-peer-deps\" -- e2e/angular-typechecker-install-e2e/src/storybook-composition.e2e.spec.ts e2e/angular-typechecker-install-e2e/src/storybook-tarball.e2e.spec.ts',{encoding:'utf8'});console.log('yarn clean; storybook legacy-peer-deps intact:',lpd.trim());"</automated>
    <automated>npx nx run-many -t lint typecheck -p angular-typechecker-install-e2e angular-typechecker-matrix-e2e angular-typechecker-ng-cli-e2e --skip-nx-cache</automated>
    <automated>npx nx format:check</automated>
  </verify>
  <done>
    11 npm sites carry `--no-audit --no-fund --prefer-offline`; 2 pnpm sites carry
    `--prefer-offline`; both `corepack yarn install` sites and all `nx add`/`ng add` +
    pnpm-symlink lines are flag-free; both Storybook installs still carry `--legacy-peer-deps`.
    lint + typecheck (maxWarnings:0) + format:check green on the 3 touched e2e projects.
    `git diff --stat packages/angular-typechecker/package.json` is empty (no version mutation).
  </done>
</task>

<task type="auto">
  <name>Task 2: Run ONE instrumented warm --parallel=2 measurement and write 260714-gja-MEASUREMENTS.md</name>
  <files>.planning/quick/260714-gja-research-other-local-e2e-wall-clock-time/260714-gja-MEASUREMENTS.md</files>
  <action>
    Measure via the committed ATC_TIME_INSTALLS seam -- NO code change. Minimize runs: reuse
    the 1gr WARM tables (260714-1gr-MEASUREMENTS.md, run W) as the before-flags baseline; do
    ONE new warm after-flags run.

    STANDBY / SLOW-RUN CAVEAT: the e2e run is ~23 min. Run it DETACHED/in the background
    (run_in_background). A machine standby mid-run pauses it; slow != failure -- do NOT kill
    or restart on slowness. Only treat a non-zero exit or a non-4/4 result as a failure.

    Step A -- ensure Verdaccio storage is WARM (so the single run is comparable to 1gr's warm
    run W, not a cold-within-itself run). Check `tmp/local-registry/storage` package-dir count;
    if it is missing or thin (well under ~400 dirs), do ONE throwaway warm-up
    `NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache` first and discard its
    JSONL. If it is already populated (Lever 1 is committed; 1gr left it warm), skip the
    warm-up.

    Step B -- the measured run (background):
    `ATC_TIME_INSTALLS=1 ATC_TIMING_OUT="$PWD/tmp/gja-after.jsonl" NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache`
    (`--skip-nx-cache` is REQUIRED -- a cache hit runs no installs -> empty JSONL. `tmp/` is
    gitignored; the raw JSONL is NOT committed.)

    Step C -- aggregate: `node tools/e2e-timing/aggregate-install-timings.mjs tmp/gja-after.jsonl`.

    Step D -- write 260714-gja-MEASUREMENTS.md (match the 1gr report style). Include:
    - What+how (the APPLY-NOW flag set + which sites; the single warm-run protocol; reuse of
      1gr warm as before-flags; the ATC_TIME_INSTALLS seam unchanged).
    - The after-flags aggregated table (PM x scenario x action) + per-PM totals.
    - A per-PM comparison vs 1gr WARM: npm-install rows (the TREATMENT) vs the flag-free rows
      (`corepack yarn install`, `nx add`, `ng add` -- the ENVIRONMENTAL CONTROL). Compute the
      control's cross-session drift and attribute only the EXCESS npm-install drop over that
      drift to the flags (same rigor 1gr used with its matrix control -- but NOTE the matrix
      `npm install <tgz>` row now carries flags, so it is a treatment row, not a control).
    - HONEST framing: the win is expected MODEST (audit/fund skip = seconds per heavy install);
      extract+link + Windows Defender are the irreducible residual. If the measured npm delta
      is within the control drift / run-to-run noise, SAY SO plainly -- do not force a delta.
      The flags still stand as a safe, fidelity-preserving, CI-helping cleanup regardless.
    - PROOF the flags landed only where intended: the yarn/nx add/ng add rows are ~unchanged
      (within noise) vs 1gr warm.
    - Fidelity proof: the run was GREEN, 4/4 projects (install 37/matrix 7/ng-cli 4/cache 9).
    - Windows/one-run caveat (Defender inflation; single run per condition -> absolutes are
      directional; deltas + controls are the signal), mirroring 1gr.
    - MEASURE-ONLY / DEFERRED follow-ups (document, do NOT apply): (1) Windows Defender
      exclusion on the OS-temp install path -- the single biggest LOCAL lever but a
      CONTRIBUTOR-MACHINE change, not a repo change (do NOT redirect mkdtemp to repo-tmp --
      MAX_PATH hazard); (2) matrix-e2e fileParallelism (low-risk/small-win, only if net-positive
      on BOTH local and a 4-vCPU CI shape); (3) the pnpm-symlink `--prefer-offline` (optional,
      npmjs-direct small win, signal-discrimination risk).
    - REJECTED (document, do NOT apply): local PM-cache pin (already reused; Lever 1 + fixed
      port 4873 dominate), pnpm-swap (installs are PM-specific by design), yarn perf flags
      (none safe), ng-cli-e2e + install-e2e intra-project file-parallelism (shared Verdaccio
      cold-fetch race + CI 4-vCPU oversubscription -- the vitest config is shared local+CI).
  </action>
  <verify>
    <automated>node -e "const cp=require('node:child_process');const t=cp.execSync('node tools/e2e-timing/aggregate-install-timings.mjs tmp/gja-after.jsonl',{encoding:'utf8'});if(!/Grand total: \d+ sh\(\) calls/.test(t))throw new Error('aggregate produced no table');console.log('aggregate OK');"</automated>
    <automated>node -e "const fs=require('node:fs');const p='.planning/quick/260714-gja-research-other-local-e2e-wall-clock-time/260714-gja-MEASUREMENTS.md';const s=fs.readFileSync(p,'utf8');for(const k of ['1gr','no-audit','Defender','REJECT']){if(!s.includes(k))throw new Error('MEASUREMENTS.md missing: '+k);}console.log('report OK');"</automated>
    <human-check>The measured e2e run exited 0 with 4/4 projects green (install 37 / matrix 7 / ng-cli 4 / cache 9); confirm before trusting the report. Slow != failure -- only a non-zero exit or non-4/4 is a real failure.</human-check>
  </verify>
  <done>
    tmp/gja-after.jsonl produced from a GREEN warm --parallel=2 run (4/4 projects);
    aggregated; 260714-gja-MEASUREMENTS.md written with the after-vs-1gr-warm per-PM comparison,
    the flag-free control drift analysis, honest modest/within-noise framing, the fidelity
    proof, and the measure-only + rejected levers documented. No package.json version mutation.
  </done>
</task>

</tasks>

<threat_model>
No new trust boundary. `--no-audit` only skips a post-install advisory network call and
`--no-fund`/`--prefer-offline` skip a funding walk / metadata revalidation -- none change
dependency resolution, none mask a peer ERESOLVE (only `--legacy-peer-deps`/`--force` do, and
those are untouched). Test-harness only; no product surface, no shipped artifact change.
</threat_model>

<verification>
- Flags present ONLY on the 11 npm + 2 pnpm intended sites; `nx add`/`ng add`/`corepack yarn
  install`/pnpm-symlink flag-free; Storybook `--legacy-peer-deps` unchanged (Task 1 greps).
- lint + typecheck (maxWarnings:0) + format:check green on the 3 touched e2e projects.
- A full instrumented e2e run GREEN, 4/4 projects (fidelity intact).
- 260714-gja-MEASUREMENTS.md shows after-flags vs 1gr-warm with honest framing + follow-ups.
- `git diff --stat packages/angular-typechecker/package.json` empty (no version mutation).
</verification>

<success_criteria>
- The APPLY-NOW flag set is applied surgically (13 sites) and nowhere else; fidelity levers
  (nx add/ng add/yarn/pnpm-symlink/--legacy-peer-deps) are provably untouched.
- The e2e gate stays GREEN after the flags (4/4 projects).
- The measurement report honestly quantifies the modest win (or states within-noise) against
  the 1gr warm baseline and records the measure-only/rejected levers as follow-ups.
- Test-harness only; one-hunk-per-site revert; no version mutation -> release-safe on the
  current branch (main checkout, no worktree).
</success_criteria>

<output>
Create `.planning/quick/260714-gja-research-other-local-e2e-wall-clock-time/260714-gja-MEASUREMENTS.md` (Task 2).
No SUMMARY step defined here -- the quick workflow owns SUMMARY/VERIFICATION.
</output>
