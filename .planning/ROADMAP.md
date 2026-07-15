**Plans:** 3/3 original plans complete; 3 gap-closure plans (2026-07-12, reopened under --force for post-verification yarn `ng add` gaps); 24-04 + 24-05 + 24-06 complete -- the last NGADD-01 yarn auto-wire gap closed (nx-free vanilla ng-add, Option C)

Plans:
**Wave 1**

- [x] 24-01-PLAN.md -- ACV-03/ACP-02: builder-over-`BuilderContext` integration gap-fill + `src/index.drift.ts` barrel additive-only tripwire + the git-diff audit vs `angular-typechecker@0.2.0`
- [x] 24-02-PLAN.md -- ACD-01: README `## Angular CLI` section + curated prose CHANGELOG entry + the `angular-cli-docs.spec.ts` content tripwire

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 24-03-PLAN.md -- ACV-01/ACV-02: the scaffolded `ng add` -> `ng run` e2e project (committed pinned Ng22 fixture) + the real-clone milestone-final UAT procedure

**Gap closure** *(added 2026-07-12 -- a post-verification gap: yarn does not auto-install the `@nx/devkit` peer `nx`, so `ng add` crashes on a yarn Angular CLI workspace)*

- [x] 24-04-PLAN.md -- ACP-02: declare `nx` as a direct `^23.0.0` dependency (yarn does not auto-install the `@nx/devkit` peer) + invert the `package-manifest.spec.ts`/`@nx/dependency-checks` guards + de-contradict PROJECT.md/CLAUDE.md
- [x] 24-05-PLAN.md -- ACV-02: finalize the yarn CLI e2e to the real `ng add` (strip debug scaffolding, keep `enableMirror:false`) + add a committed CLI x pnpm-workspace name-collision e2e (app build leaf never dropped)
- [x] 24-06-PLAN.md -- NGADD-01/ACV-02/ACP-02: make `ng-add` a vanilla nx-free `@angular-devkit/schematics` schematic sharing one framework-agnostic wiring core with the Nx `configuration` generator (Option C) so `ng add` auto-wires on the FIRST run under yarn 4; flip the yarn CLI e2e to assert first-run auto-wire; retire the resolved README yarn caveat

### Phase 25: GitHub-backed self-hosted Nx remote cache

**Goal:** Stand up a self-hosted Nx **remote** cache backed by GitHub-native primitives (focus: GitHub Actions Cache) so cacheable Nx tasks replay across CI runners, WITHOUT Nx Cloud or any new long-lived secret. Lower-priority infra: the e2e per-project split (quick-260715-050) already banks the tier's ~43% wall-clock win independently and cache-free; this is a separate, workspace-wide optimization with its own threat model. Honest payoff caveat (RESEARCH-3): once the OS/Node hash landmine below is fixed, the genuine within-run cross-runner hit is ~8-16s (the small plugin build) -- the heavy e2e work is not safely cacheable -- so this phase must justify itself on workspace-wide cross-run hits, not the e2e tier.

**Requirements:**

- **CREEP-mitigated (CVE-2025-36852).** Cache writes must not be poisonable by an untrusted PR into a scope that trusted/release runs replay. Lean on GitHub Actions Cache branch/merge-ref scoping + the existing `pull_request` (NOT `pull_request_target`) posture; write only from trusted contexts; keep the RELEASE build **cache-miss-by-design** (release.yml never points at the cache, so published bytes are always freshly built).
- **Read-WRITE in CI**, **read-ONLY from the local dev machine** (local runs restore hits but never populate the shared cache).
- May use the **`gh` CLI** and any relevant GitHub/Git primitive; **focus on GitHub Actions Cache** as the store (built-in retention, ~90-day max ceiling -- ample here).
- **Automatic cleanup by date** via GitHub Actions Cache retention/TTL (no unbounded growth; no manual pruning).
- Implement against Nx 23's FREE "build your own caching server" OpenAPI contract (`PUT/GET /v1/cache/{hash}`, 409-on-existing-key immutability), pointed at via `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`. Do NOT use the deprecated `@nx/{s3,gcs,azure,shared-fs}-cache` packages (deprecated 2026-05-21 due to CREEP) or Nx Cloud (external service + token breaks the tokenless-OIDC posture). The deprecated official packages live in the nrwl/nx git history; third-party plugins (e.g. `raegen/nx`, standalone cache servers) are references, SHA-pinned if adopted.
- **Correctness landmine (MUST fix):** nx's default task hash excludes OS + Node version, so a remote cache would let one `test`-matrix cell replay another cell's result -- turning the 6-cell OS/Node matrix into theater. Add `RUNNER_OS` + the Node major as `env` named inputs in `nx.json` so each cell hashes distinctly.
- Ship a threat-model doc + guard tests (release.yml never sets the cache env var; writes gated to trusted contexts; 409-immutability) -- fits a secure-phase gate.

**Depends on:** Phase 24
**Plans:** 0 plans

**Grounding:** `.planning/quick/260715-050-optimize-e2e-ci-wall-clock/260715-050-RESEARCH-3.md` (feasibility verdict, CREEP mechanism + mitigations rated for this repo, GitHub-native backend ranking, deprecated-vs-free landscape, MEDIUM effort estimate). User-provided sources are captured there (deprecated `@nx/azure-cache`; nx.dev self-hosted-caching "build your own caching server"; the CREEP CVE blog; the self-hosted-cache-packages deprecation page; the Emily Xiong exploration article).

Plans:
- [ ] TBD (run /gsd-plan-phase 25 to break down)
