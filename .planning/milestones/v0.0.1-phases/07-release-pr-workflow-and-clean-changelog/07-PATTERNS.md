# Phase 7: Release-PR workflow and clean changelog - Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 5 (4 modify, 1 created-at-cut-time)
**Analogs found:** 5 / 5 (every file's analog is the file itself or a sibling in the same repo)

## Orientation (read first)

This is a release-process / config / docs phase. There are NO new source modules. Every
"file touched" is a MODIFICATION to an existing file, so the analog for each is the file
ITSELF -- the executor edits in-style against the current shape. The only genuinely-new
surface is one added `it()` block in an existing spec (whose analog is the sibling
assertions already in that spec) and a per-release CHANGELOG entry (whose analog is the
two curated entries already in CHANGELOG.md).

The locked decisions (D-01..D-17) live in `07-CONTEXT.md`; the runbooks + exact gh-api
bodies live in `07-RESEARCH.md`. This map does NOT re-derive them -- it pins each file to
its analog and extracts the concrete current-state excerpts the executor must edit
in-place or replicate.

## File Classification

| File                                      | Role        | Change                                       | Data Flow                           | Closest Analog                                                          | Match Quality          |
| ----------------------------------------- | ----------- | -------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------- | ---------------------- |
| `nx.json`                                 | config      | modify (1 field)                             | config                              | the existing `release` block (lines 82-97)                              | exact (self)           |
| `.github/workflows/ci.yml`                | config (CI) | modify (add job + gate 2 jobs + rework gate) | event-driven (GH Actions)           | existing job/step shape in ci.yml + SHA-pin convention from release.yml | exact (self + sibling) |
| `AGENTS.md`                               | docs        | modify (rewrite 1 section + checklist)       | docs                                | the current release-mechanics sections (lines 101-168)                  | exact (self)           |
| `CHANGELOG.md`                            | docs        | append (at cut time, not in phase build)     | docs                                | the 0.0.1 / 0.0.2 curated entries (lines 5-39)                          | exact (self)           |
| `e2e/.../src/release-hygiene.int.spec.ts` | test        | modify (add 1 `it`)                          | request-response (fs read + assert) | the sibling `it()` assertions in the same spec (lines 79-94)            | exact (self)           |

Not files (handled outside the repo tree, per CONTEXT/RESEARCH -- no analog needed):

- GitHub rulesets 18229122 / 18229088 / 18229053 -- LIVE config via `gh api` PUT/DELETE (Runbook 2). Not a tracked file.
- The release tag + `gh release create` -- one-time maintainer operations (Runbook 4).
- `.planning/REQUIREMENTS.md` REL-01/02/03 -- planning artifact, add per RESEARCH "Proposed REQUIREMENTS.md text".

## Pattern Assignments

### `nx.json` (config, modify -- exactly one field)

**Analog:** the existing `release` block in the same file.

**The ONLY change (D-01):** in the `git` object, flip `tag: true -> false`. Keep
`commit: true`, `push: false`, and `changelog.workspaceChangelog.createRelease: false`
exactly as-is. Do NOT touch `releaseTag.pattern`, `conventionalCommits`, `preVersionCommand`,
or `projects`.

**Current state to edit** (lines 82-97):

```json
  "release": {
    "projects": ["angular-typechecker"],
    "releaseTag": { "pattern": "angular-typechecker@{version}" },
    "git": {
      "commit": true,
      "tag": true,
      "push": false
    },
    "version": {
      "conventionalCommits": true,
      "preVersionCommand": "npx nx run-many -t build"
    },
    "changelog": {
      "workspaceChangelog": { "createRelease": false }
    }
  }
```

**After the edit, the `git` block reads `{ "commit": true, "tag": false, "push": false }`.**
That is the whole diff. (LANDMINE, already encoded: never set `createRelease: "github"` --
the `release-hygiene` spec at line 93 + AGENTS.md gotcha 3 both guard it.)

---

### `.github/workflows/ci.yml` (config / CI, modify -- add `changes` job, gate `test`+`e2e`, rework `ci` gate)

**Analog:** the existing jobs/steps in this same file (for the job + step + checkout shape)
PLUS `release.yml` for the SHA-pin + comment-block convention. Use Runbook 3 in `07-RESEARCH.md`
for the exact deltas; this section pins the in-repo conventions the new YAML MUST match.

**Convention 1 -- checkout step shape (copy verbatim into the new `changes` job)** (ci.yml lines 56-58, identical at 75, 97, 113):

```yaml
- uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1
  with:
    persist-credentials: false
```

Every checkout in this repo is SHA-pinned with a trailing `# vX.Y.Z` comment AND sets
`persist-credentials: false`. The `dorny/paths-filter` step follows the same pin form:
`dorny/paths-filter@9d7afb8d214ad99e78fbd4247752c4caed2b6e4c # v4.0.0` (RESEARCH-verified SHA).
The trailing inline `# vN` comment is REQUIRED-style and is preserved by the spec's
comment-stripper (it strips only whole-line comments).

**Convention 2 -- the `ci` aggregate gate as it exists today** (ci.yml lines 130-141, the rework target):

```yaml
ci:
  needs: [test, e2e, act-compat, lint-workflows]
  runs-on: ubuntu-latest
  if: always()
  steps:
    - name: Gate
      run: |
        if [ "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') || contains(needs.*.result, 'skipped') }}" = "true" ]; then
          echo "A required job failed, was cancelled, or was skipped"
          exit 1
        fi
        echo "All required jobs succeeded"
```

Rework per D-08 / Runbook 3: add `changes` to `needs`, and DROP `'skipped'` from the
`contains(...)` fail set (keep `failure` + `cancelled`). The job id AND name MUST stay
exactly `ci` (lines 124-130 comment makes this the required-status-check contract -- the
ruleset consumes the name `ci`). Update the echo strings to reflect that path-skip is now
acceptable.

**Convention 3 -- job-gating `if:` MUST use the NEGATIVE form** (this is load-bearing; Pitfall 3).
Gate `test` and `e2e` with `if: ${{ needs.changes.outputs.code != 'false' }}` and
`needs: changes` (merge into `e2e`'s existing single-job needs; `test` currently has no
`needs`). The negative form keeps both jobs in the `act -n` plan when the filter output is
empty under act. Leave `act-compat` and `lint-workflows` UNGATED.

**Convention 4 -- the act-compat contract the new YAML MUST NOT break** (`tools/act/act-compat.sh` lines 110-123):

```bash
PR_PLAN="$(plan pull_request -e "$EVENTS/pull_request.json" --env GITHUB_REF=refs/pull/1/merge)"
assert_selected "$PR_PLAN" "ci/test-" "pull_request"
assert_selected "$PR_PLAN" "ci/e2e" "pull_request"
assert_selected "$PR_PLAN" "ci/act-compat" "pull_request"
assert_selected "$PR_PLAN" "ci/lint-workflows" "pull_request"
assert_selected "$PR_PLAN" "ci/ci" "pull_request"
assert_absent  "$PR_PLAN" "release/publish" "pull_request"
# push-main:
assert_selected "$PUSH_MAIN_PLAN" "ci/test-" "push-main"
assert_selected "$PUSH_MAIN_PLAN" "ci/ci" "push-main"
```

With the negative `if:`, `ci/test-` and `ci/e2e` STAY selected under act (empty output
`!= 'false'` is true). The new `changes` job will additively appear as `ci/changes` in the
plan -- no existing `assert_selected`/`assert_absent` breaks (verified: no assertion forbids
extra jobs). Run `bash tools/act/act-compat.sh` first per RESEARCH assumption A3.

**Convention 5 -- threat-model comment block** (ci.yml lines 1-19): the file opens with a
`# Threat model (...)` block. When adding the `changes` job, keep the same commenting
discipline -- a short `#`-prefixed rationale above the job (mirrors the per-job comments at
lines 35-40, 66-69, 90-93, 109-110, 123-129). The new `dorny/paths-filter` `uses:` must keep
the SHA-pin + `# v4.0.0` form so the spec's 40-char-SHA assertion (lines 162-170) stays green.

---

### `AGENTS.md` (docs, modify -- rewrite gotcha 3 + the checklist; KEEP the bump table + the LANDMINE)

**Analog:** the current release-mechanics sections in this same file. The RESEARCH
"AGENTS.md Rewrite Scope (D-17)" table is authoritative on what KEEPS vs. REWRITES.

**KEEP verbatim / largely as-is (do NOT regress):**

- "Conventional Commits drive the changelog..." + the 0.x bump-shift table (lines 19-99) -- VERIFIED correct against nx 23.0.1. Update only the "Always confirm with a dry run" note (line 72-85) to add that the UNIFIED `npx nx release --dry-run` must be used (the `nx release version` subcommand rejects the top-level `release.git` block).
- Gotcha 1 (pin the literal version, lines 103-113) -- KEEP.
- Gotcha 2 (curate the changelog scope, lines 115-122) -- KEEP + STRENGTHEN (cite that the live dry-run leaks `**06-02:**` plan-id scopes).
- Gotcha 3's LANDMINE sub-block (`createRelease: "github"`, lines 136-154) -- KEEP VERBATIM; it is source-verified.

**REWRITE -- gotcha 3 lead paragraph** (lines 124-134, the core change):

```markdown
3. **The local cut does NOT push; you push the tag, and you create the GitHub Release
   from the curated changelog.** `nx.json` sets `release.git.push: false`, so
   `npx nx release <version> --skip-publish` creates the version commit, the changelog,
   and the tag entirely LOCALLY -- nothing reaches origin until you push. Order:
   (1) cut locally, (2) curate `CHANGELOG.md` and amend it onto the version commit,
   (3) `git push origin angular-typechecker@<version>` ...
```

The OLD text says "cut locally on `main` -> curate -> push the tag from main", AND it claims
the cut CREATES a tag. Both are now wrong. The rewrite must say (per D-01/D-02/D-03/D-05):
the cut happens on a `release/*` branch, `git.tag:false` means the cut creates NO tag at all,
the branch opens a PR (carrying code + `.planning/`, D-07), merges as a MERGE COMMIT (D-04),
then the maintainer tags the MERGE COMMIT `angular-typechecker@x.y.z` (no `v`) and pushes it
to fire the frozen `release.yml`.

**REWRITE -- the "Quick checklist" steps 1-5** (lines 156-168): reorder to the
branch-cut -> dry-run -> curate -> PR -> merge -> tag-merge-commit -> push-tag ->
gh-release sequence; state that the cut no longer creates a tag.

**ADD -- a short note on the Default-branch ruleset:** `main` is now PR-only (empty bypass,
D-06); document the D-12 recovery toggle (admins EDIT the ruleset `enforcement: disabled`,
push the fix, re-enable) so a future agent does not attempt a direct push.

**Process gate:** per AGENTS.md's own rule (lines 6-17), this change is code-review-gated --
the phase `code_review_gate` satisfies it. Reconcile with the `angular-typechecker-release-mechanics`
memory (point 6 already anticipates this) and the CLAUDE.md "nx release configuration norms"
note (post-1.0 mapping vs. AGENTS.md's operative 0.x column -- keep the distinction explicit).

---

### `CHANGELOG.md` (docs, created at cut time -- NOT built in this phase)

**Analog:** the curated `0.0.2` and `0.0.1` entries (lines 5-39). This phase does NOT add a
new entry; it systematizes the curate-in-the-Release-PR discipline (D-13). The entry template
the executor / future cutter must replicate:

**Structure to copy** (the `0.0.2` maintenance-release shape, lines 5-14):

```markdown
## <x.y.z> (<YYYY-MM-DD>)

<one-line prose summary of the release>

<optional narrative paragraph: what + why>

### Compatibility

- Nx 23, Angular 22 (`@angular/compiler-cli` `^22.0.0`), TypeScript `>=6.0.0 <6.1.0`
- Node `^22.22.3 || ^24.15.0 || ^26.0.0`
```

**Feature-release shape** adds `### Features` / `### Fixes` / `### Breaking Changes` sections
above Compatibility (the `0.0.1` entry, lines 22-34, is the model: bold lead-in per bullet,
prose). Every entry ends with a reference-link line:

```markdown
[<x.y.z>]: https://github.com/LayZeeDK/angular-typechecker/releases/tag/angular-typechecker@<x.y.z>
```

(lines 38-39 -- newest first, prepended).

**Hard rule (REL-03 / D-13 / D-15):** the curated section contains NO internal GSD plan-id
scope -- no `feat(NN-NN):`, no `**06-02:**` heading token, no `\b\d{2}(-\d{2})*\b` plan id.
The Compatibility block is MANDATORY (both existing entries carry it). Use release-meaningful
scopes only.

---

### `e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts` (test, modify -- add ONE `it`)

**Analog:** the sibling `it()` blocks in the SAME spec. This is the one genuinely-new test
surface. Map its exact structure from the existing PKG-05 assertion that already reads the
same field family.

**Imports / setup already present (reuse, do NOT re-add)** (lines 1-5, 23-30):

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// ...
const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const nxJsonPath = join(workspaceRoot, 'nx.json');
```

**Exact analog assertion to clone** (lines 79-94 -- the existing `git.push`/`createRelease` test):

```typescript
it('keeps the local-first cut decoupled from push + GitHub release (PKG-05 / D-13)', () => {
  const nx = JSON.parse(readFileSync(nxJsonPath, 'utf8')) as {
    release?: {
      git?: { push?: boolean };
      changelog?: { workspaceChangelog?: { createRelease?: unknown } };
    };
  };

  expect(nx.release?.git?.push).toBe(false);
  expect(nx.release?.changelog?.workspaceChangelog?.createRelease).toBe(false);
});
```

**New `it` to ADD (REL-01, Wave 0)** -- same structure, widen the inline type to include
`tag` and assert `git.tag === false`. Place it inside the existing
`describe('PKG-03: nx release is scoped to angular-typechecker only', ...)` block (lines 60-95),
adjacent to the push/createRelease test. Replicate the style exactly:

- `const nx = JSON.parse(readFileSync(nxJsonPath, 'utf8')) as { release?: { git?: { tag?: boolean } } };`
- `expect(nx.release?.git?.tag).toBe(false);`
- Comment in the same voice as line 88-91 (explain WHY: the cut must not create a tag; the
  maintainer tags the merge commit post-PR per D-01/D-03).

**Optional second `it` (REL-03 backstop, Claude's discretion per RESEARCH Q2):** a
CHANGELOG-no-plan-id-scope assertion. Follow the SAME read-and-regex pattern the spec already
uses for the release workflow (lines 117-126, 155-170) -- read the file, run a regex, assert.
Read `CHANGELOG.md` and assert the latest section contains no `\b\d{2}(-\d{2})*\b` plan-id
token / no `**\d\d` heading. Add `const changelogPath = join(workspaceRoot, 'CHANGELOG.md');`
alongside the other path consts (lines 30-38) if implemented.

**Style conventions enforced across this spec (match them):**

- Each `it` re-reads the file fresh inside the test (no shared parsed state) -- see lines 62, 70, 80.
- Inline-typed `JSON.parse(...) as { release?: ... }` rather than an imported type.
- A leading comment per non-obvious assertion explaining the threat/decision it guards.
- YAML/text invariants asserted with string/regex (`toMatch`/`toContain`), NOT a YAML parser
  (lines 16-18 rationale) -- but `nx.json` is parsed with `JSON.parse` (it is JSON).

## Shared Patterns

### SHA-pinned action references (applies to: `ci.yml`)

**Source:** `ci.yml` lines 56-59 / `release.yml` lines 56-59; enforced by
`release-hygiene.int.spec.ts` lines 155-170.

```yaml
- uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1
  with:
    persist-credentials: false
```

Every `uses:` is a full 40-char commit SHA with a trailing `# vX.Y.Z` comment. The new
`dorny/paths-filter@9d7afb8d214ad99e78fbd4247752c4caed2b6e4c # v4.0.0` MUST follow this exact
form or the SHA-pin assertion fails. (Note: that assertion currently runs against `release.yml`
only -- but actionlint + the SHA-pin discipline still apply to ci.yml; keep the form.)

### Read-file-and-assert regression pattern (applies to: `release-hygiene.int.spec.ts`)

**Source:** `release-hygiene.int.spec.ts` -- `readFileSync(path, 'utf8')` then `JSON.parse`
(for nx.json, lines 62/70/80) or `toMatch`/`toContain` (for YAML/text, lines 117-206), with a
fresh read inside each `it`. New assertions clone this exactly.

### Curated-changelog discipline (applies to: `CHANGELOG.md`, `AGENTS.md`, GitHub Release)

**Source:** `CHANGELOG.md` 0.0.1/0.0.2 entries (lines 5-39) + AGENTS.md gotcha 2 (lines 115-122).
Prose summary + (Features/Fixes/Breaking) + mandatory Compatibility block + reference-link
line; NO plan-id scopes. The GitHub Release notes reuse this exact section via
`gh release create ... --notes-file <section>` (never `--generate-notes`, D-14).

### Threat-model comment header (applies to: `ci.yml`)

**Source:** `ci.yml` lines 1-19 + `release.yml` lines 1-24. New CI jobs carry a short
`#`-prefixed rationale comment in the same voice (least-privilege, SHA-pin, why-this-shape).

## No Analog Found

None. Every in-repo file change has its analog as the file itself or a sibling in the same
repo. The non-file operations (ruleset PUT/DELETE, manual tag, `gh release create`) are
out-of-tree live/maintainer operations fully specified by Runbooks 2 and 4 in `07-RESEARCH.md`
-- they need no code-analog mapping.

## Metadata

**Analog search scope:** repo root (`nx.json`, `AGENTS.md`, `CHANGELOG.md`),
`.github/workflows/` (`ci.yml`, `release.yml`), `e2e/angular-typechecker-install-e2e/src/`
(`release-hygiene.int.spec.ts`), `tools/act/` (`act-compat.sh` -- the act-compat contract).
**Files scanned:** 6 read in full / targeted.
**Pattern extraction date:** 2026-06-29
