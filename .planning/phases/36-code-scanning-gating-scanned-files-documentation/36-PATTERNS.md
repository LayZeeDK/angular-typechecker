# Phase 36: Code Scanning gating + Scanned-files documentation - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 5 (2 CI/config, 2 test, 2 docs -- one file is both edited AND guarded)
**Analogs found:** 5 / 5 (all in-repo; every target mirrors an existing sibling)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.github/workflows/ci.yml` (MODIFY) | CI workflow | event-driven (GitHub Actions) | itself -- `cve-lite` job block (`ci.yml:354-383`) | exact (same file, sibling job) |
| `ci-e2e-coverage-guard.spec.ts` (EXTEND, add `describe`) | test / static drift guard | file-I/O (fs read + regex) | GUARD-01f in the same file (`:433-481`) | exact (same file, reuse `extractJobLines`) |
| `code-scanning-docs.spec.ts` (NEW) | test / docs content-tripwire | file-I/O (fs read + `.toContain`) | `angular-cli-docs.spec.ts` (whole file) | exact (`*-docs.spec.ts` family) |
| `packages/angular-typechecker/README.md` (MODIFY) | docs (shipped) | prose | `### SARIF and GitHub Code Scanning` + `#### Run from the repository root` (`README.md:694-722`) | exact (extend the same section) |
| `AGENTS.md` (MODIFY) | docs (repo-governance) | prose | `## The default-branch ruleset: main is PR-only` + Lockout recovery (`AGENTS.md:224-241`) | exact (extend the same sections) |

**Reuse-not-reinvent (ponytail):**
- The drift guard is a NEW `describe` block appended to `ci-e2e-coverage-guard.spec.ts`, NOT a new file -- `extractJobLines` is a private in-file helper reused directly (no export needed).
- The unit vitest config is `packages/angular-typechecker/vitest.config.mts` (resolves RESEARCH open-question #1). No config edit needed -- new/extended specs auto-ride `nx test angular-typechecker`.
- No new dependency, no YAML/Markdown parser -- all assertions are line-level regex / normalized-whitespace `.toContain` (the repo's standing no-parser precedent).

---

## Pattern Assignments

### `.github/workflows/ci.yml` (CI workflow, event-driven) -- 4 edits

**Analog:** itself. Every edit mirrors an existing sibling in the same file.

#### Edit 1 -- extend the `ci` aggregate `needs[]` (D-02, GATE-01)

Current (`ci.yml:729-743`), NO change to the `if: always()` / Gate step body:

```yaml
  ci:
    needs:
      [
        changes,
        discover,
        test,
        e2e,
        e2e-windows,
        fallow,
        cve-lite,
        format-lint,
        act-compat,
        lint-workflows,
        scoped-name-guard,
      ]
```

Append the two jobs (order cosmetic):

```yaml
        scoped-name-guard,
        code-scanning,
        code-scanning-proof,
      ]
```

The Gate step (`ci.yml:746-753`) is UNCHANGED -- it already drops `skipped` from the fail set, so a path-skipped `code-scanning-proof` on a planning-only PR does not deadlock:

```yaml
    steps:
      - name: Gate
        run: |
          if [ "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}" = "true" ]; then
            echo "A required job failed or was cancelled"
            exit 1
          fi
          echo "All required jobs succeeded or were intentionally path-skipped"
```

#### Edit 2 -- remove the `code-scanning` path-gate (D-01, GATE-02)

Remove exactly `ci.yml:541`. Leave `needs: changes` (harmless; minimal diff -- see RESEARCH Section 1 / open-question #2):

```yaml
  code-scanning:
    needs: changes
    if: ${{ needs.changes.outputs.code != 'false' }}   # <-- DELETE THIS LINE ONLY
    runs-on: ubuntu-latest
```

`code-scanning-proof` `if:` (`ci.yml:656`) STAYS UNCHANGED (D-01a):

```yaml
  code-scanning-proof:
    needs: changes
    if: ${{ github.event_name == 'pull_request' && needs.changes.outputs.code != 'false' }}
```

#### Edit 3 -- add the D-03 `produced==true` assertion steps (GATE-01 contract)

**Existing `produced` guard to layer on top of** (`ci.yml:570-593`, the step that sets the output the assertion reads):

```yaml
      - id: atc-sarif
        run: |
          node tools/ci/merge-sarif.mjs || true
          if [ -s angular-typechecker.sarif ]; then echo "produced=true" >> "$GITHUB_OUTPUT"; else echo "produced=false" >> "$GITHUB_OUTPUT"; fi
```

**Fork-gate expression to mirror** (`ci.yml:601`, the exact non-fork + produced idiom already used by the upload step):

```yaml
        if: ${{ (github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false) && steps.atc-sarif.outputs.produced == 'true' }}
```

Add two NEW pure-`if:`-gated steps (RESEARCH Section 2 draft) after the two generation steps. Pure `if:` gating + static `echo`/`exit 1` body = NO step output interpolated into a shell (satisfies the no-command-injection invariant):

```yaml
      - name: Assert angular-typechecker SARIF was produced (non-fork PR)
        if: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork == false && steps.atc-sarif.outputs.produced == 'false' }}
        run: |
          echo "::error::angular-typechecker produced no SARIF on a non-fork PR. ..."
          exit 1
      - name: Assert fallow SARIF was produced (non-fork PR)
        if: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork == false && steps.fallow-sarif.outputs.produced == 'false' }}
        run: |
          echo "::error::fallow produced no SARIF on a non-fork PR. ..."
          exit 1
```

Note the fork test differs from Edit-3's upload gate: the assertion uses `github.event_name == 'pull_request' && ... fork == false` (fires ONLY on non-fork PRs); the upload gate uses `github.event_name != 'pull_request' || ... fork == false` (fires on push OR non-fork PR). The `!= 'false'` <-> the assertion's `== 'false'` are inverse conditions -- do not copy the upload gate verbatim.

#### Edit 4 -- rewrite three comment blocks (D-05, GATE-01 rationale)

**Precedent to MIRROR -- the `cve-lite` divergence block** (`ci.yml:354-369`): the canonical "this IS a required merge gate at the maintainer's request, INTENTIONALLY diverges from the code-scanning 'never a merge gate' stance" prose, with its accepted-tradeoff list + the `enforcement`-toggle recovery pointer:

```yaml
  # Dependency vulnerability gate (quick-260720-wso). Runs OWASP cve-lite-cli's
  # lockfile scan against OSV and FAILS the PR on any high-or-critical advisory
  # (`npm run cve-lite` = `cve-lite . --fail-on high`). Unlike the ADDITIVE
  # `code-scanning` job below, this IS a required merge gate (listed in the `ci`
  # aggregate's needs) at the maintainer's request -- it INTENTIONALLY diverges
  # from the code-scanning "never a merge gate" stance. Accepted tradeoffs on the
  # PR-only, empty-bypass `main`: (1) an OSV.dev outage or a newly-published
  # high/critical advisory with no available fix can block the merge button --
  # recover by toggling the branch ruleset enforcement (AGENTS.md "Lockout
  # recovery"). (2) cve-lite-cli is pinned EXACTLY as a devDependency so a future
  # upstream publish cannot silently enter CI; ...
```

**Comment to REWRITE 4a -- the `code-scanning` "DELIBERATELY NOT"** (`ci.yml:493-497`, now FALSE after Edit 1):

```yaml
  # DELIBERATELY NOT in the `ci` aggregate's needs: SARIF upload is additive
  # reporting, never a merge gate. The real gates stay put -- angular-typechecker's
  # whole-repo type-check runs in `test`, fallow's new-only verdict gates in
  # `fallow`. Keeping this job out of `ci` means a Code Scanning outage or a fork-PR
  # upload skip can NEVER deadlock the PR-only merge button.
```

Rewrite to mirror the cve-lite block: state it IS NOW a required member (GATE-01), reversing the prior exclusion; safe because (a) un-path-gated -> analysis on every PR, (b) fork-PR upload skips but job succeeds, (c) `|| true` -> only infra break fails, (d) the D-03 assertion fails on a silent empty SARIF; accepted tradeoff = a Code Scanning outage can block the button -> `enforcement: disabled` recovery (AGENTS.md "Lockout recovery").

**Comment to REWRITE 4b -- the `code-scanning-proof` "DELIBERATELY NOT"** (`ci.yml:649-650`, also now FALSE):

```yaml
  # DELIBERATELY NOT in the `ci` aggregate's needs (D-02d) -- exactly like the dogfood
  # `code-scanning` job. Promoting it into the required merge gate is GATE-01 / Phase 36.
```

Rewrite: it IS NOW a member (GATE-01 / Phase 36) -- a real SARIF -> Code Scanning contract regression (PROOF-02) now fails the required `ci` check; stays PR-only + path-gated (D-01a) so on a planning-only PR / push it resolves to `skipped`, which the aggregate drops.

**Security invariants preserved verbatim (do NOT change):** SHA-pinned `upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1`, `persist-credentials: false`, job-scoped `security-events: write` + `contents: read`, fork-PR upload skip, no PR-metadata in any shell.

---

### `ci-e2e-coverage-guard.spec.ts` (EXTEND -- static drift guard, file-I/O)

**Analog:** GUARD-01f in the SAME file (`:433-481`). Add a new `describe('GATE-01/02: ...')` block; reuse the private `extractJobLines` helper directly (no export).

**The reused helper** (`ci-e2e-coverage-guard.spec.ts:110-133`) -- the no-parser line-level job slicer:

```typescript
function extractJobLines(ci: string, jobName: string): string[] {
  const lines = ci.split('\n');
  const start = lines.findIndex((line) =>
    new RegExp(`^ {2}${jobName}:\\s*$`).test(line),
  );

  if (start === -1) {
    throw new Error(
      `GUARD: could not locate the \`${jobName}:\` job in .github/workflows/ci.yml`,
    );
  }

  let end = lines.length;

  for (let index = start + 1; index < lines.length; index++) {
    if (/^ {2}[a-z0-9-]+:\s*$/.test(lines[index])) {
      end = index;

      break;
    }
  }

  return lines.slice(start, end);
}
```

**The ci-needs membership assertion to MIRROR** (GUARD-01f, `:466-473`) -- reads the `ci` block, asserts a job name appears:

```typescript
  it('`e2e-windows` is a dependency of the `ci` aggregate job (a Windows failure fails the required gate)', () => {
    const ciBlock = extractJobLines(ci, 'ci').join('\n');

    expect(
      /^(?!\s*#).*\be2e-windows\b/m.test(ciBlock),
      "GUARD-01f: `e2e-windows` must appear in the `ci` aggregate job `needs` list, ...",
    ).toBe(true);
  });
```

**CRITICAL substring trap (RESEARCH Pitfall 4):** GUARD-01f's `\be2e-windows\b` works because nothing is a superset of `e2e-windows`. `code-scanning` IS a substring of `code-scanning-proof`, so `\bcode-scanning\b` would match BOTH -- a membership assert for `code-scanning` alone would pass even if only the proof job is listed. Anchor on the full list-item line instead:

```typescript
const ciBlock = extractJobLines(ci, 'ci').join('\n');
expect(/^\s*code-scanning,\s*$/m.test(ciBlock)).toBe(true);
expect(/^\s*code-scanning-proof,\s*$/m.test(ciBlock)).toBe(true);
```

**The un-path-gate assertion** (RESEARCH Wave 0) -- the `code-scanning` block must have NO `needs.changes.outputs.code` `if:` (the `^(?!\s*#)` prefix excludes comment lines, same idiom as every other scan in this file):

```typescript
expect(
  /^(?!\s*#).*if:\s*\$\{\{\s*needs\.changes\.outputs\.code/m.test(
    extractJobLines(ci, 'code-scanning').join('\n'),
  ),
).toBe(false);
```

**`ci` const read at top of the `describe`** (GUARD-01f `:434-437`) -- mirror:

```typescript
  const ci = readFileSync(
    join(workspaceRoot, '.github', 'workflows', 'ci.yml'),
    'utf8',
  );
```

Optional (D-05 latitude): assert the D-03 step exists + is non-fork-PR gated -- match the `code-scanning` block for a step `if:` referencing `github.event.pull_request.head.repo.fork == false` and `steps.atc-sarif.outputs.produced`.

---

### `code-scanning-docs.spec.ts` (NEW -- docs content-tripwire, file-I/O)

**Analog:** `angular-cli-docs.spec.ts` (whole file). New file fits the established `*-docs.spec.ts` family (`storybook-docs`, `angular-cli-docs`, `standalone-cli-docs`, `machine-readable-docs`). Lands in `packages/angular-typechecker/src/`, auto-rides `nx test angular-typechecker`.

**Header + normalized-whitespace setup to MIRROR** (`angular-cli-docs.spec.ts:1-24`):

```typescript
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const readmePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../README.md',
);
const readme = readFileSync(readmePath, 'utf8');
const normalized = readme.replace(/\s+/g, ' ');
```

**The `.toContain` assertion shape to MIRROR** (`angular-cli-docs.spec.ts:26-43`) -- exact heading on the raw string, claims on the normalized string (survives prose re-wrapping):

```typescript
describe('README ## Angular CLI section (docs tripwire)', () => {
  it('has an Angular CLI section heading', () => {
    expect(readme).toContain('## Angular CLI');
  });

  it('states the ng add auto-wire-all claim (every app + library)', () => {
    expect(normalized).toContain(
      'wires a `typecheck` target into every `application` and `library` project',
    );
  });
});
```

**DOC-01 assertions to write** (RESEARCH Section 6.3):
- `expect(readme).toContain('### SARIF and GitHub Code Scanning')`
- `expect(normalized).toContain('Scanned files')`
- `expect(normalized).toContain('a GitHub limitation')` (or `'not a defect'`)
- `expect(normalized).toContain('CodeQL')`
- `expect(normalized).toContain('run.artifacts')` (locks the spike evidence)

**Coverage nuance (flag for planner):** the `test` target is path-gated on `code`, so a README-only PR (`*.md` -> `code=false`) skips `test` and this tripwire. This is the SAME coverage the other `*-docs.spec.ts` tripwires already have (precedent -- accept parity). Phase 36's own PR touches `ci.yml` (`code=true`), so the tripwire IS exercised this phase. If README-only-PR coverage is wanted, promote into the always-run `scoped-name-guard` target -- otherwise mirror precedent (lazy-correct).

---

### `packages/angular-typechecker/README.md` (MODIFY -- shipped docs)

**Analog + home:** the existing `### SARIF and GitHub Code Scanning` section. Heading at `README.md:694`; the `#### Run from the repository root` sub-subsection at `:716-722`; the next `## Storybook` heading at `:724`. DOC-01 goes AFTER line 722, BEFORE line 724 (as a new `####` sub-subsection or a paragraph -- D-05 latitude).

**Sibling `####` sub-subsection shape to mirror** (`README.md:716-722`):

```markdown
#### Run from the repository root

Each result's `artifactLocation.uri` is made relative to the directory the check
runs in. Run angular-typechecker from the repository root so those URIs stay
repo-relative and GitHub Code Scanning can match each alert to the file in your
source tree. ...
```

**DOC-01 draft (RESEARCH Section 6.2, end-user language, no Issue filed):**

```markdown
#### The "Scanned files" panel stays empty (a GitHub limitation)

On an alert's detail page, GitHub shows a "Scanned files" tool-status panel. For
angular-typechecker -- and for any third-party SARIF tool -- that panel stays
empty. This is a GitHub limitation, not a defect ... GitHub fills "Scanned files"
only from its own CodeQL analysis telemetry ... Emitting the optional SARIF
`run.artifacts` list does not change it: the panel ignores it. ...
```

End-user language per the repo's "CHANGELOG + README must be end-user-facing" rule -- NO board/phase/G-gate jargon. This is the ONLY changed file in the package `files` allowlist; the additive audit vs `@0.2.3` must show ONLY this additive prose delta.

---

### `AGENTS.md` (MODIFY -- repo-governance docs)

**Analog + home:** the existing ruleset sections. `## The default-branch ruleset: main is PR-only` at `AGENTS.md:224`; the Release-tag-ruleset note at `:233`; `**Lockout recovery (the cost of the empty bypass):**` at `:236-241`; next section `## Parallel execution in git worktrees` at `:243`. The GATE-02 runbook extends AFTER line 241, BEFORE line 243.

**The sections to extend** (`AGENTS.md:224-241`):

```markdown
## The default-branch ruleset: `main` is PR-only

`main` is governed by an active "Default branch" ruleset with an EMPTY bypass list -- even
the repository owner cannot push directly to `main`. Every change (code AND `.planning/`)
reaches `main` only through a PR that satisfies the required status checks (`ci` plus the
CodeQL `Analyze (actions)` / `Analyze (javascript-typescript)` checks). ...

**Lockout recovery (the cost of the empty bypass):** if the required `ci` check ever goes
red or stops reporting and the merge button is blocked, recover by EDITING the ruleset --
repo admins can edit a ruleset even though they cannot bypass it. Toggle the ruleset's
`enforcement` to `disabled`, push the fix, then re-enable `enforcement: active`. Prefer this
temporary enforcement toggle over adding a standing bypass actor ...
```

**Runbook content to add** (RESEARCH Section 4, fixed order): (1) add "Require code scanning results" to the `main` ruleset, "Add tool" for BOTH `angular-typechecker` AND `fallow`, conservative alert threshold (existence gate, not a 2nd findings gate); (2) Evaluate mode FIRST; (3) probe a `.planning/`-only PR AND a code PR, confirm neither is blocked in Ruleset Insights; (4) flip to Active; (5) recovery = `enforcement: disabled` toggle (reuse the Lockout-recovery pointer above); (6) fork-PR deadlock DOCUMENTED as accepted (read-only token -> no upload -> no analysis -> blocked).

**MUST be code-reviewed:** the self-governance rule at the top of AGENTS.md requires any AGENTS.md change be code-reviewed -- satisfied by the phase's `code_review_gate`. Flag this explicitly in the plan.

---

## Shared Patterns

### No-comment-line regex anchor (ci.yml text scans)
**Source:** every ci.yml scan in `ci-e2e-coverage-guard.spec.ts` (e.g. `:194`, `:443`, `:470`)
**Apply to:** the new drift-guard block
The `^(?!\s*#).*<needle>` prefix excludes YAML comment lines so a block's own PROSE (which names the same jobs) cannot false-satisfy an assertion. Load-bearing here because the new block's comments will mention `code-scanning`.

```typescript
/^(?!\s*#).*\brun-many\s+-t\s+e2e\b/m.test(e2eBlock)
```

### Anti-vacuous-green + fail-loud located message
**Source:** `extractJobLines` throws on a missing job (`:116-120`); every `expect(...)` carries a located message string
**Apply to:** the new drift-guard block
A deleted job makes `extractJobLines` throw (loud), so no membership assertion is a tautology. Give each `expect` a message naming the requirement id + what silently breaks if it regresses.

### Normalized-whitespace `.toContain` docs tripwire
**Source:** `angular-cli-docs.spec.ts:24` (`readme.replace(/\s+/g, ' ')`)
**Apply to:** the new `code-scanning-docs.spec.ts`
Assert the exact heading on the RAW string, claims on the NORMALIZED string -- locks the claim, survives prose re-wrapping. Pure fs read, no Markdown parser.

### Workspace-root / README path resolution
**Source:** drift guard uses `findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)))` (`:44-46`); docs tripwire uses `join(dirname(fileURLToPath(import.meta.url)), '../README.md')` (`angular-cli-docs.spec.ts:19-22`)
**Apply to:** both new specs -- use the docs pattern for the README-relative read (the spec sits in `src/`, README is one level up).

### Pure-`if:`-gated step (no shell interpolation)
**Source:** the fork-gated upload steps (`ci.yml:601`, `:610`); the proof job's env-not-shell pattern (`:706-712`)
**Apply to:** the D-03 assertion steps
Gate on a pure `if:` expression evaluated by the Actions engine; keep the `run:` body a static `echo`/`exit 1`. NOTHING (no step output, no PR metadata) is interpolated into a shell -- satisfies the top-of-file no-command-injection invariant verbatim.

---

## No Analog Found

| Item | Role | Data Flow | Reason |
|------|------|-----------|--------|
| GATE-02 ruleset toggle on `main` | GitHub repo settings | out-of-band (human) | Not a file -- it mutates GitHub-side repo state (the `main` ruleset), captured by NO committed file. By design (D-04) the agent ships only the AGENTS.md runbook (which DOES have an analog above); a human maintainer performs the toggle. Provable only in real CI on GitHub. |

All five committed/edited files have exact in-repo analogs.

## Metadata

**Analog search scope:** `.github/workflows/ci.yml`; `packages/angular-typechecker/src/*.spec.ts` (drift-guard + docs-tripwire families); `packages/angular-typechecker/README.md`; `AGENTS.md`.
**Files scanned:** 5 analog files read (ci.yml 340-754, ci-e2e-coverage-guard.spec.ts full, angular-cli-docs.spec.ts full, README.md 685-739, AGENTS.md 218-249) + 1 glob confirming spec-file family + `vitest.config.mts`.
**Pattern extraction date:** 2026-07-22
