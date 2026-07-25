---
quick_id: 260725-73m
title: Handle Dependabot #46 (actions/setup-node 6.4.0 -> 7.0.0) + migrate CodeQL to advanced setup
date: 2026-07-25
status: complete
sources: GitHub Docs (primary), GitHub starter-workflows (primary), live repo API evidence
---

# Research: Dependabot #46 and the CodeQL default-setup deadlock

## 1. Why Dependabot PR #46 can never merge (proven)

`main` requires three status checks (ruleset 18229122, `required_status_checks`,
`strict_required_status_checks_policy: true`), all from integration_id 15368
(verified = the `github-actions` app):

- `Analyze (actions)`
- `Analyze (javascript-typescript)`
- `ci`

PR #46 has `ci` SUCCESS and 24 other green checks, but **neither `Analyze (*)` check
exists**, so it is permanently `BLOCKED`. The `CodeQL` check is `NEUTRAL` with:

> **Warning**: Code scanning cannot determine the alerts introduced by this pull
> request, because 2 configurations present on `refs/heads/main` were not found:
> Default setup: `/language:actions`, `/language:javascript-typescript`

### Controlled comparison (the decisive evidence)

| PR | Author | Workflow runs on head SHA | `Analyze (*)` checks |
| --- | --- | --- | --- |
| #65 | LayZeeDK | `ci` + `PR #65` | both present |
| #64 | LayZeeDK | `ci` + `PR #64` | both present |
| #59 | app/dependabot | `ci` only | none |
| #46 | app/dependabot | `ci` only | none |

The CodeQL default-setup run on a maintainer PR is:

```
event: "dynamic"   path: "dynamic/github-code-scanning/codeql"   name: "PR #65"
```

On Dependabot PRs that run is never created at all.

## 2. Mechanism, against primary sources

**GitHub Docs -- Troubleshooting Dependabot on GitHub Actions:**

> workflow runs that are triggered by Dependabot from `push`, `pull_request`,
> `pull_request_review`, or `pull_request_review_comment` events are treated as if
> they were opened from a repository fork

> they receive a read-only `GITHUB_TOKEN` and do not have access to any secrets that
> are normally available

**GitHub Docs -- code scanning troubleshooting, "Resource not accessible by integration":**

> code scanning always allows uploading of results when the `pull_request` event
> triggers the action run

> Dependabot is considered untrusted when it triggers a workflow run, if the workflow
> will run with read-only scopes

> for Dependabot branches, we recommend you use the `pull_request` event instead of the
> `push` event

**Synthesis.** The documented upload exemption is scoped to the `pull_request` event.
CodeQL default setup runs as event `dynamic`, which is not `pull_request`, so the
exemption does not cover it and a Dependabot-triggered default-setup run is untrusted.
Empirically GitHub does not schedule it at all.

This is corroborated in the opposite direction inside this repo: `ci.yml`'s
`code-scanning` job runs on `pull_request` with an explicit `security-events: write`,
and it **did** upload `angular-typechecker` + `fallow` SARIF successfully on Dependabot
PR #46 (analyses recorded 2026-07-25T02:58:33Z for `refs/pull/46/merge`).

**Honest limit.** GitHub does not document "default setup skips Dependabot PRs" in any
page located. The *effect* is proven by the controlled comparison above; the *reason* is
inference from the documented pieces.

**Correction to AGENTS.md (IN SCOPE -- user instruction 2026-07-25).** The GATE-02
section's item 6 (`AGENTS.md:304-308`) treats the fork-PR block as an accepted limitation
whose mechanism is "a fork PR gets a read-only token, so the upload steps skip -> no
analysis", and concludes "Un-path-gating the dogfood job cannot fix forks -- the token is
read-only." Both claims are false:

- The read-only token does NOT suppress SARIF upload. Code scanning "always allows
  uploading of results when the `pull_request` event triggers the action run".
- Proven in this repo: Dependabot PR #46 is treated as a fork per the docs above, yet its
  `ci.yml` `code-scanning` job uploaded `angular-typechecker` + `fallow` SARIF
  successfully (`refs/pull/46/merge`, 2026-07-25T02:58:33Z).

The actual cause of the block was CodeQL **default setup** running as event `dynamic`,
which falls outside the `pull_request` exemption -- so its `Analyze (*)` checks never
reported. The advanced-setup migration in this task moves CodeQL onto `pull_request` and
therefore removes the cause.

Item 6 must be rewritten to state the true mechanism.

### CORRECTION to the above (2026-07-25, caught by the mandated AGENTS.md code review)

Two claims in the paragraphs above were themselves OVERSTATED. Both were fixed in commit
`3e9bf87`; recorded here so this file does not remain a source of the same error:

1. **A Dependabot PR is NOT a fork PR.** `gh api .../pulls/46` -> `head.repo.fork: false`,
   `head.label: LayZeeDK:dependabot/...` -- Dependabot's branch lives in THIS repo. GitHub's
   docs scope "treated as if they were opened from a repository fork" to token + secrets ONLY;
   it does NOT set `github.event.pull_request.head.repo.fork`, which is the only fork test this
   repo applies. So PR #46 took the NON-fork path and proves only the TOKEN half: a read-only
   token alone does not suppress a `pull_request`-triggered SARIF upload.

2. **Real external fork PRs remain deterministically blocked, and the OLD item 6 was right in
   OUTCOME.** `ci.yml:646` and `ci.yml:655` gate BOTH SARIF uploads on
   `github.event.pull_request.head.repo.fork == false`. On a genuine fork PR the scan runs but
   nothing uploads, so no `angular-typechecker` analysis exists -- and `angular-typechecker` is a
   REQUIRED tool of GATE-02. The block is real; only the old text's GitHub-level MECHANISM (that
   GitHub itself would reject the upload) was wrong. Whether GitHub would ACCEPT a fork-PR upload
   is untested here precisely because our own gate prevents the attempt.
   **Do NOT remove ci.yml's fork gates on the strength of the #46 result.**

Also corrected: the causal chain "`dynamic` is outside the `pull_request` exemption, SO GitHub
never scheduled the run" is a NON-SEQUITUR -- the exemption governs upload PERMISSION, not run
SCHEDULING. The EFFECT (no run on a Dependabot ref) is proven by the controlled comparison; the
REASON is inference, exactly as section 2 of this file already said.

The exact GitHub Docs wording is "always allows **the** uploading of results when the
`pull_request` event triggers the action run" -- earlier drafts here, in AGENTS.md, in
`codeql.yml`, and in user-facing summaries dropped the "the" from inside the quotation marks.

Evidence boundary, restated correctly: the Dependabot fix is PROVEN in effect; real forks are
PROVEN still blocked (by our own gate); what is UNTESTED is whether GitHub would accept a
fork-PR upload if that gate were removed.

## 3. The fix: CodeQL advanced setup

GitHub's own remedy for Dependabot branches is the `pull_request` event, which is exactly
what advanced setup gives you. The official template
(`actions/starter-workflows`, `code-scanning/codeql.yml`) is:

```yaml
name: "CodeQL Advanced"
on:
  push:
    branches: [ $default-branch, $protected-branches ]
  pull_request:
    branches: [ $default-branch, $protected-branches ]
  schedule:
    - cron: $cron-weekly
jobs:
  analyze:
    name: Analyze (${{ matrix.language }})
    runs-on: ${{ (matrix.language == 'swift' && 'macos-latest') || 'ubuntu-latest' }}
    permissions:
      security-events: write
      packages: read
      actions: read
      contents: read
    strategy:
      fail-fast: false
      matrix:
        $codeql-languages-matrix
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
    - name: Initialize CodeQL
      uses: github/codeql-action/init@v4
      with:
        languages: ${{ matrix.language }}
        build-mode: ${{ matrix.build-mode }}
    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v4
      with:
        category: "/language:${{matrix.language}}"
```

Why this satisfies the existing ruleset with **no ruleset edit**:

- Job `name: Analyze (${{ matrix.language }})` renders `Analyze (actions)` and
  `Analyze (javascript-typescript)` -- byte-identical to the required contexts.
- Those checks come from the `github-actions` app (id 15368), the same app that already
  produces `ci` and today's `Analyze (*)` checks. Verified via the check-runs API.

### Current default setup config (to reproduce)

```
state: configured
languages: ["actions", "javascript", "javascript-typescript", "typescript"]
query_suite: default
```

The analyses actually produced on `main` are only two -- `/language:actions` and
`/language:javascript-typescript` (`javascript`/`typescript` are aliases), both with
`build-mode: none`, `runner: ubuntu-latest`. So the matrix is
`[actions, javascript-typescript]` with `build-mode: none`.

### LOAD-BEARING HAZARD: the migration orphans the CodeQL config

The `code_scanning` ruleset rule requires tools `CodeQL` (thresholds
`errors` / `high_or_higher`) and `angular-typechecker` (`none` / `none`). Per the
AGENTS.md GATE-02 runbook the gate matches a required tool by its
`(analysis_key, category, environment)` tuple, not by tool name.

Migrating default -> advanced changes `analysis_key`:

```
dynamic/github-code-scanning/codeql:analyze   ->   .github/workflows/codeql.yml:analyze
```

while `category` stays `/language:actions` / `/language:javascript-typescript`. The old
default-setup tuple therefore becomes an **orphaned config on `main`** -- a tuple the
gate still expects that no future upload can reproduce. Per the runbook that blocks
EVERY PR permanently with "configuration not found", and "configuration not found" is
PERMANENT for an orphaned config (transient only for a live one). This is the same
failure spike 012 diagnosed.

Mitigation (required, from the runbook): after the migration lands on `main` and the new
advanced-setup analyses exist, delete the orphaned default-setup CodeQL analyses via
`DELETE /repos/{owner}/{repo}/code-scanning/analyses/{id}`, following each response's
`next_analysis_url` for ordering; the LAST analysis in a set needs
`?confirm_delete=true`.

### Sequencing hazard: identical categories collide

The template's `category: "/language:${{matrix.language}}"` is the SAME category default
setup uses. If both configurations run on the same ref simultaneously the uploads
collide. GitHub's documented switch procedure disables default setup first:

> If you are switching from default setup to advanced setup, in the "CodeQL analysis"
> row, select [menu icon], then click "Switch to advanced". In the pop-up window that
> appears, click "Disable CodeQL".

Disabling default setup is a repository security-configuration change on the gate that
guards `main` -- a HUMAN action, like the ruleset toggles. The agent must not perform it.

## 4. setup-node 6.4.0 -> 7.0.0 verification

- Dependabot's pin `820762786026740c76f36085b0efc47a31fe5020` is genuine: verified
  `== refs/tags/v7.0.0` via `git ls-remote --tags`.
- The repo already SHA-pins every action (`.github/dependabot.yml` PKG-04 / D-16), so
  "use pinned SHA" is the existing convention, not a change.
- **10 occurrences: 9 in `ci.yml`, 1 in `release.yml`.** (An earlier draft of this file said
  11/10/1 -- that was a miscount, caught by the plan-checker. Corrected and re-verified three
  independent ways: `git grep -c` returns `ci.yml:9` + `release.yml:1`; the 9 ci.yml hits are
  at lines 118, 224, 305, 345, 387, 429, 490, 573, 733; and Dependabot PR #46's own diff
  reports `ci.yml additions=9`, `release.yml additions=1`.)
- v7.0.0 is `runs.using: 'node24'` (ESM migration).
- PR #46's green CI already validated this bump across the full matrix (ubuntu/windows/macos,
  Node 22/24/26, `act-compat`, all five e2e projects). That independently clears the
  `node24`-runtime-under-`act` question. This task only re-authors the same bump into a PR
  that can actually merge.

### The one risky change, and why it is safe

v7.0.0 stops exporting a dummy `NODE_AUTH_TOKEN`:

```js
// v6.4.0
core.exportVariable('NODE_AUTH_TOKEN', process.env.NODE_AUTH_TOKEN || 'XXXXX-XXXXX-XXXXX-XXXXX')

// v7.0.0 -- only export NODE_AUTH_TOKEN if explicitly provided by user
if (Object.prototype.hasOwnProperty.call(process.env, 'NODE_AUTH_TOKEN')) {
  core.exportVariable('NODE_AUTH_TOKEN', process.env.NODE_AUTH_TOKEN);
}
```

`release.yml` uses `registry-url` with tokenless OIDC and sets no `NODE_AUTH_TOKEN`, so
under v7 the generated `.npmrc` line `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`
references an unset variable. Concern was that npm would abort with
"Failed to replace env in config".

**Empirically disproven** (npm 11.16.0, local):

```
.npmrc:  //registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}
         registry=https://sentinel.example.invalid/
NODE_AUTH_TOKEN unset
$ npm config get registry
https://sentinel.example.invalid/       # EXIT=0
```

The sentinel value came back, proving the file parsed with the unset reference present.
npm tolerates it, so the OIDC publish path is unaffected.

### `package-manager-cache: false` in `release.yml` (cache-poisoning hardening)

Raised by the user 2026-07-25 from `actions/setup-node#1567`. That PR added this note
(verbatim, `docs/advanced-usage.md`):

> **Note**: In publishing workflows, set `package-manager-cache: false` because setup-node
> enables npm caching automatically when `package.json` specifies npm via `packageManager` or
> `devEngines.packageManager` (see [Running without a lockfile](#running-without-a-lockfile)),
> and a poisoned cache may expose credentials (including OIDC tokens) to attacker-controlled
> code.

The `package-manager-cache` input defaults to `true`, so caching can switch on with NO
`cache:` input present -- but only when `package.json` declares npm via `packageManager` or
`devEngines.packageManager`.

Measured state of this repo:

| Check | Result |
| --- | --- |
| `release.yml` uses `cache:` | no (`git grep -n cache -- release.yml` exits 1) |
| root `package.json` `packageManager` | `undefined` |
| root `package.json` `devEngines` | `undefined` |
| `package-manager-cache` default | `true`, but gated on the two fields above |
| present in v6.4.0 as well? | YES -- identical input and default |

So there is NO cache in the publish job today, and this is NOT introduced by the v7 bump.

It is nonetheless a LATENT trap worth closing: if `packageManager` is ever added to the root
`package.json` (routine for Corepack -- and `ci.yml` already calls `corepack enable` in two
jobs), the OIDC-privileged publish job would SILENTLY begin restoring an npm cache that a PR
could have poisoned, exposing the OIDC token to attacker-controlled code. One line, zero
behavior change today, fails safe thereafter. Consistent with how `release.yml` already
reasons (its tag-ref `if:` is documented as "additive defense-in-depth (RD-07)").

Scope: `release.yml` ONLY. Do NOT add it to `ci.yml`'s 9 `cache: npm` steps -- those are
deliberate opt-in caching in unprivileged jobs, and the recommendation is specific to
publishing workflows.

### Dead code found (pre-existing, not caused by the bump)

`release.yml` strips `always-auth=` from the generated `.npmrc`, with a comment claiming
setup-node writes it. `always-auth` appears **0 times** in the shipped
`dist/setup/index.js` of BOTH v6.4.0 and v7.0.0. The step is already a no-op at the
current pin. User elected to remove it in this task.

## 5. codeql-action pin decision

`ci.yml` already pins `github/codeql-action/upload-sarif@7188fc363630916deb702c7fdcf4e481b751f97a # v4.37.1`.

Verified: that SHA is `refs/tags/v4.37.1^{}` (the commit the annotated tag targets), and
`init/action.yml`, `analyze/action.yml`, `upload-sarif/action.yml` all return HTTP 200 at
it. Newer tags exist (v4.37.2, v4.37.3).

**Decision: reuse `7188fc363630916deb702c7fdcf4e481b751f97a` (v4.37.1)** for `init` and
`analyze`. Rationale: one codeql-action version across the repo, no new supply-chain
surface, and Dependabot bumps all three paths together on its weekly run.

## 6. Sources

- GitHub Docs -- Troubleshooting Dependabot on GitHub Actions (read-only `GITHUB_TOKEN`,
  fork treatment). HIGH.
- GitHub Docs -- Code scanning troubleshooting, Error: 403 "Resource not accessible by
  integration" (`pull_request` upload exemption, Dependabot untrusted, recommended
  `pull_request` event). HIGH.
- GitHub Docs -- Available rules for rulesets, "Require code scanning results" (three
  blocking conditions: alert at threshold, analysis in progress, tool not configured).
  HIGH.
- GitHub Docs -- Configuring advanced setup for code scanning (the documented
  default -> advanced switch procedure). HIGH.
- `actions/starter-workflows` `code-scanning/codeql.yml` -- official advanced-setup
  template (job name, triggers, permissions, category). HIGH.
- Live repo API: rulesets 18229122, check-runs for PRs #46/#59/#64/#65,
  `actions/runs?head_sha=`, `code-scanning/analyses`, `code-scanning/default-setup`,
  `app/15368`. HIGH.
- `git ls-remote --tags` for actions/setup-node and github/codeql-action; raw
  `authutil.ts` and `dist/setup/index.js` at both setup-node SHAs. HIGH.
- Local npm 11.16.0 `.npmrc` env-replacement experiment. HIGH.
