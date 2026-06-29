# Skip-gate probe (throwaway)

This is a `.planning/`-only change used to prove the Phase-7 ci.yml path-aware
skip-gate (REL-02 DX) on a real PR: a planning-only diff must cause the `changes`
filter to output `code=false`, skip the heavy `test`/`e2e` matrix jobs, yet still
report the required `ci` check green (no merge-button deadlock).

This PR is NOT meant to merge -- it is closed after the skip-gate behavior is
observed. Delete the branch afterward.
