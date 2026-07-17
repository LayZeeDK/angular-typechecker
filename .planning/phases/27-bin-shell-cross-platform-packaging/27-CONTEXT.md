# Phase 27: Bin shell + cross-platform packaging - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Mode:** `--auto` (autonomous discuss) `--analyze` `--chain`

<domain>
## Phase Boundary

Ship the thin cross-platform `src/cli/bin.ts` OS shell -- the THIRD adapter's
process boundary over the same pure `run(argv, env)` core Phase 26 built. `bin.ts`
is the ONLY site that touches `process.exit` / stream writes; it wraps `run()`,
writes the returned `stdout`/`stderr`, and owns the literal OS exit code
flush-safely. The package ships the CLI under two `bin` names
(`angular-typechecker` primary + `atc` alias) resolving to one compiled
`src/cli/bin.js`, with the `#!/usr/bin/env node` shebang and the CJS->ESM
`await import()` bridge surviving `@nx/js:tsc` into the BUILT and PUBLISHED
artifact, an nx-free `src/cli/**` import boundary enforced by lint + a static
build guard, and the whole milestone proven additive-only vs
`angular-typechecker@0.2.1`.

**In scope (this phase):**
- `src/cli/bin.ts` -- the shebang + the `process.exit`/stream-write shell over `run()` (CLI-01, EXIT-02's bin half).
- `package.json` `bin` field (two names -> `./src/cli/bin.js`) (CLI-01).
- `tsconfig.lib.json` `newLine: lf` + a `.gitattributes` LF guard (PKG-01).
- Confirming the shared `module: nodenext` build so the ESM bridge is not downleveled (PKG-02).
- The `src/cli/**` ESLint import-ban (CLI-03's enforcement half).
- `bin-static.spec.ts` (`test` tier) -- shebang + nx-free `require`-graph static guard (VER-03).
- Extending `tarball-audit.e2e.spec.ts` with the publint bin audit (PKG-01, published-artifact half).
- The additive-only git-diff / barrel-drift audit vs the `0.2.1` tag + a `27-ADDITIVE-AUDIT.md` (ADD-01).

**Out of scope (later phases):** the NEW `angular-typechecker-cli-e2e` project
that INSTALLS + RUNS the shipped bins for literal `0`/`1`/`2` through the real
package-manager `.bin` shim (npm/yarn/pnpm, Linux + Windows) and the real-clone
UAT -- Phase 28 (VER-04/05); README `## Standalone CLI` + exit-code table +
curated CHANGELOG -- Phase 29 (DOC-01). All load-bearing correctness
(`run()`, exit-code compose, parse, path resolution) already shipped in Phase 26 --
this phase adds NO engine or verdict behavior, only the OS shell + packaging.

</domain>

<decisions>
## Implementation Decisions

> **`--auto` note.** Every decision below was auto-locked in a single pass. All
> are HIGH-confidence -- locked by the ROADMAP Phase-27 success criteria, the
> Phase-27 requirements, the milestone PITFALLS research, and the already-shipped
> `run()` contract (its docstring in `main.ts` spells out the `bin.ts` shell
> verbatim). NONE fell in the high-impact + low-confidence "trap quadrant," so no
> user checkpoint was raised. D-07 and D-11 (the two calls with any genuine
> latitude) were resolved by the two facts discovered during codebase scout
> (`publint` + `tarball-audit.e2e.spec.ts` already exist; there is no repo
> `.gitattributes`) and are individually flagged reversible.

### `bin.ts` shell -- the only process.exit / stream-write site (CLI-01, EXIT-02)
- **D-01:** `src/cli/bin.ts` is a thin wrapper: call `run(process.argv.slice(2))`,
  then `process.stdout.write(result.stdout)`, `process.stderr.write(result.stderr)`,
  and set the exit code from `result.exitCode`. This contract is ALREADY specified
  verbatim in `main.ts`'s docstring ("`bin.ts` (Phase 27) is the ONLY tier that
  writes those strings and exits the process"). `bin.ts` adds NO logic beyond wiring.
- **D-02:** Flush-safety (Pitfall 6): set `process.exitCode = result.exitCode` and
  let the event loop drain stdout/stderr naturally -- do NOT call
  `process.exit(code)` immediately after writing (it truncates buffered stdout on a
  PIPE -- every CI run + the e2e `execSync` capture -- dropping the tail `TSxxxx`
  code an assertion needs). This is exactly why the requirement calls `bin.ts`
  "flush-safe on large buffered output." If an explicit `process.exit` is ever
  unavoidable, only after a write-callback / drain.
- **D-03:** `run()` RE-THROWS any non-`TypecheckInfrastructureError` failure (see
  `main.ts` catch). `bin.ts` wraps the `run()` call so an unknown throw is caught,
  written to `process.stderr`, and mapped to exit `2` -- `run()` never swallows an
  unknown failure and reports a clean/typed verdict.

### `bin` names + package.json field (CLI-01, Pitfall 8)
- **D-04:** `package.json` gains
  `"bin": { "angular-typechecker": "./src/cli/bin.js", "atc": "./src/cli/bin.js" }`
  -- both names -> the ONE compiled `./src/cli/bin.js` (compiled JS, consistent
  with `main: ./src/index.js`; NEVER `.ts`). `angular-typechecker` is primary,
  `atc` the alias.
- **D-05:** `bin` is a NEW manifest field. Verify `@nx/js:tsc` preserves it into the
  published `dist/.../package.json` (it already preserves
  `executors`/`generators`/`builders`; `bin` must be confirmed to survive -- the
  tarball audit in D-11 does this). NO `files` change is needed -- `bin.js` emits
  under `src/`, already whitelisted in `files: ["src", ...]`. The package `version`
  STAYS `0.2.1` -- the bump is the human-gated Release-PR flow (AGENTS.md), NOT this
  phase.

### Shebang survival + ESM bridge (PKG-01, PKG-02, Pitfalls 2/4)
- **D-06:** Pin `"newLine": "lf"` in `tsconfig.lib.json` `compilerOptions` (the
  BUILD tsconfig -- the one that ships). Deterministic LF emit across hosts: this
  repo builds on Windows arm64 where an unset `newLine` can emit CRLF, so the
  compiled `bin.js` would carry `\r` on the shebang line and fail on Linux/macOS CI
  with `env: 'node\r': No such file or directory`. This stabilizes the WHOLE package
  emit (not just `bin.js`); the change is dist-only (gitignored) and does NOT affect
  the ADD-01 public-surface audit.
- **D-07:** Add a repo-root `.gitattributes` LF guard on the TypeScript SOURCE
  (`*.ts text eol=lf`) -- there is no `.gitattributes` today. Deliberately NARROW:
  NOT a repo-wide `* text=auto eol=lf` renormalization, which would churn committed
  fixtures (the `.prettierignore`'d `ng-cli-workspace` `ng new` output + committed
  lockfiles). `newLine: lf` (D-06) is the primary emit guard; `.gitattributes` is
  belt-and-suspenders on the source. REVERSIBLE -- the planner may narrow further to
  the bin path only if preferred.
- **D-08:** NO separate bin tsconfig. `bin.ts` compiles under the SAME
  `tsconfig.lib.json` (`module: nodenext` via `tsconfig.json`) as the rest of the
  package, so the CJS->ESM `await import('@angular/compiler-cli')` bridge (reached
  transitively through `core/compiler-loader.ts`) is NEVER downleveled to
  `require()` (no `ERR_REQUIRE_ESM` on the first real type-check). `package.json`
  stays `type: commonjs`. This is the GATE A build invariant already proven by
  `gate-a-static.spec.ts`; `bin.js` inherits it.

### nx-free CLI boundary -- the enforcement half (CLI-03)
- **D-09:** Add an ESLint `@typescript-eslint/no-restricted-imports` block scoped to
  `**/src/cli/**/*.ts`, modeled on the existing `**/src/core/**/*.ts` D-11 block in
  `eslint.config.mjs`: ban `nx`, `@nx/*`, `@angular-devkit/*`, the adapter modules
  (`executor.ts` / `builder.ts` / generators / schematics), and the barrel
  (`../index`). DIFFERENCE from the core block: do NOT add `no-console` or
  `no-restricted-properties: process.exit` -- `bin.ts` LEGITIMATELY writes streams
  and sets the exit code. `main.ts`'s stream-free / exit-free purity (EXIT-02) is
  guarded by its VER-01 unit tests, not by lint. Phase 26 already respects this
  boundary by construction; Phase 27 makes it enforced.

### Static build guard (VER-03)
- **D-10:** `bin-static.spec.ts` (`test` tier, `dependsOn: build`, modeled on
  `gate-a-static.spec.ts` -- reuse its dist-read scaffolding: `packageRoot` /
  `workspaceRoot` / `distRoot` derived from `project.json`
  `build.options.outputPath`, `fs.readFileSync`, `stripCommentLines`). Asserts:
  (a) the built `dist/.../src/cli/bin.js` FIRST line is exactly
  `#!/usr/bin/env node` with NO `\r` (CRLF guard, meaningful on the Windows arm64
  build host); (b) the built bin's `require` graph never reaches `@nx/devkit`/`nx`
  -- a STATIC transitive walk from `bin.js` following relative `require()`s,
  asserting no reachable built `.js` `require()`s an `@nx/`/`nx` package specifier.
  Static / test-tier ONLY here; the RUNTIME `require.cache` module-graph probe on
  the INSTALLED bin is Phase 28 (VER-04). The cold-start-budget (`--version` < ~300ms)
  assertion (Pitfall 3 "optional") is NOT done -- speculative; the static graph walk
  already proves no nx chain is loaded.

### Tarball publint bin audit (PKG-01, published-artifact half)
- **D-11:** EXTEND the EXISTING
  `e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts` (`publint` is
  ALREADY a dev-dependency; no new dependency, no new project) to assert on the
  PACKED tarball: (a) `package.json` `bin` maps BOTH `angular-typechecker` and `atc`
  -> an existing `src/cli/bin.js` inside the tarball; (b) that `src/cli/bin.js` first
  line is a `\r`-free `#!/usr/bin/env node` shebang; (c) `publint` passes for the
  bin. This closes PKG-01's published-artifact half in-phase. REVERSIBLE -- if the
  planner finds the packed-tarball assertion better belongs beside Phase 28's new
  install-and-run project, it can move there; the dist-level VER-03 guard (D-10)
  remains Phase 27's authoritative shebang/nx-free proof either way. Phase 28's NEW
  `angular-typechecker-cli-e2e` project does the install-and-RUN for literal
  `0`/`1`/`2`.

### Additive-only audit (ADD-01)
- **D-12:** Prove the milestone additive-only vs `angular-typechecker@0.2.1` (the
  git tag EXISTS -- the concrete baseline): (a) confirm the barrel-drift tripwire
  (`src/index.drift.ts` + `tsconfig.drift.json`) stays green -- the 5 barrel exports
  byte-unchanged; (b) git-diff the public surface vs the `angular-typechecker@0.2.1`
  tag -- NO breaking change to the Nx executor id (`angular-typechecker:typecheck`),
  the `runTypecheck` / `CoreResult` / `CoreOptions` API, the Angular CLI builder, or
  the generator/executor/builder schemas; (c) confirm the `bin` field + `src/cli/**`
  are net-new additive; (d) write `27-ADDITIVE-AUDIT.md` modeled on
  `24-ADDITIVE-AUDIT.md`. The `v0.3.0` breaking-change escape hatch stays
  untriggered.

### Claude's Discretion
- Internal `bin.ts` structure (a `main()` wrapper + `.then/.catch` vs top-level
  await), as long as it is flush-safe (D-02) and adds no logic beyond wiring.
- Exact `.gitattributes` scope within the narrow/additive constraint (D-07):
  `*.ts eol=lf` vs a bin-only rule.
- The `bin-static` transitive-walk implementation (how it regexes require
  specifiers per built `.js` and follows relatives), as long as it proves the graph
  from `bin.js` is nx-free.
- Whether the `src/cli/**` ESLint block lists the executor/builder relative paths
  explicitly or relies on the `nx`/`@nx/*` bans -- both achieve nx-free.
- Fixture / assertion reuse when extending `tarball-audit.e2e.spec.ts` (D-11).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap (what + why)
- `.planning/REQUIREMENTS.md` -- CLI-01 (two-name bin over one compiled `bin.js`,
  no Nx/Angular-CLI workspace present), PKG-01 (shebang survives to built + published
  `bin.js`; `newLine: lf` + `.gitattributes`; publint tarball audit), PKG-02
  (`module: nodenext` so the ESM bridge is not downleveled), VER-03 (`bin-static.spec.ts`
  shebang + nx-free graph guard), ADD-01 (additive-only vs 0.2.1) + the Out-of-Scope table.
- `.planning/ROADMAP.md` -- "### Phase 27: Bin shell + cross-platform packaging"
  (goal + the 4 success criteria this CONTEXT implements) + the milestone framing.

### Milestone research (HIGH confidence -- 4 researchers converged)
- `.planning/research/v0.2.2-standalone-cli/PITFALLS.md` -- Pitfall 2 (CRLF shebang
  on the Windows-arm64 build host), 4 (`ERR_REQUIRE_ESM` downlevel), 8 (bin/shebang
  survive to the PUBLISHED artifact), 3 (nx-transitive crash class reaching the CLI),
  6 (`process.exit` flush race); the "Looks Done But Isn't" checklist; the
  verification-substrate recommendation (extend `tarball-audit`; the real-clone SHAs
  are Phase 28).
- `.planning/research/v0.2.2-standalone-cli/ARCHITECTURE.md` -- the third-thin-adapter
  design; `bin.ts` as the thin `process.exit`/stream shell over `run()`.
- `.planning/research/v0.2.2-standalone-cli/STACK.md` -- the build/packaging stack
  (`@nx/js:tsc`, `newLine`, `module: nodenext`, `publint`, `bin` conventions).
- `.planning/research/v0.2.2-standalone-cli/SUMMARY.md` -- milestone synthesis.

### Code the phase touches / models (read to mirror, do NOT re-implement)
- `packages/angular-typechecker/src/cli/main.ts` -- the `run()` that `bin.ts` wraps;
  its docstring specifies the `bin.ts` contract verbatim (ONLY process.exit/stream
  site; unknown error -> 2). NOTHING in `main.ts` or `core/` changes this phase.
- `packages/angular-typechecker/src/executors/typecheck/gate-a-static.spec.ts` -- the
  EXACT model for `bin-static.spec.ts` (dist byte-read, `distRoot` from `project.json`,
  `stripCommentLines`, positive `import(` / negative `require()` assertions).
- `packages/angular-typechecker/eslint.config.mjs` -- the `**/src/core/**/*.ts`
  D-11 `no-restricted-imports` block to MIRROR for `**/src/cli/**/*.ts` (import-ban
  ONLY -- omit the core block's `no-console` / `process.exit` rules; `bin.ts` needs
  I/O).
- `packages/angular-typechecker/tsconfig.lib.json` -- where `newLine: lf` is pinned
  (the build/ship tsconfig; excludes `*.spec.ts`/`*.drift.ts`, includes `src/**/*.ts`
  so `bin.ts` is emitted).
- `packages/angular-typechecker/tsconfig.json` -- `module`/`moduleResolution`
  `nodenext` (the ESM-bridge invariant `bin.ts` inherits; no separate bin tsconfig).
- `packages/angular-typechecker/project.json` -- the `@nx/js:tsc` build target
  (`assets`, `outputPath`) + the `test` / `integration` / e2e tiers `bin-static.spec.ts`
  and the tarball audit ride.
- `packages/angular-typechecker/package.json` -- where the `bin` field is added
  (`type: commonjs`, `main: ./src/index.js`, `files: ["src", ...]` conventions;
  `version` stays `0.2.1`).
- `packages/angular-typechecker/src/index.drift.ts` + `packages/angular-typechecker/tsconfig.drift.json`
  -- the barrel-drift tripwire ADD-01 leans on (5 exports locked).
- `e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts` -- the EXISTING
  publint tarball audit to EXTEND with the bin map + LF shebang (D-11).

### Prior context (this milestone)
- `.planning/phases/26-pure-cli-core-exit-code-wiring/26-CONTEXT.md` -- the `run()`
  contract + D-15 nx-free `src/cli/**` boundary Phase 27 ENFORCES; its deferred
  section scoped exactly this phase.
- `.planning/phases/25-extract-the-advisory-notice-seam/25-CONTEXT.md` -- the
  `Logger` seam the CLI drives (context for the nx-free import graph).

### Additive-audit model (ADD-01)
- `.planning/milestones/v0.2.1-phases/24-real-oss-scaffolded-e2e-additive-only-audit-docs/24-ADDITIVE-AUDIT.md`
  -- the git-diff additive-audit doc `27-ADDITIVE-AUDIT.md` is modeled on.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`run()` in `src/cli/main.ts`** -- `bin.ts` is a ~15-line wrapper; `run()`
  already returns `{ exitCode, stdout, stderr }` and re-throws unknown errors for
  `bin.ts` to map to `2`. Nothing in `main.ts` / `core/` changes.
- **`gate-a-static.spec.ts`** -- copy its dist-read scaffolding (`packageRoot` /
  `workspaceRoot` / `distRoot` from `project.json`, `stripCommentLines`) for
  `bin-static.spec.ts`.
- **`eslint.config.mjs` `core/**` block** -- copy the `no-restricted-imports` shape
  for the `cli/**` block (dropping the `no-console` / `process.exit` rules).
- **`tarball-audit.e2e.spec.ts` + `publint`** -- both ALREADY exist; EXTEND, do not
  create (PKG-01 needs zero new dependency / project).
- **`src/index.drift.ts` barrel tripwire** -- already locks the 5 barrel exports;
  ADD-01 leans on it plus a git-diff vs the `angular-typechecker@0.2.1` tag.

### Established Patterns
- **Thin-adapter charter:** `bin.ts` is the third adapter's OS shell over the ONE
  `run()` core -- never a re-implementation (the Nx executor + Angular CLI builder
  are the other two adapters).
- **Detection(core)/rendering(adapter) + nx-free boundary:** the `core/**` lint
  boundary is why the CLI's import graph never reaches nx (the 24-06
  `chalk.blue`/yarn-hoist crash class); `cli/**` extends the same discipline (D-09).
- **GATE A build invariant:** `module: nodenext` keeps `await import()` un-downleveled
  -- proven by `gate-a-static.spec.ts`; `bin.js` inherits it (D-08).
- **Two-tier verification:** committed CI-authoritative specs + a manual real-clone
  UAT. Here: dist static guard (`test` tier, D-10) + tarball publint audit (`e2e`
  tier, D-11); the install-and-run e2e + real-clone UAT are Phase 28.

### Integration Points
- `package.json` gains `bin`; `tsconfig.lib.json` gains `newLine: lf`; new repo-root
  `.gitattributes`; `eslint.config.mjs` gains the `cli/**` block; new
  `src/cli/bin.ts` + `bin-static.spec.ts`; `tarball-audit.e2e.spec.ts` extended; new
  `27-ADDITIVE-AUDIT.md`.
- Phase 28 (VER-04/05): a NEW `angular-typechecker-cli-e2e` project installs + RUNS
  the shipped bins for literal `0`/`1`/`2` through the real PM `.bin` shim (Linux +
  Windows) + the real-clone UAT (radix-ng/primitives, analogjs/analog, ngx-leaflet,
  realworld-angular).
- Phase 29 (DOC-01): README `## Standalone CLI` + exit-code table + curated CHANGELOG.

</code_context>

<specifics>
## Specific Ideas

- **`bin.ts` is the ONLY `process.exit` / stream-write site** and `main.ts`'s
  docstring already spells out the exact wrapper contract (write `stdout`/`stderr`,
  set exit code; catch an unknown throw -> `2`). Do not add logic to `bin.ts` beyond
  wiring.
- **`publint` + `tarball-audit.e2e.spec.ts` ALREADY exist** -- PKG-01's publint bin
  audit EXTENDS the existing spec (zero new dep / project). This was verified during
  the codebase scout and resolves the only scope-boundary question.
- **The `angular-typechecker@0.2.1` git tag EXISTS** -- it is the concrete ADD-01
  baseline for the git-diff public-surface audit.
- **`npx atc` supply-chain hazard** -- `atc@0.0.6` is a real, unrelated npm package.
  This phase just ships BOTH `bin` names; steering docs to `npx angular-typechecker`
  (never `npx atc`) is Phase 29 (`--help` already does so, from Phase 26 D-11).
- **Windows/MSYS `tar`/pack uses `/d/...` not `D:/...`** (Git Bash mis-parses the
  drive letter as a remote host) -- relevant to any manual packing; the automated
  install-and-run e2e is Phase 28.

</specifics>

<deferred>
## Deferred Ideas

- Shipped-tarball install-and-RUN e2e (literal `0`/`1`/`2` through the real PM `.bin`
  shim; npm + yarn flat/workspace + pnpm; Linux + Windows) + the manual real-clone
  UAT (radix-ng/primitives, analogjs/analog, ngx-leaflet, realworld-angular) --
  Phase 28 (VER-04/05).
- README `## Standalone CLI` + exit-code contract table + curated public CHANGELOG
  entry -- Phase 29 (DOC-01).
- JSON / SARIF reporters (REP-01/02), `--watch` (CLIX-01), `--quiet` / explicit
  `--color`/`--no-color` / a `--project` alias (CLIX-02) -- Future Requirements, out
  of scope this milestone.
- Cold-start-budget (`--version` < ~300ms) assertion -- Pitfall 3 "optional"; not
  warranted (the static graph walk in D-10 already proves no nx chain).
- A repo-wide `* text=auto eol=lf` `.gitattributes` renormalization -- deliberately
  NOT done (would churn committed fixtures); the narrow `*.ts eol=lf` guard (D-07) is
  chosen instead.

None beyond the above -- discussion stayed within phase scope.

</deferred>

---

*Phase: 27-bin-shell-cross-platform-packaging*
*Context gathered: 2026-07-16*
