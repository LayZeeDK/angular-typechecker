# Quick Task 260714-fd4: Docker-based e2e wall-clock optimization -- RESEARCH

**Researched:** 2026-07-14 (Windows arm64 dev box; branch gsd/v0.2.1-angular-cli-workspace-support)
**Domain:** e2e install-cost optimization; Docker image pre-bake vs actions/cache; CI + local dev
**Confidence:** HIGH (grounded in this repo's own w87/1gr/squ measurements + code, plus CITED GitHub/Docker docs)

## Summary

The e2e tier's per-run cost is the INSTALL, not the scaffold: every spec `cpSync`s a
COMMITTED fixture into `mkdtemp` and then runs a real package-manager install
(`npm/pnpm/yarn install` of the Angular 22 / Nx 23 / TS 6 toolchain) followed by the
LIVE install of OUR freshly-built tarball (`nx add` / `ng add` / `npm install <tgz>` /
`pnpm add <tgz>`). No `create-nx-workspace` / `ng new` runs at runtime (verified: zero
matches in `e2e/**/*.e2e.spec.ts`). So a "pre-built image with a scaffolded workspace"
saves nothing on scaffolding -- the only thing left to attack is the install.

An install decomposes into three costs: (1) dependency METADATA resolution, (2) tarball
FETCH over the wire, (3) tarball EXTRACT + LINK into `node_modules`. Lever 1 (landed,
1gr) + the deferred actions/cache already collapse (1)+(2) toward ~0. The ONLY thing a
Docker image can uniquely attack is (3) EXTRACT+LINK -- and it can only do that by
pre-populating `node_modules`, which (a) trades extract cost for `cpSync` copy cost
(a wash-to-negative on Linux, since Node's `cpSync` is a per-file copy with no reflink),
and (b) BREAKS FIDELITY on exactly the specs that justify the e2e tier's existence (the
yarn `ng add` auto-wire proof, the pnpm-workspace collision, and the B-03 peer-honesty
assertions all require a fresh, unpopulated install path).

**Primary recommendation: NO-GO on Docker.** Ship the already-deferred `actions/cache`
of the Verdaccio storage (1gr Part d) as the next quick task instead. It captures the
bulk of the realistically-achievable CI wall-clock win (the network-fetch portion, which
is a LARGER share on Linux CI than on this Defender-taxed Windows box), for near-zero
maintenance, no new auth scope, no change to the repo's tokenless-OIDC / `contents: read`
posture, and it stacks cleanly on the landed Lever 1. Docker adds a Dockerfile + GHCR +
multi-arch + digest-pinning maintenance surface and a new `packages:` permission scope,
in exchange for a unique lever that is defeated by this repo's architecture. Docker
"locally" on Windows-arm64 is strictly worse than the native local e2e that already
works (amd64-under-QEMU is slow; arm64 doesn't match CI; arch is correctness-irrelevant
for a pure-JS type-checker).

## 1. What a Docker image can actually save here

### The install-cost decomposition

Each e2e install into a tmp workspace pays these costs (per w87/1gr measurements + code):

| # | Cost component | Attacked by | Docker-unique? |
|---|----------------|-------------|----------------|
| 1 | Dep metadata resolution (registry round-trips) | Verdaccio warm-cache (Lever 1, landed) + actions/cache (deferred) | No |
| 2 | Tarball FETCH (bytes npmjs -> Verdaccio -> client) | Verdaccio warm-cache (landed) + actions/cache (deferred) | No |
| 3 | Tarball EXTRACT + LINK into `node_modules` (untar + write ~tens of thousands of files) | ONLY a pre-populated `node_modules` or a warm pnpm hardlink store | **Yes, in principle** |
| 4 | Corepack shim spawn + (Windows) Defender scan | Not reducible by any cache; Linux CI already avoids Defender | No |
| L | LIVE install of OUR tarball + wire (`nx add`/`ng add`) | MUST stay live (fidelity) -- never bake | n/a |

### What warm-cache / actions/cache already saves (components 1+2)

From 1gr's honest ceiling (first-party, HIGH): *"Warm collapses the NETWORK-fetch
portion of every Verdaccio-routed install toward ~0, but the irreducible local cost
remains: tarball extraction, `node_modules` linking, the corepack shim spawn, and (on
Windows) Defender scanning."* The flagship yarn install measured 93.4s cold ->
44.7s warm (~52% cut) -- that ~49s delta IS components 1+2; the residual ~45s is
components 3+4. `[VERIFIED: 1gr-MEASUREMENTS.md]`

On Linux CI the network share (1+2) is LARGER (no Defender masking it, faster disk), so
1gr states the Windows local win is a "LOWER BOUND on the proportional CI win."
`[CITED: 1gr Part d]`

### What ONLY a Docker image could save (component 3) -- and why it doesn't work here

To skip EXTRACT+LINK you must ship a `node_modules` that already exists. Three ways, all
dead ends for this repo:

- **Bake `node_modules` into the fixture, `cpSync` it with the fixture.** Node's `cpSync`
  is a real per-file copy (no reflink/CoW). Copying a ~hundreds-of-MB / tens-of-thousands
  -of-files Angular `node_modules` costs roughly what the warm install's extract costs --
  a wash on Linux, worse on Windows. You move the cost, you don't remove it.
  `[ASSUMED]` (directional; no reflink in Node cpSync is `[CITED: nodejs fs docs]`)
- **Bake the npm cache (`~/.npm/_cacache`) into the image, run `npm ci` in the tmp copy.**
  `npm ci` still extracts+links every package (component 3 unchanged); it only skips 1+2 --
  which actions/cache already does. No advantage over actions/cache. `[ASSUMED]`
- **Bake a warm pnpm content-addressable store into the image.** pnpm installs by
  hardlinking from the store, which IS cheaper than extract -- but (i) actions/cache can
  cache the pnpm store too (no Docker needed), and (ii) only the 2 pnpm installs benefit,
  not the npm/yarn majority. `[ASSUMED]`

**Realistic ceiling for Docker's unique lever: ~0 additional wall-clock over
actions/cache**, once you subtract the copy/pull costs it introduces -- and negative on
the fidelity-critical specs (Section 2).

## 2. Fidelity-preserving design (bake vs keep-live)

The crux (from the task's own FIDELITY CONSTRAINT): the e2e tier exists to exercise the
REAL `nx add`/`ng add` install of the SHIPPED tarball into a consumer workspace. Anything
that removes the from-scratch consumer install stops proving what the test exists to prove.

### Bake / keep-live split

| Layer | Bake into image? | Why |
|-------|------------------|-----|
| Node + corepack + pnpm/yarn shims | Optional (marginal) | CI already provisions these fast via `setup-node` / `pnpm/action-setup`; baking saves seconds |
| npmjs proxy cache / npm cache / pnpm store (WARM CACHE the fresh install pulls from) | Equivalent to actions/cache | Attacks components 1+2 only -- no fidelity cost, but NO advantage over the cheaper actions/cache |
| Base `node_modules` (pre-populated Angular toolchain) | **NO** | Trades extract for copy (wash) AND breaks the fresh-install fidelity of the specs below |
| Base install command (`npm/pnpm/yarn install` into EMPTY node_modules) | **KEEP LIVE** | Proves the consumer's from-scratch install; masks nothing |
| OUR tarball install + wire (`nx add`/`ng add`/`<tgz>`) | **KEEP LIVE (never bake)** | The entire point of the tier |
| Peer resolution (B-03 honesty) | **KEEP LIVE** | Specs assert a real ERESOLVE surfaces; a pre-populated tree hides it |

### Specs that CANNOT use a pre-baked `node_modules` (fidelity would break)

| Spec / scenario | Why a pre-baked node_modules breaks it |
|-----------------|----------------------------------------|
| `ng-cli-e2e` yarn (flat + workspace) | 24-06's whole finding is that yarn 4's `ng add` post-install schematic detection depends on yarn's node_modules LAYOUT. A pre-populated tree changes that layout -> the auto-wire proof is no longer testing the real yarn path. `[VERIFIED: STATE.md 24-06]` |
| `matrix-e2e` `pnpm-symlink` (collision) | The `.pnpm/` symlinked store + the root-name-collision are constructed BY the real `pnpm add` install. Pre-populating defeats the layout the OUT-02 realpath guard exists to exercise. `[VERIFIED: pnpm-symlink.e2e.spec.ts]` |
| `install-e2e` Storybook a/b/composition | Storybook's `@storybook/angular@10.4.6` is force-installed with an EXPLICIT `--legacy-peer-deps` step AFTER our package is added to a Storybook-FREE tree (install-ORDER is load-bearing, 18-04). A baked tree collapses that order. `[VERIFIED: storybook-tarball.e2e.spec.ts]` |
| ALL specs asserting B-03 peer honesty | `buildCleanEnv` strips leaked peer overrides so a real consumer ERESOLVE surfaces; a pre-populated node_modules would satisfy peers pre-emptively and MASK a broken published peer range. `[VERIFIED: e2e-process.ts + specs]` |

Conclusion: the ONLY fidelity-safe thing Docker can bake is a warm cache -- which is
actions/cache with a Dockerfile bolted on.

## 3. CI integration options, ranked

Current `e2e` job (`.github/workflows/ci.yml`): `ubuntu-latest`, Node 24, `corepack
enable`, `pnpm/action-setup@11.9.0`, `npm ci`, `nx run-many -t typecheck -p
tag:type:e2e`, `nx run-many -t e2e --parallel=2`. Top-level `permissions: contents:
read`; NO job re-grants any write scope; all actions SHA-pinned; OIDC is release.yml's
concern alone. Required check is the `ci` aggregate. `[VERIFIED: ci.yml]`

| Option | Wall-clock win vs actions/cache | Maintenance | Auth / OIDC-posture risk | Stacks with actions/cache? |
|--------|-------------------------------|-------------|--------------------------|----------------------------|
| (a) `jobs.e2e.container.image: ghcr.io/<repo>/e2e:<digest>` (warm-cache image) | ~0 (still runs `npm ci` + live fixture installs; pays image PULL) | HIGH (Dockerfile, rebuild on every Angular/Nx/TS bump, digest pin, in-container 127.0.0.1 Verdaccio wiring) | Private image needs `packages: read` on the job (NEW scope; today the job has ZERO beyond `contents: read`) + package-level access grant `[CITED: docs.github.com]` | Redundant: warm image makes cache moot; caching makes image moot |
| (a') same but node_modules-baked (GB-scale) image | Negative (pull of a GB image + `cpSync` cost > install saved; also breaks fidelity per S2) | HIGHEST | same as (a) | No -- and blows the 10 GB GHA-cache ceiling if layer-cached `[CITED: docs.docker.com]` |
| (b) `docker buildx` + `cache-from/to: type=gha` | n/a for the e2e install -- this caches IMAGE BUILD layers, not the install; only relevant if (a)/(c) is adopted | HIGH (needs `setup-buildx-action`, Buildx v0.21+ for the v2 cache API) | none extra beyond (a)/(c) | Competes for the SAME 10 GB repo cache pool as the Verdaccio actions/cache `[CITED: docs.docker.com]` |
| (c) build+push image to GHCR on schedule/tag, pull in e2e | ~0 to negative (pull time vs install saved) | HIGHEST (scheduled workflow, image lifecycle, staleness on toolchain bumps) | build+push needs `packages: write` -- a WRITE scope in a repo whose CI has none; directly contradicts the least-privilege / tokenless posture `[CITED: docs.github.com]` | Redundant with actions/cache |
| **(cheaper) `actions/cache` the Verdaccio storage (1gr Part d)** | **The reference win** (removes the network-fetch portion cross-run on CI) | LOW (one SHA-pinned `actions/cache` step; Dependabot keeps it fresh) | NONE -- read/write is to GitHub's own cache, no registry auth, no new permission scope | It IS the actions/cache; stacks on the landed Lever 1 |

Notes:
- **Does Docker REPLACE or STACK with actions/cache?** A warm-cache image REPLACES it
  (redundant). A node_modules-baked image also collides with the 10 GB GHA-cache ceiling
  that the Verdaccio actions/cache already draws from `[CITED: docs.docker.com]`. Either
  way, running BOTH wastes the shared 10 GB pool. There is no additive win.
- **CodeQL / required check:** a `container:` job does not affect the separate CodeQL
  `Analyze (...)` checks, and the required aggregate check name (`ci`) is unaffected. But
  every Docker option adds a NEW failure surface (image pull auth, registry outage) to a
  gate that currently depends only on npm + GitHub.
- **Security posture:** the single biggest strike -- every Docker option adds a `packages:`
  scope (read for pull, write for push) to a workflow whose defining property is
  `contents: read` with zero write anywhere (see the ci.yml threat-model header). That is
  a real regression of the s1ngularity/tj-actions-hardened posture for a speculative,
  ~0 wall-clock gain.

## 4. Local (Windows-arm64) story

**Verdict: Docker locally is low-value; run e2e natively (which already works).**

- All w87/1gr/squ measurements were taken running e2e NATIVELY on this box -- the native
  path is proven and is the fastest option here. `[VERIFIED: measurements]`
- A CI-matching `linux/amd64` image runs under QEMU emulation on Snapdragon arm64 =
  SLOW (per global CLAUDE.md: "x86_64 containers via QEMU emulation (slow)"). This would
  be materially slower than the native run it replaces. `[CITED: global CLAUDE.md]`
- A `linux/arm64` image runs fast locally but does NOT match CI's amd64 -- defeating the
  "reproduce CI locally" rationale. Producing BOTH means a multi-arch build (double build
  cost + `docker buildx` + QEMU for the cross-arch leg).
- Arch is correctness-irrelevant here: ci.yml itself states "arch is correctness-
  irrelevant for a pure-JS ngtsc type-checker." So there is no correctness reason to
  containerize locally either. `[VERIFIED: ci.yml]`

There is no local scenario where Docker beats the existing native e2e on this hardware.

## 5. Docker vs actions/cache -- head-to-head

| Dimension | Docker image | actions/cache (deferred 1gr Part d) |
|-----------|--------------|-------------------------------------|
| Attacks network fetch (comp 1+2) | Yes (if warm-cache baked) | Yes |
| Attacks extract+link (comp 3) | Only via node_modules pre-bake -> breaks fidelity + wash on copy | No (irreducible -- but so it is for Docker in practice) |
| Additional wall-clock over the other | ~0 (to negative after pull/copy cost) | The reference win |
| Maintenance | Dockerfile + GHCR + multi-arch + digest pin + rebuild-on-bump | One SHA-pinned cache step |
| New auth / permission scope | `packages: read` (pull) / `write` (push) | None |
| Security-posture change | Regresses `contents: read`-only CI | None |
| Toolchain pinning / reproducibility | Real, but the fixtures already pin via committed lockfiles + ci.yml pins Node/pnpm/yarn | Already covered by lockfiles + ci.yml pins |
| Verifiable on THIS box | Only the QEMU-slow amd64 path | The local flip is verifiable; CI leg needs 2 CI runs (miss->hit) |

Docker's only genuinely-unique value is toolchain pinning/reproducibility -- and that is
ALREADY delivered by the committed fixture lockfiles (`package-lock.json` / `pnpm-lock.yaml`)
plus the Node/pnpm/yarn version pins in ci.yml. There is no reproducibility gap for Docker
to fill, and no additional wall-clock cut on top of actions/cache. `[VERIFIED: fixtures + ci.yml]`

## 6. GO / NO-GO

**NO-GO on Docker. GO on the cheaper alternative (actions/cache), as a separate quick task.**

Rationale, in one line: Docker's only unique lever (skip extract+link via pre-baked
`node_modules`) is defeated by the `cpSync`-into-`mkdtemp` architecture and, decisively,
breaks fidelity on the yarn `ng add`, pnpm-collision, Storybook-order, and B-03
peer-honesty specs -- while costing a Dockerfile, GHCR, multi-arch, digest-pinning, and a
new `packages:` permission scope that regresses the repo's tokenless-OIDC / `contents:
read`-only CI posture, all for ~0 additional wall-clock over actions/cache.

Release-branch risk seals it: this is `gsd/v0.2.1-angular-cli-workspace-support` with an
imminent human-gated Release PR. A Docker rearchitecture is a large, hard-to-reverse diff
and a permanent new maintenance surface -- exactly the wrong thing to introduce before a
release cut.

### The smaller alternative to actually do (next quick task, NOT this one)

Ship the 1gr Part d `actions/cache` of the Verdaccio storage. It is turnkey and already
recipe'd. Minimal slice (1 task):

1. Add ONE SHA-pinned `actions/cache` step to the `e2e` job in `.github/workflows/ci.yml`,
   before `nx run-many -t e2e`, per the 1gr recipe:
   - `path:` `tmp/local-registry/storage` EXCLUDING `storage/angular-typechecker` +
     `storage/.htpasswd` (the run-start selective delete removes them anyway).
   - `key:` on the Verdaccio-routed fixture lockfiles + the plugin manifest + `ci.yml`
     (so any dependency/tool bump busts it); matrix is npmjs-direct so its lockfile is
     intentionally NOT keyed.
   - `restore-keys:` the `verdaccio-storage-${{ runner.os }}-` prefix.
2. Keep it a SEPARATE follow-up PR from any local change (1gr's reasoning: a CI-only
   change is unverifiable locally and must not be entangled).

This stacks on the landed Lever 1 (`clearStorage:false` already gives in-job cross-project
reuse; actions/cache adds cross-CI-run persistence) and needs no new permission scope
(`actions/cache` reads/writes GitHub's own cache, not a registry).

### Verification (for the actions/cache follow-up, when it is done)

Docker itself is NOT to be applied (NO-GO), so there is nothing to verify for it. For the
recommended actions/cache follow-up:

- **CI delta:** two consecutive CI `e2e` runs on the PR branch -- run 1 = cache MISS
  (populates), run 2 = cache HIT (restores). Read the `e2e` job wall-clock delta and
  confirm the cache-restore log line; confirm the gate stays GREEN (4/4 projects).
- **Local re-measure (optional, to show the install delta):** reuse the committed
  `ATC_TIME_INSTALLS` timing seam (no code change needed):
  ```bash
  ATC_TIME_INSTALLS=1 ATC_TIMING_OUT="$PWD/tmp/fd4-verify.jsonl" \
    NX_DAEMON=false npx nx run-many -t e2e --parallel=2 --skip-nx-cache
  node tools/e2e-timing/aggregate-install-timings.mjs tmp/fd4-verify.jsonl
  ```
  (`--skip-nx-cache` required: a cache hit runs no installs -> empty JSONL.)
- **Revert path:** delete the single `actions/cache` step from `ci.yml` (one-hunk revert).

If, contrary to this recommendation, a Docker slice were ever forced, the smallest
verifiable-on-this-box probe would be a `linux/arm64` image (native, not QEMU) that bakes
ONLY a warm npm/pnpm cache (never `node_modules`, never our tarball) and runs the existing
`nx run-many -t e2e` unchanged -- but this would still be strictly dominated by
actions/cache and is documented here only for completeness, not as a recommendation.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `cpSync` of a baked `node_modules` roughly equals the warm install's extract cost on Linux (Node cpSync = per-file copy, no reflink) | 1 | If reflink/CoW were available (e.g. via a non-Node copy on ReFS/btrfs), the copy could be much cheaper than extract -- but this would still break fidelity per S2, so the NO-GO stands |
| A2 | A GB-scale node_modules-baked image's pull time exceeds the install it saves on CI | 3 | If image pull were faster than expected, option (a') moves from "negative" to "~0" -- still not a positive win, and still breaks fidelity |
| A3 | Docker locally on amd64-under-QEMU is materially slower than native | 4 | Grounded in global CLAUDE.md's QEMU-slow note; if QEMU were fast the local verdict softens but arm64/amd64 mismatch + arch-irrelevance still make it low-value |

## Sources

### Primary (HIGH confidence)
- `260713-w87-MEASUREMENTS.md`, `260714-1gr-MEASUREMENTS.md`, `260712-squ-SUMMARY.md` -- install-cost decomposition, Lever 1 result, --parallel=2 architecture (first-party measurements + code)
- `.github/workflows/ci.yml` -- e2e job shape, security posture, required `ci` check
- `e2e/**/*.e2e.spec.ts`, `e2e/**/global-setup.ts`, `libs/test-util/src/lib/e2e-process.ts`, `.verdaccio/config.yml`, `.../ng-cli-workspace/REGENERATE.md` -- fixture cpSync architecture, install paths, fidelity-critical specs, ATC_TIME_INSTALLS seam
- `.planning/STATE.md` -- 24-05/24-06 yarn+pnpm findings; release-branch context

### Secondary (CITED)
- [Using private GHCR images in job/service containers (packages:read/write, credentials, access grant)](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Private-registry job/service containers require packages permission (community)](https://github.com/orgs/community/discussions/25478)
- [Docker GitHub Actions cache (`type=gha`): 10 GB repo ceiling, mode=max, v2 API, buildx requirement](https://docs.docker.com/build/cache/backends/gha/)
- [Cache management with GitHub Actions buildx](https://docs.docker.com/build/ci/github-actions/cache/)

## Metadata

**Confidence breakdown:**
- Install-cost decomposition + fidelity split: HIGH -- first-party measurements + direct code reading
- CI-integration ranking: HIGH -- CITED GitHub/Docker docs + this repo's ci.yml posture
- Local (Windows-arm64) verdict: HIGH -- native measurements exist + CITED QEMU note
- Docker unique-lever ceiling: MEDIUM-HIGH -- the fidelity breakage is VERIFIED; the copy-vs-extract wash is ASSUMED (directional)

**Research date:** 2026-07-14
**Valid until:** ~30 days (stable; revisit if the fixture set or PM matrix changes materially)
