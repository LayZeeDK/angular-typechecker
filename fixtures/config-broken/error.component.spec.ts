import { ConfigBrokenErrorComponent } from './error.component';

// Config-resolution SPEC fixture (Plan 02-02, EXE-02 / D-07b). This *.spec.ts
// carries its OWN deliberate spec-file type error so the integration test can
// prove that a tsconfig.spec.json is type-checked -- the named differentiator
// vs a build check (a build does not compile the specs). Do NOT add @ts-nocheck.
//
// The planted error is a TS2322 in the spec body: a `string` value assigned to a
// `number`-typed binding. It lives ONLY in this spec file (not in the
// component), so its presence in the diagnostics proves the spec source itself
// was checked. The file deliberately avoids the Jasmine/Vitest globals
// (describe/it/expect) so the spec carries EXACTLY the one planted TS2322 and no
// incidental TS2304 "cannot find name" noise.
export function buildPlantedSpecError(
  component: ConfigBrokenErrorComponent,
): number {
  // The single planted spec-file type error: a string is not assignable to the
  // declared number return type.
  const plantedSpecError: number = 'not a number from the spec'; // TS2322

  return component.count + plantedSpecError;
}
