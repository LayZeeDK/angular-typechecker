---
phase: 11
phase_name: "fallow-code-quality-ci-gate"
project: "angular-typechecker"
generated: "2026-06-30"
counts:
  decisions: 6
  lessons: 5
  patterns: 5
  surprises: 4
missing_artifacts: []
---

# Phase 11 Learnings: fallow-code-quality-ci-gate

## Decisions

### CI gate output: `--format human`, gated on exit code
The `fallow` CI job runs `npx fallow audit --format human --base origin/main`. The gate is the EXIT CODE (1 on `fail`), not the output format -- so format is a readability choice for the CI log, not a correctness lever.

**Rationale:** A red run's log is read by a human; the human format is more legible than JSON. Empirically verified the exit code is format-independent. (Initial choice was `--format json`; changed 2026-06-30.)
**Source:** 11-CONTEXT.md D-12 (updated), 11-RESEARCH.md

### Resolve current findings, never baseline
The `.fallowrc.jsonc` makes the gate green on adoption by SUPPRESSING verified false positives (with a documented JSONC reason each) and FIXING genuine findings -- `@angular/forms` was removed at source, not ignored. No `--save-baseline`.

**Rationale:** A baseline hides real debt; structural suppression + source fixes keep the gate honest and the tree genuinely clean (0 findings).
**Source:** 11-CONTEXT.md D-02/D-03/D-07, 11-01-SUMMARY.md

### Gate at repo root; `unused-dev-dependencies: off`, `unused-dependencies: error`
Audit the whole repo (not just the published package). Disable the dev-dependency rule (a whole rule, not a rotting ignore-list) because flat-config/CLI tooling deps are structurally untraceable by import graph; keep the prod-dependency rule on.

**Rationale:** Disabling the rule is the correct structural fix for permanent false positives; dev-tooling dep hygiene is owned by `@nx/dependency-checks` + review.
**Source:** 11-CONTEXT.md D-05/D-06

### Exact-pin `fallow@2.103.0` as a root devDependency
Pin exactly (no `^`/`~`), lockfile-pinned, run via `npx fallow` after `npm ci` (never `@latest`).

**Rationale:** Supply-chain mitigation (T-11-01) -- a fallow release cannot silently flip the gate; slopcheck cleared 2.103.0.
**Source:** 11-CONTEXT.md D-11, 11-SECURITY.md T-11-01

### Least-privilege output: no SARIF, no PR-feedback formats (deferred)
Keep the job at top-level `contents: read`. SARIF (`--ci`, needs `security-events: write`) and the PR-feedback formats (`review-github`/`pr-comment-github`, need `pull-requests: write`) are DEFERRED to a later milestone.

**Rationale:** Each format that writes outside the log broadens permissions; the gate's value (exit code + readable log) needs none of them.
**Source:** 11-CONTEXT.md D-12/Deferred Ideas, 11-SECURITY.md T-11-07

### QUAL requirements authored during plan-phase
The ROADMAP deferred Phase 11's requirements ("TBD"); QUAL-01..03 were defined in REQUIREMENTS.md during planning, grounded in the CONTEXT decisions.

**Rationale:** The planner/checker need concrete REQ-IDs to tag and verify against; the orchestrator owns requirement authoring when the roadmap defers it.
**Source:** .planning/REQUIREMENTS.md (QUAL cluster)

---

## Lessons

### fallow 2.x CLI/config surface differs from the older contract
`--json`/`--profile`/`--stdin-files` are REJECTED in 2.103.0; use `--format <fmt>`, `--gate new-only|all`, `--base <ref>`. There is NO `profiles` concept (use `extends` + `overrides` + `--only/--skip`). `fallow init` emits `.fallowrc.json` with JSONC content. Consequently the GSD `code_quality.fallow` structural pre-pass is a SILENT NO-OP on 2.x -- this project gates via the CI job instead.

**Context:** The global CLAUDE.md "Fallow structural pre-pass" note was partly stale; verified live against 2.103.0.
**Source:** 11-DISCUSS-RESEARCH.md

### fallow audits the ROOT package.json, not the published manifest
All dependency findings target the root dev manifest. This is why IN-05 (`publishConfig.provenance`) never reproduced, and why 14 dev-tooling deps surfaced as false positives.

**Context:** Drove the root-scope + `unused-dev-dependencies: off` decision and dropped the planned IN-05 suppression.
**Source:** 11-DISCUSS-RESEARCH.md, 11-RESEARCH.md

### `new-only` attribution needs the base ref's merge-base reachable
`fallow audit --gate new-only --base origin/main` runs a base-snapshot pass; a shallow CI checkout breaks new-vs-inherited attribution. `actions/checkout` with `fetch-depth: 0` is load-bearing (plus `FALLOW_AUDIT_BASE` defensively).

**Context:** Code review WR-01 raised origin/main resolution as a robustness risk; confirmed resolved on the real PR #9 run.
**Source:** 11-RESEARCH.md, 11-REVIEW.md (WR-01), 11-HUMAN-UAT.md item 3

### Output format does not change gating (verified)
`--format human` exits 1 on an introduced finding and 0 on a clean tree -- identical to JSON. The verdict drives the exit code; format only changes stdout.

**Context:** Verified before committing the json->human switch (FAIL case exit 1, PASS case exit 0).
**Source:** this phase's format-switch verification (2026-06-30)

### The GSD decision-coverage gate scans only `must_haves`/`truths`/`objective`
`check.decision-coverage-plan` extracts D-NN citations ONLY from the plan frontmatter `must_haves`/`truths`/`objective` blocks and body sections under those headings -- a top-level frontmatter key (e.g. `decisions_covered:`) is NOT read. To pass, cite each tracked `D-NN` inside `must_haves`.

**Context:** The gate reported 0/15 despite every decision being implemented; resolved by moving the D-NN citations into `must_haves.truths`.
**Source:** plan-phase decision-coverage gate (this session)

---

## Patterns

### Adopt a CI quality gate without a branch-ruleset change
Add a dedicated path-gated SHA-pinned job and wire it into the EXISTING `ci` aggregate's `needs:` + `contains(needs.*.result, ...)` gate. The single required status check stays `ci`, so no protected-branch ruleset edit is needed.

**When to use:** Adding any new blocking CI check to a repo whose merge protection points at one aggregate job.
**Source:** 11-02-PLAN.md, 11-02-SUMMARY.md

### Two-direction gate proof (green-on-clean + red-on-dead-code)
Prove a gate with a clean PR going green AND a throwaway PR (introduced violation) going red -- with the red ISOLATED to the gate job (all other jobs stay green). Delete the throwaway PR/branch after.

**When to use:** Verifying any new CI gate actually blocks, not just that it runs. act's aggregate-gate arithmetic diverges from GitHub, so the real-PR run is authoritative.
**Source:** 11-HUMAN-UAT.md items 1+2 (PR #9 green, throwaway PR #10 red)

### Declare import-graph-invisible code to the analyzer
tsconfig-`files`-only tripwires -> fallow `entry`; contract-mirror shims (enum members / value-pinned consts) -> `overrides` (`unused-enum-members: off`) / `ignoreExports`; intentional test fixtures -> repo-root path `overrides`.

**When to use:** Any reachability-based dead-code analyzer false-positives on build-time tripwires, mirror shims, or out-of-graph fixtures.
**Source:** 11-CONTEXT.md D-04, 11-01-SUMMARY.md

### Single-plan waves run sequentially on the main tree
When a wave has one plan (no parallelism to gain), skip worktree isolation and run on the main checkout -- the executor gets real `node_modules`, and a dependency-changing plan (Pattern B) is satisfied without per-worktree `npm ci`. A later wave then sees the prior wave's committed lockfile naturally.

**When to use:** Any phase whose waves are single-plan, especially when a plan mutates root dependencies.
**Source:** AGENTS.md worktree rules, applied in this phase's execution

### Verify a gate's detector is live before trusting a green
Before relying on a "0 findings / green" gate, confirm the detector actually fires (e.g. `fallow dead-code` returned 24 issues / exit 1 on the bare repo). A green gate over a broken/no-op detector is a false negative.

**When to use:** Adopting any analyzer gate -- distinguish "clean" from "not running".
**Source:** 11-VERIFICATION.md

---

## Surprises

### The CONTEXT fixture glob was wrong (package-prefixed vs repo-root)
The discuss-phase CONTEXT.md scoped the fault-isolation fixtures under `packages/angular-typechecker/fixtures/...`, but they live at the REPO ROOT `fixtures/fault-isolation/`. The wrong glob matches nothing and would leave the gate red.

**Impact:** Caught by both the researcher and the pattern-mapper; CONTEXT.md was corrected to `fixtures/fault-isolation/**` before execution. A discuss-phase path assumption nearly propagated into a broken config.
**Source:** 11-RESEARCH.md, 11-PATTERNS.md, 11-CONTEXT.md correction

### IN-05 (publishConfig as unused_dependency) did not reproduce
The phase-10 review predicted `publishConfig.provenance` would be mislabeled an unused dependency; fallow 2.103.0 never flagged it (it analyzes the root manifest, not the published package).

**Impact:** A planned suppression was dropped as unnecessary -- one fewer config entry, and a reminder to verify expected findings against the actual tool version.
**Source:** 11-DISCUSS-RESEARCH.md

### Decision-coverage gate reported 0/15 despite full implementation
Every locked decision WAS implemented, yet the blocking gate read 0 covered -- because it only scans `must_haves`/`truths`/`objective`, not an arbitrary frontmatter key.

**Impact:** Required relocating the D-NN citations into `must_haves.truths` (after first inspecting the gate's source to learn its match strategy). A passing implementation can still fail a traceability gate on citation placement.
**Source:** plan-phase decision-coverage gate (this session)

### The fallow structural pre-pass added nothing (silent no-op)
`code_quality.fallow.enabled: true` is set, but the GSD structural pre-pass uses fallow's old CLI flags, which 2.x rejects -- it fails open and injects no findings into the code review.

**Impact:** The pre-pass is a wasted invocation on fallow 2.x; the real value comes from the CI job, not the GSD pre-pass. (Fixing the GSD pre-pass was explicitly out of scope.)
**Source:** 11-DISCUSS-RESEARCH.md, global CLAUDE.md note
