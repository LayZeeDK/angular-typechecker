// Generate one single-run SARIF per angular-typechecker:typecheck consumer and
// merge them into ONE multi-run file for the CI `code-scanning` job (MULTI-01).
//
// Design B: this script folds the per-project generate loop (D-03) into the merge
// (D-02). For each discovered project it runs the SHIPPED standalone CLI from
// dist -- `node dist/.../cli/bin.js -c <tsConfig...> --format sarif` -- captures
// its byte-pure SARIF stdout, stamps `run.automationDetails.id =
// angular-typecheck/<project>` (note the literal prefix `angular-typecheck`, NOT
// the package name), and concatenates the runs into one file. The per-run id
// becomes that run's Code Scanning category, so the upload needs NO `category`
// input (a single category across multiple runs is rejected by GitHub).
//
// Run from the repo ROOT so `artifactLocation` URIs stay repo-relative and Code
// Scanning maps each alert to a source file. Exit-tolerant per project (the
// `|| true` + `[ -s file ]` analogue): exit 0/1 still writes a valid payload and
// is merged; exit 2 / empty / unparseable stdout is skipped. When ZERO runs are
// collected, NOTHING is written, so the job's `[ -s ]` produced-guard sets
// `produced=false` and the upload skips.
//
// Merge is plain JSON concatenation -- the reporter already emitted a valid SARIF
// 2.1.0 envelope, so `node-sarif-builder` is deliberately NOT imported here.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { listTypecheckProjects } from './list-typecheck-projects.mjs';

const BIN = 'dist/packages/angular-typechecker/src/cli/bin.js';
const OUTPUT = 'angular-typechecker.sarif';

/**
 * Merge single-run SARIF docs into one multi-run envelope, stamping each run's
 * `automationDetails.id`. Pure: no I/O, no CLI spawn.
 *
 * @param {{ name: string, doc: { version?: string, $schema?: string, runs?: unknown[] } }[]} entries
 * @returns {{ version?: string, $schema?: string, runs: unknown[] } | null}
 *   The merged envelope, or `null` when no entry contributed a run.
 */
export function mergeSarifRuns(entries) {
  const runs = [];
  let envelope;

  for (const { name, doc } of entries) {
    const run = (doc.runs ?? [])[0];

    // A doc with no first run contributes nothing (the per-project skip).
    if (!run) {
      continue;
    }

    run.automationDetails = { id: `angular-typecheck/${name}` };
    runs.push(run);

    // Preserve version + $schema from the FIRST valid doc.
    envelope ??= { version: doc.version, $schema: doc.$schema };
  }

  // Zero runs -> null so the CLI writes NOTHING and the upload skips.
  if (runs.length === 0) {
    return null;
  }

  return { ...envelope, runs };
}

/**
 * Run the shipped CLI once per discovered project (from the repo root) and
 * collect each project's parsed single-run SARIF doc, skipping empty/unparseable
 * output.
 *
 * @param {string} root Repo root (also the spawn cwd).
 * @returns {{ name: string, doc: unknown }[]}
 */
function collectEntries(root) {
  const entries = [];

  for (const { name, tsConfig } of listTypecheckProjects(root)) {
    const args = [BIN];

    for (const leaf of tsConfig) {
      args.push('-c', leaf);
    }

    args.push('--format', 'sarif');

    // Fixed arg array, NO `shell: true`, NO interpolated PR data (no command
    // injection). stdout = byte-pure SARIF; stderr = advisory noise. Do NOT
    // throw on a non-zero exit (the `|| true` analogue): exit 0/1 still writes
    // the payload, exit 2 writes empty stdout.
    const result = spawnSync(process.execPath, args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const stdout = (result.stdout ?? '').trim();

    // Empty stdout (exit 2 / infra failure) -> skip (the `[ -s file ]` analogue).
    if (stdout.length === 0) {
      continue;
    }

    let doc;

    try {
      doc = JSON.parse(stdout);
    } catch {
      // Unparseable stdout -> skip rather than feed an invalid run.
      continue;
    }

    entries.push({ name, doc });
  }

  return entries;
}

// CLI entry: generate + merge + write, run from the repo root.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const merged = mergeSarifRuns(collectEntries(root));

  if (merged) {
    writeFileSync(OUTPUT, JSON.stringify(merged));
  }
}
