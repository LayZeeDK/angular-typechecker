// ADDITIVE-ONLY BARREL TRIPWIRE (ACP-02 / RF-02). This file is TYPE-ONLY and never
// ships. It locks the PUBLIC programmatic API surface (`src/index.ts`) so a removed
// or renamed export fails `tsc --noEmit` LOUDLY instead of silently shipping a
// breaking change under the v0.2.1 additive-only charter.
//
// WHY A DRIFT FILE (not a runtime `.spec.ts`): three of the five barrel exports are
// TYPE-ONLY (`CoreOptions`, `CoreResult`, `SkippedReference`) -- a runtime spec can
// only observe the two VALUE exports (`runTypecheck`, `TypecheckInfrastructureError`).
// Importing all five here and referencing each makes the compiler enforce the WHOLE
// set: rename/remove any of them in the barrel and this file fails to compile (a
// removed export errors TS2305 at its import specifier).
//
// WHY IT NEVER SHIPS AND NEVER BREAKS THE PRODUCTION BUILD: it is never imported by
// production code, is NOT in the `files` whitelist that gates the tarball, and
// compiles ONLY under `tsconfig.drift.json` (run by the `typecheck` target's
// `tsc --noEmit -p .../tsconfig.drift.json`). It is EXCLUDED from `tsconfig.lib.json`
// and `tsconfig.spec.json`, so `nx build` and `nx test` never see it. Mirrors the
// established `*.drift.ts` idiom (`compiler-cli-types.drift.ts`,
// `extended-catalog.drift.ts`).

import { runTypecheck, TypecheckInfrastructureError } from './index';
import type { CoreOptions, CoreResult, SkippedReference } from './index';

// The two VALUE exports: a removed/renamed value errors TS2305 at the import above;
// the `void` references keep them from tripping no-unused (mirrors the shim drift
// file's `void` idiom).
void runTypecheck;
void TypecheckInfrastructureError;

// The three TYPE-ONLY exports: a tuple pins all three so a removed/renamed type
// errors at its exact slot. Consumed via a `void` expression so the alias is used
// (mirrors compiler-cli-types.drift.ts's `void (0 as unknown as Probe)` idiom).
type BarrelTypeExports = [CoreOptions, CoreResult, SkippedReference];

void (0 as unknown as BarrelTypeExports);
