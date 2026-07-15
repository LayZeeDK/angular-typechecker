# Quick Task 260714-1gr: Apply Lever 1 (persist the Verdaccio uplink cache) + re-measure

**Researched:** 2026-07-14
**Domain:** Nx 23 `@nx/js` Verdaccio local-registry cache persistence across e2e runs (npm/pnpm/yarn 4)
**Confidence:** HIGH for mechanism (first-party `@nx/js` source + repo reads); MEDIUM for warm-delta magnitude (must be measured -- that is Part 3)
**Implements:** `260713-w87` Lever 1. Test-harness only, additive, NO version mutation.

## Summary

Lever 1 = flip `clearStorage: true -> false` in BOTH registry global-setups and, before each
`startLocalRegistry`, selectively delete ONLY `storage/angular-typechecker/` (so our freshly
built dist republishes with no EPUBLISHCONFLICT) and `storage/.htpasswd` (so the fresh ci-user
sign-up + real-token mint still works). Everything else under `storage/` -- the npmjs uplink
proxy cache -- survives across runs. `@nx/js`'s executor only wipes storage when
`options.clear && existsSync(storage)` `[VERIFIED: verdaccio.impl.js:31]`, so with `--clear false`
NO wipe happens and our manual selective delete is the ONLY reset. Storage resolves to
`<root>/tmp/local-registry/storage` from both the executor (`resolve(context.root, storage)`) and
the config file (`../tmp/...` relative to `.verdaccio/`) -- the same abs dir `[VERIFIED]`.

The delta is **bounded to the Verdaccio-routed subset**: install-e2e + ng-cli-e2e (both point npm
at Verdaccio via `writeVerdaccioNpmrc`). matrix-e2e installs the tarball directly with an EMPTY
`.npmrc` + a non-existent `npm_config_userconfig`, so it hits **npmjs directly, starts no registry,
and touches no storage** -- it stays FLAT and is race-free `[VERIFIED]`. cache-e2e installs nothing.

**Recommendation: GO** for the local flip + selective-delete now (this task -- measurable,
additive, trivially reversible). Defer the `actions/cache` CI extension to a documented follow-up
(unmeasurable locally; turnkey recipe in Part 2).

## (a) SAFE apply -- exact selective-delete design (per file)

### Storage-path confirmation `[VERIFIED]`
- global-setups pass `storage: './tmp/local-registry/storage'`; executor does
  `options.storage = resolve(context.root, options.storage)` -> `<root>/tmp/local-registry/storage`
  and also sets `VERDACCIO_STORAGE_PATH` to that abs path (overrides `config.yml` top-level
  `storage`). `[verdaccio.impl.js:29-30, 78-80]`
- `config.yml` `auth.htpasswd.file: ../tmp/local-registry/storage/.htpasswd` (relative to
  `.verdaccio/`) -> `<root>/tmp/local-registry/storage/.htpasswd`. `VERDACCIO_STORAGE_PATH` does
  NOT rewrite the htpasswd path (it only overrides the `storage` key), so both land in the SAME dir.
- In the global-setup, `root = findWorkspaceRoot(__dirname)`, so
  `join(root, 'tmp', 'local-registry', 'storage')` is byte-identical to the executor's resolution.
- Published package name = `angular-typechecker` (unscoped) `[VERIFIED: packages/angular-typechecker/package.json]`
  -> its storage subdir is `storage/angular-typechecker/`. `.verdaccio-db.json` (the JWT secret +
  package registry) lives at `storage/.verdaccio-db.json` and is PRESERVED -- a fresh token is minted
  and used within the same run, so a persistent secret is harmless (even slightly beneficial).

### clearStorage contract `[VERIFIED: start-local-registry.js:22 + verdaccio.impl.js:31-34]`
`startLocalRegistry({clearStorage})` forks `nx run <root>:local-registry --clear <clearStorage ?? true> --storage ...`.
The executor wipes ONLY inside `if (options.clear && existsSync(options.storage)) rmSync(storage, {recursive, force})`.
With `--clear false` the branch is skipped entirely -- the executor never touches storage. So after
the flip, our two `rmSync` calls are the complete and only reset. (No other code path wipes storage:
cache-e2e/matrix-e2e never start a registry.)

### Shared helper (avoids drift between the two verbatim-copy global-setups)
Add to `libs/test-util/src/lib/e2e-fixture.ts` (exported from `libs/test-util/src/index.ts`):

```ts
import { rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lever 1 (quick-260714-1gr): before starting the local registry with
 * clearStorage:false, delete ONLY the two things that MUST be fresh each run --
 * the published angular-typechecker package dir (so the freshly built dist
 * republishes with no EPUBLISHCONFLICT) and the .htpasswd (so the ci-user
 * sign-up + real-token mint still works; Verdaccio 6 401s an unverifiable
 * bearer). Everything else under storage -- the npmjs uplink proxy cache -- is
 * PRESERVED across runs. force:true makes the first run (storage absent) a no-op.
 */
export function resetVerdaccioPublishState(root: string): void {
  const storageDir = join(root, 'tmp', 'local-registry', 'storage');

  rmSync(join(storageDir, 'angular-typechecker'), {
    recursive: true,
    force: true,
  });
  rmSync(join(storageDir, '.htpasswd'), { force: true });
}
```

### Edit both global-setups (identical change)
`e2e/angular-typechecker-install-e2e/src/global-setup.ts` and
`e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts`:

1. Import `resetVerdaccioPublishState` from `@workspace/test-util`.
2. Insert the call AFTER `delete process.env.NX_INVOCATION_ROOT_PID;`
   (install line 107 / ng-cli line 118) and BEFORE `const stop = await startLocalRegistry({`
   (install line 109 / ng-cli line 120):
   ```ts
   // Lever 1: persist the npmjs uplink proxy cache across runs (clearStorage:false)
   // but reset the two run-scoped essentials so the publish gate + token mint stay
   // correct. MUST run before startLocalRegistry (Verdaccio reads htpasswd + package
   // metadata at boot).
   resetVerdaccioPublishState(root);
   ```
3. Flip `clearStorage: true` -> `clearStorage: false` (install line 113 / ng-cli line 124).
4. Fix the now-stale comment above (install ~line 85 / ng-cli ~line 96: "clearStorage wipes the
   storage dir -- including the htpasswd") to describe the new selective-reset behavior.

### Correctness invariants -- all preserved
| Invariant | Preserved? | Why |
|---|---|---|
| 127.0.0.1 SAFETY publish gate | YES | untouched (runs after registry start) |
| Real ci-token mint | YES | `.htpasswd` deleted each run -> fresh sign-up (else a 2nd sign-up 409s) |
| No EPUBLISHCONFLICT on our dist | YES | `storage/angular-typechecker/` deleted each run -> publish sees no prior version (`--first-release` skips pre-publish view too) |
| Single 4873 registry, one live at a time | YES | install-e2e + cache-e2e `parallelism:false` unchanged |
| `NX_INVOCATION_ROOT_PID` delete | YES | selective delete inserted AFTER it |
| `enableMirror:false` / yarn cache | YES | untouched |
| `--parallel=2` | YES | untouched |
| No package.json version mutation | YES | no version touched |

**Failure modes are LOUD, not silent** (de-risks the new logic): a missed
`storage/angular-typechecker/` delete -> `nx release publish` EPUBLISHCONFLICT (hard fail); a missed
`.htpasswd` delete -> duplicate ci-user sign-up 409 in `mintCiToken` (hard fail). Neither can
silently ship a stale dist.

### Concurrency safety under `--parallel=2` `[VERIFIED]`
- install-e2e `parallelism:false` + cache-e2e `parallelism:false` each run ALONE; ng-cli-e2e +
  matrix-e2e may overlap, but matrix uses NO registry/storage. So the two registry-starting projects
  (install + ng-cli) NEVER co-run -> the storage dir is touched by at most one registry process at a
  time. No two processes ever hit the same storage concurrently with `clearStorage:false`.
- Residual-race check: ng-cli's selective-delete cannot race a still-running install-e2e, because
  install-e2e (parallelism:false) blocks every other e2e task until it finishes and stops its
  registry. Confirmed safe.
- **Bonus (within-run win):** whichever of install-e2e / ng-cli runs SECOND now reuses the FIRST's
  cached Angular/Nx/TS tarballs (large overlap) instead of re-fetching -- a warm benefit even inside
  a single tier run, not just across runs.

### Cache validity: `maxage:60m` + immutable tarballs
All Verdaccio-routed fixtures install from committed lockfiles (exact pins), so their cached tarballs
are immutable and served from disk indefinitely. `maxage:60m` only governs range-resolution METADATA
freshness (`@latest`), not tarball reuse; `angular-typechecker@latest` resolves against the local
no-proxy block (fresh each run), never npmjs. The persisted npmjs proxy cache is what carries the win.

## (b) Routing scope -- which installs Lever 1 speeds `[VERIFIED]`

| e2e project | Registry? | Install routing | Lever 1 helps? |
|---|---|---|---|
| install-e2e (npm + nx-add pnpm/yarn + storybook) | Verdaccio 4873 | `writeVerdaccioNpmrc` -> `registry=<verdaccioUrl>`; deps proxy npmjs via uplink | YES |
| ng-cli-e2e (npm/pnpm/yarn 4) | Verdaccio 4873 | `writeVerdaccioNpmrc` -> full Angular 22 fixture + `ng add` through Verdaccio | YES |
| matrix-e2e (npm `<tgz>` + pnpm `<tgz>`) | NONE | empty `.npmrc` + non-existent `npm_config_userconfig` -> **npmjs directly** | NO (stays flat, race-free) |
| cache-e2e | NONE | no install (source barrel via `nxViteTsPaths`) | N/A |

## (c) Minimal-run delta measurement protocol

Reuse the committed `ATC_TIME_INSTALLS=1` `sh()` timing + `tools/e2e-timing/aggregate-install-timings.mjs`
(no new instrumentation). **2 full tier runs** on the Windows arm64 box (~15-23 min each, ~40 min
total), both AFTER applying Lever 1:

```bash
# RUN 1 -- first-population (delete the WHOLE storage to force a from-scratch fill)
rm -rf tmp/local-registry/storage
ATC_TIME_INSTALLS=1 ATC_TIMING_OUT="$PWD/tmp/1gr-run1-cold.jsonl" \
  NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache

# RUN 2 -- fully warm (do NOT delete storage; the selective-delete removes only
# angular-typechecker + .htpasswd, preserving the npmjs proxy cache)
ATC_TIME_INSTALLS=1 ATC_TIMING_OUT="$PWD/tmp/1gr-run2-warm.jsonl" \
  NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache

node tools/e2e-timing/aggregate-install-timings.mjs tmp/1gr-run1-cold.jsonl
node tools/e2e-timing/aggregate-install-timings.mjs tmp/1gr-run2-warm.jsonl
```

`--skip-nx-cache` is required (a cache hit runs no installs -> empty JSONL). Comparisons:
1. **Cross-run delta = Run 1 vs Run 2**, per-PM, isolating the Verdaccio-routed subset (install-e2e +
   ng-cli scenarios) from the npmjs-direct matrix (`atc-matrix` npm `<tgz>` ~24.5s + `atc-pnpm` pnpm
   `<tgz>` ~7.2s), which must stay roughly FLAT in both -> a correctness check that the scope is
   bounded as claimed.
2. **Within-run cross-project win = w87 cold (~888s grand) vs Run 1** on the same box: Run 1 should
   already be < 888s because the 2nd registry-project warm-hits the 1st's cache (bonus above).
   Do NOT expect Run 1 to reproduce w87 exactly -- w87 wiped storage before EACH project.

Aggregate/compare by the per-PM totals table + the per-(PM x scenario x action) detail. Windows-vs-CI
caveat still applies (Defender inflates local extract/link; the CI e2e gate is Linux-only) -- read the
RELATIVE per-scenario deltas as the signal, treat absolutes as directional.

### Honest expected magnitude
- Warm collapses the **network fetch** portion of every Verdaccio-routed install toward ~0, but the
  **irreducible local cost remains** -- tarball extraction, node_modules linking, corepack shim spawn,
  and (on Windows) Defender scanning. So warm != instant.
- Concrete floor: the w87 in-run identical-fixture drop **93.4s -> 43.8s (~2.1x, ~50s)** on the ng-cli
  yarn fixture is exactly this network-portion win; a persistent cache generalizes it to every
  Verdaccio-routed install and every re-run.
- Rough grand-total expectation: the Verdaccio-routed subset (the bulk of the ~888s) shrinks
  materially on Run 2 -- plausibly a large fraction, bounded below by local extract/link -- while
  matrix's ~32s stays flat. The exact number is what Run 2 measures; do NOT pre-commit to a figure.
- The **Windows local win is a LOWER BOUND on the proportional CI win**: on Linux CI there is no
  Defender and faster disk, so local overhead masks less of the network savings -> a bigger
  proportional shrink there.

## (d) CI cross-run cache (actions/cache) -- DOCUMENTED FOLLOW-UP (not this task)

There is NO storage caching in `.github/workflows/` today `[VERIFIED]`. This CANNOT be verified
locally (needs 2 consecutive CI runs: miss then hit), and entangling an unverifiable CI change with
the measurable local flip muddies the PR. **Recommend: separate follow-up PR.** Turnkey recipe for
the `e2e` job in `.github/workflows/ci.yml` (restore before `nx run-many -t e2e`, save auto at
post-job); SHA-pin `actions/cache` per this repo's supply-chain posture (Dependabot keeps it fresh):

```yaml
- uses: actions/cache@<pin-a-40char-sha>  # verify tag->SHA before adding
  with:
    path: |
      tmp/local-registry/storage
      !tmp/local-registry/storage/angular-typechecker
      !tmp/local-registry/storage/.htpasswd
    key: verdaccio-storage-${{ runner.os }}-${{ hashFiles('e2e/**/fixtures/**/package-lock.json', 'e2e/**/fixtures/**/pnpm-lock.yaml', 'packages/angular-typechecker/package.json', '.github/workflows/ci.yml') }}
    restore-keys: |
      verdaccio-storage-${{ runner.os }}-
```

- **Exclude** `storage/angular-typechecker` + `.htpasswd` from the cached artifact: the selective
  delete removes them at run start anyway, so caching them wastes space and could cache a stale
  plugin/token (belt-and-suspenders; the run-start delete is the real guarantee).
- **Key** on the Verdaccio-routed fixture lockfiles + the plugin manifest (drives which nx/devkit/tslib
  the consumer pulls) + `ci.yml` (pins Node/pnpm/yarn). Any dep or tool-version bump busts it. matrix's
  lockfile is intentionally NOT keyed on -- matrix is npmjs-direct, its bytes never enter this cache.
- Verify by 2 consecutive CI e2e runs: run N (cache miss, populate) then run N+1 (cache hit) wall-clock
  delta; confirm the gate stays green.

## (e) GO / NO-GO

**GO -- apply the local flip + selective-delete now.**

| Weigh | Assessment |
|---|---|
| Blast radius | Test-harness only (2 e2e global-setups + 1 tiny test-util helper). No production code, no install command, no version mutation. |
| Reversibility | Trivial: revert 2 `clearStorage` lines + remove 2 calls. One-commit revert. |
| Maintenance cost | ~8 new load-bearing lines (a shared helper), but BOTH failure modes are LOUD (EPUBLISHCONFLICT / sign-up 409) -- cannot silently ship a stale dist. |
| Local win | Bounded to the Verdaccio-routed subset, but real: faster e2e re-runs during dev (~15-23 min tier) + a within-run cross-project cache-reuse bonus, immediately. |
| CI win | Real but deferred to the actions/cache follow-up (Part 2). |
| Invariants | All 8 preserved (Part a table). |

**Fallback:** if the 2-run experiment surfaces any fragility (EPUBLISHCONFLICT, a stale-dist spec
failure, or a token-mint 409), revert `clearStorage:false -> true` in both files (one line each) --
the flip is designed to be a no-cost revert. Ship the local flip in this task; leave `actions/cache`
as the documented turnkey follow-up.

## Files touched (this task)
- `libs/test-util/src/lib/e2e-fixture.ts` -- add `resetVerdaccioPublishState(root)` (+ export in `libs/test-util/src/index.ts`)
- `e2e/angular-typechecker-install-e2e/src/global-setup.ts` -- import + call before start; flip line 113
- `e2e/angular-typechecker-ng-cli-e2e/src/global-setup.ts` -- import + call before start; flip line 124
- (follow-up PR) `.github/workflows/ci.yml` -- `actions/cache` for `tmp/local-registry/storage`

## Sources
### Primary (HIGH -- first-party source + repo reads, 2026-07-14)
- `node_modules/@nx/js/dist/src/executors/verdaccio/verdaccio.impl.js:29-34,78-80` -- `resolve(context.root, storage)`; wipe ONLY `if (options.clear && existsSync)`; `VERDACCIO_STORAGE_PATH`. `[VERIFIED]`
- `node_modules/@nx/js/dist/src/plugins/jest/start-local-registry.js:22` -- forks `--clear ${clearStorage ?? true}`. `[VERIFIED]`
- `.verdaccio/config.yml` -- storage `../tmp/...`, htpasswd under storage, `angular-typechecker` no-proxy, `**` proxy npmjs `maxage:60m`, `publish.allow_offline:true`. `[VERIFIED]`
- `e2e/angular-typechecker-{install,ng-cli}-e2e/src/global-setup.ts` -- clearStorage:true (lines 113/124), insertion point (107/118 -> 109/120), token mint 409-on-dup, SAFETY gate, provenance strip. `[VERIFIED]`
- `e2e/.../nx-add-npm`, `ng-add-ng-run`, `storybook-{tarball,composition}` specs -- `writeVerdaccioNpmrc` -> Verdaccio routing. `[VERIFIED]`
- `e2e/angular-typechecker-matrix-e2e/src/{matrix-5types,pnpm-symlink}.e2e.spec.ts` -- empty `.npmrc` + non-existent `npm_config_userconfig` -> npmjs-direct, no registry. `[VERIFIED]`
- `e2e/angular-typechecker-{install,cache}-e2e/project.json` -- `parallelism:false`; ng-cli/matrix have none. `[VERIFIED]`
- `.github/workflows/ci.yml` -- no storage caching today; e2e job `--parallel=2`, SHA-pinned actions. `[VERIFIED]`
- `260713-w87-{RESEARCH,MEASUREMENTS}.md` -- Lever 1 spec, cold baseline (npm ~594s/26, yarn ~209s/11, pnpm ~85s/9, grand ~888s/46), 93.4s->43.8s in-run delta. `[VERIFIED: prior task]`
