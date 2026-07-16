# Requirements: angular-typechecker -- Milestone v0.2.2 (Standalone CLI)

**Defined:** 2026-07-16
**Core Value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.

**Milestone goal:** Ship a standalone `angular-typechecker` / `atc` command-line binary that runs the complete Angular type-check outside Nx and the Angular CLI -- a third thin adapter over the same `runTypecheck` core -- owning the literal OS exit code `2` for infrastructure errors. **Additive-only patch bump (`0.2.1 -> 0.2.2`).**

## Milestone v0.2.2 Requirements

### CLI (binary + thin-adapter surface)

- [ ] **CLI-01**: A user can run the complete Angular type-check from a standalone binary with NO Nx or Angular CLI workspace present -- shipped as two `bin` names (`angular-typechecker` primary + `atc` alias) that resolve to one compiled `src/cli/bin.js` (`npx angular-typechecker ...`; installed `atc ...`).
- [ ] **CLI-02**: The CLI produces the SAME verdict and diagnostics as the Nx executor and Angular CLI builder -- the complete set (TS + template + extended NG8xxx, no emit), single-tsconfig AND solution reference-walking, same boundary filtering -- by composing the same `runTypecheck` core, never a re-implementation.
- [ ] **CLI-03**: The CLI entrypoint imports ONLY pure-core modules (never `@nx/devkit`/`nx` at runtime), enforced by a `src/cli/**` ESLint import-ban plus a module-graph probe; a console logger routes the report to stdout and advisory notices / errors to stderr.
- [x] **CLI-04**: The five advisory `warn*` helpers are extracted to a pure `core/emit-advisory-notices.ts` behind an injected structural `Logger`; the Nx executor injects its logger with byte-identical observable behavior (additive/internal, no public-API change).

### ARGS (argument parsing)

- [ ] **ARGS-01**: Arguments are parsed with the Node stdlib `util.parseArgs` -- zero new runtime or dev dependencies.
- [ ] **ARGS-02**: Input is by tsconfig PATH via `--tsConfig` (short `-c`), repeatable and required; deliberately NOT `-p` / `--project` (which would collide with Angular CLI/Nx workspace *project* selection). `--max-warnings <n>`, `--fail-fast`, `--include-deps`, and `--strict` each map to an existing `CoreOptions` / adapter knob -- no new engine behavior.
- [ ] **ARGS-03**: A single `--tsConfig` uses the string (direct / solution-walk) path; two or more use the `string[]` union path -- a single input is never passed as a one-element array (which would skip solution-tsconfig walking).
- [ ] **ARGS-04**: `--help` / `-h` and `--version` print and exit `0`; an unknown flag, a missing required `--tsConfig`, or a non-integer `--max-warnings` is a usage error -> exit `2` with a clear message.
- [ ] **ARGS-05**: Color is auto-detected honoring `NO_COLOR` / `FORCE_COLOR` / TTY, feeding the existing report formatter.

### EXIT (exit-code contract)

- [ ] **EXIT-01**: The binary returns literal OS exit codes -- `0` clean, `1` completed-run verdict failure (type error / warnings-exceeded / coverage-incomplete), `2` infrastructure or usage error. `TypecheckInfrastructureError` maps to `2` via `toExitCode` (its first live consumer, reserved since v0.0.3 COR-04); the `0`-vs-`1` split derives from `evaluateResult(...).success`, NEVER from `toExitCode` over raw counts (a coverage-incomplete / warnings-exceeded run has `errorCount === 0` -- naive wiring would be a silent false pass).
- [ ] **EXIT-02**: A pure `run(argv, env): Promise<{ exitCode, stdout, stderr }>` holds all decision logic and never calls `process.exit` or writes streams; the thin `bin.ts` shell is the only `process.exit` / stream-write site and is flush-safe on large buffered output.

### PKG (packaging + cross-platform)

- [ ] **PKG-01**: The source shebang (`#!/usr/bin/env node`, LF) survives `@nx/js:tsc` into the built AND published `bin.js`; `newLine: lf` + a `.gitattributes` rule guard against CRLF corruption; the tarball audit (`publint`) validates the bin.
- [ ] **PKG-02**: The bin compiles under the same `module: nodenext` config so the CJS->ESM `await import('@angular/compiler-cli')` bridge is never downleveled to `require()` (no `ERR_REQUIRE_ESM` at first real type-check).
- [ ] **PKG-03**: tsconfig paths are resolved from an arbitrary CWD using nx-free `node:path` and `realpathSync.native`-normalization (Windows drive-letter case / 8.3 names) before reaching the boundary filter.

### VER (verification -- follows the repo's Vitest pyramid + CI matrix)

Test tiers mirror the existing strategy (ci.yml + `packages/angular-typechecker/project.json`): **Unit** = `*.spec.ts` (`test` target, `dependsOn: build`); **Integration** = `*.integration.spec.ts` (`integration` target, real cold `@angular/compiler-cli`); both ride the LEAN **6-cell** OS x Node matrix (Linux x {22,24,26} + Windows x {24,26} + macOS x 24). **e2e** = the `e2e` target (packed tarball + Verdaccio + real package-manager installs), per-project dynamic CI matrix.

- [ ] **VER-01 (Unit)**: In-process `*.spec.ts` cover the pure logic on the 6-cell matrix -- `parse-args` (flag mapping, `--tsConfig`/`-c` repeatable, unknown-flag / missing-input / non-integer-`--max-warnings` -> usage error, `--help`/`--version`, color env), the exit-code composition in `run()` against a STUBBED core (clean->0; type-error->1; coverage-incomplete AND warnings-exceeded [`errorCount === 0`, `success === false`]->1; infra->2; usage->2), the console logger (report->stdout, notices/errors->stderr), and `emit-advisory-notices` against a mock `Logger`. The Windows cells give free cross-OS coverage of parse/exit/path logic.
- [ ] **VER-02 (Integration)**: `run(argv)` is exercised end-to-end in-process (no spawn, no tarball) against committed real-cold-compiler fixtures on the 6-cell matrix: clean->0, planted TS / template / NG8xxx error->1 (code in stdout), a real coverage-incomplete case->1, `--max-warnings 0` and `--strict`->1, multi-`--tsConfig` union + single-`--tsConfig` solution-walk, and a malformed / nonexistent tsconfig->2 (`TypecheckInfrastructureError`); this exercises the CJS->ESM `await import()` bridge and, on the Windows cells, real path normalization.
- [ ] **VER-03 (Static build guard)**: A `bin-static.spec.ts` (`test` tier, `dependsOn: build`, modeled on `gate-a-static.spec.ts`) asserts the BUILT `bin.js` starts with a `#!/usr/bin/env node` shebang whose first line has no `\r` (CRLF guard -- meaningful on the Windows arm64 build host) and that its `require` graph never reaches `@nx/devkit`/`nx` (nx-free boundary).
- [ ] **VER-04 (Shipped-tarball e2e)**: A DEDICATED `angular-typechecker-cli-e2e` project (auto-covered by the dynamic per-project CI matrix) proves the SHIPPED `bin`s, installed from the packed tarball via Verdaccio, return literal process exit codes `0`/`1`/`2` through the real package-manager-generated `.bin` shim -- both `angular-typechecker` and `atc`, and `npx angular-typechecker` -- across the package-manager matrix **npm + yarn (flat + workspace) + pnpm**, on **Linux AND Windows** (Node 24). Net-new coverage vs the existing Nx/ng `{success}` (0/1) harness: literal exit **2** (infra + usage) and the shim path (incl. the Windows `.cmd`/`.ps1` shim). *Implementation notes for planning:* the e2e CI job must gain an OS axis for THIS project (the current dynamic matrix is Linux-only), and the Windows leg must handle the known Windows-Verdaccio robustness issues (127.0.0.1 bind / ECONNREFUSED retry) that motivated the repo's Linux-only heavy default -- accepted deliberately because the bin shim is the one genuinely Windows-divergent CLI surface.
- [ ] **VER-05 (Real-clone UAT)**: The shipped `bin`s run at real project tsconfigs in real OSS clones of BOTH kinds -- a real Nx workspace (`radix-ng/primitives` primary, `analogjs/analog` alt) AND a real Angular CLI (`angular.json`) workspace (`bluehalo/ngx-leaflet`, `realworld-angular`) -- on-stack Angular 22: planted-error RED / clean GREEN / bad-path -> `2` (ACV-01 pattern; uncommitted clones pinned by URL + SHA).

### ADD (additive-only charter)

- [ ] **ADD-01**: The milestone is additive-only vs `angular-typechecker@0.2.1` -- NO breaking change to the Nx executor id (`angular-typechecker:typecheck`), the `runTypecheck` / `CoreResult` / `CoreOptions` public API, the Angular CLI builder, or the generator schemas -- enforced (barrel / drift tripwire) and audited by git-diff before release (the `executor.ts` logger swap is internal + observably identical; the `bin` field and `src/cli/**` are net-new). The `v0.3.0` breaking-change escape hatch triggers only if a breaking change proves unavoidable.

### DOC (docs)

- [ ] **DOC-01**: A README `## Standalone CLI` section documents installation, the flag set, and the exit-code contract table (`0` clean / `1` verdict-fail / `2` infra-or-usage); the canonical uninstalled invocation is `npx angular-typechecker` (docs NEVER instruct `npx atc` -- `atc@0.0.6` is an unrelated published package; `atc` is documented only as an installed PATH shorthand). A curated public CHANGELOG entry is written in end-user language (no internal ids).

## Future Requirements

Deferred to a later milestone. Tracked, not in this roadmap.

### Reporters

- **REP-01**: Machine-readable `--format json` reporter (agent-parseable structured diagnostics).
- **REP-02**: `--format sarif` reporter (GitHub Code Scanning `upload-sarif`).

### CLI ergonomics

- **CLIX-01**: `--watch` mode (needs the deferred `NgtscProgram` incremental engine).
- **CLIX-02**: `--quiet` and explicit `--color` / `--no-color` overrides.

## Out of Scope

Explicitly excluded this milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| `-p` / `--project` input flag | Would collide with Angular CLI / Nx *workspace project* selection; this CLI takes a tsconfig PATH. Use `--tsConfig` / `-c`. |
| JSON / SARIF reporters | Machine-readable output deferred (REP-01/02); needs a committed schema. This milestone is CLI-only, human output. |
| `--watch` mode | Needs the deferred `NgtscProgram` incremental engine (WALK-FUT-02). |
| Config-file discovery / implicit tsconfig / glob input | Conflicts with the D-04 "no cwd" whole-program engine contract; input is always an explicit tsconfig path. |
| `--fix` / autofix | Nonsensical for a type-checker (no code changes to make) -- never build. |
| New runtime or dev dependency (arg parser / color / bundler lib) | Node stdlib `util.parseArgs` + the existing report formatter cover the surface. |
| Off-stack Angular 20/21 verification | On-stack Angular 22 only (dropped from all gates in v0.2.1). |

## Traceability

Populated during roadmap creation. Each requirement maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | Phase 27 | Pending |
| CLI-02 | Phase 26 | Pending |
| CLI-03 | Phase 26 | Pending |
| CLI-04 | Phase 25 | Complete |
| ARGS-01 | Phase 26 | Pending |
| ARGS-02 | Phase 26 | Pending |
| ARGS-03 | Phase 26 | Pending |
| ARGS-04 | Phase 26 | Pending |
| ARGS-05 | Phase 26 | Pending |
| EXIT-01 | Phase 26 | Pending |
| EXIT-02 | Phase 26 | Pending |
| PKG-01 | Phase 27 | Pending |
| PKG-02 | Phase 27 | Pending |
| PKG-03 | Phase 26 | Pending |
| VER-01 | Phase 26 | Pending |
| VER-02 | Phase 26 | Pending |
| VER-03 | Phase 27 | Pending |
| VER-04 | Phase 28 | Pending |
| VER-05 | Phase 28 | Pending |
| ADD-01 | Phase 27 | Pending |
| DOC-01 | Phase 29 | Pending |

**Coverage:**
- Milestone requirements: 21 total
- Mapped to phases: 21 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-07-16*
*Last updated: 2026-07-16 after roadmap creation (milestone v0.2.2 Standalone CLI, phases 25-29)*
