// Post-process fallow's multi-run SARIF for the CI `code-scanning` job: stamp each
// run's `automationDetails.id`, give every location-deficient `locations` ENTRY a
// region-less fallback location, and fingerprint the results it synthesizes one
// for. Run from the repo ROOT (it reads/writes `fallow.sarif` relative to cwd).
//
// WHY the location fallback (the bug this script exists to fix): the `fallow audit`
// DUPES sub-analysis emits its `fallow/code-duplication` result with the `locations`
// key OMITTED ENTIRELY -- in the pinned 3.6.0 AND in 3.9.1 (latest), so "just
// upgrade" is not a fix, and `fallow config-schema` exposes no sarif/location/anchor
// knob. GitHub then rejects the WHOLE multi-run upload with
// `locationFromSarifResult: expected at least one location`, so ONE file-less clone
// group costs every fallow alert, including the sibling dead-code run's properly
// located ones. It fired twice in live CI (runs 30004691193 and 29772473095: zero
// fallow analyses exist at those commits). Note the upload step prints
// `Successfully uploaded results` FIRST -- the rejection lands asynchronously during
// "Waiting for processing to finish".
//
// WHY per ENTRY rather than per result: GitHub derives an alert's location from
// `locations[0]`, so a MIXED array whose FIRST entry lacks a uri is still
// location-deficient from GitHub's point of view even though a later entry is
// usable. Mapping every entry covers all three deficiency shapes -- `locations` key
// absent (the only OBSERVED shape), `locations: []`, and an entry lacking
// `physicalLocation` -- plus the mixed case, while leaving every usable entry
// byte-untouched. The two unobserved shapes and the mixed case are cheap insurance
// against a future fallow renderer change.
//
// WHY a repo-level anchor rather than the real file: that SARIF result carries NO
// file information at all. The clone group's instance paths exist only in fallow's
// `--format json` output, so no SARIF post-processor can recover them. A repo-level
// anchor is the only option -- never dropping the finding (a dropped finding is
// worse than the current loud failure).
//
// WHY region-less is safe: GitHub's docs mark `region.startLine` Required, but a
// region-less location is empirically ACCEPTED and back-filled to line 1 col 1 --
// proven in this repo by the Phase 35 `ATC90002` proof alert landing at
// `tools/sarif-proof-fixture/tsconfig.json` with `start_line: 1`. Only
// `physicalLocation` + `artifactLocation.uri` are actually enforced.
//
// WHY a synthesized fingerprint: fallow emits ONE result per clone group and omits
// `partialFingerprints` on exactly these file-less results, so after anchoring, N
// clone groups would share an identical ruleId AND an identical region-less
// location. With no fingerprint GitHub falls back to a location-derived hash that
// ignores `message.text`, collapsing all N into ONE alert -- a dropped finding
// wearing a disguise, which is precisely what the never-drop rule above forbids.
// This mirrors the OTHER half of the shipped reporter's own file-less fallback
// (core/sarif-report.ts anchors a file-less record at its tsconfig, region-less,
// AND writes a self-computed `fingerprintOf` hash so co-located file-less records
// stay distinct). Same newline-joined-tuple recipe, over the only fields that
// distinguish two co-located file-less fallow results. It is byte-stable across
// runs for unchanged input and changes only when the finding itself changes
// (fallow's clone-group message carries the line/instance counts) -- the same churn
// characteristic the reporter's line/column-bearing tuple already accepts, and far
// better than a silent collapse.
//
// WHY `.fallowrc.jsonc` is the anchor: it is the file a maintainer edits
// (`duplicates.ignore`) to act on a clone group, mirroring fallow's own convention
// of anchoring project-level findings at `package.json` -- the manifest you would
// edit. It is committed and always present. Keep it in the ONE constant below:
// whether GitHub accepts a DOTFILE uri is REAL-CI-ONLY unproven (every region-less
// uri proven accepted so far is non-dotted), so the fallback swap to `package.json`
// stays one load-bearing line (the spec pins the expected value, so update it too).
//
// WHY the `automationDetails` overwrite is LOAD-BEARING: fallow sets its own
// `fallow/audit/dupes` id on the dupes run, and GitHub derives the Code Scanning
// category from the text BEFORE the final `/`. Leaving fallow's id would yield
// category `fallow/audit` -- a NEW (analysis_key, category, environment) tuple, i.e.
// the ORPHANED-CONFIG hazard of AGENTS.md GATE-02 step 0, which can permanently
// block PRs. `fallow/<index>` keeps the category `fallow` for every run (every
// existing analysis reports exactly that: 98/98 as of 2026-07-25), so the scheme is
// FROZEN: this is an effect-equivalent port of the inline `node -e` it replaces. The
// upload therefore passes NO `category` input -- a single category across multiple
// runs is rejected by GitHub.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FALLBACK_URI = '.fallowrc.jsonc';
const SARIF_FILE = 'fallow.sarif';
// Versioned like the shipped reporter's `atcFingerprint/v1`, and like GitHub's own
// `primaryLocationLineHash/v1`, so the tuple can be revised without silently
// re-keying every existing alert.
const FINGERPRINT_KEY = 'normalizedFallowFingerprint/v1';

/**
 * Stamp `automationDetails.id = fallow/<index>` on every run, give every
 * location-deficient `locations` entry a region-less fallback location, and
 * fingerprint every result that needed one. Mutates and returns `doc`. Pure: no I/O.
 *
 * @param {{ runs?: { automationDetails?: { id: string }, results?: { ruleId?: string, message?: { text?: string }, partialFingerprints?: Record<string, string>, locations?: { physicalLocation?: { artifactLocation?: { uri?: string } } }[] }[] }[] }} doc
 * @returns {typeof doc} The same doc, normalized.
 */
export function normalizeFallowSarif(doc) {
  for (const [index, run] of (doc.runs ?? []).entries()) {
    run.automationDetails = { id: `fallow/${index}` };

    for (const result of run.results ?? []) {
      const locations = result.locations ?? [];
      // `every` is vacuously true on an empty array, so the length check is what
      // catches `locations: []` and the absent key; `every` (not `some`) is what
      // catches the MIXED array GitHub would still reject on `locations[0]`.
      const located = locations.length > 0 && locations.every(hasUri);

      if (!located) {
        // Never drop a result, and never clobber a usable entry: each deficient
        // entry is replaced individually, so a mixed array keeps its real
        // uri/region alongside the fallback.
        const anchored = locations.map((location) =>
          hasUri(location)
            ? location
            : { physicalLocation: { artifactLocation: { uri: FALLBACK_URI } } },
        );

        result.locations =
          anchored.length > 0
            ? anchored
            : [
                {
                  physicalLocation: { artifactLocation: { uri: FALLBACK_URI } },
                },
              ];

        // `??=` so a fingerprint fallow DID supply is never overwritten.
        result.partialFingerprints ??= {
          [FINGERPRINT_KEY]: fingerprintOf(result),
        };
      }
    }
  }

  return doc;
}

/**
 * True when a `locations` entry carries the one thing GitHub's
 * `locationFromSarifResult` actually enforces: a non-empty
 * `physicalLocation.artifactLocation.uri`.
 *
 * @param {{ physicalLocation?: { artifactLocation?: { uri?: string } } }} location
 * @returns {boolean} Whether GitHub would accept this entry as located.
 */
function hasUri(location) {
  return (
    typeof location?.physicalLocation?.artifactLocation?.uri === 'string' &&
    location.physicalLocation.artifactLocation.uri.length > 0
  );
}

/**
 * A deterministic `sha256` hex fingerprint over the only two fields that
 * distinguish two co-located file-less fallow results, newline-joined so field
 * boundaries are unambiguous. Mirrors `core/sarif-report.ts`'s `fingerprintOf`
 * (which joins code + uri + message + line + column); the uri/line/column are
 * constant across every result this is applied to, so they would add nothing.
 *
 * @param {{ ruleId?: string, message?: { text?: string } }} result
 * @returns {string} Hex sha256 of the newline-joined tuple.
 */
function fingerprintOf(result) {
  const tuple = [result.ruleId ?? '', result.message?.text ?? ''].join('\n');

  return createHash('sha256').update(tuple, 'utf8').digest('hex');
}

// CLI entry: read + normalize + write back in place, run from the repo root.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const doc = normalizeFallowSarif(
    JSON.parse(readFileSync(SARIF_FILE, 'utf8')),
  );

  writeFileSync(SARIF_FILE, JSON.stringify(doc));
}
