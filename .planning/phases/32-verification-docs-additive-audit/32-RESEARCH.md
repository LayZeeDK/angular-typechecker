# Phase 32: Verification + docs + additive audit - Research

**Researched:** 2026-07-19
**Domain:** Test-tier verification (integration + shipped-tarball e2e) + additive-only release audit + end-user docs for a shipped multi-adapter Nx/Angular-CLI/standalone-CLI reporter surface
**Confidence:** HIGH (grounded in the shipped v0.2.2/v0.2.3 source with cited paths; SARIF schema draft verified by direct fetch; validator packages verified on the npm registry)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (SARIF schema validation):** Validate the REAL `formatSarifReport` output over committed fixtures against the SARIF 2.1.0 JSON schema with **`ajv`** (+ `ajv-formats` if the schema's `uri`/`uri-reference` formats need registering) as a **devDependency**, driven from a **COMMITTED** SARIF 2.1.0 schema JSON fixture (network-free, deterministic; never fetch at test time). A TRUE schema validator, distinct from Phase 31's golden-snapshot shape spec. Dev-only -> additive-only untouched. If ajv chokes on a schema construct (draft mismatch / unknown format), pin the schema draft + register formats via `ajv-formats`; do NOT weaken to a shape-only assertion.
- **D-02 (Byte-stability + redaction):** ONE shared redaction helper reused across the JSON + SARIF integration specs, applied BEFORE the byte-stability assertion; normalizes the tool `version` (JSON `version` + SARIF `runs[].tool.driver.version`) and any duration field to a fixed placeholder. Today the ONLY live volatile field is the tool version, but the helper catches any future volatile field (never assert a literal version). Byte-stability asserted two ways: (a) two-run same-process determinism, and (b) cross-OS/Node via the redacted snapshot on the 6-cell matrix, explicitly covering the Windows path -> forward-slash `artifactLocation.uri` conversion.
- **D-03 (Integration fixtures):** REUSE existing COMMITTED real-cold-compiler fixtures that already yield a stable MIXED diagnostic set (a `TS####` + an `NG8xxx` + ideally a file-less/global diagnostic). Add a dedicated reporter fixture ONLY if no existing fixture yields the needed shape. The integration tier drives BOTH `run()` (CLI adapter) and the Nx executor over the fixtures emitting `--format json` and `--format sarif`.
- **D-04 (Tarball e2e placement):** EXTEND the existing e2e projects rather than add a new one: CLI `--format json|sarif` via `angular-typechecker-cli-e2e`, `ng run <project>:typecheck --format ...` via `angular-typechecker-ng-cli-e2e`, and the Nx executor `--format ...` via `angular-typechecker-install-e2e` (or `-matrix-e2e`). Each adapter asserts (a) stdout-purity (payload PARSES, no Nx chrome / advisory text on stdout); (b) SARIF validates against the 2.1.0 schema (reuse the D-01 dev-only validator); (c) exit code IDENTICAL across `human`/`json`/`sarif` for the same input. Plan-time re-open: the exact project-to-adapter mapping.
- **D-05 (Additive-only audit):** Mirror the shipped `24-ADDITIVE-AUDIT.md` -> `32-ADDITIVE-AUDIT.md`: `git diff angular-typechecker@0.2.2..HEAD` scoped to the PUBLISHED surface + the `index.drift.ts` barrel-drift tsc, proving NO breaking change to the Nx executor id, `runTypecheck`/`CoreResult`/`CoreOptions` public API (only the new `format` option + optional `totalFilesCount`), the Angular CLI builder, the CLI flag set, or the generator schemas; `renderReport` stays OUT of the public barrel. `node-sarif-builder` classification is ALREADY resolved (Phase 31 31-01: runtime `dependency`, `@nx/dependency-checks` SEES the lazy `import()`, NO `ignoredDependencies` needed, A1 confirmed) -- the audit RE-CONFIRMS against the real lint run, does not re-litigate. Baseline tag `angular-typechecker@0.2.2` exists. The `v0.3.0` escape hatch stays untriggered.
- **D-06 (README + CHANGELOG):** Add a README `## Machine-readable output` section documenting `--format`, the JSON payload schema (flat `diagnostics[]`, `summary`, `formatVersion`, 1-based positions, code strings, file-less `null`), the SARIF `upload-sarif` GitHub Code Scanning recipe, and the "run from the repo root so `artifactLocation.uri` stays repo-relative" caveat. Add a curated UNDATED public CHANGELOG `0.2.3` entry in END-USER language (no internal ids / board jargon). Add a docs content tripwire spec (mirror `standalone-cli-docs.spec.ts` / `angular-cli-docs.spec.ts`) drift-locking the documented flag + claims against `HELP_TEXT` / the payload shape. Docs-only; NO release cut, NO `package.json` bump (stays `0.2.2`).

### Claude's Discretion (planner-owned)

The exact fixture selection (D-03), the redaction-helper signature + placeholder tokens (D-02), whether `ajv` needs `ajv-formats` (D-01), the docs-spec filename (D-06), and the precise project-to-adapter e2e mapping (D-04) are left to the planner, provided the observable proofs hold: schema-valid SARIF, byte-stable redacted payloads across the matrix, stdout-purity, exit-code parity, the additive-only verdict, and end-user-language docs.

### Deferred Ideas (OUT OF SCOPE)

- **The actual v0.2.3 release cut** (version bump `0.2.2 -> 0.2.3`, tag `angular-typechecker@0.2.3`, npm publish) -- the human-gated Release-PR flow AFTER this phase verifies, NOT part of Phase 32.
- **Published hosted `$schema` URL** (REP-04), **`--output <file>`** (CLIX-03), **other formats** (codeclimate / compact / GitLab, REP-03), **SARIF `relatedLocations`** (REP-05), **`--watch`** (CLIX-01) -- future milestones.
- **Off-stack Angular 20/21 verification** -- dropped since v0.2.1; on-stack Angular 22 only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **VER-02** | Integration tier: `run()` + the executor over committed real-cold-compiler fixtures emitting JSON + SARIF; SARIF validated against the 2.1.0 schema (dev-only validator); volatile fields (`durationMs`, tool version) redacted; byte-stable across the OS/Node cells incl. Windows path -> forward-slash URI. | Integration-tier structure + fixture selection + the VERIFIED ajv recipe (draft-07 schemastore copy -> plain `ajv` + `ajv-formats`, `strict:false`) + redaction-helper shape + 6-cell snapshot mechanism -- all below in "VER-02 deep-dive". |
| **VER-03** | Shipped-tarball e2e: the installed package emits valid JSON + schema-valid SARIF via ALL three adapters (Nx executor, `ng run`, CLI `--format`); asserts stdout-purity (payload parses) and exit-code parity across formats. | 5 e2e projects + dynamic CI matrix + Verdaccio setup + `runShim` (stream-merge caveat) + `assertShippedBinExitCodes` extension point + adapter->project mapping + the Nx/ng stdout-framing risk -- "VER-03 deep-dive". |
| **ADD-01** | Additive-only vs `angular-typechecker@0.2.2`: no breaking change to the executor id, `runTypecheck`/`CoreResult`/`CoreOptions` public API (only new `format` + optional `totalFilesCount`), builder, CLI flags, generator schemas; `renderReport` not in the barrel; `node-sarif-builder` dependency classification + `@nx/dependency-checks` visibility confirmed; `v0.3.0` untriggered. | `24`/`27-ADDITIVE-AUDIT.md` template + git-diff scoping + the `index.drift.ts` tripwire + the dependency-diff proof (ONLY `node-sarif-builder` added; `ajv`/`ajv-formats` are ROOT devDeps) -- "ADD-01 deep-dive". |
| **DOC-01** | README `## Machine-readable output` (`--format`, JSON schema, SARIF `upload-sarif` recipe, run-from-repo-root caveat) + curated end-user-language CHANGELOG entry, no internal ids. | Shipped `*-docs.spec.ts` tripwire pattern + `parseCliArgs(['--help'])` drift-lock idiom + the exact JSON payload key set + curated-CHANGELOG conventions -- "DOC-01 deep-dive". |
</phase_requirements>

## Summary

This is a **prove-and-document** phase over a surface that already ships. Both reporters are in the tree and unit-tested: `core/json-report.ts` (`formatJsonReport`, Phase 30), `core/sarif-report.ts` (`formatSarifReport`, Phase 31), reached through the widened `core/render-report.ts` seam that all three adapters (`cli/main.ts` `run()`, `executors/typecheck/executor.ts`, `builders/typecheck/builder.ts` via `convertNxExecutor`) already call. `node-sarif-builder@^4.1.0` is already declared as a runtime `dependency` and `@nx/dependency-checks` already sees the lazy `import()` with NO `ignoredDependencies` entry (verified in `packages/angular-typechecker/package.json` + `eslint.config.mjs`). Phase 32 adds NO production behavior; it adds tests, one audit document, one README section, one CHANGELOG entry, and (the only net-new tooling) a dev-only SARIF schema validator.

The four deliverables map cleanly to shipped repo patterns: VER-02 is a new pair of `*.integration.spec.ts` files in the `integration` tier (`@nx/vitest:test`, `dependsOn: build`, 6-cell OS x Node matrix); VER-03 extends three of the five existing `e2e` projects; ADD-01 is a `32-ADDITIVE-AUDIT.md` that mirrors the shipped `24-`/`27-ADDITIVE-AUDIT.md` structure verbatim; DOC-01 is a README section + curated CHANGELOG entry + a `*-docs.spec.ts` content tripwire mirroring `standalone-cli-docs.spec.ts`. The dominant risks are all "verification correctness" rather than "feature correctness": (1) the SARIF schema draft/format handling in ajv, (2) stdout-purity for the Nx/ng adapters where Nx/ng framing can leak onto stdout, and (3) cross-OS byte-stability of the redacted snapshots. Each is resolved below with a concrete, VERIFIED recipe.

**Primary recommendation:** Commit the SchemaStore `sarif-2.1.0.json` copy (VERIFIED draft-07) and validate with **plain `ajv@^8` + `ajv-formats@^3`, `strict: false`** (NOT `ajv-draft-04`) -- both as **workspace-root devDependencies**; house the validator helper + committed schema in `libs/test-util` (`@workspace/test-util`) so the VER-02 integration specs AND the VER-03 e2e specs reuse ONE validator. Drive stdout-purity primarily through the CLI `run()`/`.bin`-shim path (truly pure stdout) and, for the Nx/ng adapters, extract-and-parse the payload while asserting no advisory text is inside it.

## Architectural Responsibility Map

This phase produces PROOFS and DOCS, not app tiers. The map assigns each observable proof to the test/artifact tier that owns it.

| Capability (proof) | Primary Tier | Secondary Tier | Rationale |
|--------------------|-------------|----------------|-----------|
| Schema-valid SARIF over real-compiler output | Integration (`*.integration.spec.ts`) | e2e (shipped tarball) | The real cold `@angular/compiler-cli` produces the NG8xxx set the schema must accept; e2e re-proves it on the installed artifact. |
| Byte-stable redacted JSON + SARIF across OS/Node | Integration (6-cell matrix snapshot) | -- | The `integration` target runs on all 6 CI cells; a committed redacted snapshot is the cross-cell contract. |
| Windows path -> forward-slash `artifactLocation.uri` | Integration (Windows cells) | e2e-windows (cli-e2e) | `relativizePath` already forces `/`; the Windows matrix cell is where a regression would surface. |
| stdout-purity (payload parses, no chrome) | e2e (shipped tarball, all 3 adapters) | Integration (`run()` returns pure stdout) | Only the installed artifact through the real PM shim / `nx run` / `ng run` proves no framing leaks. |
| exit-code parity across `human`/`json`/`sarif` | e2e (literal OS exit codes) | Unit (already: reporters never touch the verdict) | `evaluateResult`/`toExitCode` own the verdict; the e2e proves the SHIPPED bin returns identical codes per format. |
| Additive-only vs `@0.2.2` | Audit doc + `index.drift.ts` tsc + `nx lint` | git-diff | Barrel tripwire + dependency-checks are standing guards; the audit doc records the git-diff verdict. |
| Docs accuracy (flag + claims + CHANGELOG hygiene) | Unit (`*-docs.spec.ts`, `nx test`) | -- | Pure filesystem read; runs in the fast loop on every PR, even docs-only. |

## Standard Stack

### Core (net-new this phase -- ALL dev-only)

The reporters and their runtime dependency already ship. The ONLY net-new packages are the dev-only SARIF schema validator.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ajv` | `^8.20.0` [VERIFIED: npm registry] | Compile + validate the SARIF 2.1.0 JSON schema in a dev-only test | The canonical JS JSON-schema validator (314M downloads/wk); ajv 8 defaults to **draft-07**, which is exactly what the SchemaStore `sarif-2.1.0.json` targets (verified below). |
| `ajv-formats` | `^3.0.1` [VERIFIED: npm registry] | Register the `uri` / `uri-reference` / `date-time` string formats the SARIF schema uses | ajv 8 ships NO formats; the SARIF schema references `uri`/`uri-reference`/`date-time` (verified by direct fetch). Without it those formats are silently un-validated (or warn under strict mode). |

**Placement (critical for ADD-01):** `ajv` + `ajv-formats` go in the **workspace-root `package.json` devDependencies** (alongside `vitest`, `verdaccio`, `publint`, `@arethetypeswrong/cli`), NEVER in `packages/angular-typechecker/package.json`. The plugin manifest's `dependencies` must gain ONLY `node-sarif-builder` since `@0.2.2` (already true). Precedent: `vitest` is imported by every spec yet is a root devDep, not a plugin dependency, and `nx lint` stays green -- `@nx/dependency-checks` only polices packages reachable through the plugin's `build` target (`.spec.ts` files are excluded by `tsconfig.lib.json`).

### Already-shipped (reused, NOT re-implemented)

| Asset | Path | Role in Phase 32 |
|-------|------|------------------|
| Widened render seam | `packages/angular-typechecker/src/core/render-report.ts:63-100` | The dispatcher the integration specs render through (`renderReport(result, { format, pathBase, color })`). |
| JSON reporter | `src/core/json-report.ts` (`formatJsonReport`) | Emits the payload VER-02 validates + DOC-01 documents. |
| SARIF reporter | `src/core/sarif-report.ts` (`formatSarifReport`) | Emits the SARIF VER-02 schema-validates. |
| Shared projection | `src/core/diagnostic-record.ts` (`toDiagnosticRecord`, `relativizePath`) | The already-`/`-forced repo-relative URI logic (`relativizePath`, lines 113-121) -- the Windows-URI proof rests on this. |
| Integration target | `packages/angular-typechecker/project.json:109-117` + `vitest.integration.config.mts` | Where VER-02 specs live (`@nx/vitest:test`, `dependsOn: build`). |
| `run()` CLI core | `src/cli/main.ts` (`run(argv, env): Promise<{ exitCode; stdout; stderr }>`) | VER-02 drives `run(['-c', fixture, '--format', 'json'], env)` and reads pure `.stdout`. |
| e2e harness | `libs/test-util/src/lib/{cli-e2e,ng-cli-e2e,verdaccio-global-setup}.ts` | `runShim`, `assertShippedBinExitCodes`, `createNgRun`, `plant` -- VER-03 extension points. |
| Tarball audit | `e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts` | The `REQUIRED_FILES` + manifest-shape pattern (extend if needed). |
| Barrel tripwire | `src/index.ts` + `src/index.drift.ts` (rides `tsc --noEmit -p tsconfig.drift.json`) | ADD-01's authoritative barrel-unchanged proof. |
| Docs tripwires | `src/standalone-cli-docs.spec.ts`, `src/angular-cli-docs.spec.ts` | DOC-01's `*-docs.spec.ts` pattern + `parseCliArgs(['--help'])` drift-lock idiom. |

**Installation (dev repo only):**
```bash
npm install -D ajv@^8 ajv-formats@^3   # workspace ROOT devDependencies (never the plugin manifest)
```

## Package Legitimacy Audit

> Phase 32 installs `ajv` + `ajv-formats` (dev-only). `node-sarif-builder` was installed in Phase 31 and is re-confirmed by ADD-01, not re-installed here.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `ajv` | npm | 8+ yrs (latest 8.20.0, 2026-04-24) | 314M/wk | github.com/ajv-validator/ajv | **OK** | Approved (root devDep) |
| `ajv-formats` | npm | latest 3.0.1 (2024-03-30) | 101M/wk | github.com/ajv-validator/ajv-formats | **OK** | Approved (root devDep) |
| `node-sarif-builder` | npm | 4.1.0 | (shipped Phase 31) | github.com/nvuillam/node-sarif-builder | **OK** (already a runtime `dependency`) | Re-confirmed by ADD-01, not re-installed |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none. Both `ajv` and `ajv-formats` returned `OK` from `gsd-tools query package-legitimacy check` (no postinstall, official `ajv-validator` org repos) AND are the packages named in the official ajv documentation (ajv.js.org) -> tagged `[VERIFIED: npm registry]`.

## VER-02 deep-dive: integration tier + SARIF schema validation + byte-stability

### Where the specs live and how they run

The `integration` target (`packages/angular-typechecker/project.json:109-117`) is `@nx/vitest:test` with `configFile: vitest.integration.config.mts`, `dependsOn: ["build"]`, and runs on the **full 6-cell OS x Node matrix** via `nx run-many -t integration` (`.github/workflows/ci.yml:139`). Add VER-02 as one or two new `packages/angular-typechecker/src/core/*.integration.spec.ts` files (e.g. `reporters-json.integration.spec.ts` + `reporters-sarif.integration.spec.ts`, or a single `machine-reporters.integration.spec.ts`; wave-parallelism prefers disjoint files -- see `global-diagnostics.integration.spec.ts` for the "dedicated file for disjoint ownership" note at lines 18-20).

Structure mirrors every shipped integration spec: `findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)))` -> `join(workspaceRoot, 'fixtures', <name>, 'tsconfig.json')` -> `await runTypecheck({ tsConfigPath })` (real cold `@angular/compiler-cli`) -> render. The JSON/SARIF render paths do NOT reload compiler-cli (they load only `typescript`, already warm), so the cold-compiler cost is paid once by `runTypecheck`.

### Fixture selection (D-03)

Fixtures live at the **workspace root** `fixtures/` (NOT under the plugin's `src/`). Verified committed fixtures and the diagnostic families they yield:

| Fixture | tsconfig | Diagnostics it produces | Use for |
|---------|----------|-------------------------|---------|
| `fixtures/layout-b-host` | `fixtures/layout-b-host/tsconfig.json` | `TS2322` (aggregated broken story) **+** `NG8002` (external-template kill-shot, carries a `.html` `artifactLocation` + `.ts` relatedInformation) + `suppressedInGraph*` | The MIXED `TS####` + `NG8xxx` payload -- exercises the relative-URI conversion on BOTH a `.ts` and a `.html` file. Proven in `src/core/layout-b.integration.spec.ts:59-149`. |
| `fixtures/global-diagnostics` | `fixtures/global-diagnostics/tsconfig.json` | file-less/global `TS2318` (`noLib:true` + `types:[]`) | The **file-less/no-location** path (SARIF no-`locations` result, JSON `file:null`). Proven in `src/core/global-diagnostics.integration.spec.ts:37-50`. |

**Recommendation (lazy + sufficient):** use `layout-b-host` for the mixed `TS####` + `NG8xxx` payload and `global-diagnostics` for the file-less path. Together they cover D-03's "`TS####` + `NG8xxx` + file-less" without authoring a new fixture. Only add a dedicated fixture if a SINGLE payload carrying all three at once is required -- it is not (VER-02 asserts per-payload validity + stability, and two fixtures cover the union). NOTE: `layout-b-host`'s NG8002 is a coverage-incomplete/verdict-fail run (good -- it also lets VER-02 assert the reporter never masks the verdict), and its `artifactLocation.uri` will be the `.html` template path relative to `pathBase`.

**`pathBase` is load-bearing for cross-OS stability:** pass `pathBase` = the fixture/workspace root when rendering, so `relativizePath` (`diagnostic-record.ts:113-121`) produces repo-relative forward-slash URIs identical on Windows/Linux/macOS. Without a `pathBase` the payload carries absolute machine paths and the 6-cell snapshot fails immediately.

### SARIF schema validation (D-01) -- VERIFIED recipe

The SchemaStore `sarif-2.1.0.json` (the `$id` the CONTEXT cites) was fetched directly on 2026-07-19:

```
"$schema": "http://json-schema.org/draft-07/schema#"     <- draft-07, NOT draft-04
"$id": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"
size: 111,720 bytes (~109 KB)
format keywords used: "date-time", "uri", "uri-reference"
```

This resolves D-01's open question decisively:

- The SchemaStore copy is **draft-07 with `$id`** (the modern form) -- so use **plain `ajv@^8`** (draft-07 is ajv 8's default). Do **NOT** use `ajv-draft-04`. (The OASIS *canonical* `sarif-schema-2.1.0.json` is draft-04 with a bare `id`; the SchemaStore-hosted copy the CONTEXT points at has been converted to draft-07. Commit the SchemaStore copy so the plain-ajv path holds.)
- The schema uses `uri`/`uri-reference`/`date-time` formats -> **`ajv-formats` IS required** and must be registered.
- Use `strict: false` so the ~109 KB schema does not trip ajv strict-mode complaints.

```ts
// libs/test-util/src/lib/validate-sarif.ts  (shared by VER-02 integration + VER-03 e2e)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Committed dev-only fixture (NOT under the plugin src/ -> never ships). ~109 KB.
const schema = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'sarif-2.1.0.schema.json'),
    'utf8',
  ),
);

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validateSarifSchema = ajv.compile(schema); // compile ONCE at module load

export function validateSarif(sarifJson: string): { valid: boolean; errors: string } {
  const data = JSON.parse(sarifJson); // stdout-purity: this throws if stdout is impure
  const valid = validateSarifSchema(data) === true;
  return {
    valid,
    errors: valid ? '' : JSON.stringify(validateSarifSchema.errors, null, 2),
  };
}
```

The validator asserts the REAL `formatSarifReport` output (over the committed fixtures) validates -- not a hand-rolled object. The data's own `$schema` (node-sarif-builder emits `http://json.schemastore.org/sarif-2.1.0.json`) is irrelevant to ajv: ajv validates the data against the compiled schema object, not against the data's `$schema` pointer.

**Schema-fixture placement:** commit `sarif-2.1.0.schema.json` beside the validator in `libs/test-util/src/lib/`. It must NOT live under `packages/angular-typechecker/src/` -- the tarball `files: ["src", ...]` allowlist would ship a 109 KB dev-only schema, and `tarball-audit.e2e.spec.ts` would need a new leak-guard exception. `libs/test-util` is path-aliased (`@workspace/test-util`), never published, and already the home of every shared e2e/integration helper.

**Watch-item (minor):** if `libs/test-util` carries its own `@nx/dependency-checks`-linted `package.json`, `ajv`/`ajv-formats` may need declaring there or ignoring; test-util is a private lib and its `eslint.config.mjs` is separate from the plugin's. Confirm against the real `nx lint test-util` during execution -- not a blocker.

### Byte-stability + redaction helper (D-02)

The only live volatile field is the tool `version`: JSON top-level `version` (`json-report.ts:80`) and SARIF `runs[].tool.driver.version` (`sarif-report.ts:72`). The JSON payload OMITS `durationMs` (Phase-30 D-05) and SARIF carries no duration/timestamp, so the redaction surface is tiny -- but write the helper to catch any future volatile field, never asserting a literal version. The shipped unit specs already show the exact redaction shape to lift into a shared helper:

- JSON: `{ ...payload, version: '[version]' }` (`json-report.spec.ts:247`)
- SARIF: map `runs[].tool.driver.version -> '[version]'` (`sarif-report.spec.ts:294-305`)

```ts
// One shared helper reused across BOTH integration specs (D-02).
function redactVolatile(payload: any): any {
  if (payload.runs) { // SARIF
    return { ...payload, runs: payload.runs.map((r: any) => ({
      ...r, tool: { ...r.tool, driver: { ...r.tool.driver, version: '[version]' } } })) };
  }
  return { ...payload, version: '[version]' }; // JSON
}
```

Assert byte-stability two ways (D-02):
1. **Two-run same-process determinism:** `expect(redactVolatile(parse(run2))).toEqual(redactVolatile(parse(run1)))` -- render the same fixture twice and compare.
2. **Cross-OS/Node via the 6-cell matrix:** `expect(redactVolatile(parse(payload))).toMatchSnapshot()`. The committed snapshot (generated on Windows) must reproduce byte-for-byte on the Linux/macOS cells; the `relativizePath` `/`-forcing makes the URIs OS-invariant, so the Windows path -> forward-slash `artifactLocation.uri` conversion is proven precisely by "the Windows-authored snapshot matches on Linux and vice-versa." Redact the OBJECT (vitest serializes deterministically) rather than the raw string.

**Determinism guarantees already in place:** `CoreResult.diagnostics` are sorted+deduped by `runTypecheck` (`render-report.ts:56-57`); SARIF `partialFingerprints` are sha256 over a relative-path tuple with NO absolute path / cwd / version (`sarif-report.ts:152-162`); the 18-rule catalog is enum-ordered. The only cross-OS variable is the file URI, which `relativizePath` normalizes.

### The `run()` + executor dual (D-03)

- **`run()` (primary, clean):** `const { stdout } = await run(['-c', fixtureTsConfig, '--format', 'json'], env)` -> `stdout` is the pure payload (`main.ts` returns `stdout = renderReport(...)` only; advisories go to `stderr`). `JSON.parse(stdout)` / `validateSarif(stdout)`. This is the cleanest stdout-purity vehicle in the whole phase.
- **Nx executor:** invoke the executor in-process. It writes the payload via `process.stdout.write(report)` (per PITFALLS source citation), so spy `process.stdout.write` to capture the string, or call the executor and assert its `{ success }` matches `run()`'s exit intent. Build a minimal `ExecutorContext` (`root`, `projectName`, `cwd`) -- see `src/builders/typecheck/builder.integration.spec.ts` for the `TestingArchitectHost` precedent and the `NX_DAEMON=false` + `NX_ISOLATE_PLUGINS=false` module-scope requirement (STATE 24-01) if the executor path resolves a project graph. In practice the `run()` payload and the executor payload are byte-identical because both call the SAME `renderReport` seam -- so the executor assertion can be lighter (payload parses + same exit intent), with `run()` carrying the byte-stability snapshot.

## VER-03 deep-dive: shipped-tarball e2e across all three adapters

### The five e2e projects and the CI matrix

`e2e/angular-typechecker-{cli,ng-cli,install,matrix,cache}-e2e`. CI runs them as a **per-project dynamic matrix**: a lean `discover` job (`tools/ci/list-e2e-projects.mjs`) fs-reads `e2e/*/project.json` and feeds `fromJSON(needs.discover.outputs.projects)` (`.github/workflows/ci.yml:153-262`), one Linux runner per e2e project; plus a dedicated `e2e-windows` job that runs ONLY `angular-typechecker-cli-e2e` on `windows-latest` (`ci.yml:294-319`). Each cell (re)builds the plugin via its own `e2e`-target `dependsOn: angular-typechecker:build` (GUARD-01e). A shared Verdaccio `global-setup` (`libs/test-util/src/lib/verdaccio-global-setup.ts`) publishes the dist ONCE; specs `inject('verdaccioUrl'/'verdaccioToken')` and install BY NAME.

**GUARD-01x wiring to satisfy:** GUARD-01/01b (dynamic-matrix wiring + `discover` output == enumeration), GUARD-01e (per-target `dependsOn: build`), GUARD-01f (the `e2e-windows` OS-axis). Adding `--format` assertions to EXISTING specs in EXISTING projects triggers **none** of these -- there is no new project, no new CI job, no `ci.yml` edit. This is exactly why D-04 says extend, not add. A brand-new e2e project WOULD auto-join the dynamic matrix (good) but is unnecessary.

### Adapter -> project mapping (D-04)

| Adapter | e2e project | Invocation | Existing extension point |
|---------|-------------|------------|--------------------------|
| Standalone CLI `--format` | `angular-typechecker-cli-e2e` | `runShim(tmp, 'angular-typechecker', ['-c','tsconfig.json','--format','json'], env)` | `libs/test-util/src/lib/cli-e2e.ts` `assertShippedBinExitCodes` (add a `--format` parity + purity block) |
| `ng run ...:typecheck --format` | `angular-typechecker-ng-cli-e2e` | `createNgRun(prefix)(tmp, 'app:typecheck --format json', env)` | `libs/test-util/src/lib/ng-cli-e2e.ts` `createNgRun` / `assertPerProjectScoping` |
| Nx executor `--format` | `angular-typechecker-install-e2e` (or `-matrix-e2e`) | `nx run <project>:typecheck --format json` | `install-e2e` consumer-workspace specs |

Recommended primary mapping: CLI via `cli-e2e` (already the exit-code-contract home), `ng run` via `ng-cli-e2e`, and the Nx executor via `install-e2e` (its `consumer-app`/`consumer-workspace` fixtures already drive `nx run`).

### THE key VER-03 implementation detail: `runShim` merges stdout+stderr

`runShim` (`cli-e2e.ts:38-83`) returns `stdout: \`${result.stdout}${result.stderr}\`` -- it **concatenates** the two streams. That is correct for the shipped exit-code + code-substring assertions, but it makes `JSON.parse(result.stdout)` **fail** because stderr advisory chatter is glued to the payload. For stdout-PURITY (D-04: "the stdout payload PARSES cleanly"), the planner MUST expose the streams separately. `spawnSync` already returns `result.stdout` and `result.stderr` separately (cli-e2e.ts:58-64 just merges them), so the fix is small:

```ts
// Add a sibling helper OR extend ShimResult with a separate stderr field.
export interface ShimResultSplit { code: number; stdout: string; stderr: string; }
export function runShimSplit(...): ShimResultSplit {
  const result = spawnSync(command, args, { ...same options... });
  if (result.error) { throw ... }
  return { code: result.status ?? 2, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}
```
Then `JSON.parse(runShimSplit(...).stdout)` proves purity and `.stderr` carries the advisories. Do NOT reuse the stream-merged `runShim` for the purity assertion.

### stdout-purity risk for the Nx / ng adapters (surface to the planner)

The CLI `.bin` shim gives TRULY pure stdout (the shipped `bin.ts` writes `run().stdout` only). But `nx run <p>:typecheck --format json` and `ng run <p>:typecheck --format json` frame the executor's stdout with their own task-runner output ("> nx run ...", NX summary banners). Nx sends most chrome to stderr, but a leading task-echo line can land on stdout depending on `--output-style`/TTY. This is Pitfall 1 (stdout contamination) surfacing at the adapter boundary. Recommended handling for the Nx/ng cells:

1. Prefer an output style that suppresses framing where available (e.g. `nx run ... --output-style=static` reduces prefixes; verify the exact Nx 23 stdout framing during execution, do not assume).
2. If Nx/ng still prepend a banner line, extract the payload deterministically -- slice stdout from its first `{` (the payload is a single JSON object) -- AND assert no advisory/notice text (`angular-typechecker:` prefix, "coverage-incomplete" notice) is INSIDE the parsed payload. That satisfies "no Nx chrome / advisory text leaking onto stdout" for the payload boundary while tolerating the framework's own wrapper the consumer already expects from `nx run`.
3. Keep the strongest purity proof on the CLI path (`run()`/shim), where stdout is unambiguously pure.

**Open question flagged below.** This is the #1 execution risk for VER-03.

### The three assertions per adapter (D-04)

For each adapter, over a clean fixture and a planted-error fixture:
- (a) **stdout-purity:** `JSON.parse(payloadStdout)` succeeds (JSON) / `validateSarif(payloadStdout).valid === true` (SARIF, reusing the D-01 helper).
- (b) **schema-valid SARIF:** the shared `validateSarif` from `libs/test-util`.
- (c) **exit-code parity:** run the SAME input through `--format human`, `--format json`, `--format sarif` and assert the literal exit code is IDENTICAL across all three -- `0` clean, `1` planted TS2322, and (the cardinal anti-false-pass) the coverage-incomplete case still `1` in every format. `assertShippedBinExitCodes` (`cli-e2e.ts:109-184`) is the exact pattern to extend with a `--format` loop.

## ADD-01 deep-dive: additive-only audit vs `angular-typechecker@0.2.2`

### Mirror the shipped audit doc verbatim

`.planning/milestones/v0.2.2-phases/27-bin-shell-cross-platform-packaging/27-ADDITIVE-AUDIT.md` is the closest template (and `.../v0.2.1-phases/24-.../24-ADDITIVE-AUDIT.md` the original). Produce `.planning/phases/32-verification-docs-additive-audit/32-ADDITIVE-AUDIT.md` with the SAME five sections:

1. **Header + Verdict:** baseline `angular-typechecker@0.2.2` (confirm `git tag -l 'angular-typechecker@0.2.2'`), HEAD sha, scope = the whole v0.2.3 milestone (Phases 30-32), method = standing-guard cross-check + `git diff angular-typechecker@0.2.2..HEAD` per public-surface path + `git cat-file`/`git ls-tree` net-new confirmation. Verdict: ADDITIVE-ONLY HOLDS, `v0.3.0` NOT triggered, version stays `0.2.2`.
2. **Guard cross-check map:** the standing guards, all present + green in this phase's `nx test` / `nx typecheck` / `nx lint` runs.
3. **Git-diff verdict per audited path** (the table below).
4. **New-file additions (additive by construction):** the whole `src/core/{json-report,sarif-report,diagnostic-record,extended-catalog}.ts` set + their specs were 0 files at `@0.2.2` (`git ls-tree -r angular-typechecker@0.2.2 -- <path>`).
5. **Disposition:** no executor-id break, no barrel break, no schema break, only additive changes + the ONE new runtime `dependency` (`node-sarif-builder`).

### The audited paths (git-diff verdict table)

Run each `git diff angular-typechecker@0.2.2..HEAD -- <path>` and record the verdict:

| Audited path | Expected verdict | Notes |
|--------------|------------------|-------|
| `packages/angular-typechecker/src/index.ts` | **UNCHANGED** | Verified byte-identical now: barrel exports `runTypecheck`, `TypecheckInfrastructureError`, `CoreOptions`, `CoreResult`, `SkippedReference` only (`index.ts:14-19`). `renderReport`/`formatJsonReport`/`formatSarifReport` are NOT exported. |
| `.../src/executors/typecheck/schema.json` + `schema.d.ts` | **WIDEN-ONLY** | Phase 30 added the optional `format` enum (`'human'|'json'|'sarif'`, default `human`) + `--quiet`/`--color`. Every pre-existing option unchanged; `additionalProperties`/`required` unchanged. |
| `.../src/builders/typecheck/{builder.ts,schema.json,schema.d.ts}` | `builder.ts` **UNCHANGED**; schemas **WIDEN-ONLY** (mirror the executor `format`) | `builder.ts` is byte-unchanged (`convertNxExecutor(typecheckExecutor)`); the additive-only charter names it explicitly. |
| `.../src/core/run-typecheck.ts` (`CoreResult`/`CoreOptions`) | **ADDITIVE** | `CoreResult.totalFilesCount?: number` (OPTIONAL, Phase 30). `CoreOptions` unchanged. `index.drift.ts` still compiles = the type-level proof. |
| `.../executors.json`, `generators.json`, `builders.json`, `collection.json` | **UNCHANGED** | Executor id `angular-typechecker:typecheck` intact. |
| `.../src/generators/*/schema.json` | **UNCHANGED** | Generator schemas byte-identical. |
| `packages/angular-typechecker/package.json` | **ADDITIVE (deps): ONLY `node-sarif-builder`** | THE critical dependency proof -- see below. |

### The dependency proof (the ADD-01 crux)

`git diff angular-typechecker@0.2.2..HEAD -- packages/angular-typechecker/package.json` must show the `dependencies` block gained **exactly one** entry, `"node-sarif-builder": "^4.1.0"`, and nothing else (the current manifest confirms: `@nx/devkit`, `node-sarif-builder`, `nx`, `tslib` -- `node-sarif-builder` is the only addition since `@0.2.2`; `nx` was already a direct dep since v0.2.1). Prove that `ajv`/`ajv-formats` did NOT reach the published `dependencies`:

```bash
git diff angular-typechecker@0.2.2..HEAD -- packages/angular-typechecker/package.json
# assert: + "node-sarif-builder": "^4.1.0"  in dependencies; NO ajv / ajv-formats anywhere in this file
git show HEAD:packages/angular-typechecker/package.json | rg -c 'ajv'   # expect 0
```
`ajv`/`ajv-formats` appear only in the ROOT `package.json` devDependencies (a `git diff ... -- package.json` at the root will show them, which is FINE -- the root manifest is `@angular-typechecker/source`, `"private": true`, never published).

### Re-confirm `node-sarif-builder` classification against the real lint

Already resolved in Phase 31 (`eslint.config.mjs:130-176` has NO `node-sarif-builder` in `ignoredDependencies`; the lazy `await import('node-sarif-builder')` in `sarif-report.ts:59` is seen by `@nx/dependency-checks`). ADD-01 RE-CONFIRMS by running `nx lint angular-typechecker` (maxWarnings:0) green and recording that `node-sarif-builder` is neither flagged missing/obsolete nor needs an ignore entry (A1 confirmed). Do NOT re-open this.

### The barrel tripwire (leg a)

`src/index.drift.ts` (a type-only, never-shipped file, `index.drift.ts:1-35`) imports all five barrel exports and references each so a rename/removal fails `tsc --noEmit -p tsconfig.drift.json` LOUDLY. The `typecheck` target runs that tsc (`project.json:92-96`). ADD-01's authoritative leg (a) is "`nx typecheck angular-typechecker` green" = the barrel is byte-intact.

## DOC-01 deep-dive: README `## Machine-readable output` + curated CHANGELOG + docs tripwire

### README structure

`packages/angular-typechecker/README.md` already has: a ToC, `## Standalone CLI` (with an `### Options` table carrying the `--format`/`--quiet`/`--color` rows added in Phase 30/30-03), `## Angular CLI`, `## Storybook`, `## Exit codes`, `## Limitations`. Add a new `## Machine-readable output` section (+ its ToC anchor `[Machine-readable output](#machine-readable-output)`). It documents:

1. **`--format <human|json|sarif>`** (default `human`) and the matching Nx executor / Angular CLI builder `format` option.
2. **The JSON payload schema** -- the exact shipped shape (drift-locked in `json-report.spec.ts:405-478`), in end-user language:
   - top-level: `formatVersion` (integer marker), `tool`, `version`, `tsConfigPath`, `summary`, `diagnostics[]`.
   - `summary`: `outcome` (`clean`/`type-error`/`coverage-incomplete`/`warnings-exceeded`), `success`, `errorCount`, `warningCount`, `diagnosticCount`, `rootNamesCount`, optional `totalFilesCount`, `suppressedThirdParty`, `suppressedInGraphErrorCount`, `suppressedInGraphWarningCount`, optional `advisories`.
   - each `diagnostics[]` entry: `file` (repo-relative or `null` for file-less), 1-based `line`/`column`/`endLine`/`endColumn`, `code` (`TS####`/`NG8xxx`/`ATC9000x`) + raw `rawCode` int, `severity`, `message`.
3. **The SARIF `upload-sarif` recipe** -- a GitHub Actions snippet: `atc -c tsconfig.json --format sarif > results.sarif` then `github/codeql-action/upload-sarif@<sha>` with `sarif_file: results.sarif`. Note the 18-NG8xxx `rules[]` catalog and `partialFingerprints`.
4. **The run-from-repo-root caveat** -- `artifactLocation.uri` is relativized against the process root; run from the repo root so URIs stay repo-relative and GitHub Code Scanning matches files (Pitfall 4).
5. File-less diagnostics: represented as `file:null` (JSON) / no-location result (SARIF); the **exit code / `success`, not the SARIF alert, is the authoritative fail signal** for them (GH1001).

### The docs tripwire spec (D-06)

Mirror `src/standalone-cli-docs.spec.ts` (a pure `readFileSync` of README + CHANGELOG, whitespace-normalized `\s+ -> ' '`, runs in the fast `nx test` loop). A new `src/machine-readable-docs.spec.ts` (or extend `standalone-cli-docs.spec.ts`) should assert:
- README contains `## Machine-readable output` + the ToC anchor.
- README documents `--format` with all three values `human`/`json`/`sarif`.
- README mentions `upload-sarif` and the repo-root/`artifactLocation.uri` caveat.
- Optionally drift-lock the documented `--format` against the live `parseCliArgs(['--help'])` (the shipped idiom: `standalone-cli-docs.spec.ts:39-40,60` derives flag tokens from `HELP_TEXT` so an added flag self-enforces a README update). `--format` already appears in `HELP_TEXT` (Phase 30), so `helpFlags` will include `--format`; the existing "documents every long-form flag" test already forces it into the README.
- CHANGELOG hygiene: a `## 0.2.3` entry exists AND carries no internal ids -- reuse the shipped guard regex `not.toMatch(/DOC-01|CLI-0\d|SC#|phase[-\s]?\d/i)` (`standalone-cli-docs.spec.ts:122`), extended for any board jargon (`Layout B`, `input-set`, `SB-0x`, `G-gate`, per the changelog-readme-end-user-facing rule).

### Curated CHANGELOG (D-06)

`CHANGELOG.md` at the **repo root** (`../../CHANGELOG.md` from the plugin src; descending version sections, `## 0.2.2` already present). Add an **UNDATED** `## 0.2.3` entry at the top, in END-USER language (what an Angular dev gets + how to use it): machine-readable `--format json` and `--format sarif` across the Nx executor, Angular CLI builder, and standalone CLI; JSON for agents, SARIF 2.1.0 for GitHub Code Scanning; a `upload-sarif` one-liner. NO internal ids/scopes/board jargon, NO date, NO link-refs. Package `version` STAYS `0.2.2` -- this phase does NOT bump/tag/publish; the `0.2.2 -> 0.2.3` cut is the later human-gated Release-PR flow (AGENTS.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SARIF 2.1.0 conformance check | A hand-written "does it have runs/results" shape assertion | `ajv` + `ajv-formats` over the committed draft-07 schema | VER-02 requires validation against THE 2.1.0 schema; a shape assertion misses required-field/format violations node-sarif-builder could ship after an upgrade (Pitfall 11). |
| Repo-relative forward-slash URIs | A new `path.relative().replace(/\\/g,'/')` in the spec | The shipped `relativizePath` (`diagnostic-record.ts:113-121`) -- assert its OUTPUT | The production code already owns the Windows-path fix; re-deriving it in a test would test a copy, not the shipped behavior. |
| Shim exit-code contract | A fresh `spawnSync` block per format | Extend `assertShippedBinExitCodes` (`cli-e2e.ts:109-184`) | The 3-PM helper already owns the 0/1/2 contract + the ERR_REQUIRE_ESM/infra guards; add a `--format` loop, do not fork it. |
| The additive-audit document | A freeform prose write-up | The `27-ADDITIVE-AUDIT.md` five-section template | The structure (verdict / guard map / git-diff table / new-file proof / disposition) is the reviewed, milestone-audited format. |
| CHANGELOG hygiene enforcement | Manual eyeballing | The shipped `not.toMatch(/.../i)` regex guard | `standalone-cli-docs.spec.ts:122` already catches leaked ids in the fast test loop. |

**Key insight:** Phase 32 writes almost no new logic -- its correctness is entirely in REUSING the shipped projection/relativization/exit-code/audit patterns so the tests prove the SHIPPED behavior, not a test-local re-implementation of it.

## Common Pitfalls

### Pitfall 1: ajv on the wrong draft / missing formats
**What goes wrong:** `ajv.compile(sarifSchema)` throws "no schema with key or ref draft-04" or every `uri` field silently passes because the format is unregistered.
**Root cause:** the OASIS canonical schema is draft-04; the SchemaStore copy is draft-07. Mixing them, or forgetting `ajv-formats`, breaks validation.
**Avoid:** commit the SchemaStore `sarif-2.1.0.json` (draft-07, verified) -> plain `ajv@^8` + `ajv-formats@^3`, `strict:false`, `addFormats(ajv)`. NOT `ajv-draft-04`.
**Warning sign:** a "validation" test that passes on a deliberately-broken SARIF.

### Pitfall 2: stdout-purity fails because `runShim` merges streams
**What goes wrong:** `JSON.parse(runShim(...).stdout)` throws because stderr advisories are concatenated onto the payload.
**Root cause:** `cli-e2e.ts:81` returns `stdout+stderr`.
**Avoid:** add `runShimSplit` returning separate `stdout`/`stderr` (spawnSync already separates them); parse only `.stdout`.
**Warning sign:** the purity test fails only when the fixture emits an advisory notice.

### Pitfall 3: Nx/ng framing on stdout corrupts the payload
**What goes wrong:** `nx run p:typecheck --format json` stdout has a leading `> nx run ...` line, so `JSON.parse` fails.
**Root cause:** the task runner frames the executor's stdout.
**Avoid:** verify Nx 23 framing during execution; extract from the first `{`, assert no advisory text INSIDE the parsed payload, and keep the strongest purity proof on the CLI shim path.
**Warning sign:** the CLI purity test passes but the Nx/ng one flakes on framing.

### Pitfall 4: the schema fixture ships in the tarball
**What goes wrong:** a 109 KB `sarif-2.1.0.schema.json` committed under `packages/angular-typechecker/src/` gets published (the `files: ["src"]` allowlist ships all non-`.ts` under `src/`), bloating the package and tripping `tarball-audit` leak guards.
**Avoid:** commit the schema in `libs/test-util/src/lib/` (path-aliased, never published), NOT under the plugin `src/`.
**Warning sign:** `tarball-audit.e2e.spec.ts` "ships the required files" / leak-guard tests change.

### Pitfall 5: cross-OS snapshot drift from an un-relativized `pathBase`
**What goes wrong:** the redacted snapshot passes on Windows, fails on Linux, because the payload embedded an absolute machine path.
**Avoid:** always pass `pathBase` when rendering in the integration spec; redact only the version; rely on `relativizePath`'s `/`-forcing.
**Warning sign:** a snapshot diff that is only path separators / drive letters between cells.

### Pitfall 6: `ajv`/`ajv-formats` accidentally in the plugin manifest
**What goes wrong:** a devDep added to `packages/angular-typechecker/package.json` breaks ADD-01 by construction (the ONLY new runtime dep may be `node-sarif-builder`).
**Avoid:** root `package.json` devDependencies only; the ADD-01 dependency-diff step is the catch.
**Warning sign:** `git diff ... -- packages/angular-typechecker/package.json` shows `ajv`.

## Code Examples

### The additive-only git-diff commands (ADD-01)
```bash
git tag -l 'angular-typechecker@0.2.2'   # confirm baseline exists
BASE=angular-typechecker@0.2.2
for p in \
  packages/angular-typechecker/src/index.ts \
  packages/angular-typechecker/src/executors/typecheck/schema.json \
  packages/angular-typechecker/src/executors/typecheck/schema.d.ts \
  packages/angular-typechecker/src/builders/typecheck/builder.ts \
  packages/angular-typechecker/executors.json \
  packages/angular-typechecker/generators.json \
  packages/angular-typechecker/builders.json \
  packages/angular-typechecker/collection.json \
  packages/angular-typechecker/package.json ; do
  echo "=== $p ==="; git diff "$BASE"..HEAD -- "$p"
done
# net-new proof for the reporter modules:
git ls-tree -r "$BASE" -- packages/angular-typechecker/src/core/sarif-report.ts   # expect: absent
```

### Exit-code parity + purity loop (VER-03, extending assertShippedBinExitCodes)
```ts
for (const format of ['human', 'json', 'sarif'] as const) {
  const clean = runShimSplit(tmp, 'angular-typechecker', ['-c', 'tsconfig.json', '--format', format], env);
  expect(clean.code, clean.stderr).toBe(0);                 // exit-code parity: 0 in every format
  if (format === 'json') expect(() => JSON.parse(clean.stdout)).not.toThrow();      // stdout-purity
  if (format === 'sarif') expect(validateSarif(clean.stdout).valid, validateSarif(clean.stdout).errors).toBe(true);
}
// plant TS2322 -> assert code === 1 for ALL three formats (the anti-false-pass parity).
```

### SARIF validation over the real fixture (VER-02)
```ts
const result = await runTypecheck({ tsConfigPath: fixtureTsConfig('layout-b-host') });
const sarif = await renderReport(result, { format: 'sarif', pathBase: workspaceRoot, color: false });
const { valid, errors } = validateSarif(sarif);
expect(valid, errors).toBe(true);
expect(redactVolatile(JSON.parse(sarif))).toMatchSnapshot(); // 6-cell byte-stability
```

## State of the Art

| Old Approach | Current Approach | Why |
|--------------|------------------|-----|
| Validate SARIF against the OASIS canonical draft-04 schema with `ajv-draft-04` | Validate against the SchemaStore draft-07 copy with plain `ajv@^8` + `ajv-formats` | The SchemaStore `sarif-2.1.0.json` (the CONTEXT's cited `$id`) is draft-07 with `$id` (verified 2026-07-19); plain ajv 8 handles it -> one fewer package than the draft-04 path. |
| Golden-snapshot shape assertion for SARIF (Phase 31) | A TRUE schema validator ADDED alongside it (VER-02) | VER-02 mandates schema validation; it complements, does not replace, `sarif-report.spec.ts`'s golden snapshot. |

**Deprecated/outdated for this phase:** none. All shipped patterns are current.

## Runtime State Inventory

Not applicable -- Phase 32 is a verification/docs/audit phase, not a rename/refactor/migration. It adds test files, one audit doc, one README section, one CHANGELOG entry, and dev-only devDependencies. No stored data, live-service config, OS-registered state, secrets, or build artifacts carry a renamed identifier. (Explicitly verified: no production source or public API changes; `git diff` scope is docs + tests + root devDeps.)

## Validation Architecture

> nyquist_validation is enabled (`.planning/config.json` `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`@nx/vitest:test`) |
| Config file | `packages/angular-typechecker/vitest.config.mts` (unit/docs), `vitest.integration.config.mts` (integration), per-project `e2e/*/vitest.config.mts` |
| Quick run command | `nx test angular-typechecker` (unit + docs tripwire) |
| Full suite command | `nx run-many -t typecheck && nx run-many -t test && nx run-many -t integration` (+ `nx run-many -t e2e` locally / per-project matrix in CI) |

### Phase Requirements -> Test Map
| Req ID | Observable proof | Test Type | Automated command | File Exists? |
|--------|------------------|-----------|-------------------|-------------|
| VER-02 | SARIF validates against the 2.1.0 schema over `layout-b-host` + `global-diagnostics` | integration | `nx integration angular-typechecker` | ❌ Wave 0 (`src/core/*reporters*.integration.spec.ts`) |
| VER-02 | JSON + SARIF byte-stable (redacted) across 6-cell matrix incl. Windows URI | integration (snapshot) | `nx integration angular-typechecker` | ❌ Wave 0 (+ committed `__snapshots__`) |
| VER-02 | `run()` + executor emit the same payload from the same fixture | integration | `nx integration angular-typechecker` | ❌ Wave 0 |
| VER-03 | CLI/`ng run`/Nx-executor emit valid JSON + schema-valid SARIF from the shipped tarball | e2e | `nx run-many -t e2e -p angular-typechecker-cli-e2e` (+ ng-cli + install) | ⚠️ extend existing specs |
| VER-03 | stdout-purity (payload parses, no chrome) | e2e | (same) | ❌ Wave 0 (`runShimSplit` + purity asserts) |
| VER-03 | exit-code parity across human/json/sarif (incl. coverage-incomplete -> 1) | e2e | (same) | ⚠️ extend `assertShippedBinExitCodes` |
| ADD-01 | additive-only verdict vs `@0.2.2` | audit doc + tsc + lint | `nx typecheck angular-typechecker && nx lint angular-typechecker` | ✅ guards exist; ❌ `32-ADDITIVE-AUDIT.md` |
| ADD-01 | barrel unchanged | drift tsc | `nx typecheck angular-typechecker` (runs `tsconfig.drift.json`) | ✅ `index.drift.ts` |
| ADD-01 | only `node-sarif-builder` added to plugin deps | git-diff + lint | `git diff angular-typechecker@0.2.2..HEAD -- .../package.json`; `nx lint angular-typechecker` | ✅ standing; recorded in audit |
| DOC-01 | README documents `--format`, JSON schema, SARIF recipe, repo-root caveat | unit (docs tripwire) | `nx test angular-typechecker` | ❌ Wave 0 (`*-docs.spec.ts`) |
| DOC-01 | CHANGELOG `0.2.3` present + no internal ids | unit (docs tripwire) | `nx test angular-typechecker` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `nx test angular-typechecker` (unit + docs tripwire, fast).
- **Per wave merge:** `nx run-many -t typecheck && nx run-many -t test && nx run-many -t integration`; the e2e tier via `nx run-many -t e2e -p <project>` for the extended projects.
- **Phase gate:** full suite green (typecheck + test + integration + the three extended e2e projects) before `/gsd-verify-work`; the additive audit's `nx lint angular-typechecker` (maxWarnings:0) green.

### Wave 0 Gaps
- [ ] `packages/angular-typechecker/src/core/*reporters*.integration.spec.ts` (or one machine-reporters spec) -- VER-02 JSON+SARIF over `layout-b-host` + `global-diagnostics`, schema validation, redacted 6-cell snapshot.
- [ ] `libs/test-util/src/lib/validate-sarif.ts` + committed `sarif-2.1.0.schema.json` -- the shared dev-only validator (VER-02 + VER-03).
- [ ] `libs/test-util/src/lib/cli-e2e.ts` `runShimSplit` (separate streams) + a `--format` parity/purity extension to `assertShippedBinExitCodes`.
- [ ] `--format` assertions added to `angular-typechecker-{cli,ng-cli,install}-e2e` specs (VER-03).
- [ ] `.planning/phases/32-.../32-ADDITIVE-AUDIT.md` (ADD-01).
- [ ] `packages/angular-typechecker/src/machine-readable-docs.spec.ts` (or extend `standalone-cli-docs.spec.ts`) -- DOC-01 tripwire.
- [ ] Framework install: `npm i -D ajv@^8 ajv-formats@^3` at the workspace root.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `ajv` + `ajv-formats` | VER-02/VER-03 schema validator | to install | `^8.20.0` / `^3.0.1` | none needed (root devDep) |
| SARIF 2.1.0 schema JSON | VER-02/VER-03 validator | fetch-once + commit | draft-07 SchemaStore copy (~109 KB) | commit the OASIS copy + `ajv-draft-04` only if the draft-07 copy is unavailable |
| Verdaccio + local registry | VER-03 tarball install | ✓ (shipped `verdaccio@6.7.4`) | 6.7.4 | -- |
| `@angular/compiler-cli` (cold) | VER-02 real-compiler fixtures | ✓ (peer, installed) | 22.0.6 | -- |
| Corepack (yarn/pnpm shims) | ng-cli/install e2e | ✓ in CI (Node 24) | -- | -- |

**Missing dependencies with no fallback:** none (the schema + ajv are trivially installable/committable).
**Missing dependencies with fallback:** the SARIF schema draft -- primary is the draft-07 SchemaStore copy (plain ajv); the draft-04 OASIS copy (+ `ajv-draft-04`) is the documented fallback if the SchemaStore copy cannot be committed.

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` (= enabled by default). Phase 32 adds NO production code, NO new runtime dependency (dev-only `ajv`/`ajv-formats`), and NO network/auth surface -- it is tests + docs + an audit over a shipped surface.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | partial (test data only) | The SARIF payload is machine data; `JSON.stringify`/`node-sarif-builder` escape it; ajv validates it. No user input crosses a trust boundary in this phase. |
| V6 Cryptography | no (reused) | `partialFingerprints` sha256 already shipped (Phase 31); not re-implemented here. |
| V14 Config / Supply chain | yes | The ONLY net-new packages are `ajv`/`ajv-formats` (dev-only) -- both `OK` from the legitimacy gate (314M / 101M weekly, official `ajv-validator` org, no postinstall). |

### Known Threat Patterns for this phase
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Absolute local path leaked into a committed/uploaded SARIF (maintainer dir structure) | Information disclosure | `relativizePath` forces repo-relative forward-slash URIs (already shipped); VER-02 asserts no drive letter / `\` in the payload. |
| A dev-tool devDep (ajv) with a malicious postinstall | Supply-chain | Legitimacy gate: `ajv`/`ajv-formats` have NO postinstall (verified); pinned `^` ranges; root devDep only. |
| Slopsquatted `ajv-format` / `ajv-formatter` typo | Supply-chain | Exact package names from official ajv docs (ajv.js.org) + registry verification; the ADD-01 diff surfaces any stray addition. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `layout-b-host` + `global-diagnostics` fixtures together cover the `TS####` + `NG8xxx` + file-less requirement without a new fixture. | VER-02 fixtures | LOW -- verified against the two integration specs; if a single all-three payload is wanted, add one fixture (D-03 already authorizes it). |
| A2 | Nx 23 `nx run`/`ng run` framing can be extracted/isolated so the Nx/ng adapter stdout parses. | VER-03 stdout-purity | MEDIUM -- the exact Nx 23 stdout framing must be confirmed during execution; the CLI shim path is the guaranteed-pure fallback. |
| A3 | `@nx/dependency-checks` will not flag `ajv`/`ajv-formats` because they are imported only by test/e2e files excluded from the plugin `build` target. | Standard Stack placement | LOW -- matches the shipped `vitest`/`verdaccio` precedent; confirm with `nx lint` during execution. |
| A4 | The committed SchemaStore `sarif-2.1.0.json` will remain draft-07 at fetch time. | VER-02 ajv recipe | LOW -- verified 2026-07-19; the schema is a frozen artifact; the draft-04 fallback (`ajv-draft-04`) is documented. |

**All other claims are `[VERIFIED]` (shipped source with cited paths, direct schema fetch, npm registry) or `[CITED]`.**

## Open Questions

1. **Nx/ng adapter stdout framing (VER-03).** (EXECUTION-DEFERRED)
   - What we know: the CLI `.bin` shim yields truly pure stdout; `nx run`/`ng run` frame the executor's stdout with task-runner output.
   - What's unclear: whether Nx 23 (non-TTY, `NX_DAEMON=false`) prepends any line to stdout vs stderr for a single target.
   - Recommendation: during execution, capture a real `nx run p:typecheck --format json` stdout and inspect; if framed, extract from the first `{` and assert no advisory text inside the payload; keep the CLI shim path as the authoritative purity proof.
   - Resolution: EXECUTION-DEFERRED with the documented fallback baked into 32-02 (Tasks 2 + 3 capture the real framing at execution time, extract from the first `{`, and assert no advisory text is inside the parsed payload; the CLI shim in 32-02 Task 1 remains the authoritative pure-stdout proof).

2. **Single machine-reporters integration spec vs two (VER-02).** (RESOLVED)
   - What we know: wave-parallelism prefers disjoint files (`global-diagnostics.integration.spec.ts:18-20`).
   - What's unclear: whether one spec (both formats, both fixtures) or two (json / sarif) is cleaner for the wave plan.
   - Recommendation: two files (`*-json` / `*-sarif` `.integration.spec.ts`) sharing the `validateSarif`/`redactVolatile` helpers from `@workspace/test-util` -- disjoint ownership, one shared snapshot dir.
   - Resolution: RESOLVED / adopted -- 32-01 creates two files (`machine-reporters-json.integration.spec.ts` + `machine-reporters-sarif.integration.spec.ts`) sharing the `@workspace/test-util` helpers.

3. **Docs spec: new file vs extend `standalone-cli-docs.spec.ts` (DOC-01).** (RESOLVED)
   - Recommendation: a new `machine-readable-docs.spec.ts` keeps the section-scoped tripwire self-contained and mirrors the one-section-per-spec shipped convention (`angular-cli-docs.spec.ts`, `storybook-docs.spec.ts`).
   - Resolution: RESOLVED / adopted -- 32-04 Task 3 creates the new `machine-readable-docs.spec.ts`.

## Sources

### Primary (HIGH confidence)
- Shipped repo source (read directly): `src/core/{render-report,json-report,sarif-report,diagnostic-record}.ts` + their `.spec.ts`; `src/index.ts` + `src/index.drift.ts`; `packages/angular-typechecker/package.json` + `project.json` + `eslint.config.mjs`; `src/{standalone-cli,angular-cli}-docs.spec.ts`; `src/core/{layout-b,global-diagnostics}.integration.spec.ts`; `libs/test-util/src/lib/{cli-e2e,ng-cli-e2e}.ts`; `e2e/angular-typechecker-install-e2e/src/tarball-audit.e2e.spec.ts`; `e2e/angular-typechecker-cli-e2e/src/cli-exit-codes.e2e.spec.ts`; `.github/workflows/ci.yml`; `.planning/milestones/v0.2.{1,2}-phases/{24,27}-ADDITIVE-AUDIT.md`.
- SchemaStore `sarif-2.1.0.json` fetched directly 2026-07-19 (curl): `$schema` draft-07, `$id` oasis-tcs raw, ~109 KB, formats `date-time`/`uri`/`uri-reference`.
- npm registry (`npm view`): `ajv@8.20.0`, `ajv-formats@3.0.1`, both `OK` from `gsd-tools query package-legitimacy check` (314M / 101M weekly, official `ajv-validator` org, no postinstall).
- `.planning/research/v0.2.3-reporters/{SUMMARY,STACK,PITFALLS}.md` -- the milestone research this phase builds on (HIGH; grounded in the shipped v0.2.2 source + the 4.1.0 tarball).

### Secondary (MEDIUM confidence)
- WebSearch (ajv / SARIF schema draft): established that the OASIS canonical schema is draft-04 while SchemaStore hosts a converted copy -- reconciled and superseded by the direct fetch (draft-07 for the SchemaStore `$id` the CONTEXT cites).
- GitHub Code Scanning `upload-sarif` docs (via the milestone research citations): the recipe + repo-relative-URI / run-from-repo-root requirement.

### Tertiary (LOW confidence)
- None. Every load-bearing claim traces to shipped source, a direct schema fetch, or the npm registry.

## Metadata

**Confidence breakdown:**
- VER-02 recipe (ajv draft-07 + ajv-formats, fixtures, redaction): HIGH -- schema draft verified by direct fetch; fixtures verified against shipped integration specs.
- VER-03 mapping + `runShim` stream-split: HIGH on the mechanism (cited source); MEDIUM on Nx/ng stdout framing (execution-time confirmation flagged).
- ADD-01 (audit template, dep proof, barrel tripwire): HIGH -- template + baseline tag + current manifest all verified.
- DOC-01 (README shape, docs tripwire, CHANGELOG): HIGH -- JSON key set from the shipped drift-lock; docs-spec pattern from shipped specs.

**Research date:** 2026-07-19
**Valid until:** ~2026-08-18 (stable; the only external moving part is the SchemaStore schema draft, verified and mirrored by a committed copy).
