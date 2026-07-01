# Phase 11: Fallow code-quality CI gate -- Discuss Research

**Researched:** 2026-06-30
**Tool under evaluation:** `fallow` (npm) v2.103.0
**Method:** real command output captured via `npx --yes fallow@latest ...` (nothing installed/persisted); config schema dumped via `fallow config-schema`; live `audit` run against this repo with `--base origin/main`.

> All command output below is quoted verbatim from this session. Where a task expectation did
> not reproduce it is flagged explicitly.

## Version & bins

- `registry.npmjs.org/fallow` -> `dist-tags.latest = 2.103.0` (only one dist-tag: `latest`). Confirmed **2.x**.
- `bin`: `{"fallow":"bin/fallow","fallow-lsp":"bin/fallow-lsp","fallow-mcp":"bin/fallow-mcp"}` -> three binaries: `fallow`, `fallow-lsp`, `fallow-mcp`.
- `engines.node`: `">=16"`.
- Self-reported version in audit JSON: `"version": "2.103.0"`, audit `"schema_version": 7`.

## CLI flags (verified)

Captured from `--help`, `audit --help`, `init --help`. All confirmations are quoted exactly.

### `fallow audit` (the gate)

| Question                            | Answer          | Exact flag text from `--help`                                                                                                                                                                                           |
| ----------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--format json`?                    | YES             | `-f, --format <FORMAT>` ... `[aliases: --output]` ... `[possible values: human, json, sarif, compact, markdown, codeclimate, pr-comment-github, pr-comment-gitlab, review-github, review-gitlab, badge]`                |
| `--base <ref>` / `--changed-since`? | YES (same flag) | `--changed-since <CHANGED_SINCE>` ... `[aliases: --base]`                                                                                                                                                               |
| `--gate new-only\|all`?             | YES             | `--gate <GATE>` -- `new-only (default): fail only on findings introduced by the current changeset. all: fail on every finding in changed files and skip base-snapshot attribution.` Possible values: `new-only`, `all`. |
| `--ci`?                             | YES             | `--ci` -- `CI mode: equivalent to --format sarif --fail-on-issues --quiet`                                                                                                                                              |
| `--brief`?                          | YES             | `--brief` -- `Render the deterministic review brief instead of the gating audit report ... ALWAYS exits 0 (the verdict is carried informationally). ... Orthogonal to --format`                                         |
| `-o <file>`?                        | YES             | `-o, --output-file <PATH>` -- `Write the report to a file instead of stdout, for any --format (no ANSI codes)`                                                                                                          |

Other audit-relevant flags observed: `--diff-file <PATH>` / `--diff-stdin` (line-level scoping; "Project-level findings still bypass this filter. When both this and `--changed-since` are set, the diff filter wins for finding scope while `--changed-since` still drives file discovery"), `--fail-on-issues`, `--sarif-file <PATH>`, `--max-crap <N>` (default 30.0), `--dead-code-baseline` / `--health-baseline` / `--dupes-baseline` (the global `--baseline`/`--save-baseline` are **rejected** on `audit`), `--production-dead-code|health|dupes`, `--summary`. `review` is an alias of `audit` that implies `--brief`.

> Note: there is **no top-level `--gate` or `--brief`** -- both are `audit`-subcommand flags only. `--format`, `--base`/`--changed-since`, `--ci`, `-o` ARE global (present on every subcommand including `init`).

### Config discovery flag

`-c, --config <CONFIG>` -- `Path to config file (.fallowrc.json, .fallowrc.jsonc, fallow.toml, or .fallow.toml)`.

## Gate semantics

- **Default gate = `new-only`** (verified in `audit --help` and in the live run: `attribution.gate = "new-only"`).
- **`new-only`**: only findings _introduced by the current changeset_ affect the verdict (cause exit 1). Inherited/pre-existing findings are still **reported** but do not gate. Each JSON finding carries `"introduced": true|false`. Confirmed live: 28 dead-code issues total, of which `dead_code_introduced: 12` / `dead_code_inherited: 16` -- the verdict was `fail` because 12 were introduced.
- **`all`**: fails on _every_ finding in changed files and **skips the base-snapshot attribution pass** (cheaper; no new-vs-inherited computation).
- **Base ref resolution when `--base`/`--changed-since` is unset** (quoted): "the base is the git merge-base against the branch's upstream or the remote default (`origin/HEAD`, `origin/main`, `origin/master`); set `FALLOW_AUDIT_BASE` to pin it."
- **Attribution mechanism**: `new-only` runs an extra **base-snapshot** pass -- it analyzes the tree at `--base` and diffs findings, so a finding present at the base = inherited, a finding absent at base but present now = introduced. This requires git to resolve and check out / read the base ref's tree.
- **Git history depth**: `--changed-since`/`--base` and the attribution pass **require git** (help: "`audit`, `impact`, and `--changed-since` still require git"). The base ref (`origin/main`) must be present locally and resolvable to a tree. In CI with a shallow `actions/checkout` (default `fetch-depth: 1`), `origin/main`'s merge-base may be unreachable -> **use `fetch-depth: 0`** (or at least fetch enough history to reach the merge-base) for reliable new-vs-inherited attribution. With `--gate all` the base snapshot is skipped, so deep history matters less, but file discovery via `--changed-since` still needs the base ref reachable.

## Config schema (entry points / ignores / rules / profiles / discovery)

`fallow init` (run in a scratch dir, Detected: JavaScript) created **`.fallowrc.json`** (NOT `.fallowrc.jsonc` by default) plus a `.gitignore` with a `.fallow/` entry. The generated file nonetheless contains **JSONC comments** and a `$schema` pointer:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/fallow-rs/fallow/main/schema.json",
  "entry": ["src/index.{js,jsx,mjs}", "src/main.{js,jsx,mjs}"],
  "duplicates": {
    "minOccurrences": 3,
    // "ignore": ["**/lib/**", "**/legacy/**", "**/__generated__/**", "**/generated/**"]
  },
  "rules": {},
}
```

(`--toml` would emit TOML instead. To get a `.fallowrc.jsonc` filename specifically, rename -- both extensions are auto-discovered.)

Full schema dumped via `fallow config-schema` (2294 lines). Relevant keys:

### Entry points (files reachable only via tsconfig `files`, not the import graph)

- **`entry`**: `array` of **glob strings** (e.g. `"src/index.{js,jsx,mjs}"`). This is the key for declaring a build-time tripwire / tsconfig-`files`-only file so it is NOT flagged `unused_files`. For IN-02, add the drift file's path here, e.g. `"packages/angular-typechecker/src/core/compiler-cli-types.drift.ts"`.
- Related: `framework` (array of `ExternalPluginDef`) -- fallow auto-detected an Angular plugin in the live run (`entry_points.sources.plugin: 56`), `EntryPointRole` enum `runtime|test|support` governs how plugin entry points count toward reachability.
- `includeEntryExports` (bool) / `--include-entry-exports`: report unused exports even in entry files (default off -> entry-file exports auto-marked used).

### Ignoring / scoping files or specific symbols

- **`ignoreExports`**: `array` of `IgnoreExportRule` = `{ "file": "<glob>", "exports": ["name", ...] }` where `"*"` ignores all exports of the matched file. This is the key for pinning a specific exported symbol (e.g. the contract-mirror enum / a single type export) without suppressing the whole file.
- **`ignorePatterns`**: `array` of glob strings -- exclude whole paths from analysis.
- **`ignoreDependencies`**: `array` of package-name strings -- the documented escape hatch for false-positive `unused-dependencies` (fallow's own JSON findings emit an `add-to-config` action pointing at this exact key).
- **`usedClassMembers`** (`UsedClassMemberRule`): mark class members as framework-used either globally (a name/glob) or `ScopedUsedClassMemberRule` (`{ extends?, implements?, members: [...] }`) -- relevant for Angular lifecycle / decorator-driven members.
- **`ignoreExportsUsedInFile`** (bool or `{type, interface}` by-kind), `ignoreDecorators`, `ignoreUnresolvedImports`, `ignoreDependencyOverrides`, `ignoreCatalogReferences` -- other targeted ignore knobs.
- **Inline suppression** (per finding, not config): fallow emits `suppress-line` / `suppress-file` actions with exact comment tokens. Verified live tokens:
  - file-level: `// fallow-ignore-file unused-file`
  - line-level (above the line): `// fallow-ignore-next-line unused-type`, `// fallow-ignore-next-line unused-enum-member`, `// fallow-ignore-next-line unused-dependencies`, `// fallow-ignore-next-line unused-component-input`, `// fallow-ignore-next-line unrendered-components`
  - There is a `require-suppression-reason` rule (opt-in) that forces every `fallow-ignore-*` / `@expected-unused` comment to carry a reason.

### Per-rule severity / disable (config-driven: YES)

- **`rules`** (`RulesConfig`): per-issue-type severity. Rule names are **kebab-case**; values are the `Severity` enum: **`"error"`** (report + fail CI), **`"warn"`** (report, no fail), **`"off"`** (don't detect/report). Example: `"rules": { "unused-files": "error", "unused-dev-dependencies": "off" }`.
- Relevant rule keys (kebab-case): dead-code -> `unused-files`, `unused-exports`, `unused-types`, `unused-enum-members`, `unused-class-members`, `unused-dependencies`, `unused-dev-dependencies`, `unused-optional-dependencies`, `unresolved-imports`, `circular-dependencies`, `boundary-violation`, plus Angular-specific `unused-component-inputs` / `unused-component-outputs` / `unrendered-components`. Duplication and complexity are configured via their own blocks (below), not via a single `rules` key.
- **Per-file override**: `overrides` = array of `ConfigOverride` `{ "files": ["<glob>", ...], "rules": <PartialRulesConfig> }` -- lets you set a rule to `off`/`warn` for a specific path (e.g. all `fixtures/**`).
- **Duplication** config block `duplicates` (`DuplicatesConfig`): `enabled`, `mode` (`strict|mild|weak|semantic`), `minTokens`, `minLines`, `minOccurrences` (default scaffold = 3), `threshold`, `ignore`, `ignoreDefaults`, `skipLocal`, `crossLanguage`, `ignoreImports` (default true).
- **Complexity** config block `health` (`HealthConfig`): `maxCyclomatic` (default 20), `maxCognitive` (default 15), `maxCrap` (default 30.0), `ignore` (globs), `thresholdOverrides` (per-file/per-function).
- **Audit defaults** block `audit` (`AuditConfig`): `gate` (`AuditGate` = `new-only|all`), `deadCodeBaseline`, `healthBaseline`, `dupesBaseline`, `cacheMaxAgeDays`. So the gate can be pinned in config (`"audit": { "gate": "new-only" }`) instead of on the CLI.

### Profiles

- **There is NO `profiles` concept in the config schema** (0 occurrences of "profile" in the 2294-line schema). The fallow 2.x equivalents are: **`extends`** (array of config paths to inherit from), **`rulePacks`** (declarative rule-pack files), and **`overrides`** (per-glob rule severity). The CLI selects analysis scope via `--only` / `--skip` (dead-code/dupes/health), `--production`, and `--workspace`, NOT a named profile.
- (This corrects the old CLAUDE.md note that said "profiles are config-file driven, not a CLI option" -- in 2.103.0 there is no `--profile` flag AND no `profile` config key. Use `extends` + `overrides` instead.)

### Config file discovery (auto-discovered)

Verified from `-c, --config` help text: **`.fallowrc.json`, `.fallowrc.jsonc`, `fallow.toml`, `.fallow.toml`** (in that listed order). Per global preference, prefer `.fallowrc.jsonc` (comments allowed) -- `init` emits JSONC content even into the `.json` filename, so renaming to `.jsonc` is clean.

## Actual findings on this repo

Command: `npx --yes fallow@latest audit --format json --base origin/main` run from `D:\projects\github\LayZeeDK\angular-typechecker`.

- **Exit code 1**, `verdict: "fail"`, no stderr. `base_ref: "origin/main"`, `head_sha: "d5cd2cc"`, `changed_files_count: 108`, `elapsed_ms: 1282`.
- `summary`: `dead_code_issues: 28` (`dead_code_has_errors: true`), `complexity_findings: 0`, `max_cyclomatic: null`, `duplication_clone_groups: 0`.
- `attribution`: `gate: "new-only"`, `dead_code_introduced: 12`, `dead_code_inherited: 16` (complexity/duplication all 0).
- `entry_points`: total 60 (`default_index: 2`, `package.json: 2`, `plugin: 56`) -- fallow auto-loaded an Angular plugin.
- **`fallow audit --brief --base origin/main` exits 0** as documented (verdict carried informationally). It also surfaced a "Decisions to make (3)" public-api-contract section (changed contracts consumed by modules outside the diff: `TypecheckInfrastructureError`, `gatherAllDiagnostics`, etc.) -- informational, non-gating.

### Known-expected false positives -- reproduction status

| ID    | Expectation                                                                 | Reproduced?                 | Evidence                                                                                                                                                                                                                                                                                                             |
| ----- | --------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IN-02 | `compiler-cli-types.drift.ts` flagged `unused_file` (tsconfig-`files`-only) | **YES**                     | `unused_files: [{ path: "packages/angular-typechecker/src/core/compiler-cli-types.drift.ts", introduced: true }]`. Fix: add to `entry` (or `// fallow-ignore-file unused-file`).                                                                                                                                     |
| IN-03 | `EmitFlags` enum members flagged unused (mirror shim)                       | **YES**                     | `unused_enum_members` = all 7 members `DTS, JS, Metadata, I18nBundle, Codegen, Default, All` of `EmitFlags` in `compiler-cli-types.ts` (L110-116), all `introduced: true`. Fix: `unused-enum-members: "off"` (scoped via `overrides` on that file) or inline `// fallow-ignore-next-line unused-enum-members`.       |
| IN-04 | `UNKNOWN_ERROR_CODE` const flagged `unused_types`                           | **YES (as `unused_types`)** | `unused_types: [{ path: "...compiler-cli-types.ts", export_name: "UNKNOWN_ERROR_CODE", is_type_only: true, line: 130, introduced: false }]`. Note `introduced: false` -> inherited, so it does NOT gate today; still reported. Fix: `ignoreExports` `{file, exports:["UNKNOWN_ERROR_CODE"]}` or `unused-types: off`. |
| IN-05 | `publishConfig.provenance` mislabeled `unused_dependency`                   | **NO -- did not reproduce** | 0 mentions of `provenance`/`publishConfig` in the audit JSON. `publishConfig.provenance: true` exists at `packages/angular-typechecker/package.json:52` but fallow did NOT flag it. **The IN-05 false positive does not occur in 2.103.0 -- no suppression needed for it.**                                          |

### OTHER genuine / additional findings (not in the expected list)

fallow analyzes the **root** `package.json` (the workspace dev manifest), not the published `packages/angular-typechecker/package.json`. This drives a large block of dependency findings:

- **`unused_dependencies` (1):** `@angular/forms` (root `package.json:52`, `introduced: false`). Likely a genuine question -- is `@angular/forms` actually needed? If it is a deliberate fixture/peer-test dep, add to `ignoreDependencies`; otherwise it is real dead weight.
- **`unused_dev_dependencies` (14, all `introduced: false`):** `@angular-devkit/core`, `@angular-devkit/schematics`, `@angular/language-service`, `@arethetypeswrong/cli`, `@eslint/js`, `@nx/plugin`, `@schematics/angular`, `@swc-node/register`, `@swc/helpers`, `@typescript-eslint/utils`, `angular-eslint`, `eslint-config-prettier`, `publint`, `typescript-eslint`. These are config/build/tooling deps fallow cannot reach by import graph (ESLint flat-config plugins, swc register, attw/publint CLIs). **Mostly false positives** -- suppress via `ignoreDependencies` and/or run audit with `--production` to change dev-dep handling. Worth a human pass to confirm none are genuinely removable.
- **`unrendered_components` (3, `introduced: true`):** `fixtures/fault-isolation/non-template-error.component.ts` (NonTemplateErrorComponent), `survivor.component.ts` (SurvivorComponent), `tcb-poison.component.ts` (TcbPoisonComponent) -- intentional test fixtures rendered nowhere. Suppress via an `overrides` block on `fixtures/**` (`unrendered-components: off`) or `ignorePatterns`.
- **`unused_component_inputs` (1, `introduced: true`):** `fixtures/fault-isolation/tcb-poison.component.ts:36` `someInput` -- again an intentional fixture. Same fixture-scoped suppression.
- Empty (clean): `unused_exports`, `unlisted_dependencies`, `private_type_leaks`, `circular_dependencies`, `unused_optional_dependencies`, all complexity and duplication findings.

**Net:** with no config present today the gate fails (exit 1) on 12 introduced findings -- the EmitFlags enum members (7), the drift unused-file (1), the fixture unrendered-components (3), and the fixture unused-component-input (1). A `.fallowrc.jsonc` must (a) add the drift file to `entry`, (b) turn `unused-enum-members` off for `compiler-cli-types.ts`, (c) scope-off the `fixtures/**` component rules, (d) add the legit-but-untraceable dev/tooling deps to `ignoreDependencies`, and (e) `ignoreExports` the `UNKNOWN_ERROR_CODE` type export. IN-05 needs nothing.

## Open questions / caveats

1. **fallow gates on the ROOT `package.json`, not the published package manifest.** All 15 dependency findings target root deps. Decide whether the gate should run at repo root (current behavior, noisy dev-dep false positives) or be scoped (`--workspace`/`--root packages/angular-typechecker`) to the published package. The known IN-05 (`publishConfig.provenance`) expectation was based on the package manifest, which fallow did not analyze -- hence it never fired.
2. **`@angular/forms` (prod dependency) may be a genuine finding,** not a false positive -- confirm before blanket-ignoring.
3. **Default filename is `.fallowrc.json`, not `.fallowrc.jsonc`,** despite the content being JSONC. Rename if the `.jsonc` extension is wanted (both auto-discovered).
4. **No `profiles` / `--profile`.** Any plan text assuming a profile mechanism (incl. the stale CLAUDE.md note) is wrong for 2.103.0; use `extends` + `overrides` + `--only/--skip`.
5. **CI git depth:** `new-only` attribution needs `origin/main`'s merge-base reachable -- require `fetch-depth: 0` in `actions/checkout`, or pin `FALLOW_AUDIT_BASE`. `--gate all` avoids the base-snapshot pass but still needs the base ref for file discovery.
6. **`introduced` flag is changeset-relative.** Findings like `UNKNOWN_ERROR_CODE` and the 15 deps are currently `inherited` (`introduced:false`) only because they predate `origin/main`'s merge-base on this branch; on a clean PR that touches those files they could flip to `introduced` and start gating. Suppress them in config regardless so they are deterministic.
7. **Old CLAUDE.md drift note is now partly stale:** the `--json`/`--profile`/`--stdin-files` rejection it describes is correct, but it should be updated to reflect that `--gate`, `--brief`, `--ci`, `-o`, and `--base` all exist and work in 2.103.0 (the GSD pre-pass remains a no-op for other reasons).
