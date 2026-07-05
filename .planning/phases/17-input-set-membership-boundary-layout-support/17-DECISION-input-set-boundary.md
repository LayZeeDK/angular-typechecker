# Decision: `suppressedInGraph` semantics + coverage-incomplete verdict (hardened R1-plus)

**Decided:** 2026-07-05 (locked 2026-07-06) via a 3-board Opus advisory process.
**Scope:** resolves the D-06/D-07 residual left open in `17-CONTEXT.md` — what
`suppressedInGraph` counts and how a dropped first-party diagnostic maps to the verdict,
especially for a suppressed transitive out-of-project first-party `.ts`.
**Status:** LOCKED. This file is authoritative for that question; `17-CONTEXT.md` D-06/D-07
carry the operative rules; downstream agents implement from both.

## The question

Replacing directory-containment with input-set membership (`inputTs` = union of walked
leaves' declared `readConfiguration().rootNames` `.ts` paths), SB-04 splits the silent
`suppressedCount` into `suppressedThirdParty` + `suppressedInGraph`, and criterion 4 requires
`suppressedInGraph > 0` to be non-clean. The gap: a transitive dependency error and a declared
mandate file dropped by a canonicalization/junction asymmetry present identically at
suppression time — what counts, and does a genuine dep error flip the host verdict?

## Process (3 boards, 16 independent Opus analyses)

1. **Anchored board** (given R1/R2/OTHER as candidates): 6 members → R1 hard floor. Central
   premise: (i) genuine transitive dep and (ii) asymmetry-dropped declared file are
   indistinguishable → fail-closed on both. Compromise: R1 + actionable file paths + defer
   finer split to SB-08 + amend C4.
2. **Blind board** (NO candidates given; design from source): 6 members INDEPENDENTLY
   re-derived R1 ("R1-plus"). R2 and the anchored round's three-way split did NOT re-emerge
   from any lens. New refinements surfaced: dual-identity membership, severity-mirror,
   wire-both-verdict-fns, `suppressedInGraphFiles` advisory, FM-9 (template-abort) fold,
   narrow base-dir.
3. **Reconciliation + empirical-verification board** (4 members, given both prior boards):
   verified the load-bearing claims against installed `typescript@6.0.3` /
   `@angular/compiler-cli@22.0.4` source and hardened two real holes.

## Source-verified findings (reconciliation board)

- **Dual-identity is SOUND for declared `.ts`/`.d.ts`** (two independent verifications with
  line citations): `readConfiguration` rootNames come from `parseJsonConfigFileContent().fileNames`
  (`@angular/compiler-cli` chunk-6ZBSJK4S.js:495) via `getNormalizedAbsolutePath` — no realpath,
  case-preserving (`typescript.js` :43937, :8893); the program sets
  `SourceFile.fileName = normalizePath(rootName) = rootName` for a root file (`typescript.js`
  :128918-128920, :129257; the realpath branch :129153 fires only for `preserveSymlinks` +
  node_modules `.d.ts`). So `raw(F) === raw(R)` for a declared root before realpath → a
  transient realpath throw that drops a root from `inputTs` is RECOVERED via the `raw` form
  and reported as a real error. A raw collision between a transitive dep and a declared root
  is impossible (path is identity) and fail-safe even hypothetically (over-report).
- **FRAGILITY (why tripwires):** the invariant is undocumented, and Angular attaches template
  diagnostics to NON-rootName files (`makeTemplateDiagnostic`, chunk-QY6RCOQ6.js:5439/5502):
  external `templateUrl` → `.html`; indirect inline → synthetic `"<ts> (X template)"`;
  `.ngtypecheck.ts` shims are not rootNames. Input-set membership ALONE would misclassify a
  clean host's own external/indirect-template NG8xxx → false coverage-incomplete, or a
  suppressed external-template ERROR = **false pass**. → RETAIN the (narrowed) base-dir keep
  clause + branch-4a; classify a base-kept non-rootName first-party diagnostic as in-graph.
- **Severity-mirror has a silent-pass hole UNLESS late-bound:** `finalize()` never receives
  `maxWarnings`. Baking "warnings count only when `maxWarnings` set" in core assumes unset →
  drops an in-graph Warning → then `evaluateResult({maxWarnings:0})` passes = silent false
  pass (verified against `evaluate-result.ts`). Fix: per-category counts on `CoreResult`,
  gated in `evaluateResult` with the real `maxWarnings`. Suggestion/Message exclusion is
  always safe.
- **FM-9 fold is necessary but insufficient:** folding `templateCheckAborted` (NG3004) closes
  the whole-program TCB-abort blind spot; but a **walk first-party leaf that resolves to zero
  files** (`walk-references.ts` `reason: 'zero-root-names'`, advisory-only) compiles nothing →
  a clean sibling makes the solution read clean = the milestone's own value failing silently.
  Feed it into coverage-incomplete. Residual partial-shim-priming without NG3004 is
  v22.0.4-pinned, guarded by the RES-02/HARD-01 drift probes.
- **CLAIM 2 = additive; CLAIM 5 = HARD default (unanimous).** Surface-only-by-default cannot
  be made charter-safe: the rare unrecoverable declared drop is, by construction, the residue
  of failed membership detection and is not separately guardable.

## The locked design ("hardened R1-plus")

See `17-CONTEXT.md` D-02 (dual-identity), D-03/D-04/D-04a (keep-rule + retain base/4a),
D-05/D-06/D-07 (split counter, late-bound severity, verdict wiring, FM-9, zero-rootNames leaf),
D-09/D-09a (test scope + mandatory tripwire fixtures). One-line summary:

> Keep by dual-identity input-set membership (raw + realpath) OR narrowed base-dir OR
> branch-4a; split the counter into `suppressedThirdParty` (quiet) + per-category in-graph
> counts; gate coverage-incomplete late in `evaluateResult` + `toExitCode` (HARD default,
> exit 1, distinct `outcome`); fold NG3004 and the zero-rootNames leaf into coverage-incomplete;
> ship the tripwire fixtures.

## What did NOT survive

- **R2** (keep the host green on a dropped first-party diagnostic): rejected by all boards —
  no public-TS-API signal distinguishes a genuine dep from an asymmetry-dropped declared file
  at suppression time; a surface-only default silent-passes the unrecoverable declared drop.
- **The three-way non-flipping `suppressedDependency` counter** (anchored round's OTHER): did
  not re-emerge from any blind lens; a failing-severity first-party drop must flip the verdict.

## Deferred to SB-08 (urgent)

- The true root-cause fix: per-file `getSemanticDiagnostics(declaredSourceFile)` instead of
  the whole-program all-getter, so undeclared transitive diagnostics are never gathered
  (removes the FM1 residual at the source; touches the D-16 all-getter — out of Phase-17 scope).
- An opt-in strict/lenient toggle (lenient = surface-only for teams that accept the risk).
