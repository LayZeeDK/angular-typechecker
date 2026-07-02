import { ConsumerGeneratorComponent } from './consumer-generator.component';

// Phase 15 GE2E fixture: the SPEC LEAF of the un-wired multi-leaf consumer-generator
// workspace (D-01). This *.spec.ts is the DISTINCT file set that tsconfig.spec.json
// INCLUDES and tsconfig.lib.json EXCLUDES -- so a diagnostic that lands here proves
// the solution tsconfig's spec-leaf reference was walked (WALK-01). Committed CLEAN;
// the generator-e2e spec injects a STATEMENT producing a DISTINCT code (TS2345) into
// a per-run TMP copy so a single token in stdout cannot false-prove "both leaves
// walked" (Pitfall 4).
//
// The fixture installs NO test-runner package (only @angular/* + nx + typescript),
// so the test globals are declared inline here to keep the file self-contained and
// the committed baseline green under `types: ["node"]`. Type-checking the spec file
// set is the point; running it is not (the executor never runs the tests).
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect<T>(actual: T): { toBe(expected: T): void };

describe('ConsumerGeneratorComponent', () => {
  it('constructs with the expected label', () => {
    const component = new ConsumerGeneratorComponent();
    const label: string = component.label;
    expect(label).toBe('angular-typechecker generator e2e');
  });
});
