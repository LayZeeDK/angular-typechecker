# Milestones: angular-typechecker

A historical record of shipped versions. For current work see `.planning/ROADMAP.md`.

---

## v0.0.1 -- Complete Angular type-check, decoupled from build/test

**Shipped:** 2026-06-29
**Phases:** 1-7 (8 incl. inserted Phase 5.1) | **Plans:** 29 | **Commits:** 255
**Timeline:** 2026-06-27 -> 2026-06-29 (3 days)
**Package source:** ~1,162 LOC TypeScript (33 `.ts` files incl. tests)
**Published:** `angular-typechecker@0.0.1` and `@0.0.2` (npm, live, tokenless OIDC + SLSA v1 provenance)

### Delivered

The first publishable slice: a single Nx executor (`angular-typecheck`) that runs
the complete Angular compiler diagnostic set (TypeScript + template type-check +
extended NG8xxx) with no emit, decoupled from building or testing -- Nx-native,
cacheable, and runnable per project against any project type.

### Key Accomplishments

1. **Complete unconditional diagnostic engine** -- a framework-agnostic `runTypecheck` runs `@angular/compiler-cli` whole-program no-emit with a custom all-getter gatherer modeled on `@angular/build`, surfacing TS + template type-check + extended NG8xxx diagnostics in one pass (NG8109 where `ngc`'s default gatherer short-circuits), asserted against the v13->v22 diagnostic catalog.
2. **CommonJS executor that loads ESM compiler-cli** -- a sub-50-line Nx adapter ships as CommonJS built with `module: nodenext` and reaches the ESM-only compiler via `await import()` with no `import()`->`require()` downlevel (proven by a built-bytes GATE A assertion through the packed tarball).
3. **Correct project-boundary filtering + modes + human output** -- realpath-normalized absolute-path filtering (pnpm-symlink + case-insensitive-FS safe), report-all/fail-fast modes, `--max-warnings`, and `formatDiagnostics` output; ESLint module-boundary enforcement locking the core-vs-adapter split.
4. **Nx-cacheable target with a lying-cache guard** -- `cache:true`/`outputs:[]` with correct per-tsconfig + dependency-source inputs, proven by a dependency-error-busts-cache HIT/MISS test (green -> HIT -> inject a transitive type error -> MISS + new diagnostic + non-zero exit).
5. **Supply-chain-hardened npm publish** -- 0.0.1 and 0.0.2 published live via the registered npm Trusted Publisher with NO token and SLSA v1 provenance; hardened `release.yml`, `SECURITY.md`, and tarball audits (`publint` + `attw --pack`).
6. **5-project-type e2e matrix + cross-OS CI + Release-PR flow** -- validated across application/local-lib/buildable-lib/publishable-lib/spec-tsconfig against the installed tarball (incl. pnpm + mixed-case), gated by a Node 22/24/26 x Linux/Windows/macOS matrix; `main` switched to a PR-only Release-PR workflow with a clean public changelog.

### Audit

PASSED (`.planning/milestones/v0.0.1-MILESTONE-AUDIT.md`): 34/34 requirements
SATISFIED, 8/8 phases verified, 0 cross-phase integration gaps, 4/4 E2E flows
complete (with recorded live-run evidence), Nyquist COMPLIANT across every phase.

### Known deferred items at close

None (no open debug/quick-task/UAT artifacts; tech-debt items are documentation
drift / INFO-level only -- see the audit report).

### Archives

- `.planning/milestones/v0.0.1-ROADMAP.md` -- full phase detail
- `.planning/milestones/v0.0.1-REQUIREMENTS.md` -- requirements with outcomes
- `.planning/milestones/v0.0.1-MILESTONE-AUDIT.md` -- audit report
- `.planning/milestones/v0.0.1-phases/` -- phase execution history (PLANs, SUMMARYs, VERIFICATIONs, etc.)
