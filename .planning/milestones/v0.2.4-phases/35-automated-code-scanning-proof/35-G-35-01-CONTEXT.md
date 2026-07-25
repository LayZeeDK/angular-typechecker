# Gap G-35-01 -- Context (locked decisions for plan-phase 35 --gaps)

**Gathered:** 2026-07-21
**Status:** Ready for gap planning
**Source gap:** `35-UAT.md` `## Gaps` -> G-35-01 (NOT in `35-VERIFICATION.md` `gaps_found`; fed explicitly).
**Discussion mode:** auto-decision-locking (user-confirmed region shape 2026-07-21).

<domain>
## Task Boundary

Fix G-35-01: the SARIF reporter emits file-less (tool / project-level) diagnostics with NO
`locations`, which GitHub Code Scanning rejects for the WHOLE file
(`locationFromSarifResult: expected at least one location`), so the `code-scanning-proof` job
never ingests and the assert step is skipped. This REVERSES locked decision D-01
(`sarif-report.ts:28/202`, "a file-less record becomes a no-location result"). It is a
PUBLISHED-SARIF-OUTPUT change in production code (`sarif-report.ts`) -- outside phase 35's
additive (D-04) boundary -- hence a deliberate gap-closure plan, not an inline patch.

In scope: attach an ingestible fallback location to every file-less SARIF result; update the D-01
doc-comments; update the two specs + regenerate the two SARIF snapshots; re-prove ingestion in real
CI. OUT of scope: any change to the JSON reporter, the shared `DiagnosticRecord`, the fingerprint,
the assert script, the proof fixture, or the diagnostic-synthesis `file: undefined` shape.
</domain>

<decisions>
## Implementation Decisions (LOCKED -- do not revisit)

### D1 -- Fallback URI = relativized `result.tsConfigPath`
For EVERY file-less result (`record.file === null`), attach a location whose
`physicalLocation.artifactLocation.uri` is `relativizePath(result.tsConfigPath, pathBase)`.
`CoreResult.tsConfigPath: string` is always present (`run-typecheck.ts:60`), always exists in the
repo, and is the honest owner of all three file-less cases (ATC90001 zero-root-names, ATC90002
missing-reference, file-less global TS e.g. TS2318). `relativizePath` is already exported from
`diagnostic-record.ts` -- import it (this is the ONE result-level path the reporter relativizes;
per-diagnostic paths still come from `toDiagnosticRecord`). For the multi-tsconfig / solution-walk
case, the representative `tsConfigPath` (basePath) is the correct, always-present owner; a
per-diagnostic owner path is explicitly NOT warranted (YAGNI).

### D2 -- SARIF-only; confine to `sarif-report.ts` PASS-2
Do NOT touch `DiagnosticRecord` or `json-report.ts`. JSON keeps `file: null` (a JSON consumer is
not GitHub). The shared projection + the JSON snapshot stay byte-identical. D-01 stays TRUE for the
record; only the SARIF EMISSION gains a fallback location.

### D3 -- Do NOT give the synthesized diagnostics a real `.file`
The `file: undefined` shape of `synthesizeFilelessError` (diagnostic-codes.ts:122-135) is
load-bearing: the boundary filter keeps a diagnostic unconditionally ONLY when it is file-less
(never-suppress / no false-PASS). The fallback lives in the reporter, out-of-band -- never by
mutating the diagnostic.

### D4 -- Fingerprint unchanged
`fingerprintOf` still hashes the TRUE record (file-less -> empty-string sentinels), so
`atcFingerprint/v1` and thus alert identity do NOT churn. The synthetic location must NOT feed the
fingerprint. This falls out for free because the record is not changed.

### D5 -- Applies to ALL file-less results
Not just the ATC tool codes: file-less global TS (TS2318) breaks ingestion too. Uniform rule:
`record.file === null` -> attach the tsconfig fallback location.

### D6 -- Region shape: REGION-LESS whole-file location (user-confirmed 2026-07-21)
Supply `fileUri` ALONE (no `startLine`/region). Verified against `node-sarif-builder`
(`sarif-result-builder.js`): `if (options.fileUri)` emits
`locations:[{physicalLocation:{artifactLocation:{uri}}}]`; a region is added only when `startLine`
is passed. Region-less is honest (these are project/config-level, not line-specific), is the
smallest diff (supply `fileUri` in the existing file-less else-branch of the conditional spread),
and GitHub supports path-level alerts. NOTE: region-less acceptance is the ONLY sub-decision whose
GitHub acceptance is real-CI-only-provable; the conservative alternative (a complete synthetic
region `line 1, col 1`) was explicitly considered and REJECTED in favor of the honest form -- the
`code-scanning-proof` job is the authoritative confirmation.

### D7 -- Stays a 0.2.4 patch (additive charter holds)
vs the last RELEASED version (0.2.3) the old file-less SARIF was REJECTED by its primary consumer
(GitHub), so making it ingestible is a FIX, not a breaking API change. The v0.3.0 escape hatch
governs the plugin's API surface (executor options / barrel exports), not the SARIF payload shape.
Part of the same unreleased 0.2.4 SARIF work (Phase 33 already reshaped SARIF at 0.2.4). No version
bump beyond the already-derived 0.2.3 -> 0.2.4 patch; no release cut (human-gated Release-PR).
</decisions>

<specifics>
## Blast radius (verified 2026-07-21)

1. **Production:** `packages/angular-typechecker/src/core/sarif-report.ts` PASS-2 file-less branch
   (~lines 202-211): in the `record.file === null` case supply
   `fileUri: relativizePath(result.tsConfigPath, pathBase)` (region-less). Add the `relativizePath`
   import from `./diagnostic-record`. Update the D-01 module-header comment (line ~28) and the
   inline `// D-01:` comment (line ~202) to state: file-less records now carry a whole-file fallback
   location on the tsconfig, still NEVER dropped.
2. **Unit spec** `sarif-report.spec.ts`: flip the assertion in the test
   `'never drops a file-less diagnostic -- emits it as a no-location result...'` (~line 361-373,
   `expect('locations' in fileless).toBe(false)`) to expect the file-less result now carries a
   location whose `artifactLocation.uri` is the relativized fixture `tsConfigPath` (the fixture
   already sets `tsConfigPath: 'D:/ws/proj/libs/x/tsconfig.lib.json'`, ~line 162) with NO region.
   Regenerate `__snapshots__/sarif-report.spec.ts.snap`.
3. **Integration spec** `machine-reporters-sarif.integration.spec.ts`: flip the two "NO locations"
   assertions -- global-diagnostics TS2318 (`(result.locations?.length ?? 0) === 0`, ~line 327-330)
   and solution-style-all-missing ATC90002 (`result.locations?.length ?? 0).toBe(0)`, ~line
   431-439) -- to expect a single whole-file location on the (relativized) tsconfig. Regenerate
   `__snapshots__/machine-reporters-sarif.integration.spec.ts.snap`. The Phase-35 proof-fixture
   drift-lock describe (family-tag + level tuples) is UNAFFECTED.
4. **No change:** `tools/ci/assert-code-scanning.mjs` (checks category + family tag + severity, not
   locations), the proof fixture, `json-report.ts` + its snapshot, `diagnostic-record.ts`,
   `diagnostic-codes.ts`, the barrel. Scan `render-report.spec.ts` + `merge-sarif.spec.ts` (matched
   a `locations` grep) but they are expected to pass through unchanged.
5. **Proof:** after landing, re-push PR #55 and confirm the `code-scanning-proof` job goes GREEN in
   real CI (the SARIF is ingested; all four (family tag, severity) alert tuples land under the
   `angular-typecheck-proof` category). This is the phase Nyquist point -- provable ONLY in real CI.

## Verification gates (every one must pass before the phase closes)
`nx test angular-typechecker` (unit, incl. regenerated sarif-report snapshot) + `nx integration`
(incl. regenerated machine-reporters-sarif snapshot + the proof drift-lock) + the 3 tsc typechecks
+ `nx run-many -t lint` (maxWarnings:0) + `nx format:check` + `npm run fallow` + `npm run cve-lite`
+ `nx build`. Then the real-CI `code-scanning-proof` green (authoritative).
</specifics>

<canonical_refs>
## Canonical References

- `35-UAT.md` `## Gaps` -> G-35-01 (the discovered defect + symptom + root cause).
- `packages/angular-typechecker/src/core/sarif-report.ts` (D-01 site: header line ~28, PASS-2 line ~202).
- `packages/angular-typechecker/src/core/diagnostic-record.ts` (`relativizePath` export; `toDiagnosticRecord`).
- `packages/angular-typechecker/src/core/run-typecheck.ts:60` (`CoreResult.tsConfigPath: string`).
- `node_modules/node-sarif-builder/dist/lib/sarif-result-builder.js` (`initSimple` region/fileUri behavior).
- `.claude/skills/spike-findings-angular-typechecker` (SARIF/reporter blueprint, if relevant).
</canonical_refs>
