// Post-process fallow's multi-run SARIF for the CI `code-scanning` job: stamp each
// run's `automationDetails.id` AND give every location-deficient result a
// region-less fallback location. Run from the repo ROOT (it reads/writes
// `fallow.sarif` relative to cwd) so `artifactLocation` URIs stay repo-relative.
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
// `physicalLocation` + `artifactLocation.uri` are actually enforced. This also
// mirrors the shipped reporter's own file-less fallback (core/sarif-report.ts
// anchors a file-less record at its tsconfig, region-less).
//
// WHY `.fallowrc.jsonc` is the anchor: it is the file a maintainer edits
// (`duplicates.ignore`) to act on a clone group, mirroring fallow's own convention
// of anchoring project-level findings at `package.json` -- the manifest you would
// edit. It is committed and always present. Keep it in the ONE constant below:
// whether GitHub accepts a DOTFILE uri is REAL-CI-ONLY unproven (every region-less
// uri proven accepted so far is non-dotted), so the fallback swap to `package.json`
// stays a one-line change.
//
// WHY the `automationDetails` overwrite is LOAD-BEARING: fallow sets its own
// `fallow/audit/dupes` id on the dupes run, and GitHub derives the Code Scanning
// category from the text BEFORE the final `/`. Leaving fallow's id would yield
// category `fallow/audit` -- a NEW (analysis_key, category, environment) tuple, i.e.
// the ORPHANED-CONFIG hazard of AGENTS.md GATE-02 step 0, which can permanently
// block PRs. `fallow/<index>` keeps the category `fallow` for every run (all 98
// existing analyses report exactly that), so the scheme is FROZEN: this is the
// verbatim port of the inline `node -e` it replaces. The upload therefore passes NO
// `category` input -- a single category across multiple runs is rejected by GitHub.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FALLBACK_URI = '.fallowrc.jsonc';
const SARIF_FILE = 'fallow.sarif';

/**
 * Stamp `automationDetails.id = fallow/<index>` on every run and give every
 * location-deficient result a region-less fallback location. Mutates and returns
 * `doc`. Pure: no I/O.
 *
 * @param {{ runs?: { automationDetails?: { id: string }, results?: { locations?: { physicalLocation?: { artifactLocation?: { uri?: string } } }[] }[] }[] }} doc
 * @returns {typeof doc} The same doc, normalized.
 */
export function normalizeFallowSarif(doc) {
  for (const [index, run] of (doc.runs ?? []).entries()) {
    run.automationDetails = { id: `fallow/${index}` };

    for (const result of run.results ?? []) {
      // One condition covers all three deficiency shapes -- `locations` key
      // absent (the only OBSERVED shape), `locations: []`, and an entry lacking
      // `physicalLocation` -- because GitHub enforces `physicalLocation` +
      // `artifactLocation.uri` and all three fail it. The two unobserved shapes
      // are cheap insurance against a future fallow renderer change.
      const located = (result.locations ?? []).some(
        (location) =>
          typeof location?.physicalLocation?.artifactLocation?.uri ===
            'string' &&
          location.physicalLocation.artifactLocation.uri.length > 0,
      );

      // Never drop a result. A MIXED array (at least one usable entry) is left
      // untouched -- an unobserved shape, so keep the blast radius minimal.
      if (!located) {
        result.locations = [
          { physicalLocation: { artifactLocation: { uri: FALLBACK_URI } } },
        ];
      }
    }
  }

  return doc;
}

// CLI entry: read + normalize + write back in place, run from the repo root.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const doc = normalizeFallowSarif(
    JSON.parse(readFileSync(SARIF_FILE, 'utf8')),
  );

  writeFileSync(SARIF_FILE, JSON.stringify(doc));
}
