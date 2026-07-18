/**
 * ONE shared redaction helper (VER-02 / D-02) reused by the JSON + SARIF
 * integration specs, applied to a PARSED payload BEFORE every byte-stability
 * assertion. It maps the volatile tool `version` to a fixed placeholder so the
 * payload is comparable two-run (same process) AND across the OS x Node matrix,
 * WITHOUT ever asserting a literal version.
 *
 * Written to catch the volatile field structurally even though today the tool
 * version is the ONLY live one: the JSON payload omits `durationMs` (Phase-30 D-05)
 * and SARIF carries no duration/timestamp, so nothing else is volatile yet. Add
 * future volatile fields here, never as a literal assertion in a spec.
 *
 * - SARIF branch (payload has a `runs` array): each `runs[].tool.driver.version`
 *   maps to `'[version]'`.
 * - JSON branch: the top-level `version` maps to `'[version]'`.
 *
 * Redact the OBJECT (not the raw string) so vitest serializes it deterministically
 * for `toMatchSnapshot`. Every other field is preserved verbatim.
 */
const VERSION_PLACEHOLDER = '[version]';

export function redactVolatile(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object') {
    return payload;
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record['runs'])) {
    return {
      ...record,
      runs: record['runs'].map((run) => redactRunVersion(run)),
    };
  }

  return { ...record, version: VERSION_PLACEHOLDER };
}

/**
 * Maps a single SARIF `runs[]` entry's `tool.driver.version` to the placeholder,
 * preserving every other field. Any missing intermediate level short-circuits (the
 * entry is returned unchanged) so a malformed payload never throws in the helper.
 */
function redactRunVersion(run: unknown): unknown {
  if (run === null || typeof run !== 'object') {
    return run;
  }

  const runRecord = run as Record<string, unknown>;
  const tool = runRecord['tool'];

  if (tool === null || typeof tool !== 'object') {
    return runRecord;
  }

  const toolRecord = tool as Record<string, unknown>;
  const driver = toolRecord['driver'];

  if (driver === null || typeof driver !== 'object') {
    return runRecord;
  }

  return {
    ...runRecord,
    tool: {
      ...toolRecord,
      driver: {
        ...(driver as Record<string, unknown>),
        version: VERSION_PLACEHOLDER,
      },
    },
  };
}
