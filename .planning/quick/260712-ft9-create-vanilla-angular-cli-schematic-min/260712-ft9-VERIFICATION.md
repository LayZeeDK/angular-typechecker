---
phase: quick-260712-ft9
verified: 2026-07-12T00:00:00Z
status: passed
score: 4/4 truths verified
---

# Quick Task 260712-ft9: Vanilla Nx-free Angular CLI ng-add discriminator -- Verification Report

**Task Goal:** Create a VANILLA (Nx-free) Angular CLI schematic minimal reproduction that
DISCRIMINATES whether the yarn-4 `ng add` no-autowire failure is a GENERAL
Angular-CLI-under-yarn bug or SPECIFIC to nx-based schematic factories -- producing a clear
verdict backed by captured G1/G2/G3 gate logs, with an npm control proving the vanilla
package is well-formed.
**Verified:** 2026-07-12
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Repro yields a CLEAR discriminating verdict (NX-SPECIFIC vs GENERAL) backed by G1/G3/[G3-CATCH] gate logs + marker outcome | VERIFIED | FINDINGS.md line 9 `## VERDICT: NX-SPECIFIC`; run.log yarn leg G1(53)+G3-OK(57)+marker(61) |
| 2 | npm control wires the SAME vanilla package (marker present under npm), proving well-formedness | VERIFIED | run.log npm leg: G1(91), `[G3] createSchematic(ng-add) OK`(95), `[MARKER npm] present`(99); marker file on disk (19 bytes) |
| 3 | Interpretation matrix applied: yarn wires => NX-SPECIFIC, no upstream issue warranted | VERIFIED | FINDINGS.md lines 25-33 matrix; top row (both wire, no G3-CATCH) selected |
| 4 | Verdict recorded in FINDINGS.md AND OPEN QUESTION in debug doc resolved | VERIFIED | FINDINGS.md `VERDICT: NX-SPECIFIC`; debug doc lines 303-330 `## OPEN QUESTION -- RESOLVED`; committed b513ac9 |

**Score:** 4/4 truths verified

### Per-must_have Detail (task's 6 explicit checks)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Package genuinely Nx-free; index.js imports NOTHING; factory is `exports.default`; no nx/@nx/devkit/convertNxGenerator/ora/chalk/log-symbols | PASS | `rg require\|import` in index.js = 0 matches; only "nx" hit is the descriptive string in collection.json ("No nx, no heavy deps"); `node -e typeof f.default==='function'` => `[OK]` |
| 2 | run.log yarn leg: G1 hasSchematics=true, G3 createSchematic OK (not G3-CATCH), marker present | PASS | run.log:53 `[G1] hasSchematics=true`; :57 `[G3] createSchematic(ng-add) OK`; :61 `[MARKER yarn] present`; marker file on disk |
| 3 | npm control leg also wired (marker present) => package well-formed | PASS | run.log:91/95/99; ws-npm marker on disk (19 bytes) |
| 4 | `[G3-CATCH]` did NOT fire in either leg | PASS | `rg -c "G3-CATCH" run.log` => 0 matches (exit 1) |
| 5 | Verdict is NX-SPECIFIC, logically supported by (2)+(3) | PASS | Nx-free schematic wires under BOTH yarn+npm => package well-formed => atc no-wire requires nx transitive chain => not general CLI bug. Inference sound. |
| 6 | Debug doc OPEN QUESTION resolved + todo item 2 annotated (upstream NOT warranted, USER-GATED, no issue filed) | PASS | debug doc:303-330 resolved section; todo:38-49 "Upstream ... NOT WARRANTED ... stays USER-GATED"; committed b513ac9 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vanilla-ng-add-repro/index.js` | Zero-import `exports.default` factory writing marker | VERIFIED | 8 lines, no requires; `exports.default = function` writing `/VANILLA_NG_ADD_RAN.txt` |
| `vanilla-ng-add-repro/collection.json` | `ng-add` schematic -> `./index` | VERIFIED | `"ng-add": { "factory": "./index" }` |
| `vanilla-ng-add-repro/package.json` | `schematics: ./collection.json`, zero deps | VERIFIED | 5 lines; name/version/schematics only; NO dependencies block |
| `vanilla-ng-add-repro/vanilla-repro.mjs` | Verdaccio harness w/ 127.0.0.1 SAFETY gate | VERIFIED | line 118 `if (!url.startsWith('http://127.0.0.1:')) throw` |
| `vanilla-ng-add-repro/FINDINGS.md` | Verdict + gate/marker evidence | VERIFIED | VERDICT + verbatim gate lines + matrix + method |
| `vanilla-ng-add-repro/run.log` | Captured gate logs for both legs | VERIFIED | 106 lines; both legs' G1/G3/marker; matches SUMMARY quotes |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Vanilla pkg (Verdaccio) | fresh yarn-4 + npm workspaces | `npm publish` -> `ng add` against 127.0.0.1 | WIRED | run.log:4-26 publish; both legs run `ng add vanilla-ng-add-repro` |
| Patched G1/G2/G3/[G3-CATCH] gates | marker file + verdict | gate-by-gate stderr discriminates throw vs clean createSchematic | WIRED | `[G3] ... OK` both legs; 0 `[G3-CATCH]`; markers land; verdict recorded |

### Anti-Patterns Found

None. No debt markers (TBD/FIXME/XXX) in the deliverable or the two committed in-repo docs.

### Notes (non-blocking)

- The npm-leg quote block in SUMMARY.md (and FINDINGS.md) omits the `CREATE VANILLA_NG_ADD_RAN.txt (19 bytes)` line that IS present in run.log:97. Cosmetic omission; does not affect the verdict (marker presence is the load-bearing signal and is quoted).
- The published tarball (run.log:7-12) bundles `run.log` + `vanilla-repro.mjs` alongside the 3 package files. Harmless -- `ng add` resolves only package.json/collection.json/index.js; does not affect discrimination.
- Plan `files_modified` lists `yarn-run.log`/`npm-run.log`; the executor teed a single combined `run.log` instead, which the plan's Task-2 verify explicitly permits ("or a single combined log"). Not a gap.

### Soundness of the discriminating inference

SOUND. The logic holds: a schematic importing NOTHING (no nx transitive chain) wires cleanly
under yarn 4 AND under npm. The npm control rules out "malformed repro" as the reason yarn
wired. Therefore the angular-typechecker yarn no-wire cannot be a general Angular-CLI probe
defect -- it necessarily requires the `@nx/devkit -> nx -> ora -> log-symbols -> chalk`
transitive chain that only nx's packaging drags in under yarn's hoist. The "file an upstream
angular/angular-cli issue" framing is correctly refuted; any nx-under-yarn filing stays
USER-GATED and none was filed.

### Gaps Summary

None. All four must-have truths verified against the actual artifacts (package files,
run.log, FINDINGS.md, in-repo debug doc + todo). The discriminating result is captured in
unambiguous gate logs and is reproducible via the committed harness reference.

---

_Verified: 2026-07-12_
_Verifier: Claude (gsd-verifier)_
