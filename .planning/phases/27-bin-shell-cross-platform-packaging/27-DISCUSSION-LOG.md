# Phase 27: Bin shell + cross-platform packaging - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 27-bin-shell-cross-platform-packaging
**Mode:** `--auto` (autonomous, single-pass) `--analyze` (trade-off tables) `--chain`
**Areas discussed:** bin.ts flush/exit strategy, bin field + names, shebang/CRLF guard, ESM-bridge build, nx-free cli boundary, static build guard, tarball publint audit, additive-only audit

> `--auto` selected the recommended option for every area without a user prompt.
> All picks are HIGH-confidence (locked by the ROADMAP SCs / requirements / PITFALLS
> research / the shipped `run()` contract). No area was high-impact + low-confidence,
> so none was escalated to a user checkpoint.

---

## bin.ts flush / exit strategy (Pitfall 6, EXIT-02)

| Option | Description | Selected |
|--------|-------------|----------|
| `process.exitCode = code` + return (drain naturally) | Write stdout/stderr, set exitCode, let the event loop flush before exit | [X] |
| `process.exit(code)` immediately after write | Abrupt; truncates buffered stdout on a pipe (CI / execSync) -- the tail TSxxxx code an assertion needs can be dropped | |
| `process.exit` inside a write callback / after drain | Correct but heavier than needed | |

**Auto-selected:** `process.exitCode = code` + return.
**Notes:** Pitfall 6 explicitly recommends this; it is why the requirement calls
`bin.ts` "flush-safe on large buffered output." `main.ts`'s docstring already names
`bin.ts` as the only write/exit site.

---

## bin field + two names (CLI-01, Pitfall 8)

| Option | Description | Selected |
|--------|-------------|----------|
| Two names -> one compiled `./src/cli/bin.js` | `{ "angular-typechecker": "./src/cli/bin.js", "atc": "./src/cli/bin.js" }` | [X] |
| Point bin at `./src/cli/bin.ts` (source) | Ships raw `.ts`; repeats the 0.0.1-0.1.0 packaging defect class | |
| Single `angular-typechecker` name only | Drops the `atc` shorthand the milestone commits to | |

**Auto-selected:** Two names -> one compiled `bin.js`.
**Notes:** LOCKED by CLI-01. `bin` points at compiled JS (consistent with `main`);
`files` needs no change (`src/` already whitelisted); `version` stays `0.2.1`
(bumped only in the Release-PR flow).

---

## Shebang / CRLF guard (PKG-01, Pitfall 2)

| Option | Description | Selected |
|--------|-------------|----------|
| `newLine: lf` in `tsconfig.lib.json` + narrow `*.ts eol=lf` `.gitattributes` | Deterministic LF emit (primary guard) + a source-level belt-and-suspenders | [X] |
| Rely on `.gitattributes` alone | Does not control the `tsc` emit newline on a Windows host | |
| Repo-wide `* text=auto eol=lf` renormalization | Would churn committed fixtures (`ng-cli-workspace`, lockfiles) | |

**Auto-selected:** `newLine: lf` (build tsconfig) + a narrow `*.ts eol=lf` `.gitattributes`.
**Notes:** Windows-arm64 build host -> a `\r` shebang breaks Linux/macOS
(`env: node\r`). `newLine: lf` is the load-bearing emit guard; the narrow
`.gitattributes` avoids the additive-only churn a repo-wide renormalize would cause.
Reversible (planner may narrow to the bin path only).

---

## ESM-bridge build (PKG-02, Pitfall 4)

| Option | Description | Selected |
|--------|-------------|----------|
| Shared `tsconfig.lib.json` (`module: nodenext`) | `await import()` stays un-downleveled; inherits the GATE A invariant | [X] |
| Separate bin tsconfig (`module: commonjs`) | Downlevels `await import()` -> `require()` -> `ERR_REQUIRE_ESM` at first type-check | |

**Auto-selected:** Shared `tsconfig.lib.json`, no separate bin tsconfig.
**Notes:** `package.json` stays `type: commonjs`; the bridge is reached through
`core/compiler-loader.ts` and proven by `gate-a-static.spec.ts`.

---

## nx-free `src/cli/**` boundary (CLI-03)

| Option | Description | Selected |
|--------|-------------|----------|
| ESLint import-ban only (no `no-console`/`process.exit`) | Mirror the `core/**` block's import-ban; `bin.ts` keeps its I/O | [X] |
| Full `core/**` block copied verbatim (incl. `no-console`/`process.exit`) | Would forbid `bin.ts`'s legitimate stream writes + exit | |

**Auto-selected:** Import-ban only on `**/src/cli/**/*.ts`.
**Notes:** `main.ts` purity (EXIT-02) is guarded by its unit tests, not lint. Ban
`nx`/`@nx/*`/`@angular-devkit/*` + adapter modules + the barrel.

---

## Static build guard (VER-03)

| Option | Description | Selected |
|--------|-------------|----------|
| `bin-static.spec.ts` static dist read (test tier) | Model on `gate-a-static.spec.ts`; shebang byte-check + static nx-free require-graph walk | [X] |
| Runtime `require.cache` module-graph probe here | Heavier; belongs to the installed-bin e2e (Phase 28, VER-04) | |
| Add a cold-start budget assertion too | Pitfall 3 "optional"; speculative -- static walk already proves no nx chain | |

**Auto-selected:** static dist-read spec (test tier); runtime probe deferred to Phase 28.
**Notes:** Reuse the `gate-a-static` dist-read scaffolding + `distRoot` from `project.json`.

---

## Tarball publint bin audit (PKG-01)

| Option | Description | Selected |
|--------|-------------|----------|
| EXTEND existing `tarball-audit.e2e.spec.ts` | `publint` + spec already exist; assert bin map + LF shebang on the packed tarball; zero new dep/project | [X] |
| New standalone publint spec/project | Duplicates existing packing + audit machinery | |
| Defer all publint to Phase 28 | Would push PKG-01 verification out of its own phase | |

**Auto-selected:** Extend the existing spec.
**Notes:** Discovered during codebase scout that `publint` is already a dev-dep and
`e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts` exists -- this
dissolved the only real scope-boundary question. Reversible.

---

## Additive-only audit (ADD-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Barrel-drift tripwire (green) + git-diff vs `angular-typechecker@0.2.1` tag + `27-ADDITIVE-AUDIT.md` | Reuse `src/index.drift.ts` + model the doc on `24-ADDITIVE-AUDIT.md`; the 0.2.1 tag exists | [X] |
| Manual eyeball diff only | Not repeatable; no tripwire | |

**Auto-selected:** tripwire + git-diff vs the `0.2.1` tag + audit doc.
**Notes:** The `angular-typechecker@0.2.1` tag exists as the concrete baseline; the
`bin` field + `src/cli/**` are net-new; `v0.3.0` escape hatch stays untriggered.

---

## Claude's Discretion

- Internal `bin.ts` structure (a `main()` wrapper vs top-level await), flush-safe per D-02.
- Exact `.gitattributes` scope within the narrow constraint (`*.ts eol=lf` vs bin-only).
- The `bin-static` transitive-walk implementation details.
- Whether the `cli/**` ESLint block lists adapter relative paths explicitly or relies on the `nx`/`@nx/*` bans.
- Fixture / assertion reuse when extending `tarball-audit.e2e.spec.ts`.

## Deferred Ideas

- Shipped-tarball install-and-run e2e (literal 0/1/2 through the `.bin` shim; npm/yarn/pnpm; Linux + Windows) + real-clone UAT -- Phase 28 (VER-04/05).
- README `## Standalone CLI` + exit-code table + curated CHANGELOG -- Phase 29 (DOC-01).
- JSON/SARIF reporters, `--watch`, `--quiet`/explicit `--color` -- Future Requirements (out of scope).
- Cold-start-budget assertion -- not warranted this phase.
- Repo-wide `* text=auto eol=lf` renormalization -- deliberately not done.
