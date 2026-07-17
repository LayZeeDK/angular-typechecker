# Phase 28: Shipped-tarball e2e + real-clone UAT - Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 13 (10 new, 3 modified)
**Analogs found:** 13 / 13 (every file has a verified in-repo analog -- this is a heavy-reuse, near-zero-invention phase)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `e2e/angular-typechecker-cli-e2e/project.json` | config | -- | `e2e/angular-typechecker-install-e2e/project.json` | exact |
| `e2e/angular-typechecker-cli-e2e/vitest.config.mts` | config | -- | `e2e/angular-typechecker-install-e2e/vitest.config.mts` | exact |
| `e2e/angular-typechecker-cli-e2e/tsconfig.json` + `tsconfig.spec.json` | config | -- | `e2e/angular-typechecker-install-e2e/tsconfig{.json,.spec.json}` | exact |
| `e2e/angular-typechecker-cli-e2e/src/global-setup.ts` | test-setup | event-driven | `e2e/angular-typechecker-install-e2e/src/global-setup.ts` | exact |
| `e2e/angular-typechecker-cli-e2e/src/cli-exit-codes.e2e.spec.ts` (npm) | test | request-response | `matrix-5types.e2e.spec.ts` + `ng-add-ng-run.e2e.spec.ts` | role+flow match |
| `e2e/angular-typechecker-cli-e2e/src/cli-exit-codes-yarn.e2e.spec.ts` | test | request-response | `ng-add-ng-run-yarn.e2e.spec.ts` | exact |
| `e2e/angular-typechecker-cli-e2e/src/cli-exit-codes-pnpm.e2e.spec.ts` | test | request-response | `ng-add-ng-run-pnpm.e2e.spec.ts` | exact |
| `e2e/angular-typechecker-cli-e2e/src/nx-free-runtime.e2e.spec.ts` | test | transform | `packages/.../src/cli/bin-static.spec.ts` (STATIC counterpart) | role match |
| `e2e/angular-typechecker-cli-e2e/fixtures/cli-consumer/` | fixture | -- | `install-e2e/fixtures/consumer-app/` + `ng-cli-workspace/` (lockfile) | role match |
| `libs/test-util/src/lib/cli-e2e.ts` (OPTIONAL `createCliRun`) | utility | request-response | `libs/test-util/src/lib/ng-cli-e2e.ts` (`createNgRun`) | exact |
| `28-<plan-id>-UAT.md` (doc artifact) | doc | -- | `24-ACV-01-UAT.md` + `24-HUMAN-UAT.md` | exact |
| **MODIFIED** `.github/workflows/ci.yml` (+`e2e-windows` job) | config | -- | the existing `e2e` job + `test` job's windows cells | role match |
| **MODIFIED** `packages/.../src/ci-e2e-coverage-guard.spec.ts` (+GUARD-01f) | test | -- | GUARD-01b block in the same file | exact |
| **MODIFIED** `libs/test-util/src/lib/verdaccio-global-setup.ts` (`mintCiToken` retry) | utility | request-response | the existing `mintCiToken` fetch | exact |

Verified stack facts for the planner:
- Shipped `bin` map (from `packages/angular-typechecker/package.json`): `"angular-typechecker": "./src/cli/bin.js"` and `"atc": "./src/cli/bin.js"` -- both names, ONE file. Installed bin path inside a consumer: `node_modules/angular-typechecker/src/cli/bin.js`; shim path: `node_modules/.bin/{angular-typechecker,atc}[.cmd/.ps1]`.
- CLI flag contract (`parse-args.ts`): input flag is `-c`/`--tsConfig` (repeatable, required). `-p`/`--project` is deliberately UNREGISTERED -> unknown-flag usage error -> exit 2. `-h`/`--help`, `--version` -> exit 0. `--max-warnings <n>`, `--fail-fast`, `--include-deps`, `--strict` exist. HELP_TEXT last line is literally `Exit codes: 0 clean / 1 verdict-fail / 2 infrastructure-or-usage.`
- Exit-code owner (`bin.ts`): sets `process.exitCode` and RETURNS (never `process.exit`); usage errors -> 2, unknown crash catch -> 2. FROZEN -- the phase only OBSERVES it.

## Pattern Assignments

### `e2e/angular-typechecker-cli-e2e/project.json` (config)

**Analog:** `e2e/angular-typechecker-install-e2e/project.json` (whole file, 35 lines) -- copy verbatim, rename.

**Delta to apply:** change every `angular-typechecker-install-e2e` token to `angular-typechecker-cli-e2e` (`name`, `sourceRoot`, `reportsDirectory`, `typecheck.command` path). Keep byte-identical otherwise. The full shape:

```json
{
  "name": "angular-typechecker-cli-e2e",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "e2e/angular-typechecker-cli-e2e/src",
  "tags": ["scope:fixture", "type:e2e"],
  "implicitDependencies": ["angular-typechecker"],
  "targets": {
    "e2e": {
      "executor": "@nx/vitest:test",
      "dependsOn": [{ "projects": ["angular-typechecker"], "target": "build" }],
      "outputs": ["{options.reportsDirectory}"],
      "parallelism": false,
      "options": { "reportsDirectory": "coverage/e2e/angular-typechecker-cli-e2e" }
    },
    "typecheck": {
      "executor": "nx:run-commands",
      "cache": true,
      "inputs": ["default", "^default", "{workspaceRoot}/tsconfig.base.json",
        { "externalDependencies": ["typescript", "vitest", "@nx/js", "@nx/vite"] }],
      "options": {
        "command": "tsc --noEmit -p e2e/angular-typechecker-cli-e2e/tsconfig.spec.json",
        "cwd": "."
      }
    }
  }
}
```

This one file satisfies FIVE guards at once: GUARD-01 (`e2e` target), GUARD-01c (`typecheck` target), GUARD-01d (`type:e2e` tag), GUARD-01e (`e2e.dependsOn` builds `angular-typechecker`), GUARD-01b (`parallelism: false` -- MANDATORY because this project boots a Verdaccio registry; GUARD-01b's "every registry-starting e2e project serializes" test auto-requires it, `ci-e2e-coverage-guard.spec.ts:343-372`).

---

### `e2e/angular-typechecker-cli-e2e/vitest.config.mts` (config)

**Analog:** `e2e/angular-typechecker-install-e2e/vitest.config.mts` (whole file, 42 lines) -- copy verbatim, rename.

**Serialization block to copy verbatim** (install-e2e `vitest.config.mts:22-40`):
```typescript
  test: {
    name: 'angular-typechecker-cli-e2e',   // <- the ONLY value to change
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.e2e.spec.ts'],
    globalSetup: ['./src/global-setup.ts'],
    reporters: ['default'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 300000,
    hookTimeout: 300000,
  },
```

**Delta:** change `test.name` and the `cacheDir` path (line 17) to `angular-typechecker-cli-e2e`; adapt the header comment. Everything else (node env, `pool:forks`+`singleFork`, `fileParallelism:false`, `sequence.concurrent:false`, 300000 timeouts, `nxViteTsPaths()`+`nxCopyAssetsPlugin([])` plugins) is copied unchanged (D-01).

---

### `e2e/angular-typechecker-cli-e2e/src/global-setup.ts` (test-setup, event-driven)

**Analog:** `e2e/angular-typechecker-install-e2e/src/global-setup.ts` (whole file, 7 lines) -- one-line delegate.

**Copy verbatim, change only the label:**
```typescript
import { createVerdaccioGlobalSetup } from '@workspace/test-util';

export default createVerdaccioGlobalSetup({
  label: 'angular-typechecker-cli-e2e',
});
```

All load-bearing behavior (startLocalRegistry on `127.0.0.1`, real token mint, provenance strip, `nx release publish --first-release --excludeTaskDependencies`, the non-`127.0.0.1` SAFETY refuse-gate, `provide(verdaccioUrl/verdaccioToken)`) lives in `libs/test-util/src/lib/verdaccio-global-setup.ts` (D-01/D-02) -- do NOT re-implement.

---

### `e2e/angular-typechecker-cli-e2e/src/cli-exit-codes.e2e.spec.ts` (test, request-response) -- npm baseline

**Analogs:** two, combined:
1. `e2e/angular-typechecker-matrix-e2e/src/matrix-5types.e2e.spec.ts` -- the by-name/tarball install + `it.each` matrix + green-then-planted + `not.toMatch(/ERR_REQUIRE_ESM/)` + `not.toContain('infrastructure error')` shape.
2. `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run.e2e.spec.ts` -- the Verdaccio `inject('verdaccioUrl'/'verdaccioToken')` + `expect(url.startsWith('http://127.0.0.1:'))` + `writeVerdaccioNpmrc` + `mkdtempSync`/`cpSync`/`removeTmpDir` + `stripAllNpmConfig` + `npm_config_userconfig -> nonexistent` npm provisioning.

**Imports + provisioning to copy** (from `ng-add-ng-run.e2e.spec.ts:1-105`):
```typescript
import { buildCleanEnv, findWorkspaceRoot, removeTmpDir, sh, writeVerdaccioNpmrc } from '@workspace/test-util';
const env = buildCleanEnv({ stripAllNpmConfig: true });
// inject the published registry; re-assert the 127.0.0.1 SAFETY invariant:
const verdaccioUrl = inject('verdaccioUrl');
expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true);
const tmp = mkdtempSync(join(tmpdir(), 'atc-cli-npm-'));
try {
  cpSync(fixtureDir, tmp, { recursive: true });
  writeVerdaccioNpmrc(tmp, verdaccioUrl, verdaccioToken);
  const npmEnv = { ...env, npm_config_userconfig: join(tmp, '.npmrc.nonexistent') };
  sh('npm install --no-audit --no-fund --prefer-offline', { cwd: tmp, env: npmEnv });
  sh('npm install angular-typechecker --no-audit --no-fund --prefer-offline', { cwd: tmp, env: npmEnv }); // BY NAME from Verdaccio (D-02), NOT a packed .tgz
  // ... shim assertions ...
} finally { removeTmpDir(tmp); }
```

**Core net-new pattern -- the shim runner + literal 0/1/2 assertions.** There is NO in-repo `runShim` yet; the RESEARCH code-example block (`28-RESEARCH.md:301-342`) is the recommended shape, derived from `createNgRun`. Put it either inline or in the optional `cli-e2e.ts` helper below:
```typescript
import { spawnSync } from 'node:child_process';
function runShim(consumerDir, binName /* 'angular-typechecker' | 'atc' */, args, env) {
  const isWin = process.platform === 'win32';
  const shim = join(consumerDir, 'node_modules', '.bin', isWin ? `${binName}.cmd` : binName);
  const result = spawnSync(shim, args, {
    cwd: consumerDir, env, encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,   // avoid ENOBUFS truncating the tail TSxxxx (Pitfall 6)
    shell: isWin,                  // .cmd needs a shell on Windows (CVE-2024-27980); args are FIXED so shell:true is safe (Pitfall 2)
  });
  return { code: result.status ?? 1, stdout: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}
// exit 0 / 1 / 2 cells (D-03):
expect(runShim(tmp, 'angular-typechecker', ['-c', 'tsconfig.json'], npmEnv).code).toBe(0);       // clean
// plant a diagnostic-CODE error, then:
expect(runShim(tmp, 'atc', ['-c', 'tsconfig.json'], npmEnv).code).toBe(1);                        // verdict-fail
expect(runShim(tmp, 'atc', ['-c', 'does-not-exist.json'], npmEnv).code).toBe(2);                  // infra
expect(runShim(tmp, 'atc', ['--nonsense'], npmEnv).code).toBe(2);                                 // usage (unknown flag)
expect(runShim(tmp, 'atc', [], npmEnv).code).toBe(2);                                             // usage (missing -c)
```

**Planting pattern (assert a CODE, never message text).** Reuse `plant(path, anchor, replacement)` from `@workspace/test-util` (`ng-cli-e2e.ts:118-124`) or the inline `original.replace(anchor, ...)` + `expect(injected).not.toBe(original)` from `matrix-5types.e2e.spec.ts:288-292`. Restore in `finally`. The `matrix-5types.e2e.spec.ts:191-192` `BROKEN_FIELD`/`BROKEN_STATEMENT` (JSON.stringify, ASCII-only, TS2322) are ready-made planted-error lines.

**`npx angular-typechecker` cell (SAFE npx; NEVER `npx atc`)** -- use `execSync` try/catch -> `error.status` (RESEARCH `28-RESEARCH.md:344-357`), mirroring `createNgRun`'s catch (`ng-cli-e2e.ts:100-112`).

**Mandatory coverage floor (D-03):** >=1 shim-resolution assertion per PM, each exit code per bin name, and the Windows `.cmd` leg. Weight toward exit `2` (the headline net-new cell). Planner may prune provably-redundant (PM x invocation x code) cells above that floor.

---

### `e2e/angular-typechecker-cli-e2e/src/cli-exit-codes-yarn.e2e.spec.ts` (test) -- yarn flat + workspace

**Analog:** `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-yarn.e2e.spec.ts` (whole file).

**Copy these mechanics verbatim:**
- `const YARN_VERSION = '4.17.0';` + `commandSucceeds(\`corepack yarn@${YARN_VERSION} --version\`, ...)` availability guard (`ng-add-ng-run-yarn.e2e.spec.ts:66,91-94`), then `it.skipIf(!corepackAvailable).each(['flat', 'workspace'] as const)` (`:160`).
- `setupYarnWorkspace(...)` (`:98-157`): drop the npm lockfile, set `packageManager: yarn@4.17.0`, add `workspaces: ['projects/*']` for the workspace layout, and write the full load-bearing `.yarnrc.yml` (`nodeLinker: node-modules`, `npmRegistryServer`, `npmAuthToken`, `unsafeHttpWhitelist: [127.0.0.1]`, `npmMinimalAgeGate: 0`, `enableImmutableInstalls: false`, per-fixture `cacheFolder`, `enableGlobalCache: false`, `enableMirror: false`) + `writeVerdaccioNpmrc`.
- Install: `sh('corepack enable', ...)` then `sh('corepack yarn install', ...)` then install the package by name via yarn (`corepack yarn add -D angular-typechecker`), replacing the `ng add` calls at `:198-203`.

**Delta:** replace `ng add`/`ng run`/`typecheckTarget`/`assertPerProjectScoping` (the ng-adapter surface) with `runShim(tmp, ...)` exit-code assertions. The shim on a yarn `node-modules` linker still lands in `node_modules/.bin/`. Adapt the fixture path to `fixtures/cli-consumer` and the tmp prefix to `atc-cli-yarn-${layout}-`.

---

### `e2e/angular-typechecker-cli-e2e/src/cli-exit-codes-pnpm.e2e.spec.ts` (test) -- pnpm

**Analog:** `e2e/angular-typechecker-ng-cli-e2e/src/ng-add-ng-run-pnpm.e2e.spec.ts` (whole file).

**Copy verbatim:**
- `commandSucceeds('pnpm --version', ...)` guard + `it.skipIf(!pnpmAvailable)` (`:97-105+`).
- `stripAllNpmConfig: true` env (`:90`), drop the npm lockfile, and the `strictDepBuilds: false` posture (the long comment at `~:120-135`) so pnpm 11's build-script gate does not `ERR_PNPM_IGNORED_BUILDS`-fail the install (this is the same class as the `nx-add-fails-on-pnpm-workspaces` memory).
- Install the package by name via `pnpm add -D angular-typechecker` (pnpm reads the fixture `.npmrc` from `writeVerdaccioNpmrc`).

**Delta:** replace `ng add`/scoping with `runShim` exit-code cells; the pnpm symlinked layout still creates `node_modules/.bin/` shims. See also `matrix-e2e/src/pnpm-symlink.e2e.spec.ts` for a pure pnpm-install-and-resolve reference if the pnpm shim resolution needs a sanity probe.

---

### `e2e/angular-typechecker-cli-e2e/src/nx-free-runtime.e2e.spec.ts` (test, transform) -- D-07

**Analog:** `packages/angular-typechecker/src/cli/bin-static.spec.ts` -- this spec is the RUNTIME counterpart to that STATIC dist-graph walk (`bin-static.spec.ts:14-17` literally names Phase 28 VER-04 as its runtime complement). Reuse its `NX_SPECIFIER = /^(@nx\/|nx\/|nx$)/` pattern concept for classifying require-cache keys.

**Runtime probe pattern** (RESEARCH `28-RESEARCH.md:359-392`, allowed by D-07 discretion -- require-cache inspection via a preload hook, NOT the `.bin` shim):
```typescript
// dump-require-cache.cjs dropped in the consumer temp dir:
//   process.on('exit', () => {
//     const nx = Object.keys(require.cache).filter((k) => /node_modules[\\/](@nx[\\/]|nx[\\/])/.test(k));
//     require('node:fs').writeFileSync(process.env.ATC_CACHE_OUT, JSON.stringify(nx));
//   });
const installedBin = join(tmp, 'node_modules', 'angular-typechecker', 'src', 'cli', 'bin.js');
try {
  execSync(`node -r "${hookPath}" "${installedBin}" -c tsconfig.json`, {
    cwd: tmp, env: { ...npmEnv, ATC_CACHE_OUT: cacheOut }, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
  });
} catch { /* a planted-error run still exits non-zero; the exit hook still fires */ }
expect(JSON.parse(readFileSync(cacheOut, 'utf8')) as string[]).toEqual([]);   // no @nx/* or nx/ at runtime
// ESM-bridge half rides on any real shim run's output:
expect(runOutput).not.toMatch(/ERR_REQUIRE_ESM/);
```
The installed bin path is `node_modules/angular-typechecker/src/cli/bin.js` (matches the verified `bin` map). The `/ERR_REQUIRE_ESM/` assertion is already the standing idiom (`ng-cli-e2e.ts:171,181`; `matrix-5types.e2e.spec.ts:312`).

---

### `e2e/angular-typechecker-cli-e2e/fixtures/cli-consumer/` (fixture)

**Analogs:**
- Peer-dep set + self-contained standalone component: `e2e/angular-typechecker-install-e2e/fixtures/consumer-app/` (`package.json` pins `@angular/core|common|compiler@22.0.4`, `rxjs@7.8.2`, `zone.js@0.16.0`, dev `@angular/compiler-cli@22.0.4` + `typescript@6.0.3`; `src/app.component.ts` is a clean standalone component; `tsconfig.json` -> references `tsconfig.lib.json`).
- Committed lockfile: `e2e/angular-typechecker-ng-cli-e2e/fixtures/ng-cli-workspace/` ships `package-lock.json` -- the cli-consumer needs one too (Pitfall 3 / A3: deterministic on-stack Angular 22 install so `await import('@angular/compiler-cli')` never false-fails to a wrong-reason exit 2).

**Delta:**
- DROP `nx.json` and `project.json` -- the standalone CLI is nx-free and takes a tsconfig path directly; the fixture needs NO Nx and NO executor wiring (unlike every existing e2e fixture, which exist for `nx add`/`ng add`). This is the ONE genuinely-new fixture shape.
- Ship `package.json` (Angular 22 peer set, copied from consumer-app), a committed lockfile (`package-lock.json`), a clean `tsconfig.json` (self-contained, no workspace `tsconfig.base.json` extension -- see consumer-app's isolation note at `src/app.component.ts:4-8`), and >=1 clean component. Optionally a second tsconfig leaf if the plan wants a two-path union cell.
- Do NOT commit a `.npmrc`/`.yarnrc.yml` into the fixture -- those are written into the per-run tmp copy only (`writeVerdaccioNpmrc`); the committed-fixture rule is enforced by the specs (T-24-06 pattern).
- Fixture errors are PLANTED at runtime; the committed tree stays clean (green baseline).

---

### `libs/test-util/src/lib/cli-e2e.ts` (OPTIONAL utility) -- `createCliRun`

**Analog:** `libs/test-util/src/lib/ng-cli-e2e.ts` -- specifically the `createNgRun` factory (`:84-113`, `execSync` try/catch -> `{stdout, code}`) and the `plant` helper (`:118-124`).

**Delta:** only add this module if the `runShim` + literal-status capture is reused across the three PM specs (D-02 forbids a new helper LIBRARY, but a new module inside the existing `test-util` lib is the established pattern -- `ng-cli-e2e.ts` was added exactly this way). Export via `libs/test-util/src/index.ts` (append to the existing export block, `index.ts:21-38`). Keep it tiny: the `runShim` shape above + optionally re-export `plant`. If reuse is low, inline `runShim` in the npm spec and skip this file (YAGNI).

---

### `28-<plan-id>-UAT.md` (doc artifact) -- VER-05, human-run

**Analogs:** `.planning/milestones/v0.2.1-phases/24-.../24-ACV-01-UAT.md` (the reproducible-procedure shape: frontmatter `status/scope/gate/substrate/outcome`, "About this gate", numbered `### N. <title>` tests each with `expected:`/`steps:` (fenced bash)/`result:`/`evidence:`, a `## Summary` tally, `## Gaps`, `## Notes`) and `24-HUMAN-UAT.md` (the executed evidence log).

**Delta (the shipped surface CHANGED -- this is the only real content difference):**
- Invoke the standalone `bin` (`atc -c <tsconfig>` / `angular-typechecker -c <tsconfig>`), NOT `ng add`/`ng run`. Use `-c`/`--tsConfig` (NEVER `-p` -- `-p` is itself a valid exit-2 usage-error cell; RESEARCH `28-RESEARCH.md:431`).
- Per clone, three assertion shapes (RESEARCH `28-RESEARCH.md:444-448`): RED (plant a distinct TS/NG code per leaf -> exit 1, stdout contains the `TSxxxx`, no `ERR_REQUIRE_ESM`, no "infrastructure error"; revert), GREEN (clean -> exit 0), BAD-PATH (`atc -c does-not-exist.json` -> exit 2; optional `atc --nonsense` / `atc` no-`-c` -> exit 2).
- Substrate (D-09): Angular-CLI kind carry-forward SHAs `bluehalo/ngx-leaflet @ 818e9ae55240b570397ede5a15cb4d466785abdc` + `realworld-angular/realworld-angular @ 9e3528ff27bad5fedaefb879ccc4aaf4717b137b`; Nx-workspace kind `radix-ng/primitives` (primary) + `analogjs/analog` (alt) -- SHAs NOT recorded, pin FRESH at UAT time and record in the artifact (PITFALLS candidate starting points: `radix-ng/primitives @ 4a7390a2b058457aa47c6f3e0e03b69b70dee025`, `analogjs/analog @ 04e32e2a873cc3a3d0d037cc24be5ad02ddb363a` -- re-verify on-stack).
- MSYS/Windows manual runs use `/d/...` not `D:/...` paths (carry-forward from `24-ACV-01-UAT.md:45-47`).
- The `--auto --chain` pipeline PRODUCES this checklist; a HUMAN runs it (D-08). Set `status:` accordingly (e.g. `pending-human-run`) and surface to the user at phase close -- do NOT mark VER-05 done from automation.

---

### MODIFIED: `.github/workflows/ci.yml` -- add the `e2e-windows` job (D-04/D-05 option b)

**Analogs (two, to mirror):**
1. The existing `e2e` job (`ci.yml:204-262`) for the step sequence: `checkout@<sha>` (`persist-credentials: false`), `setup-node@<sha>` (`node-version: 24`, `cache: npm`), `corepack enable`, `pnpm/action-setup@<sha>` (`version: 11.9.0`), `npm ci`, `npx nx run-many -t typecheck -p "$PROJECT"`, `npx nx run-many -t e2e -p "$PROJECT"`. Reuse the `PROJECT` env-var no-command-injection pattern (`ci.yml:212-219`) verbatim -- pass `PROJECT: angular-typechecker-cli-e2e` as an env value, NEVER interpolate `${{ }}` into a run step.
2. The `test` job's Windows cells (`ci.yml:105-111`) confirm `windows-latest` + Node 24 is an established runner in this workflow.

**Delta:** add a NEW top-level job `e2e-windows` (RESEARCH `28-RESEARCH.md:144-173` gives the full YAML), `runs-on: windows-latest`, gated `needs: changes` + `if: ${{ needs.changes.outputs.code != 'false' }}` (the same negative-`if` form the heavy jobs use). Hardcode the single project via `env.PROJECT: angular-typechecker-cli-e2e`. Pin every `uses:` to a 40-char SHA (Dependabot-managed, matching the rest of the file; security threat "mutable-tag repoint"). Pin `shell: bash` on the run steps so `-p "$PROJECT"` quoting is byte-identical to the Linux `e2e` job and the guard regex matches (A1). Then ADD `e2e-windows` to the `ci` aggregate `needs` list (`ci.yml:416-427`) -- the `contains(needs.*.result, 'failure')` gate (`:433`) then covers it. Do NOT touch the Linux `e2e` dynamic matrix or `discover` job (option b's whole point: leave the verified-live wiring + GUARD-01b's four assertions intact; the Linux `cli-e2e` leg is auto-discovered because the project has an `e2e` target).

NODE COUPLING (carry the existing note, `ci.yml:234-239`): `corepack enable` requires corepack, which ships in Node 24 but is REMOVED in Node 25+ -- if this job's node bumps to >=25, provision yarn via a pinned setup step.

---

### MODIFIED: `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` -- add GUARD-01f (OS-axis)

**Analog:** the `GUARD-01b` `describe` block in the SAME file (`:253-398`) -- copy its idioms: `readFileSync(join(workspaceRoot,'.github','workflows','ci.yml'),'utf8')`, line-level regex assertions with the `^(?!\s*#)` comment-exclusion prefix, fail-loud messages, and the `extractE2eJobLines`/job-key-slice helpers (`:108-129`). Reuse `enumerateE2eProjects` (`:52-63`) for the "also on Linux" assertion.

**Delta -- add a GUARD-01f `describe` asserting the four wiring facts (RESEARCH `28-RESEARCH.md:175`):**
1. an `e2e-windows` job exists with `runs-on: windows-latest`;
2. it runs `nx run-many -t e2e -p "$PROJECT"` with `PROJECT: angular-typechecker-cli-e2e`;
3. `e2e-windows` is in the `ci` job's `needs` list;
4. `angular-typechecker-cli-e2e` is in `enumerateE2eProjects(...)` (so it ALSO runs on Linux via the dynamic matrix).

You will need a new `e2e-windows:` job-slicer (generalize `extractE2eJobLines`'s job-key regex `/^ {2}<name>:\s*$/`). Keep GUARD-01b's existing four assertions UNTOUCHED and green (option b changes no Linux wiring). This closes the silent-drift axis for the Windows leg exactly as GUARD-01b does for the Linux matrix.

---

### MODIFIED: `libs/test-util/src/lib/verdaccio-global-setup.ts` -- bounded ECONNREFUSED retry in `mintCiToken`

**Analog:** the existing `mintCiToken` function in the SAME file (`:46-84`) -- the `fetch(new URL(...), { method:'PUT', ..., signal: AbortSignal.timeout(10000) })` + status check.

**Delta (D-06, Pitfall 1):** wrap the `fetch` in a bounded retry loop (~10 attempts, ~500ms linear backoff, ~10s total budget) that retries ONLY on `ECONNREFUSED`/`ECONNRESET` (a cold Windows runner's socket-accept can slightly lag the "listening" log line the readiness scrape resolves on). Keep the per-attempt `AbortSignal.timeout(10000)`. This is harmless to the working Linux path (it never hits connection-refused). Primary location is the token-mint fetch (earliest network touch); add a spec-level install retry ONLY if install-time ECONNREFUSED is observed (A2). This is the ONLY change to a shared helper this phase makes -- it must stay backward-compatible with the two existing registry-publishing e2e projects (install-e2e, ng-cli-e2e) that already call it.

## Shared Patterns

### Verdaccio publish-once + inject (cross-cutting; all VER-04 specs)
**Source:** `libs/test-util/src/lib/verdaccio-global-setup.ts` (`createVerdaccioGlobalSetup`) consumed via `inject('verdaccioUrl')`/`inject('verdaccioToken')`.
**Apply to:** every `*.e2e.spec.ts` in the new project. Re-assert `expect(verdaccioUrl.startsWith('http://127.0.0.1:')).toBe(true)` at the top of each `it` (safety-invariant echo, `ng-add-ng-run.e2e.spec.ts:74`). Install BY NAME from Verdaccio (D-02), never pack-a-`.tgz` (avoids the Windows/MSYS `D:/` `tar` gotcha).

### Clean nested-install env
**Source:** `libs/test-util/src/lib/e2e-process.ts` `buildCleanEnv({ stripAllNpmConfig: true })` (`:38-63`).
**Apply to:** every spec's `env`. `stripAllNpmConfig` is load-bearing -- the globalSetup sets `npm_config_registry` process-wide and it would outrank the tmp `.npmrc` (`ng-add-ng-run.e2e.spec.ts:57-62`). Add `npm_config_userconfig -> <tmp>/.npmrc.nonexistent` per install.

### Exit-code capture (the net-new surface)
**Source:** `spawnSync(...).status` for exact 0/1/2 (RESEARCH; `execSync` catch -> `error.status` is the fallback, `ng-cli-e2e.ts:100-112`).
**Apply to:** every shim/npx invocation. `spawnSync` is preferred (returns `status` without throwing, so distinguishing 1 vs 2 is direct -- Pitfall 4). Always `maxBuffer: 20 * 1024 * 1024` (Pitfall 6). On Windows: `shell: true` + `.cmd` suffix (Pitfall 2). Assert a diagnostic CODE (`toContain('TS2322')`), never message text; assert `not.toMatch(/ERR_REQUIRE_ESM/)` + `not.toContain('infrastructure error')` on every RED run.

### Anchor-checked planting + finally-restore
**Source:** `plant(path, anchor, replacement)` (`ng-cli-e2e.ts:118-124`) or the inline `original.replace(...)` + `expect(injected).not.toBe(original)` + `finally { writeFileSync(sourcePath, original) }` (`matrix-5types.e2e.spec.ts:288-318`).
**Apply to:** every planted-error (exit 1) cell. Fails LOUD if the fixture anchor drifts (no silent plant-nothing false-pass).

### Windows-safe temp teardown
**Source:** `removeTmpDir(dir)` (`e2e-process.ts:225-236`).
**Apply to:** every spec's `finally` (best-effort, tolerates Windows EPERM/lingering handles -- relevant now that this project runs on the Windows leg).

### CI no-command-injection invariant (V5)
**Source:** `ci.yml:212-219` -- matrix/project value reaches run steps via a `PROJECT` env var, never `${{ }}`-interpolated into a `run` command.
**Apply to:** the new `e2e-windows` job (hardcode `PROJECT: angular-typechecker-cli-e2e` as an env value). Every `uses:` 40-char SHA-pinned (V10, tj-actions class).

## No Analog Found

None. Every file has a verified in-repo analog. The two most "novel" pieces are still close mirrors:
- The `runShim` helper is new CODE but a direct derivative of `createNgRun` (`ng-cli-e2e.ts:84-113`).
- The `cli-consumer` fixture is a new SHAPE (no `nx.json`/`project.json`, because the CLI is nx-free) but its peer set + component + committed-lockfile requirement come straight from `install-e2e/fixtures/consumer-app/` + `ng-cli-workspace/`.

## Metadata

**Analog search scope:** `e2e/*` (4 projects), `libs/test-util/src/lib/*`, `packages/angular-typechecker/src/{cli,executors}/*`, `.github/workflows/ci.yml`, `.planning/milestones/v0.2.1-phases/24-.../*UAT.md`.
**Files scanned:** ~20 (project.json/vitest.config/global-setup x3 e2e projects; 3 PM spec analogs; 2 helper libs; ci.yml; guard spec; bin.ts/parse-args.ts; 2 UAT docs; 3 fixture files).
**Pattern extraction date:** 2026-07-16
