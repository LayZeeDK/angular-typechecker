---
quick_id: 260714-fd4
status: complete
outcome: no-go
date: 2026-07-14
---

# Quick Task 260714-fd4: Docker-based e2e wall-clock optimization -- SUMMARY

**Outcome: NO-GO on Docker (research-only decision task; nothing applied).** The `--research`
step produced a HIGH-confidence NO-GO backed by the first-party w87/1gr/squ measurements plus
cited GitHub/Docker docs. The user reviewed the verdict and chose to record the research as the
deliverable rather than apply Docker. No production/CI/source change was made; no
`package.json` version mutation.

## Why NO-GO (see 260714-fd4-RESEARCH.md for the full analysis)

1. **Docker saves ~nothing unique here.** Every e2e spec `cpSync`s a COMMITTED fixture into a
   mkdtemp workspace -- there is zero runtime scaffolding, so the user's "pre-built image with a
   scaffolded workspace" would only save the INSTALL. An install = metadata + fetch + extract/link;
   Lever 1 (landed) + the deferred `actions/cache` already collapse metadata+fetch. Docker could
   only uniquely attack extract/link by pre-baking `node_modules`, which just trades extract for
   `cpSync` copy cost (a wash on Linux; Node `cpSync` has no reflink).
2. **Fidelity kills the pre-bake.** A populated `node_modules` breaks the exact specs that justify
   the tier: the yarn `ng add` auto-wire proof (24-06, depends on yarn's real node-modules layout),
   the pnpm-workspace collision (needs a real `.pnpm/` store), the Storybook install-order +
   `--legacy-peer-deps` case, and every B-03 peer-honesty ERESOLVE assertion. The only fidelity-safe
   "bake" IS a warm cache = `actions/cache`.
3. **Docker vs actions/cache -> actions/cache wins outright:** same fetch win, ~0 extra wall-clock,
   low maintenance, and NO new auth scope. Every Docker path (GHCR image / buildx-gha / build-push)
   needs a `packages:` scope that regresses this repo's `contents: read`-only tokenless-OIDC posture,
   plus the 10 GB GHA-cache ceiling.
4. **Docker-locally is low-value on this box:** native e2e is already fastest here; amd64-under-QEMU
   is slow, arm64 doesn't match CI's amd64, and arch is correctness-irrelevant for a pure-JS
   type-checker. The only plausible local Docker lever is the Linux-fs-avoids-Windows-Defender/NTFS
   effect -- likely small on the D: Dev Drive (ReFS, async Defender) and obtainable more cheaply via
   WSL2 without a Dockerfile.

## Recommendations carried forward

- **CI:** ship the deferred `actions/cache` of the Verdaccio storage (1gr Part d) as a separate quick
  task -- turnkey, stacks on Lever 1, no new auth scope.
- **Local:** the confident local win is already banked (Lever 1 warm Verdaccio cache across runs);
  further local levers are the subject of the follow-up quick task (research other LOCAL e2e
  wall-clock optimizations; measure + apply).

## Artifacts

- `260714-fd4-RESEARCH.md` -- the full Docker analysis, fidelity split table, ranked CI-integration
  options, Windows-arm64-local verdict, and GO/NO-GO.
- No PLAN/VERIFICATION: the task resolved at the research/decision gate (NO-GO), so no plan was
  authored and no apply was verified.
