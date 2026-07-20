# Phase 28: Shipped-tarball e2e + real-clone UAT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 28-shipped-tarball-e2e-real-clone-uat
**Mode:** `--auto` (autonomous, single-pass) `--analyze` (trade-off tables logged) `--chain`
**Areas discussed:** cli-e2e project shape, exit-code/PM/bin assertion matrix, Windows CI OS-axis, Verdaccio reuse, installed-bin runtime probe, real-clone UAT

> `--auto` mode selected the recommended option for every gray area without a user
> prompt. Trade-off tables below are the `--analyze` audit trail. No decision fell in
> the trap quadrant (high-impact + low-confidence); the one high-impact area with real
> latitude (Windows CI OS-axis wiring) was deliberately left OPEN as a research flag
> rather than locked.

---

## New cli-e2e project shape

| Option | Description | Selected |
|--------|-------------|----------|
| Model on `install-e2e` | New project copies the Verdaccio publish-once + serialized node-env harness | [X] |
| New bespoke harness | Invent a fresh install-and-run scaffold | |
| Fold into `install-e2e` | Add install-and-run specs to the existing project | |

**Choice:** Model on `angular-typechecker-install-e2e`; auto-discovered by `list-e2e-projects.mjs`.
**Notes:** A DEDICATED project is required by VER-04 SC-1 ("dedicated `angular-typechecker-cli-e2e`"); folding into install-e2e would fail the requirement and the OS-axis-for-this-project-only intent.

## Exit-code x PM x bin-name assertion matrix

| Option | Description | Selected |
|--------|-------------|----------|
| Deliberate net-new coverage | Prove 0/1/2 through the real PM `.bin` shim, both bin names + npx, per PM; prune only redundant cells | [X] |
| Full cartesian product | Every PM x invocation x code | |
| Minimal smoke | One PM, one exit code | |

**Choice:** Deliberate coverage weighted toward literal `2` (infra+usage) -- the net-new surface vs the 0/1 `{success}` harness.
**Notes:** Full cartesian is wasteful; minimal smoke under-covers the shim. D-03 sets a mandatory-coverage floor with planner pruning latitude.

## Windows CI OS-axis (RESEARCH-FLAGGED)

| Option | Description | Selected |
|--------|-------------|----------|
| Direction locked, mechanism OPEN | Windows leg for THIS project only (required); wiring mechanism deferred to research/plan | [X] |
| Lock a specific wiring now | Pre-pick include-based OS axis vs separate job | |
| Skip Windows | Linux-only like the other e2e projects | |

**Choice:** DIRECTION locked by VER-04 SC-2 (Windows required, RISK accepted); MECHANISM left open (technical CI plumbing = researcher/planner territory, not a user gray area).
**Notes:** The `e2e` matrix is 1-D over `project:` with `runs-on: ubuntu-latest` fixed. Candidate shapes (include-based OS axis vs separate Windows job) must preserve the `discover`->`fromJSON` contract and GUARD-01b. Not auto-locked -- the one high-impact area with genuine latitude.

## Verdaccio reuse

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the existing pattern | One registry on 127.0.0.1, real token, stripAllNpmConfig, refuse-gate | [X] |
| Second registry port | Isolated registry for the new project | |

**Choice:** Reuse verbatim; no second registry port.
**Notes:** Established, load-bearing invariants (dual-stack fix, no public-registry leak).

## Installed-bin runtime nx-free / ESM-bridge probe

| Option | Description | Selected |
|--------|-------------|----------|
| Add the runtime probe | Assert no `ERR_REQUIRE_ESM`; installed require-cache never reaches `@nx/*`/`nx/` | [X] |
| Rely on Phase 27 static guard only | Skip the runtime probe | |

**Choice:** Add the runtime probe (VER-04 SC-3; Phase 27 D-10 explicitly deferred the runtime half here).
**Notes:** Complements the static dist-graph walk with a real installed-artifact check.

## Real-clone UAT

| Option | Description | Selected |
|--------|-------------|----------|
| Manual, both kinds, URL+SHA pinned | Human-run UAT per the ACV-01 / HUMAN-UAT pattern | [X] |
| Automate the clone UAT | Add clone-and-run to CI | |

**Choice:** Manual UAT (as VER-05 states), captured in a `28-<id>-UAT.md` artifact.
**Notes:** Angular-CLI SHAs carry forward (`ngx-leaflet @818e9ae`, `realworld @9e3528f`); Nx-workspace SHAs (radix-ng/primitives, analogjs/analog) pinned fresh at UAT time.

## Claude's Discretion

- Planted-error fixture design (assert by diagnostic CODE, never message text).
- Exact pruning of the (PM x bin x invocation x code) cell set within D-03's floor.
- Runtime module-graph probe implementation.
- `execSync`/`spawnSync` capture mechanics (flush-safe, no tail truncation).

## Deferred Ideas

- README `## Standalone CLI` + exit-code table + curated CHANGELOG -- Phase 29 (DOC-01).
- JSON/SARIF reporters, `--watch`, `--quiet`/`--color`/`--project` -- Future Requirements.
- GitHub-backed Nx remote cache -- ROADMAP Backlog.
- Cartesian OS-expansion of all e2e projects onto Windows -- deliberately not done.
