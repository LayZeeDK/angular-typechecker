# Phase 32 - Deferred / out-of-scope items

## From 32-04 (DOC-01, README + CHANGELOG + docs tripwire)

### Stale CLI `--help` text: SARIF "lands in a later release"

- **File:** `packages/angular-typechecker/src/cli/parse-args.ts:87-88` (`HELP_TEXT`)
- **Issue:** the shipped `--help` output still reads
  `--format <fmt>  Output format: human (default), json, or sarif (sarif lands in
  a later release).` SARIF shipped in Phase 31, so this claim is now false and
  would ship in the 0.2.3 release, contradicting the README `## Machine-readable
  output` section this plan added.
- **Why deferred (not fixed here):** 32-04's `files_modified` is scoped to
  `README.md`, `CHANGELOG.md`, and `machine-readable-docs.spec.ts` only. Editing
  `parse-args.ts` is a different shipped surface with its own test coverage
  (`parse-args.spec.ts`, `standalone-cli-docs.spec.ts` flag drift-lock). The
  32-04 docs tripwire only checks the README for the stale clause, not the help
  text, so it does not fail on this.
- **Fix (small, one-liner):** drop the ` (sarif lands in a later release)` clause
  from `HELP_TEXT` so it reads `... json, or sarif.` Verify `nx test` (the
  parse-args + standalone-cli-docs specs are HELP_TEXT-derived but assert flag
  TOKENS, not the description prose, so no spec update is expected) + `nx format:check`.
- **Owner:** a follow-up quick task or the 32-03 additive-audit pass, before the
  v0.2.3 Release-PR is cut.
