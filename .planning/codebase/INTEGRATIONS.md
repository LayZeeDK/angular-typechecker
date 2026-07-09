# External Integrations

**Analysis Date:** 2026-07-09

angular-typechecker is a build-time developer tool, not a networked service. It
has NO application-level external services, databases, or auth providers. Its
integrations are all toolchain and distribution concerns: the Angular compiler
it drives in-process, the npm registry it publishes to, GitHub Actions CI/CD,
and a local Verdaccio registry used only for e2e install verification.

## APIs & External Services

**In-process compiler engine (the core integration):**
- `@angular/compiler-cli` - the type-check engine. Loaded at runtime via dynamic ESM `import('@angular/compiler-cli')` from CommonJS in `packages/angular-typechecker/src/core/compiler-loader.ts` (memoized). This is the single value-import of the compiler in the whole package; the executor calls `performCompilation` and gathers the full diagnostic set. Declared as a `peerDependency` - the consumer's installed version is used.
- `typescript` - loaded the same way via dynamic `import('typescript')` in `packages/angular-typechecker/src/core/load-typescript.ts` (memoized, `default ?? loaded`). Also a `peerDependency`.

Neither is a network API - they are in-process libraries reached through the
CJS to ESM dynamic-import bridge.

## Data Storage

**Databases:**
- None. This is a stateless build-time tool.

**File Storage:**
- Local filesystem only. Reads tsconfig files and the consumer's TypeScript program; writes the type-check report to raw `process.stdout` (`packages/angular-typechecker/src/executors/typecheck/executor.ts`). No files are emitted (`noEmit`).

**Caching:**
- Nx task cache. The `angular-typechecker:typecheck` target is `cache: true` with inputs pinned in `nx.json` (tsconfig globs, `package.json`, `tsconfig.base.json`, transitive `.d.ts`/`.tsbuildinfo` dependent outputs, and `externalDependencies: [typescript, @angular/compiler-cli]`). No external cache service.

## Authentication & Identity

**Application auth:**
- None. The tool has no users, sessions, or identity system.

**Publish auth (npm):**
- Tokenless OIDC Trusted Publisher. `.github/workflows/release.yml` publishes with `id-token: write` and no `NODE_AUTH_TOKEN` set (an empty token would break OIDC). `NPM_CONFIG_PROVENANCE: true` attaches provenance. The npm Trusted Publisher is pinned to repo `LayZeeDK/angular-typechecker`, workflow filename `release.yml`, and environment `npm-publish`.
- `registry-url: https://registry.npmjs.org/` is set on `actions/setup-node` (required for npm to DETECT the OIDC trusted-publishing environment).
- The seed publish (`0.0.1`) used a one-time granular token; every subsequent release is OIDC-only.

**Verdaccio auth (e2e only):**
- `.verdaccio/config.yml` configures htpasswd auth so the e2e `ci-user` sign-up can mint a real publish token against the local registry. Local-only; no real credentials.

## Monitoring & Observability

**Error Tracking:**
- None (build-time tool).

**Logs:**
- `@nx/devkit` `logger` for advisory notices (warn/info/error) emitted by the executor adapter; the type-check report itself is written to raw stdout so GitHub problem-matcher `file:line:col` parsing stays intact. Detection lives in the pure `core/`; only the executor adapter touches `logger` and stdout.

## CI/CD & Deployment

**Hosting / distribution:**
- Public npm registry (`registry.npmjs.org`). The package is published (`nx release publish`) from `dist/packages/angular-typechecker/`. Release tag pattern `angular-typechecker@{version}` (`nx.json` `release.releaseTag.pattern`).
- Source + issues + homepage on GitHub (`github.com/LayZeeDK/angular-typechecker`), declared in `packages/angular-typechecker/package.json` (`repository.url`, `bugs.url`, `homepage`).

**CI Pipeline (GitHub Actions):**
- `.github/workflows/ci.yml` (`ci`) - the required merge gate. Jobs: `changes` (path-filter via `dorny/paths-filter`), `test` (6-cell OS x Node matrix: ubuntu 22/24/26, windows 24/26, macos 24), `e2e` (Linux/Node 24 tarball-install gate, serialized `--parallel=1`), `fallow` (code-quality audit, new-only), `format-lint` (Prettier + ESLint, uses `nrwl/nx-set-shas`), `act-compat`, `lint-workflows` (actionlint), `scoped-name-guard`, and the aggregate `ci` gate.
- `.github/workflows/release.yml` (`release`) - triggers on `angular-typechecker@*` tag push (+ manual dispatch); publishes via OIDC behind the `npm-publish` environment (Required Reviewer manual gate).
- CodeQL analysis (`Analyze (actions)`, `Analyze (javascript-typescript)`) - additional required status checks (referenced in `AGENTS.md`; default-branch ruleset). Managed by GitHub default setup (no in-repo workflow file).
- All action refs are 40-char SHA-pinned; `persist-credentials: false` on every checkout; top-level `contents: read`.

**Dependency automation:**
- Dependabot (`.github/dependabot.yml`) - `github-actions` ecosystem, weekly. Keeps the SHA-pinned action refs (and their `# vN` comments) fresh.

**Branch protection:**
- `main` is PR-only via an active "Default branch" ruleset with an empty bypass list (even the owner cannot push directly). Release tags are governed by a separate "Release tag" ruleset. (See `AGENTS.md`.)

## Local Registry (e2e install verification)

- Verdaccio `6.7.4` - launched via the `local-registry` target (`@nx/js:verdaccio`, `project.json`) bound to `127.0.0.1:4873`. Config `.verdaccio/config.yml`.
- The `angular-typechecker` package is served ONLY from local storage (no proxy) so the e2e round-trip exercises the freshly built dist, never the live npmjs copy; everything else proxies `https://registry.npmjs.org/`.
- e2e projects (`e2e/angular-typechecker-install-e2e`, `-cache-e2e`, `-matrix-e2e`) pack the local dist tarball and install it via npm / pnpm / yarn into fixture consumer workspaces. All three share the same tarball path, so they run serialized (`--parallel=1`).

## Environment Configuration

**Required env vars:**
- `NX_DAEMON: false` - set in CI jobs (parallel-safety / determinism).
- `NPM_CONFIG_PROVENANCE: true` - release publish (provenance attestation).
- `FALLOW_AUDIT_BASE: origin/main` - pins the fallow new-only audit base.
- `VERDACCIO_STORAGE_PATH` - runtime storage override for the local registry (e2e).
- No application runtime env vars; the executor takes options via the Nx schema (`tsConfig`, `includeDeps`, `maxWarnings`, `failFast`, `strict`) in `packages/angular-typechecker/src/executors/typecheck/schema.json`.

**Secrets location:**
- No stored secrets. Publish uses ephemeral OIDC identity minted per release run (no long-lived npm token in the repo or CI).

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None. (GitHub Release creation is done manually by a human after the release PR merges - see `AGENTS.md`; the CI publish job holds only `id-token: write`, never `contents: write`.)

---

*Integration audit: 2026-07-09*
