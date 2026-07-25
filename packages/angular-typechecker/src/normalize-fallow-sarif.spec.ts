import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { findWorkspaceRoot, validateSarif } from '@workspace/test-util';

// Regression guard for the fallow file-less SARIF upload bug. The `fallow audit`
// DUPES sub-analysis emits `fallow/code-duplication` with the `locations` key
// OMITTED, and GitHub rejects the WHOLE multi-run upload with
// `locationFromSarifResult: expected at least one location` -- so one file-less
// clone group cost every fallow alert twice in live CI (runs 30004691193,
// 29772473095). This proves the REAL tools/ci/normalize-fallow-sarif.mjs anchors
// every location-deficient `locations` ENTRY at `.fallowrc.jsonc` (region-less)
// WITHOUT dropping a result or clobbering an already-located entry, fingerprints
// every result it anchors so co-located clone groups cannot collapse into a single
// alert, and keeps the frozen `fallow/<index>` id scheme that pins the Code
// Scanning category to `fallow`.
//
// It drives the real script as a SUBPROCESS (execFileSync) against a hermetic
// mkdtempSync temp dir holding a fixture `fallow.sarif` -- the script's only input
// -- and asserts on the file it rewrites. It does NOT import
// `normalizeFallowSarif` or any tools/ci module by any mechanism: a
// pathToFileURL/file:// dynamic import of a cross-project .mjs fails vitest's
// module runner (it cannot resolve a file URL outside this project's root), and a
// relative `../../../tools/ci/...` import fails @nx/enforce-module-boundaries at
// maxWarnings:0 (a required lint gate). So the spec imports ONLY node builtins +
// vitest + @workspace/test-util, exactly like merge-sarif.spec.ts.

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);
const normalizeScript = join(
  workspaceRoot,
  'tools',
  'ci',
  'normalize-fallow-sarif.mjs',
);

interface SarifLocation {
  physicalLocation?: {
    artifactLocation?: { uri?: string };
    region?: {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    };
  };
}

interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations?: SarifLocation[];
  partialFingerprints?: Record<string, string>;
}

interface SarifRun {
  tool: {
    driver: { name: string; version?: string; informationUri?: string };
  };
  automationDetails?: { id: string };
  results: SarifResult[];
}

interface SarifDoc {
  version: string;
  $schema: string;
  runs: SarifRun[];
}

// The real captured multi-run shape. A factory (not a shared const) so the
// in-memory input can be deep-compared against the output without any risk of the
// two aliasing.
function createFixture(): SarifDoc {
  return {
    version: '2.1.0',
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    runs: [
      // Run 0 -- dead-code: a fully located result that MUST survive untouched.
      {
        tool: { driver: { name: 'fallow', version: '3.9.1' } },
        automationDetails: { id: 'fallow/audit/dead-code' },
        results: [
          {
            ruleId: 'fallow/unused-file',
            level: 'error',
            message: { text: 'File is never imported' },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: 'tools/ci/merge-sarif.mjs' },
                  region: {
                    startLine: 7,
                    startColumn: 1,
                    endLine: 7,
                    endColumn: 12,
                  },
                },
              },
            ],
            partialFingerprints: { fallowFingerprint: 'abc123' },
          },
        ],
      },
      // Run 1 -- dupes, verbatim from the failing CI run: fallow's own
      // `fallow/audit/dupes` id (which the fix must OVERWRITE), no
      // `tool.driver.rules`, and a single result with `locations` ABSENT and no
      // `partialFingerprints`. This is the shape GitHub rejects.
      {
        tool: {
          driver: {
            name: 'fallow',
            version: '3.9.1',
            informationUri: 'https://github.com/fallow-rs/fallow',
          },
        },
        automationDetails: { id: 'fallow/audit/dupes' },
        results: [
          {
            ruleId: 'fallow/code-duplication',
            level: 'warning',
            message: { text: 'Clone group 1 (44 lines, 2 instances)' },
          },
        ],
      },
      // Run 2 -- the two UNOBSERVED deficiency shapes GitHub would also reject:
      // an empty `locations` array, and an entry lacking `physicalLocation`.
      // Their ruleId AND (post-anchor) location are identical, so they are also
      // the pair that proves the synthesized fingerprints keep them distinct.
      {
        tool: { driver: { name: 'fallow', version: '3.9.1' } },
        results: [
          {
            ruleId: 'fallow/code-duplication',
            level: 'warning',
            message: { text: 'Empty locations array' },
            locations: [],
          },
          {
            ruleId: 'fallow/code-duplication',
            level: 'warning',
            message: { text: 'Location without physicalLocation' },
            locations: [{}],
          },
        ],
      },
      // Run 3 -- a MIXED array. GitHub reads the alert location from
      // `locations[0]`, so a first entry lacking a uri still kills the WHOLE
      // upload even though a later entry is usable. The usable entry must
      // survive byte-unchanged beside the anchored one. It also carries a
      // fallow-supplied fingerprint, which the `??=` must NOT overwrite.
      {
        tool: { driver: { name: 'fallow', version: '3.9.1' } },
        results: [
          {
            ruleId: 'fallow/code-duplication',
            level: 'warning',
            message: { text: 'Mixed locations array' },
            partialFingerprints: { fallowFingerprint: 'def456' },
            locations: [
              {},
              {
                physicalLocation: {
                  artifactLocation: { uri: 'tools/ci/merge-sarif.mjs' },
                  region: {
                    startLine: 20,
                    startColumn: 1,
                    endLine: 20,
                    endColumn: 9,
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('normalize-fallow-sarif.mjs anchors file-less fallow results', () => {
  it('gives every location-deficient result a region-less .fallowrc.jsonc anchor, preserves located results, and keeps the frozen fallow/<index> id scheme', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'normalize-fallow-sarif-'));

    try {
      const sarifFile = join(tempRoot, 'fallow.sarif');

      writeFileSync(sarifFile, JSON.stringify(createFixture()));

      // The script's only input is the file it reads from cwd -- no stub CLI needed.
      execFileSync('node', [normalizeScript], {
        cwd: tempRoot,
        encoding: 'utf8',
      });

      const rewritten = readFileSync(sarifFile, 'utf8');
      const output = JSON.parse(rewritten) as SarifDoc;

      // 1. The file-less dupes finding SURVIVES, anchored at .fallowrc.jsonc with
      // NO region (GitHub back-fills it to line 1 col 1).
      const dupesResults = output.runs[1].results;

      expect(dupesResults).toHaveLength(1);
      expect(dupesResults[0].ruleId).toBe('fallow/code-duplication');
      expect(
        dupesResults[0].locations?.[0]?.physicalLocation?.artifactLocation?.uri,
      ).toBe('.fallowrc.jsonc');
      expect(
        dupesResults[0].locations?.[0]?.physicalLocation,
      ).not.toHaveProperty('region');

      // 2. An already-located result is NOT clobbered -- its uri, region, and
      // partialFingerprints survive byte-for-byte.
      expect(output.runs[0].results[0]).toEqual(
        createFixture().runs[0].results[0],
      );

      // 3. THE assertion that guards the bug: EVERY entry of EVERY result now
      // has a physicalLocation.artifactLocation.uri, the one condition GitHub's
      // `locationFromSarifResult` enforces. Per ENTRY, not just `locations[0]`,
      // because a MIXED array (run 3) whose FIRST entry is deficient is what
      // GitHub actually reads -- and `locations[0]` is asserted explicitly so a
      // regression to a `.some()`-style per-result predicate fails here.
      // Combined with the never-drop count below this covers run 2's two
      // unobserved shapes and run 3's mixed one.
      expect(output.runs.flatMap((run) => run.results)).toHaveLength(5);

      for (const run of output.runs) {
        for (const result of run.results) {
          expect(
            result.locations?.[0]?.physicalLocation?.artifactLocation?.uri,
          ).toBeTruthy();

          for (const location of result.locations ?? []) {
            expect(
              location.physicalLocation?.artifactLocation?.uri,
            ).toBeTruthy();
          }
        }
      }

      // 3b. The mixed array keeps BOTH entries: the deficient one is anchored in
      // place and the usable one survives byte-unchanged (never clobbered, never
      // dropped, never reordered).
      const mixedResult = output.runs[3].results[0];

      expect(mixedResult.locations).toEqual([
        { physicalLocation: { artifactLocation: { uri: '.fallowrc.jsonc' } } },
        createFixture().runs[3].results[0].locations?.[1],
      ]);

      // 3c. Every anchored result ends up WITH a fingerprint, and co-located
      // ones are DISTINCT. Without this, run 2's two results share a ruleId AND
      // (post-anchor) the exact same region-less location, so GitHub's
      // location-derived fallback fingerprint -- which ignores `message.text` --
      // would collapse them into ONE alert: a dropped finding wearing a
      // disguise, which is what the never-drop rule forbids.
      const anchoredFingerprints = [
        ...output.runs[1].results,
        ...output.runs[2].results,
        mixedResult,
      ].map((result) => JSON.stringify(result.partialFingerprints));

      for (const fingerprint of anchoredFingerprints) {
        expect(fingerprint).toBeTruthy();
      }

      expect(new Set(anchoredFingerprints).size).toBe(
        anchoredFingerprints.length,
      );

      // 3d. `??=`, not `=`: a fingerprint fallow already supplied on a
      // location-deficient result survives untouched.
      expect(mixedResult.partialFingerprints).toEqual({
        fallowFingerprint: 'def456',
      });

      // 4. Orphan-tuple guard: the id scheme is FROZEN at `fallow/<index>` --
      // including overwriting fallow's own `fallow/audit/dupes`, which would
      // otherwise make GitHub derive category `fallow/audit` (a NEW
      // (analysis_key, category, environment) tuple; AGENTS.md GATE-02 step 0).
      expect(output.runs.map((run) => run.automationDetails?.id)).toEqual([
        'fallow/0',
        'fallow/1',
        'fallow/2',
        'fallow/3',
      ]);

      // 5. Envelope regression guard ONLY. validateSarif CANNOT detect this bug --
      // `result.locations` is optional in SARIF 2.1.0, so the validator returns
      // valid: true on the exact payload GitHub rejects. It must never stand in
      // for assertion 3.
      const { valid, errors } = validateSarif(rewritten);

      expect(valid, errors).toBe(true);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
