---
phase: quick-260717-slr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md
  - .planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md
autonomous: true
requirements: [VER-05]

must_haves:
  truths:
    - "The shipped standalone bin, rebuilt from CURRENT HEAD, runs at a real Nx-workspace Angular APPLICATION tsconfig leaf (apps/analog-app/tsconfig.app.json in analogjs/analog @ 5b0b8b66) and returns exit 1 with the planted TSxxxx (RED)."
    - "On the clean app leaf the bin returns exit 0 (GREEN) -- or, if analog's own pre-existing diagnostics leak into the app leaf, a documented EXTERNAL-caveat exit 1 (never a fabricated GREEN)."
    - "Bad-path (atc -c does-not-exist.json) and the unregistered -p flag (atc -p <app tsconfig>) each return exit 2 (BAD-PATH)."
    - "No ERR_REQUIRE_ESM and no infrastructure error on any run."
    - "Both bin names (atc, angular-typechecker) and the npx angular-typechecker path are exercised; npx atc is NEVER used."
    - "The Nx-application cell is recorded at 260717-slr-UAT.md mirroring 28-04-UAT.md's per-clone Tests + results-table shape (clone @ SHA, kind, discovered app-leaf path, observed exit codes + evidence)."
    - "The VER-05 matrix in 28-04-UAT.md gains one Nx-application row cross-referencing the quick record, without rewriting test #5 or the frontmatter tallies."
  artifacts:
    - path: ".planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md"
      provides: "The executed Nx-application VER-05 addendum UAT record (RED/GREEN/BAD-PATH observed exit codes + evidence)"
      contains: "analog-app/tsconfig.app.json"
    - path: ".planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md"
      provides: "Canonical VER-05 matrix, now with the Nx-application row"
      contains: "260717-slr"
  key_links:
    - from: ".planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md"
      to: "analogjs/analog @ 5b0b8b66 :: apps/analog-app/tsconfig.app.json"
      via: "recorded clone URL + pinned SHA + discovered app-leaf tsconfig path"
      pattern: "analog.*5b0b8b66"
    - from: ".planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md"
      to: ".planning/quick/260717-slr-.../260717-slr-UAT.md"
      via: "cross-reference note in the added Nx-application row"
      pattern: "260717-slr"
---

<objective>
Close the one open cell of the VER-05 real-clone matrix: an Nx-WORKSPACE Angular
APPLICATION project. VER-05 (28-04-UAT.md) already covered both project types (app + lib)
and both workspace kinds (Angular CLI + Nx), but the two Nx clones targeted only LIBRARY
leaves (radix-ng/primitives libraries + a schematics leaf; analogjs/analog library
packages content/router/trpc). Apps were only exercised on the Angular CLI side. This task
runs the shipped standalone CLI bin against a real Nx-application tsconfig leaf and records
it as a VER-05 addendum.

Purpose: Confidence gate on top of the CI-authoritative VER-04 (already green) -- prove the
shipped bin drives the Angular compiler and returns literal 0/1/2 against a genuine Nx
application project, the one matrix cell never exercised.
Output: An executed UAT record (260717-slr-UAT.md) + one addendum row in the canonical
28-04-UAT.md matrix. DOCS ONLY -- no angular-typechecker production source, no committed
test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md

<!-- The above is THE gate this task extends. Mirror its shape EXACTLY: the "About this
gate", "How to install the shipped bin", "Assertion shape per clone", the per-clone Tests
(expected/steps/result/evidence), the ## Summary tally, and the results table. Test #5
(analogjs/analog) is the sibling this addendum sits beside -- reuse its structure and its
EXTERNAL-caveat handling. -->

<substrate>
Target: analogjs/analog @ 5b0b8b660e9a77fe7565a795a42d5482f9f3769c -- a real Nx workspace,
on-stack Angular 22, ALREADY CLONED on disk at the MSYS path /d/projects/github/analogjs/analog
(Windows D:\projects\github\analogjs\analog). SAME clone + SHA that VER-05 test #5 used for
analog's library packages -- reusing it keeps the UAT consistent and the SHA already pinned.

VERIFIED app-leaf target (discovered during planning -- confirm it still holds at run time):
  apps/analog-app/tsconfig.app.json
  - apps/analog-app is projectType "application" (nx $schema), a genuine Nx application project.
  - Its tsconfig.app.json EXCLUDES **/*.spec.ts + **/*.test.ts and does NOT include
    src/test-setup.ts, so it AVOIDS the analog TS2882 test-setup caveat that forced test #5's
    caveated GREEN -- a real exit-0 GREEN is expected achievable here.
  - Its include set is NARROW: files [src/main.ts, src/main.server.ts, ...] + include
    [src/app/pages/**/*.page.ts, src/server/components/**/*.ts, src/server/middleware/**/*.ts].
    The RED plant MUST go into a .ts that is ACTUALLY in this program (e.g. a real
    src/app/pages/**/*.page.ts), else the planted diagnostic will not surface.
  - apps/ng-app is a STUB (only tsconfig.spec.json, no app leaf / project.json) -- NOT usable;
    do not target it. If apps/analog-app has moved, pick another apps/* app-shape tsconfig.app.json
    (blog-app / trpc-app / opt-catchall-app all have one) and record the substitution.
</substrate>

<shipped-bin-currency>
The atc/angular-typechecker shims already installed in the clone are STALE (they predate 23
PR #42 review-hardening commits on the current branch: the toExitCode removal, the EPIPE fix,
the --version newline fix). For a faithful "current shipped bin" proof, REBUILD + REPACK from
CURRENT HEAD and REINSTALL before running:
  1. npx nx build angular-typechecker --skip-nx-cache   (exit 0)
  2. pack from dist/packages/angular-typechecker via npm pack (MSYS: cd to /d/... not D:/...);
     capture $ABS_TGZ.
  3. reinstall into the clone with pnpm (analog is a pnpm workspace):
     cd /d/projects/github/analogjs/analog && pnpm add -w -D "$ABS_TGZ"
     (root workspace add; a bare pnpm add errors ERR_PNPM_ADDING_TO_ROOT).
The installed CLI reaches @angular/compiler-cli + typescript via the CLONE's OWN node_modules
through await import(...).
</shipped-bin-currency>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Run the Nx-application VER-05 UAT and author the record</name>
  <files>.planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md</files>
  <action>
Execute the Nx-application cell of VER-05 against analogjs/analog @ 5b0b8b66 and record REAL
observed results (no fabrication) in a new UAT doc, mirroring 28-04-UAT.md's per-clone Tests +
results-table shape.

STEP A -- Rebuild + reinstall the current-HEAD shipped bin (per <shipped-bin-currency>):
  - npx nx build angular-typechecker --skip-nx-cache (assert exit 0).
  - cd /d/projects/github/LayZeeDK/angular-typechecker/dist/packages/angular-typechecker;
    npm pack; capture the absolute tarball path as ABS_TGZ (use MSYS /d/... paths -- Git Bash
    mis-parses D:/ as a remote host).
  - cd /d/projects/github/analogjs/analog; pnpm add -w -D "$ABS_TGZ" (root workspace add).
  - Confirm the clone is on 5b0b8b66 (git -C ... rev-parse HEAD) and on-stack
    (@angular/compiler-cli ^22, typescript ~6.0); record the observed versions.

STEP B -- Confirm the app leaf. Verify apps/analog-app/tsconfig.app.json exists and is
projectType application; note its narrow include set. If it moved, substitute another apps/*
tsconfig.app.json and record the substitution in ## Notes.

STEP C -- Run the assertion battery from the clone root (analog @ /d/projects/github/analogjs/analog).
Run the bin BY PATH via the PM-generated shim; exercise BOTH bin names + npx angular-typechecker;
NEVER npx atc (fetches the unrelated atc@0.0.6 supply-chain hazard). Record each observed exit
code and the evidence:
  - GREEN: ./node_modules/.bin/atc -c apps/analog-app/tsconfig.app.json ; echo "exit=$?"
    -> expect 0 on the clean tree. If analog's own pre-existing diagnostics leak into this app
    leaf, DO NOT fake a GREEN: record the ACTUAL exit 1 as a documented EXTERNAL caveat (name
    the exact TSxxxx + source file, exactly like test #5's TS2882 caveat) and proceed -- RED +
    BAD-PATH + no-infra remain the load-bearing proof.
  - RED: plant a distinct diagnostic into a .ts that is ACTUALLY in the app leaf's program
    (a real src/app/pages/**/*.page.ts; confirm it is in the include set first). Use
    `const atcPlant: string = 123;` -> TS2322. Then
    ./node_modules/.bin/angular-typechecker -c apps/analog-app/tsconfig.app.json ; echo "exit=$?"
    -> expect exit 1, stdout CONTAINS the planted TS2322, stdout has NO ERR_REQUIRE_ESM and NO
    "infrastructure error". Also exercise the npx path once:
    npx angular-typechecker -c apps/analog-app/tsconfig.app.json (expect the same). Revert the
    plant: git checkout -- <file>.
  - BAD-PATH / usage:
    ./node_modules/.bin/atc -c does-not-exist.json ; echo "exit=$?"  -> expect 2 (infrastructure)
    ./node_modules/.bin/atc -p apps/analog-app/tsconfig.app.json ; echo "exit=$?" -> expect 2
    (-p is unregistered -> usage error).

STEP D -- Leave the clone pristine: revert all plants (git checkout -- .); the tarball
reinstall of package.json/pnpm-lock.yaml is expected drift in the UNCOMMITTED external clone
and does NOT need reverting. The external clone is OUTSIDE this repo -- its changes are NEVER
committed here.

STEP E -- Author .planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md.
Follow 28-04-UAT.md's structure: a short "About this gate" framing (VER-05 Nx-APPLICATION
addendum; the one matrix cell -- Nx-workspace application project -- never previously exercised;
CI-authoritative counterpart is VER-04; manual/local gate, clone UNCOMMITTED), a single per-clone
Tests block (expected / steps / result / evidence) for analog-app, a ## Summary tally, and a
results table row (# | Clone @ SHA | Kind = Nx workspace / application | GREEN | RED | BAD-PATH |
Verdict). Record REAL observed exit codes + evidence only; if a run was autonomous (not a literal
human sign-off) say so plainly, matching test #5's autonomous-run honesty note. Set the frontmatter
status/outcome from the actual verdict.
  </action>
  <verify>
    <automated>test -f .planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md && rg -q 'analog-app/tsconfig.app.json' .planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md && rg -q '5b0b8b66' .planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md && rg -q 'ERR_REQUIRE_ESM' .planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md && rg -qi 'exit.?2|BAD-PATH' .planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md</automated>
  </verify>
  <done>
260717-slr-UAT.md exists and records the Nx-application cell: clone analogjs/analog @ 5b0b8b66,
kind Nx workspace / application, discovered app-leaf apps/analog-app/tsconfig.app.json, and the
OBSERVED GREEN (0 or documented external-caveat 1) / RED (1 + planted TS2322, no ERR_REQUIRE_ESM /
infra) / BAD-PATH (does-not-exist -> 2; -p -> 2) exit codes with evidence. Both bin names + npx
angular-typechecker exercised; npx atc never used. Clone left pristine (plants reverted).
  </done>
</task>

<task type="auto">
  <name>Task 2: Append the Nx-application addendum row to the canonical VER-05 matrix</name>
  <files>.planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md</files>
  <action>
Append ONE row to the results table in 28-04-UAT.md ("## Human sign-off / results table") for
the Nx-application cell, so the VER-05 matrix is complete in its canonical home. Row shape mirrors
the existing rows:
  | 6 | analogjs/analog @ 5b0b8b66 (Nx app leaf) | Nx workspace (application) | <GREEN result> | <RED result: TS2322> | PASS (2/2 = 2) | <verdict> |
Use the ACTUAL observed results from Task 1's record (do not restate optimistically). Add a
one-line cross-reference so a reader can find the full record, e.g. a "## Notes" bullet:
"- Nx-APPLICATION cell (the matrix cell test #5 did not cover -- it targeted analog LIBRARY
  packages) closed 2026-07-17 by quick task 260717-slr; full record:
  .planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md".

Do NOT rewrite test #5, its evidence, or the frontmatter tallies beyond adding the row + the
short note. (Optionally bump the results-table intro count if it states a clone total; leave the
frontmatter outcome/summary tally of the original run as-is -- this is an addendum, not a re-run.)
  </action>
  <verify>
    <automated>rg -q '260717-slr' .planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md && rg -qi 'Nx workspace \(application\)|application' .planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md</automated>
  </verify>
  <done>
28-04-UAT.md's results table carries a new Nx-application row reflecting Task 1's observed
verdicts, plus a one-line cross-reference to 260717-slr-UAT.md. Test #5 and the frontmatter
tallies are otherwise unchanged.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| npx package resolution | `npx atc` would fetch the unrelated published `atc@0.0.6` (supply-chain hazard), not the shipped bin |
| external clone -> this repo | analog clone is UNCOMMITTED and OUTSIDE this repo; its file changes must never be staged/committed here |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-slr-01 | Tampering (supply chain) | shipped-bin invocation | mitigate | Run the bin BY PATH via the installed `.bin` shim or `npx angular-typechecker`; NEVER `npx atc` (the plan and 28-04-UAT.md both forbid it). No new registry packages are installed -- only the project's OWN local dist tarball. |
| T-slr-02 | Information disclosure | git commit surface | mitigate | Only `.planning/**` docs in THIS repo are committed (orchestrator-owned); the external analog clone's edits (plants + tarball reinstall drift) are never staged here. Plants reverted via `git checkout --` to leave the clone pristine. |
</threat_model>

<verification>
- 260717-slr-UAT.md exists and records analog-app/tsconfig.app.json @ 5b0b8b66 with observed
  GREEN/RED/BAD-PATH exit codes, the planted TS2322, and the ERR_REQUIRE_ESM-absent assertion.
- 28-04-UAT.md results table has the Nx-application row + a cross-reference to 260717-slr-UAT.md.
- No angular-typechecker production source or committed test files changed (DOCS only).
- The analog clone is left pristine (all plants reverted).
</verification>

<success_criteria>
- The VER-05 matrix's one missing cell -- an Nx-workspace Angular APPLICATION project -- is
  closed with a recorded, evidence-backed shipped-bin UAT run.
- The shipped bin (rebuilt from current HEAD) returns literal 0/1/2 at a real Nx application
  tsconfig leaf, with no ERR_REQUIRE_ESM and no infrastructure error, both bin names + npx
  angular-typechecker exercised.
- Results are real observations (no fabrication); an unbuilt-monorepo GREEN caveat, if any, is
  documented as EXTERNAL (not faked), exactly like test #5.
</success_criteria>

<output>
Create `.planning/quick/260717-slr-close-the-nx-application-verification-ga/260717-slr-UAT.md`
(primary deliverable) and append the addendum row to
`.planning/phases/28-shipped-tarball-e2e-real-clone-uat/28-04-UAT.md`. No SUMMARY file is
required for this quick task beyond the UAT record itself.
</output>
