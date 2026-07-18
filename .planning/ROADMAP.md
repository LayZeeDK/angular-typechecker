# Roadmap: angular-typechecker

## Milestones

- [SHIPPED] **v0.0.1** -- Phases 1-7 (incl. inserted 5.1) -- shipped 2026-06-29. Complete Angular type-check (TS + template + extended NG8xxx), no-emit, decoupled from build/test, as a cacheable Nx executor published to npm. Full detail: `.planning/milestones/v0.0.1-ROADMAP.md`.
- [SHIPPED] **v0.0.3** -- Phases 8-11 -- shipped 2026-06-30. Engine hardening: closed correctness/completeness holes, made diagnostic gathering resilient instead of all-or-nothing, made Angular-version drift fail loudly, and adopted `fallow` as a green-on-adoption CI quality gate. Full detail: `.planning/milestones/v0.0.3-ROADMAP.md`.
- [SHIPPED] **v0.1.0** -- Phases 12-15 (incl. inserted 13.1) -- shipped 2026-07-02. Reference-walking engine, the typecheck executor rename, and the configuration + init generator suite. Full detail: `.planning/milestones/v0.1.0-ROADMAP.md`.
- [SHIPPED] **v0.2.0** -- Phases 16-20 -- shipped 2026-07-07. Storybook story type-checking via one boundary-filter correctness fix (directory-containment -> compiler input-set membership), across both Nx-official layouts, with no silent false pass. Full detail: `.planning/milestones/v0.2.0-ROADMAP.md`.
- [SHIPPED] **v0.2.1** -- Phases 21-24 -- shipped 2026-07-16. Angular CLI (`angular.json`) workspace support: `ng add`/`ng generate`/`ng run` for the typecheck target, additive-only beside the existing Nx surface, proven against real OSS Angular 22 workspaces. Full detail: `.planning/milestones/v0.2.1-ROADMAP.md`.
- [SHIPPED] **v0.2.2** -- Phases 25-29 -- shipped 2026-07-17. Standalone `angular-typechecker` / `atc` CLI binary: a third thin adapter over the same `runTypecheck` core that runs the complete Angular type-check outside Nx and the Angular CLI, owning the literal OS exit codes `0`/`1`/`2`. Additive-only patch bump (`0.2.1 -> 0.2.2`). Full detail: `.planning/milestones/v0.2.2-ROADMAP.md`.
- [CURRENT] **v0.2.3** -- Phases 30-32 -- Machine-readable reporters. Machine-readable output -- JSON (agent-parseable) and SARIF 2.1.0 (GitHub Code Scanning `upload-sarif`) -- across all three adapters (Nx executor, Angular CLI builder, standalone CLI) over the one shared `runTypecheck` core, so AI coding agents and CI can consume the complete diagnostic set as data. Additive-only patch bump (`0.2.2 -> 0.2.3`).

## Phases

<details>
<summary>[SHIPPED] v0.0.1 (Phases 1-7, incl. 5.1) -- SHIPPED 2026-06-29</summary>

- [x] Phase 1: Workspace Bootstrap + Engine Spike (GATED) (4/4 plans) -- completed 2026-06-27
- [x] Phase 2: Core Type-Check Engine + Gatherer (3/3 plans) -- completed 2026-06-27
- [x] Phase 3: Filtering, Modes, Output + Quality Gates (4/4 plans) -- completed 2026-06-27
- [x] Phase 4: Nx Executor Adapter + Cacheable Target (3/3 plans) -- completed 2026-06-28
- [x] Phase 5: Packaging, Publish Hardening + e2e Smoke (MVP) (5/5 plans) -- completed 2026-06-28
- [x] Phase 5.1: 0.0.2 first OIDC steady-state publish verification (INSERTED) (1/1 plan) -- completed 2026-06-29
- [x] Phase 6: Full e2e Matrix + CI (5/5 plans) -- completed 2026-06-29
- [x] Phase 7: Release-PR workflow and clean changelog (4/4 plans) -- completed 2026-06-29

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.0.1-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.0.3 -- Engine hardening (Phases 8-11) -- SHIPPED 2026-06-30</summary>

- [x] Phase 8: Correctness & Completeness Fixes (3/3 plans) -- completed 2026-06-29
- [x] Phase 9: Resilience (per-file fault isolation + boundary robustness) (5/5 plans) -- completed 2026-06-29
- [x] Phase 10: Drift-hardening & Maintainability (4/4 plans) -- completed 2026-06-29
- [x] Phase 11: Fallow code-quality CI gate (2/2 plans) -- completed 2026-06-30

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.0.3-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.1.0 -- reference-walking engine, typecheck executor rename, and the configuration + init generator suite (Phases 12-15, incl. inserted 13.1) -- SHIPPED 2026-07-02</summary>

- [x] Phase 12: Extended-diagnostic catalog + completeness tripwire (4/4 plans) -- completed 2026-07-01
- [x] Phase 13: Engine -- solution-tsconfig reference-walking (6/6 plans) -- completed 2026-07-01
- [x] Phase 13.1: Rename angular-typecheck executor to typecheck (INSERTED) (1/1 plan) -- completed 2026-07-01
- [x] Phase 14: configuration + init generators, nx add (3/3 plans) -- completed 2026-07-02
- [x] Phase 15: Generator e2e + CI self-audit guard (2/2 plans) -- completed 2026-07-02

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.1.0-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.2.0 -- Storybook story type-checking (Phases 16-20) -- SHIPPED 2026-07-07</summary>

- [x] Phase 16: Storybook type-check gate spike (GATED, GO/NO-GO) -- completed 2026-07-05 (GO)
- [x] Phase 17: Input-set-membership boundary + layout support (7/7 plans) -- completed 2026-07-06
- [x] Phase 18: Packaged-tarball e2e + docs (5/5 plans) -- completed 2026-07-06
- [x] Phase 19: Stretch -- Layout C / non-TS story formats / strict mode (3/3 plans) -- completed 2026-07-07
- [x] Phase 20: Vite/Analog Storybook query-import guidance (5/5 plans) -- completed 2026-07-07

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.2.0-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.2.1 -- Angular CLI workspace support (Phases 21-24) -- SHIPPED 2026-07-16</summary>

- [x] Phase 21: Angular CLI builder engine (multi-tsConfig, GATE A' spike GO/NO-GO) (3/3 plans) -- completed 2026-07-11 -- ENG-01, ACB-01/02/03: GATE A' = GO against a real `bluehalo/ngx-leaflet` clone; `tsConfig` widened to `string | string[]`.
- [x] Phase 22: Configuration schematic -- the angular.json write-fork (2/2 plans) -- completed 2026-07-11 -- ACS-01/02/04, COV-01: `ng generate ...:configuration` wires `tsConfig: [buildLeaf, specLeaf]` into `angular.json`.
- [x] Phase 23: Init schematic parity + first-party ng-add (3/3 plans) -- completed 2026-07-12 -- ACS-03, NGADD-01, ACP-01: `ng generate ...:init` parity, optional peer classification, `ng-add` auto-wire-all (first iteration).
- [x] Phase 24: Real-OSS + scaffolded e2e, additive-only audit, docs (6/6 plans, incl. 3 gap-closure) -- completed 2026-07-15 -- ACV-01/02/03, ACP-02, ACD-01 + gap-closure NGADD-01 (yarn `nx` peer + nx-free vanilla `ng-add`).

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.2.1-ROADMAP.md`

</details>

<details>
<summary>[SHIPPED] v0.2.2 -- Standalone CLI (Phases 25-29) -- SHIPPED 2026-07-17</summary>

- [x] Phase 25: Extract the advisory-notice seam (1/1 plans) -- completed 2026-07-16 -- CLI-04
- [x] Phase 26: Pure CLI core + exit-code wiring (3/3 plans) -- completed 2026-07-16 -- CLI-02/03, ARGS-01..05, EXIT-01/02, PKG-03, VER-01/02
- [x] Phase 27: Bin shell + cross-platform packaging (3/3 plans) -- completed 2026-07-16 -- CLI-01, PKG-01/02, VER-03, ADD-01
- [x] Phase 28: Shipped-tarball e2e + real-clone UAT (4/4 plans) -- completed 2026-07-17 -- VER-04, VER-05
- [x] Phase 29: Docs (1/1 plans) -- completed 2026-07-17 -- DOC-01

Full phase detail (goals, success criteria, decisions): `.planning/milestones/v0.2.2-ROADMAP.md`

</details>

<details open>
<summary>[CURRENT] v0.2.3 -- Machine-readable reporters (Phases 30-32)</summary>

- [x] **Phase 30: Reporter seam + JSON reporter + `--format` threading + observability** - Widen the `renderReport` seam with a `format` discriminator, add the zero-dependency JSON reporter, thread `--format`/`--quiet`/`--color` through all three adapters, and capture the optional `totalFilesCount`. (FMT-01/02/03, REP-01, OBS-01, CLIX-02, VER-01) (completed 2026-07-18)
- [ ] **Phase 31: SARIF reporter** - The lazy-`import()`ed `node-sarif-builder` SARIF 2.1.0 reporter with repo-relative URIs, partialFingerprints, file-less fallback, the 18-NG8xxx rules catalog, plus the nx-free require-graph guard and CJS-under-`import()` interop test. (REP-02, VER-04)
- [ ] **Phase 32: Verification + docs + additive audit** - Integration + shipped-tarball e2e across all three adapters, SARIF schema validation, cross-OS determinism, the additive-only git-diff audit vs `@0.2.2`, and the README/CHANGELOG. (VER-02, VER-03, ADD-01, DOC-01)

</details>

## Phase Details (v0.2.3 -- Machine-readable reporters)

### Phase 30: Reporter seam + JSON reporter + `--format` threading + observability

**Goal**: A user selects machine-readable JSON (or the default human) output via one `--format` flag threaded identically through all three adapters, and gets a stable, documented, agent-parseable JSON payload on stdout -- while the verdict and exit code stay owned by the engine, never re-derived by the reporter. This establishes the widened seam + full three-adapter plumbing that the SARIF reporter reuses.
**Depends on**: v0.2.2 (shipped)
**Requirements**: FMT-01, FMT-02, FMT-03, REP-01, OBS-01, CLIX-02, VER-01
**Success Criteria** (what must be TRUE):

  1. `atc -c tsconfig.json --format json` (and the matching Nx executor `format` option + Angular CLI builder `format` option) prints ONE parseable JSON payload to stdout: a flat `diagnostics[]` (each carrying a repo-relative `file` or `null` for file-less, 1-based `line`/`column`/`endLine`/`endColumn`, a humanized `code` string [`TS####`/`NG8xxx`/`ATC9000x`] plus the raw `rawCode` int, `severity`, `message`) and a `summary` (the discriminated `outcome`, category counts, `totalFilesCount`, and the structured suppression/advisory fields), with a `formatVersion` marker + tool version and drift-locked keys.
  2. The exit code for a given project is IDENTICAL across `--format human` and `--format json` (and the omitted default) -- including a coverage-incomplete run where `errorCount === 0` but the run still fails -- proving the reporter is a pure function over `CoreResult` that never re-decides `success` from counts (`evaluateResult`/`toExitCode` stay the sole owners).
  3. The machine payload contains NO ANSI escape byte even under `FORCE_COLOR=1` and goes to stdout ONLY, while every advisory/notice/error goes to stderr via the injected `Logger`; `--quiet` silences the stderr chatter without touching the payload or the verdict; `--color`/`--no-color` are explicit overrides layered above the `NO_COLOR` > `FORCE_COLOR` > TTY precedence and affect the human path only.
  4. With `--format` omitted, human output is byte-identical to `angular-typechecker@0.2.2` -- the widened `renderReport` seam, the new `CoreResult.totalFilesCount` field (captured from the live `Program` on the direct path and a deduped source-file `Set` across walked leaves), and the enum on the three adapter schemas + both schema-parity specs are all additive; `builder.ts` is unchanged.

**Plans**: 3/3 plans complete

Plans:
**Wave 1**

- [x] 30-01-PLAN.md (Wave 1) -- Observability: capture the OPTIONAL `CoreResult.totalFilesCount` (non-declaration source files) off the live `Program` on the direct path and a name-deduped `Set` across walked leaves via `finalizeUnion`; `evaluateResult` never reads it (negative test) + a real-compiler integration proof. (OBS-01, VER-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 30-02-PLAN.md (Wave 2, depends 30-01) -- The reporter seam + JSON reporter: a shared pure `core/diagnostic-record.ts` projection (1-based off-by-one helper, `TS####`/`NG8xxx`/`ATC9000x` code strings + `rawCode`, category severity, repo-relative paths); pure `core/json-report.ts` (`formatJsonReport`) with flat `diagnostics[]` + rich `summary` (outcome DELEGATED to `evaluateResult`, `formatVersion:1`, tool version) via `JSON.stringify` only; widen `core/render-report.ts` to dispatch on an optional `format` (default human), moving `loadCompilerCli()` into the human branch (sarif throws "Phase 31") + VER-01 JSON shape/snapshot/no-ANSI/key-drift specs. (FMT-01, FMT-02, FMT-03, REP-01, VER-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 30-03-PLAN.md (Wave 3, depends 30-02) -- Thread the `--format` (+ `--quiet`, `--color`/`--no-color` via `allowNegative`) enum through the CLI `parse-args`/`main`, the executor `schema.json`/`schema.d.ts`/`normalize-options`/`executor.ts`, and the builder `schema.json` (builder.ts UNCHANGED); add `'format'` to both `schema-parity` specs + README `### Options` rows (HELP_TEXT drift-lock); add the exit-code-parity (incl. coverage-incomplete), `--quiet`-gates-stderr-only, and `--color`/`--no-color` override unit specs. (FMT-01, FMT-03, CLIX-02, VER-01)

### Phase 31: SARIF reporter

**Goal**: A user selects `--format sarif` and gets valid SARIF 2.1.0 ready for GitHub Code Scanning `upload-sarif`, built with the one deliberate new dependency (`node-sarif-builder`) that is lazy-`import()`ed ONLY on the SARIF path -- the human / JSON / `--help` / CLI-boot paths never load it. The reporter reuses Phase 30's shared normalized-record projection so JSON and SARIF cannot drift on positions/codes/paths.
**Depends on**: Phase 30
**Requirements**: REP-02, VER-04
**Success Criteria** (what must be TRUE):

  1. `atc -c tsconfig.json --format sarif` (and the executor/builder `format: sarif`) emits schema-valid SARIF 2.1.0 to stdout: `runs[].tool.driver` (name / version / informationUri + a `rules[]` catalog for the 18 NG8xxx extended diagnostics) and `results[]` with a humanized `ruleId`, a mapped `level`, `message.text`, and `locations[]` carrying a repo-relative forward-slash `artifactLocation.uri` + a 1-based `region` + self-computed `partialFingerprints`, in deterministic order.
  2. File-less diagnostics (synthesized 90001/90002, global TS) are represented as no-location results and never dropped; the verdict/exit code -- not the SARIF -- is the authoritative fail signal for them, and the exit code stays identical to the human/JSON runs for the same input.
  3. A require-graph guard proves the human / JSON / `--help` / CLI-boot paths never load `node-sarif-builder` (nor its transitive `fs-extra`); a REAL-import (not mocked) integration test proves the `node-sarif-builder` CJS-under-`await import()` interop resolves via `(mod.default ?? mod)`, and `@nx/dependency-checks` sees `node-sarif-builder` as a `dependency` (or it is added to `ignoredDependencies` with a one-line comment).
  4. The `'sarif'` enum member is threaded across all three adapter schemas and both schema-parity specs, and no ANSI byte appears in the SARIF payload regardless of `FORCE_COLOR` / TTY.

**Plans**: 2/2 plans complete

Plans:
**Wave 1**

- [x] 31-01-PLAN.md (Wave 1) -- Add `node-sarif-builder@^4.1.0` as a `dependency`; promote the 18-NG8xxx catalog to ONE enum-driven production module (`core/extended-catalog.ts`, single member->ngCode source); implement `core/sarif-report.ts` (`formatSarifReport`) reached ONLY via `await import('./sarif-report')`, REUSING the shipped `toDiagnosticRecord` projection (D-13 -- repo-relative URIs / 1-based regions / humanized codes come from the record, NOT a fresh `path.relative`), with `partialFingerprints` (`atcFingerprint/v1` sha256 recipe), the file-less no-location fallback, and the 18-rule catalog; replace the `renderReport` sarif throw + SARIF-shape unit specs (VER-01 slice). The `'sarif'` enum value was already threaded in Phase 30. (REP-02, VER-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 31-02-PLAN.md (Wave 2, depends 31-01) -- The require-graph guard proving human / JSON / `--help` / CLI-boot never load `node-sarif-builder` (nor transitive `fs-extra`) + the REAL-import CJS-under-`await import()` interop test + resolve the `@nx/dependency-checks` lazy-only-`import()` visibility against the real `nx lint`. (VER-04)

### Phase 32: Verification + docs + additive audit

**Goal**: The SHIPPED tarball emits valid JSON + schema-valid SARIF across all three adapters, the payloads are byte-stable across the OS/Node matrix, the whole milestone is proven additive-only vs `angular-typechecker@0.2.2`, and the README/CHANGELOG document the feature in end-user language. Proof + docs land after both reporters work.
**Depends on**: Phase 31
**Requirements**: VER-02, VER-03, ADD-01, DOC-01
**Success Criteria** (what must be TRUE):

  1. An integration tier runs `run()` + the Nx executor over committed real-cold-compiler fixtures emitting JSON + SARIF; the SARIF validates against the 2.1.0 schema (dev-only validator) and both payloads are byte-stable across the OS/Node cells after redacting volatile fields (tool version, any duration), including the Windows path -> forward-slash URI conversion (VER-02).
  2. A shipped-tarball e2e proves the installed package emits valid JSON + schema-valid SARIF through ALL three adapters (Nx executor, `ng run`, CLI `--format`), asserting the stdout payload parses cleanly (stdout-purity) and the exit code is identical across `human`/`json`/`sarif` (VER-03).
  3. A git-diff / `index.drift.ts` barrel audit proves additive-only vs `angular-typechecker@0.2.2` -- NO breaking change to the Nx executor id (`angular-typechecker:typecheck`), the `runTypecheck`/`CoreResult`/`CoreOptions` public API (only the new `format` option + the optional `totalFilesCount`), the Angular CLI builder, the CLI flag set, or the generator schemas; `node-sarif-builder` is classified as a `dependency` with the lazy-import visibility resolved; the `v0.3.0` escape hatch stays untriggered (ADD-01).
  4. A README `## Machine-readable output` section documents the `--format` flag, the JSON payload schema, and the SARIF `upload-sarif` recipe -- including the "run from the repo root so `artifactLocation.uri` stays repo-relative" caveat -- alongside a curated public CHANGELOG entry in end-user language with no internal ids (DOC-01).

**Plans**: TBD

Plans:

- [ ] 32-01: Integration specs -- `run()` + the executor over committed real-cold-compiler fixtures emitting JSON + SARIF; SARIF 2.1.0 schema validation (dev-only validator); volatile-field redaction; cross-OS/Node byte-stability incl. Windows path -> forward-slash URI (VER-02).
- [ ] 32-02: Shipped-tarball e2e proving the installed package emits valid JSON + schema-valid SARIF via all three adapters, stdout-purity (payload parses), and exit-code parity across formats (VER-03).
- [ ] 32-03: Additive-only git-diff + barrel-drift audit vs `angular-typechecker@0.2.2` -> `32-ADDITIVE-AUDIT.md`; confirm `node-sarif-builder` dependency classification + `@nx/dependency-checks` resolution (ADD-01).
- [ ] 32-04: README `## Machine-readable output` section (JSON schema + SARIF `upload-sarif` recipe + the run-from-repo-root caveat) + curated end-user-language CHANGELOG entry (DOC-01).

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | --------------- | ------ | --------- |
| 1. Workspace Bootstrap + Engine Spike (GATED) | v0.0.1 | 4/4 | Complete | 2026-06-27 |
| 2. Core Type-Check Engine + Gatherer | v0.0.1 | 3/3 | Complete | 2026-06-27 |
| 3. Filtering, Modes, Output + Quality Gates | v0.0.1 | 4/4 | Complete | 2026-06-27 |
| 4. Nx Executor Adapter + Cacheable Target | v0.0.1 | 3/3 | Complete | 2026-06-28 |
| 5. Packaging, Publish Hardening + e2e Smoke (MVP) | v0.0.1 | 5/5 | Complete | 2026-06-28 |
| 5.1 0.0.2 first OIDC steady-state publish verification (INSERTED) | v0.0.1 | 1/1 | Complete | 2026-06-29 |
| 6. Full e2e Matrix + CI | v0.0.1 | 5/5 | Complete | 2026-06-29 |
| 7. Release-PR workflow and clean changelog | v0.0.1 | 4/4 | Complete | 2026-06-29 |
| 8. Correctness & Completeness Fixes | v0.0.3 | 3/3 | Complete | 2026-06-29 |
| 9. Resilience (per-file fault isolation + boundary robustness) | v0.0.3 | 5/5 | Complete | 2026-06-29 |
| 10. Drift-hardening & Maintainability | v0.0.3 | 4/4 | Complete | 2026-06-29 |
| 11. Fallow code-quality CI gate | v0.0.3 | 2/2 | Complete | 2026-06-30 |
| 12. Extended-diagnostic catalog + completeness tripwire | v0.1.0 | 4/4 | Complete | 2026-07-01 |
| 13. Engine -- solution-tsconfig reference-walking | v0.1.0 | 6/6 | Complete | 2026-07-01 |
| 13.1 Rename angular-typecheck executor to typecheck (INSERTED) | v0.1.0 | 1/1 | Complete | 2026-07-01 |
| 14. configuration + init generators, nx add | v0.1.0 | 3/3 | Complete | 2026-07-02 |
| 15. Generator e2e + CI self-audit guard | v0.1.0 | 2/2 | Complete | 2026-07-02 |
| 16. Storybook type-check gate spike (GATED) | v0.2.0 | spike 006-008 | Complete (GO) | 2026-07-05 |
| 17. Input-set-membership boundary + layout support | v0.2.0 | 7/7 | Complete | 2026-07-06 |
| 18. Packaged-tarball e2e + docs | v0.2.0 | 5/5 | Complete | 2026-07-06 |
| 19. Stretch (Layout C / non-TS formats / strict mode) | v0.2.0 | 3/3 | Complete | 2026-07-07 |
| 20. Vite/Analog Storybook query-import guidance | v0.2.0 | 5/5 | Complete | 2026-07-07 |
| 21. Angular CLI builder engine (multi-tsConfig, GATE A') | v0.2.1 | 3/3 | Complete | 2026-07-11 |
| 22. Configuration schematic -- the angular.json write-fork | v0.2.1 | 2/2 | Complete | 2026-07-11 |
| 23. Init schematic parity + first-party ng-add | v0.2.1 | 3/3 | Complete | 2026-07-12 |
| 24. Real-OSS + scaffolded e2e, additive-only audit, docs | v0.2.1 | 6/6 | Complete | 2026-07-15 |
| 25. Extract the advisory-notice seam | v0.2.2 | 1/1 | Complete | 2026-07-16 |
| 26. Pure CLI core + exit-code wiring | v0.2.2 | 3/3 | Complete | 2026-07-16 |
| 27. Bin shell + cross-platform packaging | v0.2.2 | 3/3 | Complete | 2026-07-16 |
| 28. Shipped-tarball e2e + real-clone UAT | v0.2.2 | 4/4 | Complete | 2026-07-17 |
| 29. Docs | v0.2.2 | 1/1 | Complete | 2026-07-17 |
| 30. Reporter seam + JSON reporter + `--format` threading + observability | v0.2.3 | 3/3 | Complete    | 2026-07-18 |
| 31. SARIF reporter | v0.2.3 | 2/2 | Complete   | 2026-07-18 |
| 32. Verification + docs + additive audit | v0.2.3 | 0/4 | Not started | - |

## Backlog

- **GitHub-backed self-hosted Nx remote cache** -- a workspace-wide CI cache optimization proposed and then removed from the v0.2.1 roadmap (was Phase 25) as lower priority than the already-shipped e2e per-project matrix split (~41% faster). Grounded by `260715-050-RESEARCH-3.md` (GitHub Actions Cache backend, CREEP-mitigated). Requires fixing the OS/Node hash landmine (`RUNNER_OS` + Node major as `env` named inputs) before any cache replay.
