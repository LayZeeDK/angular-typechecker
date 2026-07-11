---
status: partial
phase: 24-real-oss-scaffolded-e2e-additive-only-audit-docs
source: [24-VERIFICATION.md]
started: 2026-07-11T12:05:00Z
updated: 2026-07-11T12:05:00Z
---

## Current Test

[awaiting human testing -- run gate #1 (ngx-leaflet) first, then gate #2 (realworld-angular)]

## Tests

### 1. ACV-01 real-clone gate #1 -- bluehalo/ngx-leaflet @ 818e9ae55240b570397ede5a15cb4d466785abdc (app ngx-leaflet-demo + lib ngx-leaflet)

Pack the shipped dist tarball, `ng add angular-typechecker` (from the tarball), plant per-leaf errors (app component TS2322, app spec TS2345, lib component TS2554), run `ng run ngx-leaflet-demo:typecheck` and `ng run ngx-leaflet:typecheck`. Full reproducible steps in `24-ACV-01-UAT.md`.

expected: ng add auto-wires a typecheck target into BOTH projects (two-element tsConfig array, no stray nx.json). Clean baseline: both targets exit 0. Planted: the app target reports TS2322 + TS2345 but NOT TS2554; the lib target reports TS2554 but NEITHER app code. No ERR_REQUIRE_ESM / infrastructure error.
result: [pending]

### 2. ACV-01 real-clone gate #2 -- realworld-angular/realworld-angular @ 9e3528ff27bad5fedaefb879ccc4aaf4717b137b (single application, app-only) -- run AFTER gate #1

`ng add angular-typechecker`, plant app-component TS2322 + app-spec TS2345, run `ng run realworld-angular:typecheck`. Full steps in `24-ACV-01-UAT.md`.

expected: ng add wires a typecheck target into the single application (leaves [tsconfig.app.json, tsconfig.spec.json], no stray nx.json). Clean baseline exits 0. Planted: the target reports BOTH TS2322 and TS2345 (build leaf + spec leaf both checked) and exits non-zero; no ERR_REQUIRE_ESM / infrastructure error.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
