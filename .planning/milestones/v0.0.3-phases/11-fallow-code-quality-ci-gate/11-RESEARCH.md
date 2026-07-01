# Phase 11: Fallow code-quality CI gate - Research

**Researched:** 2026-06-30
**Domain:** CI quality gate (fallow 2.103.0) + dead-code config for an Nx 23 / Angular 22 / TS 6 monorepo
**Confidence:** HIGH (every config key, finding count, and verdict below was reproduced live against `fallow@2.103.0` on this repo's HEAD vs `origin/main`)

## Summary

This phase wires `fallow@2.103.0` into CI as a `new-only` gate and resolves the repo's current findings so the gate is green on adoption. I authored a concrete `.fallowrc.jsonc`, ran it live (`npx --yes fallow@latest audit --format json --base origin/main -c <config>`), and confirmed **verdict `pass` / exit 0** with the config alone, and a **fully clean tree (0 dead-code findings, `has_errors:false`)** once the genuinely-unused `@angular/forms` prod dependency is removed. Both runs are reproduced below.

The 11-DISCUSS-RESEARCH.md facts hold verbatim with **one path correction**: the fault-isolation fixtures live at the **repo-root** `fixtures/fault-isolation/`, NOT `packages/angular-typechecker/fixtures/` (the path in 11-CONTEXT.md D-04 and the canonical-refs is wrong). The `overrides.files` glob MUST be `fixtures/fault-isolation/**`, not `packages/angular-typechecker/fixtures/fault-isolation/**` -- the latter matches nothing and the gate would still fail on 4 introduced fixture findings.

**Primary recommendation:** Ship the verified `.fallowrc.jsonc` below; **remove `@angular/forms`** (confirmed zero imports anywhere) rather than `ignoreDependencies` it (D-07 verify-then-resolve -> remove); add a dedicated path-gated, SHA-pinned `fallow` job copying the `test`/`e2e` pattern verbatim, wired into the `ci` aggregate `needs:` + gate; add one `assert_selected "$PR_PLAN" "ci/fallow"` line to act-compat.sh.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `--gate new-only` (fallow default); PR fails only for findings it INTRODUCES.
- **D-02:** Pin `"audit": { "gate": "new-only" }` in config AND suppress inherited findings at rule/entry/ignore level (not relying on `introduced:false`) -- end the phase genuinely clean.
- **D-03:** Config-driven via hand-authored `.fallowrc.jsonc` (NOT inline `// fallow-ignore-*`), one JSONC comment per declaration.
- **D-04:** Verified keys: `entry` (drift file), `overrides` (EmitFlags off on compiler-cli-types.ts; fixtures off), `ignoreExports` (UNKNOWN_ERROR_CODE), `rules` (unused-dev-dependencies off, unused-dependencies error), `duplicates`/`health` defaults, `audit.gate`.
- **D-05:** Gate at REPO ROOT (`npx fallow audit ... --base origin/main` from root), NOT scoped to the package.
- **D-06:** `unused-dev-dependencies: off` (14 structurally un-traceable tooling deps).
- **D-07:** KEEP `unused-dependencies: error`; `@angular/forms` is VERIFY-THEN-RESOLVE.
- **D-08:** IN-05 does NOT reproduce -- no suppression for it.
- **D-09:** All three families (dead-code + `duplicates` + `health`) at default thresholds (repo is clean on both).
- **D-10:** Dedicated `fallow` job in `ci` aggregate `needs:` + gate; single required check stays `ci` (no ruleset change).
- **D-11:** Exact-pinned `fallow` ROOT devDependency; CI runs `npm ci` then `npx fallow` (NOT `@latest`).
- **D-12:** Gate command `npx fallow audit --format json --base origin/main`; exit code gates; NO `--ci`/SARIF.
- **D-13:** `actions/checkout` `fetch-depth: 0` + `persist-credentials: false`; optionally pin `FALLOW_AUDIT_BASE=origin/main`.
- **D-14:** Path-gate with `if: ${{ needs.changes.outputs.code != 'false' }}` NEGATIVE form; ubuntu-latest, Node 24, SHA-pinned actions.
- **D-15:** `assert_selected "$PR_PLAN" "ci/fallow"`; actionlint stays green; preserve ci.yml security posture.

### Claude's Discretion
- Exact `.fallowrc.jsonc` layout / `$schema` pointer / comment wording; `audit.gate` config key vs `--gate` CLI flag (config preferred for determinism).
- `@angular/forms` removed vs ignored -- decided by the executor's import-graph check (**this research's evidence: REMOVE**).
- Ordering of the `fallow` job in the workflow file; whether it shares the `changes` job output directly.

### Deferred Ideas (OUT OF SCOPE)
- Migrating fallow output to GitHub code-scanning via SARIF (`--ci`) -- needs `security-events: write`.
- Fixing GSD's broken fallow structural pre-pass (fallow 2.x flag drift) -- a GSD-tooling concern.
- Tuning duplication/complexity thresholds -- deferred until a real finding proves a default wrong.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUAL-01 | Dedicated path-gated SHA-pinned `fallow` CI job wired into `ci` aggregate, `new-only` gate | Verified job YAML below (copies `test`/`e2e` pattern); `fetch-depth: 0` confirmed sufficient (merge-base `1e37d55` resolved live); act label `ci/fallow` |
| QUAL-02 | Hand-authored `.fallowrc.jsonc` RESOLVES current findings -> audit exits 0 | **Verified live: verdict `pass`, exit 0** with the config below; **0 findings** once `@angular/forms` removed |
| QUAL-03 | `fallow` exact-pinned root devDependency; act-compat assertion; actionlint green; ci.yml posture preserved | `fallow@2.103.0` (slopcheck OK, 404k weekly dl, source repo present); root devDep does NOT touch `@nx/dependency-checks` (scoped to the package) |

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `fallow` | `2.103.0` (exact-pin) | dead-code / duplication / complexity analyzer; the CI gate | `[VERIFIED: npm registry]` only `latest` dist-tag = `2.103.0`; created 2026-03-17, 404,196 weekly downloads, source repo `github.com/fallow-rs/fallow`, `engines.node >=16`, no postinstall script |

**Installation (root devDependency):**
```bash
npm install -D fallow@2.103.0   # exact pin; CI runs `npm ci` then `npx fallow`
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `--gate new-only` (config-pinned) | `--gate all` | `all` skips the base-snapshot pass (cheaper) but gates on EVERY finding in changed files -- higher friction; D-01 locks `new-only` |
| `ignoreDependencies: ["@angular/forms"]` | **Remove `@angular/forms`** | Removal is deterministic + leaves a 0-finding tree; ignore leaves a perpetual reported (non-gating) finding and `has_errors:true`. **Evidence says remove.** |
| `npx fallow` (locked) | `npx fallow@latest` | `@latest` lets a fallow release silently change a default rule and flip the gate (D-11 lesson). Pin + `npm ci`. |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `fallow` | npm | ~3.5 mo (2026-03-17) | 404,196 / wk | github.com/fallow-rs/fallow | `[OK]` | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
No `postinstall` script (`npm view fallow scripts.postinstall` empty). Verified on the npm registry (correct ecosystem).

## The verified `.fallowrc.jsonc` (repo root)

This is the EXACT file content that was run live and produced **verdict `pass` / exit 0**. The planner can hand this to the executor verbatim. Place at repo root (auto-discovered; both `.json`/`.jsonc` discovered, `.jsonc` chosen for comments per preference).

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/fallow-rs/fallow/main/schema.json",

  // IN-02: the build-time drift tripwire is reachable ONLY via tsconfig.drift.json
  // `files` (classic node10 resolution), never via the import graph, so fallow
  // flags it `unused_file`. Declaring it an entry point clears that false positive.
  "entry": [
    "packages/angular-typechecker/src/core/compiler-cli-types.drift.ts"
  ],

  // IN-04: UNKNOWN_ERROR_CODE is a value-mirrored constant consumed only by the
  // drift tripwire's value-level pin (not the import graph). Pin it so the
  // `unused_types` finding never gates, regardless of changeset attribution (D-02).
  "ignoreExports": [
    {
      "file": "**/compiler-cli-types.ts",
      "exports": ["UNKNOWN_ERROR_CODE"]
    }
  ],

  "rules": {
    // D-06: the 14 dev/tooling deps (ESLint flat-config plugins, swc register,
    // attw/publint CLIs, etc.) are structurally un-traceable by import graph and
    // will always false-positive. Dev-dep hygiene is owned by @nx/dependency-checks
    // (the published package) + manual review, not fallow.
    "unused-dev-dependencies": "off"
    // D-07: unused-dependencies stays at its default `error` -- catches a genuine
    // unused PROD dep. @angular/forms is RESOLVED by removal (see below), not here.
  },

  "overrides": [
    {
      // IN-03: the EmitFlags enum mirrors the real @angular/compiler-cli enum as a
      // contract-mirror shim; members are consumed by the drift pin, not the import
      // graph. Scope the rule off for this file only.
      "files": ["**/compiler-cli-types.ts"],
      "rules": {
        "unused-enum-members": "off"
      }
    },
    {
      // Intentional fault-isolation test fixtures: components rendered nowhere +
      // one fixture @Input. They drive the engine's per-file resilience tests.
      // NOTE: fixtures live at REPO ROOT (fixtures/fault-isolation/), NOT under
      // packages/angular-typechecker/ -- the glob MUST be root-relative.
      "files": ["fixtures/fault-isolation/**"],
      "rules": {
        "unrendered-components": "off",
        "unused-component-inputs": "off"
      }
    }
  ],

  "audit": {
    // D-02: pin the gate so the verdict is deterministic regardless of CLI flags.
    "gate": "new-only"
  }
}
```

**`duplicates` / `health` (D-09):** intentionally OMITTED -- fallow applies its defaults (`duplicates.minOccurrences 3`; `health.maxCyclomatic 20` / `maxCognitive 15` / `maxCrap 30`) automatically. The live run shows `duplication_clone_groups: 0` and `complexity_findings: 0`, so the defaults are zero-cost regression tripwires. Do NOT add empty blocks; absence == defaults.

## Resolving the findings: live evidence

Command (run from repo root, HEAD = `d5cd2cc`, base merge-base `1e37d55`, 112 changed files):
```
npx --yes fallow@latest audit --format json --base origin/main -c <config>
```

| Scenario | verdict | exit | dead_code_issues | introduced | remaining |
|----------|---------|------|------------------|-----------|-----------|
| No config | fail | 1 | 28 | 12 | (baseline) |
| Config only (`@angular/forms` NOT removed) | **pass** | **0** | 1 | 0 | `@angular/forms` (inherited, `error`, non-gating today) |
| Config + `@angular/forms` removed | **pass** | **0** | **0** | 0 | **none -- fully clean** |

The 12 introduced findings the config clears: 1 drift `unused_file` (`entry`), 7 `unused_enum_members` (`overrides`), 3 `unrendered_components` + 1 `unused_component_inputs` (`fixtures/fault-isolation/**` `overrides`). The 2 remaining inherited `error`-severity findings that D-02 demands be deterministic: `UNKNOWN_ERROR_CODE` `unused_types` (cleared by `ignoreExports`) and `@angular/forms` `unused_dependencies` (cleared by REMOVAL). The 14 `unused_dev_dependencies` default to `warn` (verified in schema) so they never gated, but D-06 sets them `off` for clarity.

### `@angular/forms`: REMOVE (verify-then-resolve, D-07)

`[VERIFIED: git grep]` `@angular/forms` appears ONLY in root `package.json:52` + `package-lock.json`. Zero `import` / template / config references anywhere in `packages/`, `fixtures/`, `e2e/`, `tools/`, `apps/`. (The lone `forms` substring hit in `exit-codes.ts:14` is the word "performs".) It is genuine dead weight. **Recommendation: remove it from `dependencies`** -- this yields the 0-finding clean tree above. Do NOT `ignoreDependencies` it: that leaves a perpetual reported finding and `has_errors:true`, contradicting the "resolve, not baseline" roadmap intent.

> Executor task: `git grep -n "@angular/forms"` to re-confirm zero usage, then remove the `package.json` line + `npm install` to regenerate the lockfile.

### Entry-point auto-detection (open question 1, answered)

`[VERIFIED: live audit]` fallow auto-detects an Angular plugin and loads **60 entry points** (`default_index: 2`, `package.json: 2`, `plugin: 56`). The 56 plugin entry points cover the real Angular component/source entry points automatically -- the config's `entry` array does **NOT** need to re-list them. The only file needing an explicit `entry` is the drift tripwire, which is invisible to the import graph because it is reachable ONLY via `tsconfig.drift.json`'s `files` array (classic node10 resolution; excluded from `tsconfig.lib.json`/`tsconfig.spec.json`). Adding the drift file to `entry` clears its `unused_file` finding AND does **not** mask any real finding -- the config+removal run shows `unused_exports: []` (the drift file exports nothing the entry-point treatment could hide), and the tree is fully clean.

## CI wiring: the exact `fallow` job YAML

Copy the `test`/`e2e` pattern verbatim. SHA pins are the EXACT ones already in `ci.yml` (Dependabot keeps both jobs in lockstep). Slot it as a sibling of `e2e` (after it, before `act-compat`), then add `fallow` to the `ci` aggregate `needs:` + it is covered by the existing `contains(needs.*.result, ...)` gate (no gate-expression edit needed -- `needs.*` already globs all listed jobs).

```yaml
  # Code-quality gate (QUAL-01): fallow audit in new-only mode -- a PR fails only
  # for dead code / duplication / over-complexity it INTRODUCES. Config-pinned
  # gate (.fallowrc.jsonc `audit.gate: new-only`); --format json is for the CI log
  # only, the exit code gates. NO --ci/SARIF (would need security-events: write,
  # contradicting the top-level contents: read). fallow is an exact-pinned root
  # devDependency installed by `npm ci`; `npx fallow` resolves the locked version
  # (never @latest) so a fallow release cannot silently flip the gate.
  #
  # fetch-depth: 0 is LOAD-BEARING -- new-only attribution runs a base-snapshot
  # pass against origin/main's merge-base; a shallow checkout breaks new-vs-
  # inherited attribution. FALLOW_AUDIT_BASE pins the base ref defensively.
  #
  # Path-gated (D-08), SAME NEGATIVE if: form as test/e2e -- skips a planning/docs-
  # only PR yet stays in the `act -n` plan under the empty filter output.
  fallow:
    needs: changes
    if: ${{ needs.changes.outputs.code != 'false' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1
        with:
          persist-credentials: false
          fetch-depth: 0
      - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx fallow audit --format json --base origin/main
        env:
          FALLOW_AUDIT_BASE: origin/main
```

**Aggregate `ci` job change (one line):**
```yaml
  ci:
    needs: [changes, test, e2e, fallow, act-compat, lint-workflows]   # + fallow
```
The gate expression `contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')` is UNCHANGED -- `needs.*` globs every job in the `needs:` list, so adding `fallow` to the list auto-includes it in the gate. `'skipped'` stays out of the fail set, so a planning/docs-only PR that path-skips `fallow` keeps `ci` green.

**Security posture preserved (QUAL-03):** SHA-pinned actions (reused pins), top-level `contents: read` (no job re-grant), `persist-credentials: false`, no PR-metadata interpolation (fixed target ids + flags only), Dependabot-tracked (same action refs). No new permission needed -- `npx fallow audit` reads git + filesystem only.

### `fetch-depth: 0` sufficiency (open question 7, answered)

`[VERIFIED: live]` On this branch, `git merge-base HEAD origin/main` resolved to `1e37d55`, and the audit attribution computed correctly (`gate: new-only`, accurate introduced/inherited split). `fetch-depth: 0` gives full history so the merge-base is always reachable -- sufficient. `FALLOW_AUDIT_BASE=origin/main` is set defensively (D-13 "optionally pin") so attribution never falls back to `origin/HEAD` guessing. Note: in CI the runner must have `origin/main` fetched -- `actions/checkout` with `fetch-depth: 0` on a `pull_request` event checks out the merge ref and fetches all branches/history, so `origin/main` is present.

## act-compat.sh: the exact assertion (open question 4, answered)

`[VERIFIED: by pattern]` Job id `fallow` (no `name:` set) -> act dry-run label `ci/fallow` (act labels jobs `<workflow>/<jobid>`; every existing assertion uses `ci/<jobid>`). Add ONE line to the `pull_request` block, alongside the other `ci/*` assertions (after `ci/e2e`, before `ci/act-compat`):

```bash
assert_selected "$PR_PLAN" "ci/fallow" "pull_request"
```

**Push-main:** the `fallow` job runs on `push: branches: [main]` too (same triggers as `test`). The existing `PUSH_MAIN_PLAN` block only asserts `ci/test-` and `ci/ci` (a representative subset, not every job), so adding a push-main `ci/fallow` assertion is OPTIONAL and consistent either way. **Do NOT** add a `push-tag` ABSENT assertion: `fallow` is in `ci.yml`, not `release.yml`; act selects jobs by event NAME only, and the existing push-tag/dispatch blocks assert only `release/publish`. Adding `ci/fallow` to those would be noise -- leave them as-is. (For symmetry with `test`, the simplest correct change is the single `pull_request` line above.)

**actionlint (open question 3):** the new job uses only constructs already present (matrix-free `runs-on`, `needs`, `if:` expression, SHA-pinned `uses`, `env`). actionlint type-checks the `needs.*.result` graph -- adding `fallow` to `ci.needs` keeps the graph valid (every referenced job exists). `[ASSUMED]` actionlint stays green (no new expression shapes); verify with the `lint-workflows` job locally (`./actionlint -color`).

## `@nx/dependency-checks` (open question 5, answered)

`[VERIFIED: eslint.config.mjs]` `@nx/dependency-checks` is configured ONLY in `packages/angular-typechecker/eslint.config.mjs` (scoped to that project's `lint` target over `packages/angular-typechecker/**/*.json` and its `package.json`). The root `package.json` is NOT in that rule's file set. Adding `fallow` as a ROOT devDependency does not touch `packages/angular-typechecker/package.json`, so it CANNOT trigger a `@nx/dependency-checks` finding. The published package's dependency surface is unaffected. **No dependency-checks concern.**

## Determinism (open question 6, answered)

`[VERIFIED: live]` The config suppresses every gating finding at the **rule / entry / ignore** level, NOT by relying on any `introduced:false` status:
- drift file -> `entry` (structural, changeset-independent)
- EmitFlags members -> `overrides` `unused-enum-members: off` (changeset-independent)
- UNKNOWN_ERROR_CODE -> `ignoreExports` (changeset-independent)
- fixtures -> `overrides` (changeset-independent)
- `@angular/forms` -> REMOVED (eliminates the source, not the symptom)
- `audit.gate: new-only` pinned in config

Result: on ANY PR -- including one that touches `compiler-cli-types.ts`, the drift file, the fixtures, or `package.json` -- these findings cannot flip to `introduced` and gate, because they are suppressed structurally. The post-phase tree is genuinely clean (0 findings), satisfying D-02 + caveat 6.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| New-vs-inherited finding attribution | Custom git-diff finding differ | fallow `--gate new-only` base-snapshot pass | fallow already analyzes the base tree and diffs findings; rolling it is error-prone |
| Suppressing intentional dead code | Inline `// fallow-ignore-*` comments scattered in source | central `.fallowrc.jsonc` | D-03: centralized, auditable, one documented reason each; inline comments rot and hide intent |
| Dev-dep hygiene for the published package | fallow `unused-dev-dependencies` | `@nx/dependency-checks` (already wired) | fallow's import graph cannot see flat-config/CLI tooling deps -> always false-positive (D-06) |

## Common Pitfalls

### Pitfall 1: Wrong fixture glob (the path bug in CONTEXT.md)
**What goes wrong:** Using `packages/angular-typechecker/fixtures/fault-isolation/**` (the path written in 11-CONTEXT.md D-04 and canonical-refs) matches NOTHING -- the fixtures are at the repo-root `fixtures/fault-isolation/`. The 4 introduced fixture findings stay live and the gate fails.
**How to avoid:** Use `fixtures/fault-isolation/**` (root-relative). `[VERIFIED: git ls-files]` the files are `fixtures/fault-isolation/{non-template-error,survivor,tcb-poison}.component.ts`.
**Warning sign:** audit verdict `fail` with `unrendered_components` / `unused_component_inputs` still listed after applying the config.

### Pitfall 2: Leaving `@angular/forms` ignored instead of removed
**What goes wrong:** `ignoreDependencies: ["@angular/forms"]` makes the gate pass but leaves `dead_code_has_errors: true` and a perpetual reported finding -- it baselines the debt rather than resolving it (contra roadmap item 4).
**How to avoid:** Remove the dependency (verified unused). Tree becomes 0 findings.

### Pitfall 3: Shallow checkout breaks attribution
**What goes wrong:** Default `actions/checkout` `fetch-depth: 1` cannot reach `origin/main`'s merge-base, so `new-only` mis-attributes inherited findings as introduced (or errors).
**How to avoid:** `fetch-depth: 0` (+ `FALLOW_AUDIT_BASE=origin/main` defensively). D-13.

### Pitfall 4: `npx fallow@latest` in CI
**What goes wrong:** A fallow release changing a default rule severity silently flips the gate.
**How to avoid:** Exact-pin `fallow@2.103.0` as a root devDependency; `npm ci` then `npx fallow` resolves the locked version (D-11).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | This requirement set is a CI-workflow gate, NOT engine code -- verification is workflow-static-analysis (act + actionlint) + a real fallow exit-0 check, NOT vitest |
| Config file | `.fallowrc.jsonc` (repo root); `tools/act/act-compat.sh`; `.github/workflows/ci.yml` |
| Quick run command | `npx fallow audit --format json --base origin/main` (expect exit 0) |
| Full suite command | `npx nx run-many -t typecheck-drift test -p angular-typechecker` (proves the resolved findings -- removed `@angular/forms`, untouched shim -- did not break the engine) + `bash tools/act/act-compat.sh` + `./actionlint -color` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | Exists? |
|--------|----------|-----------|-------------------|---------|
| QUAL-01 | `fallow` job is selected on pull_request (path-gated) | workflow dry-run | `bash tools/act/act-compat.sh` (asserts `ci/fallow` SELECTED) | ❌ Wave 0 (add the assertion line) |
| QUAL-01 | ci.yml is GitHub-spec-valid incl. the new `needs` graph | static lint | `./actionlint -color` (the `lint-workflows` job) | ✅ existing job |
| QUAL-01 | ci.yml parses under act | static | `act --validate` (inside act-compat.sh) | ✅ existing |
| QUAL-02 | Audit exits 0 on the resolved tree | integration | `npx fallow audit --format json --base origin/main; echo $?` (expect 0) | ❌ Wave 0 (the resolution itself) |
| QUAL-02 | Resolution did not break the engine | unit+integration | `npx nx run-many -t typecheck-drift test -p angular-typechecker` | ✅ existing suite |
| QUAL-03 | `fallow` pinned exact in root package.json + lockfile | manual/grep | `git grep '"fallow"' package.json` shows `"2.103.0"` | ❌ Wave 0 |
| QUAL-03 | Published package dependency surface unchanged | static | `@nx/dependency-checks` via `npx nx lint angular-typechecker` (no new finding) | ✅ existing |

### Sampling Rate
- **Per task commit:** `npx fallow audit --format json --base origin/main` (exit 0) on the relevant change.
- **Per wave merge:** `bash tools/act/act-compat.sh` + `./actionlint -color` + `npx nx run-many -t typecheck-drift test -p angular-typechecker`.
- **Phase gate:** all of the above green; a real green PR run of the new `fallow` job is the authoritative integration check (act CANNOT verify the aggregate `ci` gate's skipped-arithmetic -- only the REAL draft-PR run does, per the ci.yml/act-compat caveat).

### Wave 0 Gaps
- [ ] `.fallowrc.jsonc` (repo root) -- covers QUAL-02 (the verified content above)
- [ ] `@angular/forms` removal from root `package.json` + lockfile regen -- covers QUAL-02 determinism
- [ ] `fallow` job added to `.github/workflows/ci.yml` + added to `ci.needs` -- covers QUAL-01
- [ ] `fallow@2.103.0` exact-pin in root `package.json` devDependencies + `package-lock.json` -- covers QUAL-03
- [ ] `assert_selected "$PR_PLAN" "ci/fallow" "pull_request"` line in `tools/act/act-compat.sh` -- covers QUAL-01
- [ ] (no new vitest spec needed -- the gate is a workflow, validated by act/actionlint + a real run; existing engine suite covers the resolution's safety)

## Security Domain

> `security_enforcement` is enabled (config has no `false`). This phase touches CI workflow + dependency manifest -- the relevant surface is supply-chain + CI least-privilege, NOT app input/auth.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture / Supply Chain | yes | Exact-pin `fallow@2.103.0`; slopcheck `[OK]`; SHA-pinned actions (existing pins reused); Dependabot-tracked |
| V14 Configuration / CI | yes | Top-level `contents: read` preserved; no job re-grants write; `persist-credentials: false`; no PR-metadata interpolation; NO SARIF (`security-events: write` avoided) |
| V2/V3/V4/V5/V6 (auth/session/access/input/crypto) | no | No runtime/app surface in this phase |

### Known Threat Patterns for CI + npm supply chain
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Mutable action tag repointed to malicious code (tj-actions) | Tampering | Full 40-char SHA pins (reuse `ci.yml`'s existing pins) + Dependabot |
| Slopsquatted/hijacked analyzer dependency | Tampering/Spoofing | Exact-pin + slopcheck `[OK]` + verified source repo + `npm ci` (lockfile-pinned), not `@latest` |
| Credential persisted to `.git/config` and leaked | Info Disclosure | `persist-credentials: false` on the checkout (matches every other job) |
| PR-metadata command injection in a run step | Tampering | Fixed target ids + flags only; no `${{ github.event.* }}` interpolation in run steps |
| Over-broad token enabling a malicious publish | Elevation of Privilege | `contents: read` at top level; no job re-grant; OIDC publish stays release.yml's concern |

## Open Questions

None blocking. All 7 open implementation questions from the brief were answered with live evidence (entry auto-detection, `@angular/forms` removal, job YAML, act assertion, dependency-checks, determinism, fetch-depth). The single residual uncertainty:
- **`[ASSUMED]` actionlint stays green** for the new job -- high confidence (no new expression shapes), but the executor should run `./actionlint -color` to confirm. Low risk.

## Environment Availability
| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `fallow` | the gate | ✓ (via npx; to be pinned as devDep) | 2.103.0 | none needed |
| Node | running fallow / CI | ✓ | v24.18.0 local; Node 24 in CI | — |
| git history to merge-base | new-only attribution | ✓ | merge-base `1e37d55` resolved | `fetch-depth: 0` in CI |
| `act` v0.2.89 | act-compat job | ✓ (installed in CI job) | 0.2.89 | — |
| `actionlint` 1.7.7 | lint-workflows job | ✓ (installed in CI job) | 1.7.7 | — |

No missing dependencies block execution.

## Assumptions Log
| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | actionlint stays green for the new `fallow` job (no new expression shapes) | act-compat / Open Questions | LOW -- executor runs `./actionlint -color`; the job uses only existing constructs |

## Sources

### Primary (HIGH confidence)
- Live `npx --yes fallow@latest audit --format json --base origin/main` runs on this repo (no config / config-only / config+forms-removed) -- the verdict/exit/finding tables.
- `fallow config-schema` (2294 lines, `schema_version 7`) -- `entry`/`overrides`/`ignoreExports`/`rules`/`audit` shapes + default severities (`unused-dev-dependencies` default `warn`; the rest `error`).
- `npm view fallow` (version `2.103.0`, single `latest` dist-tag, created 2026-03-17, repo `github.com/fallow-rs/fallow`, no postinstall); `api.npmjs.org/downloads` (404,196/wk); `slopcheck install fallow` (`[OK]`).
- `git grep` / `git ls-files` -- `@angular/forms` zero usage; fixtures at repo-root `fixtures/fault-isolation/`; `@nx/dependency-checks` scoped to the package eslint config.
- `.planning/phases/11-fallow-code-quality-ci-gate/11-DISCUSS-RESEARCH.md` -- CLI surface, gate semantics, config discovery (corroborated live).
- `.github/workflows/ci.yml`, `tools/act/act-compat.sh`, `packages/angular-typechecker/{project.json,tsconfig.drift.json,src/core/compiler-cli-types*.ts,eslint.config.mjs}` -- the patterns to copy + posture to preserve.

### Secondary (MEDIUM confidence)
- 11-CONTEXT.md D-01..D-15 (locked decisions) -- corroborated/corrected against live evidence (fixture path correction noted).

## Metadata
**Confidence breakdown:**
- `.fallowrc.jsonc` content: HIGH -- run live, verdict pass / exit 0 reproduced; 0-finding tree on forms removal.
- CI job YAML: HIGH -- copies a verified-working pattern; fetch-depth + merge-base verified live.
- act-compat assertion: HIGH -- label format `ci/<jobid>` confirmed against existing assertions.
- `@angular/forms` removal: HIGH -- zero usage confirmed by exhaustive grep; clean-tree confirmed live.

**Research date:** 2026-06-30
**Valid until:** ~2026-07-30 (fallow is fast-moving; re-pin if `fallow` publishes past 2.103.0 -- the gate stays locked to 2.103.0 regardless until intentionally bumped).
