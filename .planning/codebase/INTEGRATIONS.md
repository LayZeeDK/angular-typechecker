# External Integrations

**Analysis Date:** 2026-06-30

**Scope note (read first):** `angular-typechecker` is a build-tool library - an
Nx executor that statically type-checks Angular projects. It has **no runtime
external integrations**: no databases, no HTTP/REST APIs, no authentication
providers, no third-party SDKs, no caching services, no monitoring backends,
and no incoming or outgoing webhooks. It reads tsconfig + source files from the
local filesystem and runs the Angular compiler in-process. The only "integration
boundaries" that exist are: (1) the Nx executor contract, (2) the
dynamically-imported ESM `@angular/compiler-cli` engine, (3) npm publish via
GitHub Actions OIDC with provenance, and (4) the GitHub Actions CI pipeline.
This document records those accurately and does not invent integrations that do
not exist.

## APIs & External Services

**Build-tool contracts (in-process, no network):**
- **Nx executor contract** - The package registers an executor via `executors.json` (`packages/angular-typechecker/executors.json`). Nx `require()`s the compiled `executor.js`; the default export is `async (options, context: ExecutorContext) => Promise<{ success: boolean }>` (`packages/angular-typechecker/src/executors/angular-typecheck/executor.ts`). Options are validated against `schema.json` (`cli: "nx"`).
  - SDK/Client: `@nx/devkit` `23.0.1` (pinned `dependency`) for `ExecutorContext` + `logger`.
  - Auth: none.
- **`@angular/compiler-cli` (the type-check engine)** - The single runtime value-import of the compiler, loaded lazily and memoized via dynamic `await import('@angular/compiler-cli')` in `packages/angular-typechecker/src/core/compiler-loader.ts` (ESM-only package, reached from the CommonJS executor). The engine calls `readConfiguration` and `performCompilation` (`packages/angular-typechecker/src/core/run-typecheck.ts`).
  - SDK/Client: `@angular/compiler-cli` `^22.0.0` (runtime `peerDependency`, supplied by the consumer).
  - Auth: none.
- **`typescript`** - Loaded dynamically alongside the compiler (`loadTypescript()` in `run-typecheck.ts`) for `ts.sortAndDeduplicateDiagnostics`, `ts.flattenDiagnosticMessageText`, `ts.sys.realpath`, diagnostic category counting.
  - Auth: none. Runtime `peerDependency` `>=6.0.0 <6.1.0`.

There are no network API calls anywhere in the plugin source.

## Data Storage

**Databases:**
- None.

**File Storage:**
- Local filesystem only. The executor reads a tsconfig (resolved relative to the workspace root, see `normalize-options.ts`) and the project's source files; it emits nothing (no-emit type-check). Report output is written to raw `process.stdout` (`executor.ts`), never to a file.

**Caching:**
- No external cache service. Result caching is provided by **Nx's local/remote task cache**: the `angular-typecheck` target is declared `cache: true` with explicit `inputs` (incl. `externalDependencies: ["typescript", "@angular/compiler-cli"]`) and empty `outputs` in `nx.json` `targetDefaults`. Vitest/build/lint targets are likewise Nx-cached. This is Nx infrastructure, not a third-party integration.
- Local tooling caches (gitignored, not integrations): `.angular/cache/`, `.nx/`, `.fallow/cache/`, `node_modules/.vite/`.

## Authentication & Identity

**Auth Provider:**
- None in the product. The library performs no authentication and stores no credentials.
- The ONLY auth in the repository is in CI publish: **GitHub Actions OIDC** mints a short-lived identity that the npm registry validates as a Trusted Publisher (tokenless). See CI/CD below.

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry/Datadog/etc. Errors surface through Nx's `logger` (`@nx/devkit`) and process exit codes.
  - Infrastructure failures (the Angular compiler failed to RUN, code-500 `UNKNOWN_ERROR_CODE`) are caught and reported via `logger.error` -> `{ success: false }` (`executor.ts`, `run-typecheck.ts`'s `TypecheckInfrastructureError`).
  - A TCB-generation Fatal (NG3004) that suppressed template diagnostics emits a loud `logger.warn` (`executor.ts`).

**Logs:**
- The diagnostic report is written to raw `process.stdout` (deliberately NOT `logger.info`, to keep byte-deterministic codeframes and GitHub problem-matcher `file:line:col` parsing intact - `executor.ts` D-04). Meta/warning messages use `@nx/devkit` `logger`.

## CI/CD & Deployment

**Hosting / distribution:**
- Published to the **public npm registry** as `angular-typechecker` (`registry.npmjs.org`). `publishConfig`: `{ provenance: true, access: "public" }`.
- Source hosted on **GitHub**: `LayZeeDK/angular-typechecker` (`repository.url` in `packages/angular-typechecker/package.json`, `directory: packages/angular-typechecker`).

**CI Pipeline (GitHub Actions):**
- `.github/workflows/ci.yml` (`ci`) - cross-OS / multi-Node test + e2e + quality gate. Jobs: `changes` (path-filter via `dorny/paths-filter`), `test` (6-cell matrix: ubuntu Node 22/24/26, windows 24/26, macos 24), `e2e` (Linux Node 24, tarball-install + cache + matrix e2e projects, pnpm `11.9.0`), `fallow` (dead-code/complexity audit, new-only gate), `act-compat` (`act` `v0.2.89` validate + dry-run), `lint-workflows` (`actionlint` `1.7.7`), and the aggregate `ci` gate (the required status check). Triggers: `pull_request` + push to `main`. Top-level `permissions: contents: read`. All actions are 40-char SHA-pinned.
- `.github/workflows/release.yml` (`release`) - hardened npm publish. Triggers on tag push `angular-typechecker@*` (+ `workflow_dispatch`). Job `publish` uses `environment: npm-publish` (manual-approval gate with a Required Reviewer), `permissions: id-token: write` only. Publishes via `npx nx release publish` with `NPM_CONFIG_PROVENANCE: true` and **no auth token** (tokenless OIDC; the npm Trusted Publisher is pinned to repo + workflow filename `release.yml` + environment `npm-publish`). `registry-url: https://registry.npmjs.org/` is required for npm to detect the OIDC trusted-publishing environment.
- `.github/dependabot.yml` - weekly `github-actions` ecosystem updates (keeps the SHA-pinned action references fresh).
- `.actrc` - maps `act` runner images to `catthehacker/ubuntu:act-24.04` for local workflow dry-runs.

**Release mechanics:**
- `nx release` with `version.conventionalCommits: true` and `releaseTag.pattern: angular-typechecker@{version}` (`nx.json`). `release.git` is `{ commit: true, tag: false, push: false }` and `changelog.workspaceChangelog.createRelease: false` - the local cut creates NO tag and pushes nothing; the release goes through a Release PR, and the tag is created by hand on the merge commit (full procedure documented in `AGENTS.md`).

## Environment Configuration

**Required env vars:**
- Product: none.
- CI test/e2e jobs: `NX_DAEMON: false`.
- CI publish job: `NPM_CONFIG_PROVENANCE: true`; OIDC `id-token: write` permission; the npm auth-token env var is deliberately left UNSET (an empty value would break OIDC).
- CI fallow job: `FALLOW_AUDIT_BASE: origin/main` (pins the new-only audit base).

**Secrets location:**
- No long-lived publish secret. Publishing uses GitHub Actions OIDC (short-lived, minted per run) validated by the npm Trusted Publisher. CI checkouts set `persist-credentials: false` so checkout credentials are never persisted. (`0.0.1` used a one-time bypass-2FA token for the seed publish; all subsequent releases are OIDC-only - documented in `release.yml`.)

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

---

*Integration audit: 2026-06-30*
