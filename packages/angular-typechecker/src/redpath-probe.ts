// THROWAWAY red-path proof for the fallow CI gate (Phase 11, HUMAN-UAT item 1).
// This file is intentionally unreachable dead code: nothing imports it and it is
// not an entry point. Expected: the `fallow` CI job detects it as an INTRODUCED
// unused finding (`--gate new-only --base origin/main`) and exits 1, turning the
// `ci` aggregate RED. This branch + its PR are deleted immediately after the proof.
export function redPathProbeUnusedExport(): number {
  return 42;
}
