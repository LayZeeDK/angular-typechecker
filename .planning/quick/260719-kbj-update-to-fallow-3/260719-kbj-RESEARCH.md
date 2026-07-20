# Fallow 2.103.0 -> 3.6.0 migration research (quick task 260719-kbj)

**Researched:** 2026-07-19
**Verdict:** Trivial upgrade. Officially ZERO breaking changes. Our exact CI gate runs GREEN on 3.6.0 with NO CLI or config edits. Migration = bump one devDependency + refresh the lockfile.
**Confidence:** HIGH (ran the actual 3.6.0 win32-arm64 binary against our repo end to end).

## Executive summary (read first)

1. Fallow 3.0.0 explicitly ships **no breaking changes**: "CLI flags, configuration, and JSON output contracts are all unchanged." The major bump only marks CSS/styling landing inside `fallow audit`. [CITED: github.com/fallow-rs/fallow/releases/tag/v3.0.0]
2. Our exact CI command `fallow audit --format human --base origin/main` (+ `FALLOW_AUDIT_BASE=origin/main`, `fetch-depth: 0`) works **byte-identically** on 3.6.0 -- `--format`, `--base` (alias of `--changed-since`), `--gate`, `FALLOW_AUDIT_BASE` all unchanged. [VERIFIED: ran 3.6.0 binary]
3. Every key in our `.fallowrc.jsonc` (`entry`, `ignoreExports`, `ignoreDependencies`, `rules`, `health`, `overrides`, `duplicates`, `audit`) is still valid in 3.6.0 -- **zero config edits required**. Confirmed by loading our v2 config under the 3.6.0 loader (exit 0) plus a negative control (bogus key hard-fails). [VERIFIED]
4. One behavioral delta touches our report (not the gate): the new v3.1.0 rule `dev-dependencies-in-production` (default `warn`, non-gating) surfaces 6 informational findings on our repo. The audit still **exits 0 (green)**. Optional one-line silence recommended for a clean report. [VERIFIED]
5. Migration is 1 required file edit (root `package.json`) + a lockfile refresh. CI, `.fallowrc.jsonc`, and `.planning/config.json` need no functional change. Keep the EXACT pin (`3.6.0`, no `^`/`~`) -- our repo's stated invariant; do NOT copy the reference repo's `~3.6.0`.

---

## 1. Breaking changes 2.x -> 3.x

**Officially none.** The 3.0.0 release notes state verbatim: *"No breaking changes. CLI flags, configuration, and JSON output contracts are all unchanged. The major bump marks the platform milestone (styling in audit), not a breaking API change."* [CITED: github.com/fallow-rs/fallow/releases/tag/v3.0.0, published 2026-07-04]

The 3.x line (3.0 -> 3.6.0) is entirely additive. The only cross-version items that could touch a `fallow audit --format human --base origin/main` run:

| Version | Change | Affects our gate? |
|---------|--------|-------------------|
| 3.0.0 | `fallow audit` now also runs CSS / CSS-in-JS analysis (deep pass, scoped back to changed anchors). CSS findings are **verdict-neutral by default** (report only, do not fail). `--no-css` / `audit.css:false` and `--no-css-deep` / `audit.cssDeep:false` opt out. | No. Our repo has ~no authored CSS; the deep CSS pass ran and reported 0 findings in the live run. Non-gating regardless. |
| 3.1.0 | **New rule `dev-dependencies-in-production`** (default `warn`; schema key is plural `dev-dependencies-in-production`). Flags a `devDependencies` package imported by a runtime-reachable (non-test) file. | Report only. Surfaces 6 warn findings on our repo (see section 4); **non-gating**, CI stays green. |
| 3.1.0 | Bug fix: `fallow health` no longer wrongly promotes 9 `warn`-default rules to `error` when a `rules:` key is present. | In our favor. Our config has a `rules` key; this fix makes warn-defaults resolve correctly. Not a break. |
| 3.4.2 | Behavior change: **CI-facing** formats (`codeclimate`, `review-github`, `review-gitlab`, `github-annotations`, `github-summary`) emit repo-root-relative paths when `--root` is a subdirectory. `--annotations-path-prefix` renamed to `--report-path-prefix` (old name kept as alias). | No. We use `--format human`, not a CI-facing format, and do not pass either prefix flag. |
| 3.5.0 | Platform packages ship a single multicall binary (~25 MB vs ~50 MB per platform). Consumer surface unchanged. | No. `@fallow-cli/<platform>` optional-dep model retained. |
| 3.6.0 | `--format json` compact by default (`--pretty` for indented). New `fallow audit-cache` cleanup subcommand. Windows LSP path fix. | No. We use `--format human`. |

**Bottom line:** nothing in 2->3 requires a change to our CLI invocation or our `audit.gate: new-only` config.

## 2. Does `fallow audit --format human --base origin/main` still work in 3.6.0?

**Yes, unchanged.** Verified against the 3.6.0 `audit --help` and by running it:

| Flag / env | 3.6.0 status |
|------------|--------------|
| `--format <FORMAT>` | Valid. Default `human`. Alias `--output`. `human` is a listed value. |
| `--base <ref>` | Valid. It is an **alias of `--changed-since`**. |
| `--changed-since <ref>` | Valid (canonical name; `--base` aliases it). |
| `--gate <new-only\|all>` | Valid. `new-only` is the default. |
| `FALLOW_AUDIT_BASE` | Still honored: help says *"set `FALLOW_AUDIT_BASE` to pin it."* |
| `--fail-on-issues` | Valid (present on `audit` too). |
| `--ci` | Valid (= `--format sarif --fail-on-issues --quiet`). |

No renamed or removed flags in our invocation. [VERIFIED: `fallow audit --help` on 3.6.0 win32-arm64]

## 3. `audit` vs `dead-code` in v3 (nothing was split or renamed)

- `fallow audit` = the **changed-files quality gate**: combines dead-code + health(complexity) + duplication + **CSS/styling** (CSS added in 3.0), scoped to files changed since the base, returns a pass/warn/fail verdict, **exits 1 on fail**. `--gate new-only` (default) fails only on findings the changeset INTRODUCED (runs a base-snapshot attribution pass); `--gate all` fails on every finding in changed files. Needs a git base (merge-base against upstream / `origin/HEAD` / `origin/main` / `origin/master` if unset). **This is our strategy.**
- `fallow dead-code` = **whole-repo**, single-analysis: unused files/exports/deps/types/enum-members/class-members + circular dependencies ONLY (no complexity, no dupes, no CSS). Base-independent. `--fail-on-issues` to gate. **This is the reference repo's strategy** (`fallow dead-code --fail-on-issues`).
- Bare `fallow` (no subcommand) = dead-code + dupes + health together, whole-repo.

v3 did **not** split analyses out of `audit`; it **added** CSS to `audit`. The standalone `dead-code` / `health` / `dupes` subcommands existed in v2 too. So there is no rename or migration of subcommand semantics -- only the CSS addition.

## 4. `.fallowrc.jsonc` schema 2->3: every key we use is still valid

The v3 config loader uses serde `deny_unknown_fields` (equivalent to the schema's `additionalProperties: false`). Loading our current (v2-authored) `.fallowrc.jsonc` under the 3.6.0 binary **succeeded, exit 0**, and a negative control (a bogus key) hard-failed with `exit_code 2` and printed the full valid-key list -- which includes every key we use. [VERIFIED]

| Our key | 3.6.0 status | Notes |
|---------|--------------|-------|
| `entry` | Valid | Unchanged (glob array of manual entry points). |
| `ignoreExports` (`{file, exports[]}`) | Valid | Unchanged. Exempts from `unused-export` + duplicate-export grouping. |
| `ignoreDependencies` | Valid | Unchanged. Exact-name, exempts from unused + unlisted. |
| `rules` (map) | Valid | Unchanged. Our `unused-dev-dependencies:off`, `unused-dependencies:error`(default), `test-only-dependencies:off` all resolve. |
| `health` (`{ignore:[...]}`) | Valid | Unchanged. `health.ignore` drops files from findings + score. |
| `overrides` (`[{files, rules}]`) | Valid | Unchanged. Per-glob rule re-severity. |
| `duplicates` (`{ignore:[...]}`) | Valid | Unchanged. Clone-detection scoping. |
| `audit` (`{gate:"new-only"}`) | Valid | Unchanged. `gate` accepts `new-only`\|`all`. Also settable via `--gate`. |

**No new REQUIRED keys.** All new v3 top-level keys (`extends`, `ignorePatterns`, `framework`, `ignoreUnresolvedImports`, `ignoreCatalogReferences`, `boundaries`, `rulePacks`, `security`, `cache`, etc.) default to empty / off.

**`ignorePatterns` (the reference repo's key) is NOT a rename of any of ours.** It is a distinct v3 (and v2) key meaning "exclude these globs from analysis ENTIRELY" (unioned with built-in defaults like `node_modules/`, `dist/`). It coexists in the schema alongside `health.ignore`, `duplicates.ignore`, and `overrides`. The reference repo (`op-nx/github-cache`) simply does not need our `rules`/`health`/`overrides`/`duplicates`/`audit` keys because it is a smaller, cleaner repo with fewer false positives -- **not** because those keys were removed. Confirmed: all our keys appear in the 3.6.0 valid-key list. [VERIFIED]

## 5. Rule-name renames: none for the rules we depend on

Every rule id we scope off (or rely on as default) is present in the 3.6.0 default rules map with the same name: [VERIFIED via resolved-config dump]

| Rule we use | 3.6.0 name | Default severity in 3.6.0 |
|-------------|------------|---------------------------|
| `unused-files` | same (singular `unused-file` also accepted as alias) | error |
| `unused-dependencies` | same | error |
| `unused-dev-dependencies` | same | warn (we force `off`) |
| `test-only-dependencies` | same | warn (we force `off`) |
| `unused-enum-members` | same | error |
| `unrendered-components` | same | warn |
| `unused-component-inputs` | same | warn |
| `unresolved-imports` | same | error |

No renames, no removals. (Note: v3 defaults `unused-dev-dependencies` and `test-only-dependencies` to `warn`, not `error` -- but we set both to `off` explicitly, so our behavior is identical either way.)

## 6. Distribution / engine

- **Binary model retained.** 3.6.0 still ships per-platform via `@fallow-cli/<platform>` optionalDependencies. `@fallow-cli/win32-arm64-msvc@3.6.0` is present -- our Windows arm64 dev machine is covered (we literally ran the 3.6.0 win32-arm64 binary). [VERIFIED: `npm view fallow@3.6.0 optionalDependencies`] The `fallow` package now has one small runtime dep, `detect-libc@2.1.2`.
- **Node engine:** `engines.node: ">=22"`. Our CI runs Node 24 and our consumer range is `^22.22.3 || ^24.15.0 || ^26.0.0` -- all satisfy `>=22`. (fallow is a dev/CI-only tool; it is not shipped to consumers.) [VERIFIED: `npm view`]
- **No v2->v3 config auto-upgrade command exists, and none is needed** (no config breaking changes). The `fallow migrate` subcommand migrates knip / jscpd / stylelint configs INTO fallow -- it is not a fallow-version upgrader. `fallow init` / `fallow recommend` scaffold or suggest a fresh config; neither is required here.

## 7. Migration edits for THIS repo

Preserving our new-only diff-gate strategy (do NOT switch to `dead-code`). REQUIRED vs OPTIONAL:

### REQUIRED

- [ ] **`package.json` (root)** -- bump the devDependency. Change `"fallow": "2.103.0"` to `"fallow": "3.6.0"`.
  - Keep it **EXACT (no `^`/`~`)**. This is a stated repo invariant: the v0.0.3 plan and the ci.yml comment both pin fallow exactly so "a fallow release cannot silently flip the gate." Do NOT copy the reference repo's `~3.6.0`. (The new v3.1.0 `dev-dependencies-in-production` rule is exactly the kind of default-change the exact pin guards against -- review the diff, then pin.)
  - The npm script `"fallow": "fallow audit --format human --base origin/main"` stays UNCHANGED.
- [ ] **`package-lock.json`** -- regenerate. After editing package.json, run `npm install` once (the repo has committed `.npmrc legacy-peer-deps=true`; `npm install` inherits it). This replaces the 8 `@fallow-cli/*@2.103.0` entries + the `fallow@2.103.0` entry with 3.6.0 and adds `detect-libc`. Do not hand-edit.
- [ ] **Prove it green:** `npx fallow audit --format human --base origin/main` -> expect exit 0. (Already verified with the 3.6.0 binary against the current tree, see section 8.)

### OPTIONAL (recommended for a clean report; NOT needed for green CI)

- [ ] **`.fallowrc.jsonc`** -- silence the new v3.1.0 warn rule for consistency with our existing dev-dep-hygiene stance. In the `rules` block (which already sets `unused-dev-dependencies:off` and `test-only-dependencies:off` because dev-dep hygiene is owned by `@nx/dependency-checks`, per D-06/D-07), add:
  ```jsonc
  "dev-dependencies-in-production": "off"
  ```
  Without this, CI stays green but the audit report lists 6 informational warnings (`@angular/common`, `@angular/platform-browser`, `@angular/router`, `@nx/js`, `ajv`, `ajv-formats` -- all dev-only imports from apps/fixtures/tooling). This is the same false-positive class we already turn off for the sibling rules.
- [ ] **`.fallowrc.jsonc`** (low priority, perf only) -- if you want to skip the new CSS pass entirely on this no-CSS repo, extend the existing `audit` block to `{ "gate": "new-only", "css": false }`. Harmless to leave on (0 CSS findings in the live run); this only shaves the deep-CSS scan time.
- [ ] **`.fallowrc.jsonc`** (cosmetic) -- the v3 schema recommends `"$schema": "./node_modules/fallow/schema.json"` (version-aligned, offline) over the GitHub `main` URL. The `main` URL still works; change only if you want editor autocomplete pinned to the installed version.

### NO CHANGE NEEDED

- **`.github/workflows/ci.yml`** -- the `fallow` job (`npx fallow audit --format human --base origin/main`, `FALLOW_AUDIT_BASE: origin/main`, `fetch-depth: 0`) works identically on 3.6.0. [VERIFIED]
- **`.planning/config.json`** -- `code_quality.fallow.enabled: true` needs no change for the version bump. (Separate, pre-existing fact: per this repo's CLAUDE.md note, GSD's structural pre-pass calls fallow with the old `--json --profile --stdin-files` flags that are broken on BOTH fallow 2.x and 3.x, so that pre-pass is already a silent no-op; our real gate is the CI job, not the GSD pre-pass. The v3 bump does not change this. Orthogonal to this migration.)
- **`packages/angular-typechecker/package.json`** (the published manifest) -- untouched. fallow is a root devDependency only; this migration does not bump the published package version.

### Doc references (optional hygiene, non-functional)

Live stack docs still cite `fallow@2.103.0` and could be refreshed to `3.6.0` for accuracy: `.planning/PROJECT.md` (lines 24, 32), `.planning/codebase/STACK.md` (line 50). Leave the ARCHIVED milestone records (`.planning/milestones/v0.0.3-*`, `.planning/MILESTONES.md`, `.planning/RETROSPECTIVE.md`, `.planning/STATE.md` history rows) as-is -- they are historical and correctly record what was true at v0.0.3.

## 8. Strategy note: keep `audit --gate new-only`, do NOT adopt `dead-code`

The reference repo (`op-nx/github-cache`) uses `fallow dead-code --fail-on-issues`. Migrating the VERSION does not require adopting that strategy. Tradeoffs if you ever reconsider (separate decision, out of scope for this bump):

| | `audit --gate new-only` (ours) | `dead-code --fail-on-issues` (reference) |
|---|---|---|
| Scope | Files changed since base only | Whole repo |
| Fails on | Only findings the PR INTRODUCES | Any dead-code finding anywhere |
| Analyses | dead-code + complexity + duplication + CSS | dead-code + deps + cycles only (no complexity/dupes/CSS) |
| Base ref | Needs `origin/main` + `fetch-depth: 0` | Base-independent |
| Behavior when base ref absent | Fails open (exits 0) | Always evaluates the whole tree |
| Our fit | Matches our new-only intent + complexity/dup gating (QUAL-01); `.fallowrc.jsonc` `audit.gate` pins it | Would drop complexity/duplication gating and change our green/red contract |

Recommendation: **keep `audit --gate new-only`.** Our repo relies on complexity + duplication gating (multiple `health.ignore` / `duplicates.ignore` entries exist precisely to tune those), which `dead-code` does not run. The `fails-open-when-base-absent` caveat is a non-issue for us because CI pins `--base origin/main` with `fetch-depth: 0`.

## 9. Verification evidence (what was actually run)

- `npm view fallow@3.6.0 version engines bin optionalDependencies dependencies` -> `engines.node >=22`; bins `fallow`/`fallow-lsp`/`fallow-mcp`; `@fallow-cli/win32-arm64-msvc@3.6.0` present; runtime dep `detect-libc@2.1.2`.
- `fallow --help`, `fallow audit --help`, `fallow dead-code --help` (3.6.0 win32-arm64) -> confirmed `audit` exists, `--base` aliases `--changed-since`, `--gate new-only` default, `--format human` default, `FALLOW_AUDIT_BASE` honored.
- `fallow config --root <our-repo> --config .fallowrc.jsonc` (3.6.0) -> loaded clean, exit 0; resolved-config dump shows all our keys parsed. Negative control with a bogus key -> `exit_code 2`, "unknown field", full valid-key list printed (includes `entry`, `ignorePatterns`, `ignoreDependencies`, `ignoreExports`, `duplicates`, `health`, `rules`, `overrides`, `audit`).
- **`fallow audit --format human --base origin/main` (3.6.0, our repo, `FALLOW_AUDIT_BASE=origin/main`)** -> `Audit scope: 194 changed files vs origin/main`; `Metrics: dead code 6 . complexity 0 . duplication 0`; the 6 are `dev-dependencies-in-production` (warn); `dead code: 6 issues (warn)`; "audit gate excluded 4 inherited findings"; **EXIT=0 (gate passes)**.
- Two benign `WARN tsconfig chain not fully loaded` lines fire on our intentional broken-fixture tsconfigs (`fixtures/solution-style-broken-ref/tsconfig.missing.json`, `solution-style-selfref`). fallow falls back gracefully ("usually harmless"); non-gating, pre-existing behavior. Not a migration concern.

## Sources

**Primary (HIGH):**
- Installed `fallow@3.6.0` win32-arm64 binary (`op-nx/github-cache/node_modules/fallow`) -- ran `--help`, `audit --help`, `dead-code --help`, `config`, and the full `audit` gate against our repo.
- `op-nx/github-cache/node_modules/fallow/schema.json` -- the shipped 3.6.0 config JSON Schema (`additionalProperties:false`, all key definitions).
- `npm view fallow@3.6.0` -- registry metadata (engines, bins, optional platform deps).

**Secondary (HIGH, official docs):**
- github.com/fallow-rs/fallow/releases/tag/v3.0.0 -- "No breaking changes" statement + CSS-in-audit description.
- github.com/fallow-rs/fallow/releases/tag/v3.1.0 -- new `dev-dependency-in-production` rule; `rules`-key health exit-1 fix.
- github.com/fallow-rs/fallow/releases/tag/v3.4.2, v3.5.0, v3.6.0 -- CI-format path change, single-binary packaging, compact-JSON default.
