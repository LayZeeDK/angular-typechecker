---
phase: 5
phase_name: "packaging-publish-hardening-e2e-smoke-mvp"
project: "angular-typechecker"
generated: "2026-06-28"
counts:
  decisions: 15
  lessons: 13
  patterns: 13
  surprises: 8
missing_artifacts:
  - "05-UAT.md (no conversational UAT run for this packaging phase)"
  - "05-05-SUMMARY.md (plan 05-05 is a human-only live-publish runbook; verified via repo state + git history + live npm registry instead of a SUMMARY)"
---

# Phase 5 Learnings: packaging-publish-hardening-e2e-smoke-mvp

## Decisions

### Self-contained shipped types over the `typescript` substrate (D-10 option a)
`compiler-cli-types.ts` re-declares the structural type surface (`CompilerCli`/`Program`/`EmitFlags`/`ParsedConfiguration`/`UNKNOWN_ERROR_CODE`) over `import type * as ts from 'typescript'`, instead of the two deep `import type` statements that climbed into `../../../../node_modules/@angular/compiler-cli/...`.

**Rationale:** The deep-relative import escaped the published package and failed to resolve in a consumer install (`attw --pack` returned `InternalResolutionError` on all four profiles). Erasure was not viable because `index.d.ts` re-exports these names. Exported names and the `CompilerCli` member set were preserved verbatim to keep the public contract.
**Source:** 05-01-PLAN.md, 05-01-SUMMARY.md

### `checkVersionMismatches: false` on `@nx/dependency-checks`
Added to the ESLint options so the autofix cannot rewrite the public peer ranges `^22.0.0` / `>=6.0.0 <6.1.0` to the installed exact versions (e.g. `^22.0.0` -> `22.0.4`); the rule still catches MISSING/OBSOLETE deps.

**Rationale:** The peer ranges are the published contract; an autofix narrowing them would silently break consumer compatibility. Never `eslint --fix` the manifest; the manifest spec asserts the exact ranges as a backstop.
**Source:** 05-01-PLAN.md (D-06), 05-01-SUMMARY.md

### Full PKG-01 manifest with explicit `files` allowlist + `publishConfig.provenance`
Extended `package.json` with files/exports/keywords (incl. `nx`+`nx-plugin`)/repository (LayZeeDK casing)/license/description/author (public email)/homepage/bugs/publishConfig, never relying on npm pack defaults.

**Rationale:** A tarball without a `files` allowlist, LICENSE, or `exports` is not registry-eligible or publishable; an explicit allowlist also closes the file-set-leak vector (T-05-01/T-05-05).
**Source:** 05-01-PLAN.md, 05-01-SUMMARY.md

### Audit the PACKED tarball, not the source tree
`publint --strict` + `attw --pack` + file-set + no-install-scripts gates run against the `.tgz` produced by `npm pack` from `dist`, never the source tree.

**Rationale:** A source-tree check cannot catch `files`-allowlist defects, `.d.ts` resolution escapes, or a stale-dist ship; only an audit of the packed artifact can, and it permanently guards against future regressions.
**Source:** 05-02-PLAN.md, 05-02-SUMMARY.md

### publint + attw as exact-pinned ROOT devDeps only
`publint@0.3.21` + `@arethetypeswrong/cli@0.18.4` added to the root `package.json` devDependencies (exact pins), never to the plugin's published manifest, and only after a package-legitimacy verification (both postinstall-free, source-backed, mature).

**Rationale:** They are tooling for the dev/CI workspace (D-09); adding them to the plugin manifest would bloat the tarball and fail dependency-checks. Exact pins match the workspace convention.
**Source:** 05-02-PLAN.md, 05-02-SUMMARY.md

### Consumer fixture wires the PUBLISHED unscoped executor id
The committed `consumer-app` fixture uses `"executor": "angular-typechecker:angular-typecheck"` (+ `includeDeps: true`, no `tsconfig` path-alias to plugin source), NOT the dev-scoped `@angular-typechecker/angular-typechecker:angular-typecheck` key.

**Rationale:** The dev-scoped key would not bind in a real consumer install; wiring the published id and proving a green run is what proves real resolution FROM `node_modules/angular-typechecker` (D-18). This fixture IS the README recipe, proven by execution.
**Source:** 05-03-PLAN.md, 05-03-SUMMARY.md

### Clean install with NO peer-resolution override (B-03 honesty)
The smoke installs the tarball into a tmp workspace with an explicit empty `.npmrc`, `npm_config_userconfig` pointed at a non-existent path, and `npm_config_legacy_peer_deps` env-stripped -- so no `--legacy-peer-deps` ever applies.

**Rationale:** Inheriting the dev repo's committed `legacy-peer-deps=true` would mask a real consumer ERESOLVE; an ERESOLVE must FAIL the test and be surfaced for human remediation, never auto-masked (B-03).
**Source:** 05-03-PLAN.md, 05-03-SUMMARY.md

### `nx.json` release block scoped to `projects: ["angular-typechecker"]`
The release block versions/publishes only the plugin; the spike app, both e2e projects, and the `@fixtures/*` libs are excluded by scope (and carry `"private": true` as defense-in-depth).

**Rationale:** Unscoped release would attempt to version/publish fixtures. Scoping is mandatory (D-11).
**Source:** 05-04-PLAN.md, 05-04-SUMMARY.md

### Tokenless OIDC steady-state publish
The hardened `release.yml` leaves `NODE_AUTH_TOKEN` entirely unset and sets `NPM_CONFIG_PROVENANCE: true` with job-only `id-token: write`; top-level perms are `contents: read`.

**Rationale:** OIDC removes the standing-token leak vector (T-05-15); an empty `NODE_AUTH_TOKEN` value would itself break OIDC (Pitfall 2), so it must be absent, not blank.
**Source:** 05-04-PLAN.md, 05-04-SUMMARY.md

### SHA-pin all GitHub Actions + Dependabot for freshness
Every `uses:` is pinned to a full 40-char commit SHA with a `# vN` comment (`actions/checkout@93cb6efe... # v5.0.1`, `actions/setup-node@a0853c24... # v5.0.0`); `.github/dependabot.yml` tracks the `github-actions` ecosystem weekly.

**Rationale:** A mutable tag (`@v5`) repointed to malicious code is the tj-actions vector (T-05-13); Dependabot keeps the pins current without reintroducing mutable refs.
**Source:** 05-04-PLAN.md, 05-04-SUMMARY.md

### Token-seed-then-OIDC bootstrap for the first publish (D-12)
The live first publish uses a short-lived granular npm write token (added as `NODE_AUTH_TOKEN` temporarily, with `id-token: write` + provenance still active), then registers the npm Trusted Publisher, then revokes the token; every subsequent release is tokenless OIDC.

**Rationale:** npm cannot do a package's FIRST publish via OIDC (npm/cli#8544 still open) and Trusted-Publisher registration is a manual npmjs.com action; the seed-then-revoke sequence leaves no standing secret.
**Source:** 05-05-PLAN.md

### Live first publish is HUMAN-GATED (B-01)
Plan 05-05 is a human runbook; the autonomous chain treats "publish-ready" (05-01..05-04 green + dry-run reviewed) as phase success and STOPS before any real publish.

**Rationale:** The first publish is irreversible (immutable version, name claimed forever, 72h unpublish window) and requires out-of-band npmjs.com actions no agent can perform.
**Source:** 05-05-PLAN.md, 05-VERIFICATION.md

### `release.releaseTag.pattern = "angular-typechecker@{version}"` (Nx 23 nested shape)
Set so the tag `nx release` produces matches the `release.yml` trigger glob `angular-typechecker@*`.

**Rationale:** Without it, the dry-run tag form did not provably match the workflow trigger; the deprecated top-level `releaseTagPattern` is rejected by Nx 23. Applied in commit 785c747 and re-verified via dry-run.
**Source:** 05-VERIFICATION.md

### `publishConfig.access: "public"` added for provenance on a new unscoped package
The shipped manifest carries `publishConfig: { provenance: true, access: "public" }` (planned shape was `{ provenance: true }` with `access` dropped).

**Rationale:** `access: "public"` is required to attach provenance on the FIRST publish of an unscoped package; caught by the seed run and applied in commit 9d3f7b7. Not a security regression -- provenance intact, live 0.0.1 carries it.
**Source:** 05-SECURITY.md

### Declare `PerformCompilationResult.program` non-optional + `getTsProgram(): TsProgram`
In the self-contained types, `program` is declared non-optional and `getTsProgram()` returns `ts.Program & { useCaseSensitiveFileNames(): boolean }`.

**Rationale:** Match the engine's actual guarded usage in `run-typecheck.ts` so the build stays green WITHOUT editing any caller (the build is the drift guard); the public `ts.Program` omits `useCaseSensitiveFileNames()` though the runtime instance exposes it.
**Source:** 05-01-SUMMARY.md

---

## Lessons

### A deep-relative `node_modules` type import does not resolve in a consumer install
The shipped `.d.ts` with `../../../../node_modules/@angular/compiler-cli/...` produced `attw --pack` `InternalResolutionError` on all profiles; only a self-contained type surface resolves once installed.

**Context:** This was the one production-code defect blocking a resolvable tarball; surfaced by the audit tooling, not by the dev build.
**Source:** 05-01-PLAN.md, 05-02-SUMMARY.md

### The build is the drift guard for hand-declared structural types
Replacing real dependency types with hand-declared shapes risks silent divergence; the engine code that CALLS the signatures is the compile-time guard, and it caught two real mismatches during Task 1.

**Context:** Build drift caught `useCaseSensitiveFileNames()` missing on `ts.Program` (TS2339) and the `program?` optionality break (TS18048); both fixed by narrowing the declared shape, never by editing a caller.
**Source:** 05-01-SUMMARY.md

### Literal `git grep` acceptance criteria trip on explanatory comments
A criterion like `git grep -c "<token>" ... returns 0` counts comment lines that mention the token, not just active code. This recurred in every plan (05-01 file header, 05-02 `--ignore-rules` comment, 05-03 `legacy-peer-deps`/`no-color` comments, 05-04 threat-model comments).

**Context:** The fix each time was to reword the comment to convey intent without the bare literal substring; no code change. Spec-level enforcement should strip comments before asserting (05-04's release-hygiene spec does this via `stripCommentLines()`).
**Source:** 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md

### GNU tar misreads a Windows drive-letter path as a remote `host:path`
`tar -xzf D:\...tgz` (Git Bash, Windows arm64) read `D:` as an rsh host -> "Cannot connect to D:", status 128, all tests skipped. GNU's `--force-local` fixes it but BSD tar (macOS CI) lacks that flag.

**Context:** The portable form is a relative tgz filename + relative `-C` subdir under a shared `cwd` -- handled identically by GNU and BSD tar and never exposing a drive letter.
**Source:** 05-02-SUMMARY.md

### `npm install pkg@x.y.z` writes a caret range by default
`npm install -D publint@0.3.21 @arethetypeswrong/cli@0.18.4` wrote `^0.3.21` / `^0.18.4`, failing the exact-pin acceptance check and diverging from the workspace convention.

**Context:** Tighten the specifiers to exact post-install and re-run `npm install` to sync the lockfile.
**Source:** 05-02-SUMMARY.md

### `attw --format json` carries TWO `problems` fields
A top-level `problems` object keyed by entrypoint AND `analysis.problems` (the flat array). The flat array under `analysis` is the one to assert on -- it deep-equals `[]` when resolution is clean.

**Context:** Asserting the wrong field would either always pass or misreport; the spec uses `expect(analysis.problems ?? []).toEqual([])` with no rule-suppression flag.
**Source:** 05-02-SUMMARY.md

### A downstream consumer does not inherit the dev repo's `@nx/angular <22` peer ceiling
The clean install of stable Angular 22.0.4 + Nx 23.0.1 succeeded with no peer override -- the ceiling that forces THIS repo's `legacy-peer-deps=true` is a dev-workspace concern (it installs the `@nx/angular` tooling tree); consumers don't pull `@nx/angular` transitively.

**Context:** This is why B-03 resolved favorably; the README's pre-release note (consumers on Angular `22.x-next`/`-rc` need `--legacy-peer-deps` because `^22.0.0` excludes pre-releases) remains correct and sufficient.
**Source:** 05-03-SUMMARY.md

### `conventionalCommits` auto-bumps the first release to 0.0.2 unless an explicit version is passed
With feat/fix dev commits and no prior tags, `nx release --first-release` derives a bump (0.0.1 -> 0.0.2); the explicit `0.0.1` arg pins the first release to the milestone version.

**Context:** Both the dry-run and the live seed-publish must pass the explicit `0.0.1` specifier.
**Source:** 05-04-SUMMARY.md, 05-05-PLAN.md

### The auto-generated changelog leaks internal GSD plan-id scopes and mis-parses decision refs as issue links
The conventional-commit scope renders as the internal plan id (`feat(05-01):`, `fix(04-03):`) and decision refs (`[#1]`/`[#2]`) become bogus issue links.

**Context:** For the public 0.0.1 release the CHANGELOG.md + GitHub Release body must be hand-curated to a short "Initial release" entry before tag/push -- do not ship the plan-id dump.
**Source:** 05-05-PLAN.md

### npm cannot do a package's first publish via OIDC
npm/cli#8544 is still open; first publish needs a write token, hence the seed-then-OIDC bootstrap.

**Context:** Drives the entire D-12 runbook shape (seed token -> publish -> register Trusted Publisher -> revoke).
**Source:** 05-05-PLAN.md

### The seed publish caught two real defects a dry-run could not
The live seed run surfaced (a) missing `publishConfig.access: "public"` (required for provenance on a new unscoped package) and (b) the granular token's Bypass-2FA flag set; both fixed before steady-state.

**Context:** The seed run doubles as the first real end-to-end test of `release.yml`'s build->pack->publish->provenance->approval machinery; only the OIDC auth swap remained unproven until the next release.
**Source:** 05-VERIFICATION.md, 05-SECURITY.md

### Nx 23 rejects the deprecated top-level `releaseTagPattern`
The tag-pattern alignment fix must use the nested `release.releaseTag.pattern` shape; the old top-level key errors out.

**Context:** Discovered while aligning the tag form with the workflow trigger (commit 785c747).
**Source:** 05-VERIFICATION.md

### GitHub does NOT notify maintainers of new Private Vulnerability Reports by default
Enabling PVR is not enough; watch/notification settings must be adjusted or reports go unseen.

**Context:** Called out as a one-time repo-settings step in the publish-readiness pre-flight.
**Source:** 05-05-PLAN.md

---

## Patterns

### Self-contained structural type re-declaration over the `typescript` substrate
Declare the shipped type surface against `typescript`'s public types rather than importing a dependency's internal `.d.ts`.

**When to use:** Shipping `.d.ts` under `module: nodenext` that must resolve cleanly in a consumer install when the underlying dependency's typings are not nodenext-clean.
**Source:** 05-01-SUMMARY.md

### `@nx/js:tsc` verbatim source-manifest -> dist copy + asset glob for non-compiled files
The build copies `package.json` verbatim into dist; non-compiled files (LICENSE) ship via a `build.options.assets` glob mirroring the `executors.json` entry.

**When to use:** Getting a hand-authored manifest field set and static files (LICENSE/README) into the published tarball without a separate copy step.
**Source:** 05-01-SUMMARY.md

### Build-fresh-then-pack-from-dist `beforeAll`; audit the `.tgz`, never the source
`nx build --skip-nx-cache` -> `npm pack --json` in the dist dir -> run all gates against the packed artifact; `afterAll` removes the `.tgz`.

**When to use:** Any publishing-correctness gate (file-set, types resolution, install scripts) -- only the packed artifact reflects what consumers receive.
**Source:** 05-02-SUMMARY.md

### `npm pack --json files[].path` for cross-OS-deterministic file-set assertions
Use the JSON file list (package-relative, no `package/` prefix) for positive-presence and negative-leak loops instead of shelling out to `tar -t`.

**When to use:** Asserting exactly which files ship, portably across Windows/macOS/Linux runners.
**Source:** 05-02-SUMMARY.md

### Cross-OS tarball extraction: relative filename + relative `-C` under a shared `cwd`
Extract with `cwd: distDir`, a bare tgz filename, and a relative `-C` subdir -- never an absolute Windows path.

**When to use:** Reading the REAL packed `package.json` / `.d.ts` out of a tarball in a test that runs on both GNU and BSD tar.
**Source:** 05-02-SUMMARY.md

### Nested-nx env hygiene (`buildCleanEnv`)
Strip `NX_*` runner vars and set `NX_DAEMON=false`, `FORCE_COLOR=0` before any nested `nx`/`npm` `execSync`, so a nested run is a clean top-level invocation.

**When to use:** Any e2e spec that runs `nx`/`npm` inside a `nx run <e2e>:test` (otherwise inherited `NX_SKIP_NX_CACHE` + forked-runner vars make every nested run a cache-miss / mask exit codes).
**Source:** 05-02-SUMMARY.md, 05-03-SUMMARY.md (carried from Phase 4)

### Per-run `mkdtemp` consumer + `cpSync` the committed fixture; mutate the discarded copy
Copy the committed fixture into a tmp dir, install/run/mutate there, and `rmSync` in `finally` -- no `.pristine` sidecar needed because the copy is thrown away.

**When to use:** Install/run smokes that must mutate source to inject an error; inherently crash-safe (D-18).
**Source:** 05-03-SUMMARY.md

### Clean-install honesty harness
Write an explicit empty `.npmrc` into the tmp workspace, point `npm_config_userconfig` at a non-existent path, and env-strip `npm_config_legacy_peer_deps` so no user/repo-level peer override leaks into the install.

**When to use:** Proving that a published package installs without peer overrides; an ERESOLVE then fails honestly instead of being silently masked.
**Source:** 05-03-SUMMARY.md

### `require()`-the-installed-`executors.json` sanity check before the run
Assert `node_modules/angular-typechecker/executors.json` carries the executor before invoking `nx run`.

**When to use:** Proving the executor resolves FROM the installed package, not a dev path-alias, before the behavioral assertion.
**Source:** 05-03-SUMMARY.md

### String/regex YAML config assertions on comment-stripped YAML (no parser dependency)
Assert CI/release config invariants (no `pull_request_target`, `contents: read`, 40-char SHA pins, `persist-credentials: false`, `NPM_CONFIG_PROVENANCE`, no `NODE_AUTH_TOKEN`) with regex over comment-stripped text instead of adding a YAML parser.

**When to use:** Regression-proofing a small set of workflow/policy invariants without a new dev dependency; strip comments first so a doc comment can neither satisfy nor break the gate.
**Source:** 05-04-SUMMARY.md

### Green-run + injected-error pair as the honesty check
Assert a clean source runs exit 0 AND an injected `TS2322` exits non-zero with the code in stdout and no `ERR_REQUIRE_ESM`/infra-error.

**When to use:** Validating any checker/gate -- it distinguishes "the check ran and passed" from "a no-op exited 0" (a type-checker that lies is worse than none).
**Source:** 05-03-PLAN.md, 05-03-SUMMARY.md

### OIDC tokenless publish (NODE_AUTH_TOKEN absent + NPM_CONFIG_PROVENANCE true + id-token:write)
Steady-state CI publish carries no standing npm secret; provenance comes from the id-token OIDC path; npm CLI >= 11.5.1 + Node >= 22.14.0 + cloud runner are the floor.

**When to use:** Any npm publish workflow after the first publish, to remove the long-lived-token leak vector while keeping provenance.
**Source:** 05-04-SUMMARY.md

### SHA-pinned GitHub Actions with Dependabot freshness
Pin every `uses:` to a 40-char commit SHA (with a `# vN` comment) and let Dependabot's `github-actions` ecosystem bump the SHA + comment.

**When to use:** Any privileged/publishing workflow, to defeat mutable-tag repointing while staying current.
**Source:** 05-04-SUMMARY.md

---

## Surprises

### `attw --pack` reported problems-empty with NO escalation needed
The B-02 escalation trigger (a real, unmasked resolution/FalseCJS problem) never fired; the 05-01 self-contained-types fix fully resolved the `InternalResolutionError` on the first audit.

**Impact:** The phase's central risk (a public-API widening or unfixable resolution escape) evaporated -- no API change, no escalation, the type surface resolves cleanly in a consumer install.
**Source:** 05-02-SUMMARY.md

### The public `ts.Program` type omits `useCaseSensitiveFileNames()`
The runtime program instance exposes it, but the published `ts.Program` interface does not, so a naive `getTsProgram(): ts.Program` failed to type-check the engine's call (TS2339).

**Impact:** Required a `TsProgram = ts.Program & { useCaseSensitiveFileNames(): boolean }` intersection -- structurally accurate, no caller change.
**Source:** 05-01-SUMMARY.md

### Angular types `PerformCompilationResult.program` as optional, but the engine reads it unguarded
`run-typecheck.ts` accesses `result.program` unguarded on the non-infra-failure path (the infra path re-throws first), so a faithful `program?: Program` declaration broke the build.

**Impact:** Declared `program: Program` non-optional to match the engine's guarded usage; the infra-failure spec is unaffected (it casts via `as unknown as CompilerCli`).
**Source:** 05-01-SUMMARY.md

### B-03 resolved favorably -- the feared consumer ERESOLVE did not materialize
The clean install (no override) of the published peers against stable Angular 22.0.4 succeeded; the dev repo's `@nx/angular <22` ceiling never reaches consumers.

**Impact:** No range-widening and no "await @nx/angular 23.1.x" action needed for the stable path; the B-03 human call became low-stakes.
**Source:** 05-03-SUMMARY.md

### The seed publish doubled as the first real end-to-end test of the release pipeline
Beyond bootstrapping the package, the seed run exercised `release.yml`'s build->pack->publish->provenance->approval machinery and caught two real defects (`publishConfig.access` and the token's Bypass-2FA flag) a dry-run could not.

**Impact:** Two publishing-correctness fixes landed before steady state; only the OIDC auth swap remained unproven until the next release.
**Source:** 05-VERIFICATION.md, 05-SECURITY.md

### The comment-false-positive class recurred in all four executed plans
Despite being identified in 05-01, the same literal-`git grep`-trips-on-comments trap reappeared in 05-02, 05-03, and 05-04.

**Impact:** Each occurrence cost a reword cycle; it argues for writing acceptance criteria that strip comments (or avoid bare literal tokens in criteria) from the start rather than per-plan firefighting.
**Source:** 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md

### Plan 05-05 produced no SUMMARY -- it was verified from repo + git + live registry
Because the live publish is a human-only runbook, there is no execution SUMMARY; the security and verification audits instead reconstructed it from git history (seed-token activate `136f1ac` -> revert `4708eae`), repo state, and `npm view angular-typechecker --json` (provenance + SLSA attestation on 0.0.1).

**Impact:** Provenance/Trusted-Publisher controls are CLOSED-by-operational-attestation where they are not code-readable; future audits must flip them to OPEN if the steady-state workflow reintroduces a standing token or provenance drops.
**Source:** 05-VERIFICATION.md, 05-SECURITY.md

### Vitest 4 emits a non-fatal `poolOptions` deprecation warning
Cloning the Phase-4 cache-e2e `vitest.config.mts` verbatim (incl. the `poolOptions.forks` shape) carried a deprecation warning under Vitest 4.

**Impact:** Parity with the proven analog was kept over silencing the warning -- a deliberate accept, noted so a future config cleanup knows it is cosmetic.
**Source:** 05-02-SUMMARY.md

---
