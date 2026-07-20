---
phase: 28-shipped-tarball-e2e-real-clone-uat
reviewed: 2026-07-16T00:00:00Z
depth: deep
files_reviewed: 19
files_reviewed_list:
  - .github/workflows/ci.yml
  - libs/test-util/src/lib/cli-e2e.ts
  - libs/test-util/src/lib/verdaccio-global-setup.ts
  - libs/test-util/src/index.ts
  - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts
  - e2e/angular-typechecker-cli-e2e/project.json
  - e2e/angular-typechecker-cli-e2e/vitest.config.mts
  - e2e/angular-typechecker-cli-e2e/tsconfig.json
  - e2e/angular-typechecker-cli-e2e/tsconfig.spec.json
  - e2e/angular-typechecker-cli-e2e/src/global-setup.ts
  - e2e/angular-typechecker-cli-e2e/src/cli-exit-codes.e2e.spec.ts
  - e2e/angular-typechecker-cli-e2e/src/cli-exit-codes-yarn.e2e.spec.ts
  - e2e/angular-typechecker-cli-e2e/src/cli-exit-codes-pnpm.e2e.spec.ts
  - e2e/angular-typechecker-cli-e2e/src/nx-free-runtime.e2e.spec.ts
  - e2e/angular-typechecker-cli-e2e/fixtures/cli-consumer/package.json
  - e2e/angular-typechecker-cli-e2e/fixtures/cli-consumer/tsconfig.json
  - e2e/angular-typechecker-cli-e2e/fixtures/cli-consumer/tsconfig.spec.json
  - e2e/angular-typechecker-cli-e2e/fixtures/cli-consumer/src/app.component.ts
  - e2e/angular-typechecker-cli-e2e/fixtures/cli-consumer/src/app.component.spec.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-07-16T00:00:00Z
**Depth:** deep
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Deep, cross-file review of the v0.2.2 standalone-CLI verification phase: a new
`angular-typechecker-cli-e2e` project (4 e2e specs + fixture), the shared `runShim`
test helper, the `mintCiToken` connection-refusal retry in the Verdaccio global-setup,
and the new `e2e-windows` CI job (plus the GUARD-01f wiring spec).

The load-bearing security-relevant items all hold up:

- **CI command-injection:** The `e2e-windows` job passes the project name through the
  `PROJECT` env var and only ever references `"$PROJECT"` inside `run:` steps -- never
  `${{ matrix.project }}` inline in a shell. A full scan found the only `${{ }}` in a
  `run:` step is the pre-existing (byte-unchanged) `nx-set-shas` git-SHA outputs in
  `format-lint`. No PR-metadata reaches a shell.
- **SHA pinning:** All five `uses:` references are exactly 40-char commit SHAs;
  `persist-credentials: false` on every checkout; top-level `contents: read`, no job
  re-grants write. The workflow uses the safe `pull_request` trigger.
- **Linux jobs untouched:** The ci.yml diff is confined to the added `e2e-windows` job
  and its entry in the `ci` aggregate `needs` list. The `discover`/`e2e` jobs and
  GUARD-01b's contract are byte-for-byte unchanged.
- **`shell: bash`** is pinned on all four `e2e-windows` `run:` steps, so `-p "$PROJECT"`
  quoting is identical to the Linux `e2e` job (windows-latest would default to pwsh).
- **`mintCiToken` retry** is correctly bounded (10 attempts, 500ms fixed backoff,
  per-attempt fresh 10s `AbortSignal.timeout`); only ECONNREFUSED/ECONNRESET (top-level
  or `.cause`) is retried, every other failure -- including the non-2xx and no-token
  throws and abort timeouts -- rethrows immediately. No infinite loop, no swallowed real
  error.
- **`runShim`** reads the literal `result.status` (correctly via `?? 1`, so a clean exit
  0 stays 0 -- not coerced with `||`), sets `maxBuffer` to 20 MB so the tail `TSxxxx`
  code is not ENOBUFS-truncated, and applies `shell: true` only on Windows. No spec ever
  routes `atc` through `npx` (the `atc@0.0.6` supply-chain hazard), and every assertion
  is by exit CODE / diagnostic CODE (`TS2322`) plus the 127.0.0.1 publish safety
  re-assertion.

No blockers. Two warnings (a latent Windows-path robustness gap in `runShim`, and an
unused fixture "spec leaf" whose own comment claims coverage that no test performs) and
two info items follow.

## Narrative Findings (AI reviewer)

### Warnings

#### WR-01: `runShim` uses `shell: true` on Windows without quoting the shim path -- breaks on any path segment containing a space

**File:** `libs/test-util/src/lib/cli-e2e.ts:47-53`

**Issue:** On Windows the helper spawns the `.cmd` shim with `shell: true`. When
`shell: true`, Node.js does NOT quote the `file` argument -- it concatenates
`file + ' ' + args.join(' ')` and hands the whole string to `cmd.exe /d /s /c "..."`.
The `shim` path is built from `consumerDir` (a `mkdtemp` dir under `os.tmpdir()`). If any
segment of that path contains a space (e.g. a dev machine whose temp lives under
`C:\Users\First Last\...`, or a custom `TEMP`), `cmd.exe` sees the shim path split at the
space and the CLI never launches. The failure is loud, not silent -- `cmd` returns a
non-zero "not recognized" status and the code/stdout assertions fail rather than
false-greening -- but it breaks the exact Windows leg this phase adds. It does not fire on
the GitHub `windows-latest` runner (temp is `C:\Users\runneradmin\...` / `D:\a\_temp`, no
spaces) or the current dev profile, which is why it is a latent gap rather than an active
failure.

**Fix:** Quote the shim so `cmd` treats it as one token under `shell: true`:

```ts
const spawnTarget = isWin ? `"${shim}"` : shim;

const result = spawnSync(spawnTarget, args, {
  cwd: consumerDir,
  env,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
  shell: isWin,
});
```

(`args` stay fixed literals, so no additional escaping is required.)

#### WR-02: Fixture ships an unused "spec leaf" (`tsconfig.spec.json` + `app.component.spec.ts`) whose comment claims coverage no e2e assertion performs

**File:** `e2e/angular-typechecker-cli-e2e/fixtures/cli-consumer/src/app.component.spec.ts:3-7` (also `.../tsconfig.spec.json`)

**Issue:** `app.component.spec.ts` documents itself as a "Clean SECOND leaf (spec
tsconfig) ... the shipped bin can check it as a distinct leaf (a two-path union / spec
cell)." Every e2e spec (`cli-exit-codes`, `-yarn`, `-pnpm`, `nx-free-runtime`) only ever
invokes the bin with `-c tsconfig.json` (or the nonexistent `does-not-exist.json`). A
grep confirms no spec references `tsconfig.spec.json`, `app.component.spec`, or
`checkedComponent`. So the "spec cell" the fixture advertises is never exercised: the two
files ship dead, and the comment asserts a verification cell that does not exist -- a
misleading coverage claim in a phase whose entire purpose is verification.

**Fix:** Either wire the claimed cell (add one `runShim(tmp, 'angular-typechecker',
['-c', 'tsconfig.spec.json'], env)` assertion to at least the npm baseline spec so the
"second leaf" is genuinely type-checked end-to-end), or delete `tsconfig.spec.json` +
`app.component.spec.ts` and drop the "distinct leaf / spec cell" language from the
component comment. Do not leave the comment asserting coverage that no test provides.

### Info

#### IN-01: `runShim` maps spawn/signal failures to exit code 1 and discards `result.error`

**File:** `libs/test-util/src/lib/cli-e2e.ts:47-58`

**Issue:** `code: result.status ?? 1` returns `1` whenever `status` is null -- i.e. a
failed spawn (ENOENT), a `maxBuffer` overflow, or a signal-terminated process
(`result.signal`) -- and `result.error` is never inspected. In those cases the helper
reports a normal "verdict-fail" exit 1 for what is actually an infrastructure failure. In
practice the exit-1 (RED) assertions also require `stdout.toContain('TS2322')`, so a
spawn failure with empty output still fails loudly rather than false-greening, but the
reported code is misleading and a maintainer debugging a Windows spawn failure gets no
signal.

**Fix:** Surface the spawn error explicitly, e.g. `if (result.error) { throw result.error; }`
before returning, or include `result.error?.message` in the returned `stdout` so a
spawn/signal failure is distinguishable from a genuine exit 1.

#### IN-02: `runNpx` builds its command by string interpolation instead of array args

**File:** `e2e/angular-typechecker-cli-e2e/src/cli-exit-codes.e2e.spec.ts:79`

**Issue:** `execSync(\`npx angular-typechecker ${args.join(' ')}\`)` interpolates
`args` into a shell string, unlike `runShim`, which correctly passes an args array to
`spawnSync`. It is safe today because `runNpx` is only ever called with fixed literal
flag/path pairs, but the pattern is a shell-injection shape: a future caller passing an
arg with a space or shell metacharacter would have it re-parsed by the shell. Prefer the
array form for consistency with `runShim` and to remove the latent shape.

**Fix:** Use `execFileSync('npx', ['angular-typechecker', ...args], { ... })` (or
document at the call site that args must remain fixed literals).

---

_Reviewed: 2026-07-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
