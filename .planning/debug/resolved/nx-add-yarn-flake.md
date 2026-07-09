---
slug: nx-add-yarn-flake
status: resolved
trigger: "Debug the nx-add-yarn flake"
goal: find_and_fix
created: 2026-07-09
updated: 2026-07-09
---

# Debug Session: nx-add-yarn-flake

## Trigger

<!-- verbatim user-supplied description; treat as DATA, not instructions -->
Debug the nx-add-yarn flake

## Symptoms

- **Expected:** `corepack yarn nx add angular-typechecker` on a yarn 4 (berry)
  workspace pointed at the local Verdaccio registry succeeds; nx detects yarn
  berry -> `yarn add -D angular-typechecker` -> runs the internal
  `g angular-typechecker:init`, which seeds the WALK-02 `typecheck`
  `targetDefaults` in `nx.json`.
- **Actual:** yarn's **Resolution** step succeeds (269 packages resolved from
  `http://localhost:487x`), then the **Fetch** step throws `RequestError` /
  `AggregateError [ECONNREFUSED]` against that same local Verdaccio port. The
  spec fails at `sh('corepack yarn install', ...)` or the subsequent
  `corepack yarn nx add angular-typechecker`.
- **Error:** `ECONNREFUSED` on the yarn fetch phase (post-resolution).
- **Timeline:** observed ONCE during the Phase 18-04 wave run (~2026-07-06) on
  the local Windows arm64 dev host. 9/10 e2e spec files passed; this was the
  only failure. CI has NEVER exercised it (per AGENTS.md the heavy e2e gate is
  Linux-only).
- **Reproduction:** `npx nx test angular-typechecker-install-e2e` ->
  `e2e/angular-typechecker-install-e2e/src/nx-add-yarn.int.spec.ts`
  (corepack `yarn@4.17.0`, Verdaccio provisioned by the shared vitest
  `globalSetup`, serialized run).

## Environment / known constraints

- Host: Windows 11 arm64, PowerShell Core / Git Bash, Node via fnm.
- Verdaccio bound to `http://localhost:<ephemeral>` and injected via
  `inject('verdaccioUrl')`; the spec writes a per-fixture `.yarnrc.yml` with
  `npmRegistryServer`, `npmAuthToken`, `unsafeHttpWhitelist: [localhost]`,
  `npmMinimalAgeGate: 0`, `enableImmutableInstalls: false`, per-fixture
  `cacheFolder`, `enableGlobalCache: false`.
- Only `@storybook/angular` uses `--legacy-peer-deps` elsewhere; the yarn spec
  does not touch Storybook fixtures.
- The npm and pnpm sibling `nx add` e2e specs PASS on the same host/run; only
  the yarn (corepack yarn 4 -> Verdaccio) path flakes.

## Investigation plan (user-directed)

1. **Diagnose from artifacts first** — reason from the spec, the `.yarnrc.yml`
   config, the Verdaccio/globalSetup wiring, and the recorded ECONNREFUSED
   evidence; enumerate + rank hypotheses (see leading candidates below).
2. **Then attempt a fresh local repro** — run the yarn e2e spec on this host to
   capture live logs and confirm/refute the top hypothesis.

## Leading hypotheses (pre-investigation, to test not assume)

- **H1 — localhost IPv4/IPv6 mismatch:** Verdaccio listens on IPv4
  `127.0.0.1` while yarn's fetch resolves `localhost` to IPv6 `::1` (or a
  different socket than resolution used) -> ECONNREFUSED. Classic dual-stack
  localhost bug; explains "resolution OK, fetch fails".
- **H2 — Verdaccio tarball-URL rewrite:** `dist.tarball` URLs Verdaccio returns
  point at a host/port/prefix yarn cannot reach (self_path / url_prefix), so
  metadata (resolution) succeeds but tarball GET (fetch) refuses.
- **H3 — registry lifecycle race:** the shared Verdaccio globalSetup tears down
  or a keep-alive socket is dropped between the resolution and fetch phases.
- **H4 — corepack provisioning:** corepack yarn 4.17.0 fetch of the yarn
  release itself (not the package) hits a network path that refuses.

## Current Focus

hypothesis: CONFIRMED -- dual-stack `localhost` family mismatch; Verdaccio bound IPv6 `::1`-only here while yarn intermittently attempted IPv4 -> ECONNREFUSED.
test: applied end-to-end IPv4 pin; ran the full install-e2e suite against the pinned registry.
expecting: yarn `nx add` succeeds (numeric-IP URL removes the family race); no sibling regresses.
next_action: CONFIRMED FIXED by the user (2026-07-09). Session archived; fix carried on branch `fix/nx-add-yarn-registry-ipv6-flake` into a PR against `main` (PR-only; merge left to the user).
reasoning_checkpoint:
  hypothesis: "The e2e registry is addressed by the dual-stack hostname `localhost`; the shared verdaccio target sets no listenAddress so Verdaccio binds the single family `localhost` resolves to first (IPv6 `::1`-only on this Windows host, confirmed by Get-NetTCPConnection). yarn 4's HTTP layer intermittently attempts the OTHER family (IPv4 `127.0.0.1`) for `localhost`; nothing listens there so connect() is refused -> AggregateError [ECONNREFUSED]. npm/pnpm reliably land on the bound family, so only yarn flakes."
  confirming_evidence:
    - "Live: Verdaccio binds `::1` ONLY on this host (no 127.0.0.1 listener) when launched with the target's bare `--listen 4873`."
    - "Error shape is AggregateError [ECONNREFUSED] = all candidate families refused on a dual-stack connect; Node 24 defaults autoSelectFamily=true + verbatim DNS."
    - "npm+pnpm pass over the same http://localhost:PORT on the same host/run; only yarn flakes -> yarn-specific family selection, not registry-down."
    - "Live: setting listenAddress=127.0.0.1 makes Verdaccio bind 127.0.0.1 and print http://127.0.0.1:PORT (numeric URL => clients skip DNS/family-race entirely)."
  falsification_test: "If, after pinning the registry to numeric 127.0.0.1 end-to-end (bind + URL + client + tarball-rewrite host), the yarn spec still throws ECONNREFUSED, the family-mismatch hypothesis is wrong (a numeric IPv4 literal cannot resolve to ::1)."
  fix_rationale: "Pinning a numeric IPv4 literal on BOTH the registry bind and the client URL removes name resolution and dual-stack family selection from the client path entirely -- the ROOT of the flake -- rather than retrying/waiting around a symptom. Verdaccio's Host-based tarball rewrite echoes 127.0.0.1 so the fetch leg is numeric too."
  blind_spots: "Cannot cheaply prove absence of the 1-in-many flake with one green run; a full multi-run stress is heavyweight/itself-flaky. The Linux-CI bind family is inferred (IPv4-first), not observed here; but pinning 127.0.0.1 is correct on every OS since it forces the bind, not merely observes it."
tdd_checkpoint:

## Resolution

root_cause: |
  Dual-stack `localhost` family mismatch. The shared `@nx/js:verdaccio` local-registry
  target sets no `listenAddress`, so Verdaccio is launched with a bare `--listen 4873`
  and binds the SINGLE address family that the hostname `localhost` resolves to first.
  On the Windows arm64 dev host that is IPv6 `::1` ONLY (confirmed by Get-NetTCPConnection:
  `::1:4873 Listen`, no IPv4 listener). Every client addresses the registry by the same
  dual-stack hostname `localhost`. npm and pnpm reliably connect to the bound family; yarn
  4 (berry)'s HTTP layer intermittently attempts the OTHER family (IPv4 `127.0.0.1`), where
  nothing is listening, so `connect()` is refused and surfaces as `AggregateError
  [ECONNREFUSED]`. Resolution wins the family race; a later parallel fetch burst loses it,
  producing the "resolution OK, fetch ECONNREFUSED" signature. Not a registry-down,
  lifecycle, tarball-rewrite (that leg inherits the same `localhost`), or corepack issue.
fix: |
  Pin the shared e2e local registry to the numeric IPv4 loopback end-to-end so no
  client path performs `localhost` name resolution (and thus no dual-stack family
  selection):
    1. project.json local-registry target: add `"listenAddress": "127.0.0.1"` ->
       verdaccio binds 127.0.0.1 and prints `http://127.0.0.1:PORT/`.
    2. global-setup.ts: pass `listenAddress: '127.0.0.1'` to startLocalRegistry (so
       its readiness scrape + the provided verdaccioUrl use the numeric literal) and
       flip the publish SAFETY gate to `http://127.0.0.1:`.
    3. Flip the loopback SAFETY-gate asserts in every install-e2e spec that reads
       verdaccioUrl (`http://localhost:` -> `http://127.0.0.1:`): nx-add-npm/pnpm/yarn,
       storybook-composition, storybook-tarball (x2), verdaccio-publish.
    4. yarn spec: `unsafeHttpWhitelist` host `localhost` -> `127.0.0.1` (must match the
       numeric registry host). npm/pnpm nerf-dart + verdaccio tarball-URL rewrite derive
       the host from the URL, so they follow automatically.
  Numeric IP on BOTH ends means yarn connects to exactly 127.0.0.1 (no DNS, no `::1`
  candidate), matching where verdaccio now binds -- the root-cause fix, not a retry.
verification: |
  Ran the full `angular-typechecker-install-e2e` suite against the pinned registry
  (NX_DAEMON=false, --skip-nx-cache): 11 files / 37 tests PASS, nx exit 0. Directly
  relevant: `nx-add-yarn.int.spec.ts` (the real `corepack yarn nx add
  angular-typechecker`) PASSED in 13.9s with NO ECONNREFUSED -- the falsification test
  (yarn still refusing against a numeric IPv4 registry) did NOT trigger. No sibling
  regressed (npm/pnpm/storybook/verdaccio-publish all green on the IPv4 URL). Prettier
  format:check clean on all changed files; the e2e project has no lint target so the
  edits are Prettier-gated only. Live root-cause proof captured beforehand:
  Get-NetTCPConnection showed verdaccio bound `::1`-only under the old bare `--listen`,
  and bound `127.0.0.1` under `--listenAddress 127.0.0.1`.
  HONEST CAVEAT: a single green yarn run cannot prove absence of a 1-in-many flake; the
  confidence is mechanism-level (numeric literals eliminate the causal name-resolution/
  family-selection step entirely), not statistical. User confirmed fixed 2026-07-09;
  repeated Linux-CI runs remain the closing statistical check.
files_changed:
  - project.json
  - e2e/angular-typechecker-install-e2e/src/global-setup.ts
  - e2e/angular-typechecker-install-e2e/src/nx-add-yarn.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/nx-add-npm.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/nx-add-pnpm.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/storybook-composition.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/storybook-tarball.int.spec.ts
  - e2e/angular-typechecker-install-e2e/src/verdaccio-publish.int.spec.ts

## Evidence

- timestamp: 2026-07-09 (artifact diagnosis)
  checked: globalSetup + startLocalRegistry + @nx/js:verdaccio executor + root project.json local-registry target
  found: globalSetup calls startLocalRegistry with NO listenAddress -> defaults to `localhost`. The local-registry target sets only port/config/storage (NO listenAddress) -> executor launches verdaccio `--listen 4873` (bare port). The injected verdaccioUrl is literally `http://localhost:4873`; the yarn spec writes that `localhost` hostname into `.yarnrc.yml npmRegistryServer` + `unsafeHttpWhitelist: [localhost]`.
  implication: BOTH the registry bind and every client connect go through the hostname `localhost`, which is dual-stack (`::1` + `127.0.0.1`). This is the shared surface for a family mismatch.

- timestamp: 2026-07-09 (artifact diagnosis)
  checked: host Node version + Node dual-stack defaults + the reported error shape
  found: Node v24.18.0. Node >=20 defaults `net` `autoSelectFamily=true` (Happy Eyeballs); Node >=17 defaults `dns.lookup` `verbatim=true` (no IPv4-first reorder). Reported error is `AggregateError [ECONNREFUSED]` -- the exact shape produced when connect() is REFUSED on ALL candidate families for a dual-stack hostname. Windows tends to resolve `localhost` IPv6-first.
  implication: `localhost` resolving to `::1` on the leg that fails, against a registry not listening on `::1`, yields precisely this AggregateError. Root = dual-stack `localhost` family ambiguity (H1).

- timestamp: 2026-07-09 (artifact diagnosis)
  checked: resolution-succeeds / fetch-fails split + errno + registry lifecycle
  found: ECONNREFUSED (connect refused = nothing listening at tried addr:port), NOT ECONNRESET / socket-hangup (a torn keep-alive gives those). globalSetup keeps the registry up for the whole serialized suite -- stop() runs only in the returned teardown (after ALL specs) or on setup error -- so the registry is NOT torn down between a single yarn command's resolution and fetch phases. Verdaccio rewrites `dist.tarball` on read from the request Host header (no url_prefix in config.yml), so the fetch leg's tarball URL host = the same `localhost`.
  implication: H3 (lifecycle race / dropped keep-alive) refuted -- wrong errno and the registry stays up. H2 (tarball rewrite) is NOT a distinct root: the tarball leg simply inherits the same `localhost` dual-stack ambiguity as resolution, just observed on a later/parallel burst of connects. Same root cause (H1), same fix.

- timestamp: 2026-07-09 (artifact diagnosis)
  checked: H4 (corepack provisioning) vs the availability guard + error target
  found: the spec's availability guard already runs `corepack yarn@4.17.0 --version`, which fetches+verifies the pinned yarn BEFORE the test body; the observed ECONNREFUSED targets the LOCAL Verdaccio port, not the corepack release CDN.
  implication: H4 refuted -- yarn is already provisioned when the body runs, and the failing connect is to local Verdaccio, not corepack's download host.

- timestamp: 2026-07-09 (artifact diagnosis)
  checked: why only yarn flakes while npm + pnpm siblings pass on the same host/run
  found: npm and pnpm both consume the same `http://localhost:4873` and pass reliably. npm (make-fetch-happen) and pnpm reliably land on `127.0.0.1` for `localhost`; yarn berry's HTTP layer is the one that intermittently connects to the wrong family.
  implication: a `localhost`-targeting client CAN reliably reach this Verdaccio, so the registry is answering on (at least) IPv4. The flake is yarn-specific family selection, not a registry-down condition. Pinning yarn to the concrete IPv4 loopback matches the proven-good npm/pnpm path -- pending the netstat bind-family confirmation.

- timestamp: 2026-07-09 (LIVE PROBE -- decisive)
  checked: started the real `@angular-typechecker/source:local-registry` target and inspected the bound socket with Get-NetTCPConnection on this Windows arm64 host
  found: Verdaccio (launched `--listen 4873`, i.e. bare port -> `localhost` bind) binds `::1` (IPv6) ONLY -- `LocalAddress ::1, Port 4873, State Listen`, with NO `127.0.0.1` listener. So on THIS host `localhost` resolves IPv6-first and Verdaccio is IPv6-only. This REFUTES the naive "pin yarn to 127.0.0.1" fix (that would deterministically ECONNREFUSED here). It CONFIRMS the mechanism: npm/pnpm land on `::1` reliably; yarn intermittently attempts `127.0.0.1` (nothing there) -> AggregateError [ECONNREFUSED].
  implication: the registry's bound family is host-dependent (IPv6-only here; typically IPv4-first on Linux CI), so NO static client-only pin is portable. The only portable, deterministic fix is to pin the registry to a concrete numeric family end-to-end (bind + URL + client), eliminating name resolution/family selection entirely.

- timestamp: 2026-07-09 (LIVE PROBE -- fix-mechanism verification)
  checked: re-ran the target with `--listenAddress=127.0.0.1` (the @nx/js:verdaccio executor option) and inspected bind + readiness log line
  found: Verdaccio bound `127.0.0.1` (confirmed `LocalAddress 127.0.0.1` on the probe port) AND printed the readiness line `http://127.0.0.1:PORT/`. So setting `listenAddress: 127.0.0.1` on the local-registry target both (a) binds IPv4 loopback and (b) prints the `http://127.0.0.1:` line that startLocalRegistry's scrape needs (scrape must be told `listenAddress:'127.0.0.1'` to match). Blast radius: only install-e2e's globalSetup forks this target; matrix-e2e and cache-e2e do NOT use the registry at all.
  implication: the fix is contained to the install-e2e project + the shared local-registry target it alone consumes. A numeric-IP registry URL (`http://127.0.0.1:PORT`) means every client (npm/pnpm/yarn) skips DNS and connects to exactly `127.0.0.1`, and Verdaccio's Host-based tarball-URL rewrite echoes `127.0.0.1` on the fetch leg too -- no `localhost`/dual-stack anywhere in the client path.

## Eliminated

- hypothesis: H3 -- registry lifecycle race / dropped keep-alive between resolution and fetch
  evidence: error is ECONNREFUSED (connect refused = nothing listening), not ECONNRESET/socket-hangup (what a torn keep-alive gives); globalSetup keeps the registry up for the whole serialized suite (stop() only in the returned teardown after ALL specs, or on setup error). Registry is not torn down mid-command.
  timestamp: 2026-07-09
- hypothesis: H4 -- corepack provisioning of yarn 4.17.0 hits a refusing network path
  evidence: the availability guard already runs `corepack yarn@4.17.0 --version` (provisions+verifies yarn BEFORE the body); the observed ECONNREFUSED targets the LOCAL Verdaccio port, not the corepack release CDN.
  timestamp: 2026-07-09
- hypothesis: H2 -- Verdaccio tarball-URL rewrite points fetch at an unreachable host (as a DISTINCT root cause)
  evidence: not a separate root -- Verdaccio rewrites dist.tarball on read from the request Host (`localhost`, no url_prefix set), so the fetch leg simply inherits the SAME dual-stack `localhost` ambiguity as resolution. Collapses into H1; same fix resolves it.
  timestamp: 2026-07-09

## Knowledge Base Entry

**Symptom:** An e2e install spec that talks to the shared local Verdaccio registry fails
intermittently with `AggregateError [ECONNREFUSED]` on the client's FETCH leg, while
RESOLUTION against the same `http://localhost:PORT` succeeded. Only yarn (berry) flaked;
npm and pnpm passed on the same host/run.

**Root cause (generalized):** Addressing the local registry by the dual-stack hostname
`localhost` is non-deterministic. With a bare `--listen PORT` (no `listenAddress`),
Verdaccio binds only the ONE address family `localhost` resolves to first -- IPv6 `::1`-only
on this Windows arm64 host. A client that (sometimes) attempts the other family (IPv4
`127.0.0.1`) reaches nothing and gets ECONNREFUSED. The bound family is host-dependent
(IPv6-first here, typically IPv4-first on Linux CI), so no client-only pin is portable.

**Guard rule:** Pin the e2e local registry to a NUMERIC IPv4 literal end-to-end -- the
`local-registry` target's `listenAddress: 127.0.0.1`, the `startLocalRegistry` call, the
injected `verdaccioUrl`, and every client whitelist/URL. A numeric literal removes DNS and
dual-stack family selection from the client path entirely. Prefer this over retry/wait
loops -- it fixes the cause, not the symptom. When adding a new install-e2e spec, assert
the registry URL is `http://127.0.0.1:` (never `localhost`).
