import { LocalLibComponent } from './local-lib.component';

// TEST-03 matrix fixture: the SPEC-TSCONFIG project type (the 5th type, D-07).
// This *.spec.ts file is the DISTINCT file set that tsconfig.spec.json includes
// and the app/lib targets EXCLUDE -- so the `angular-typecheck-spec` sibling
// target on local-lib is a genuinely separate check baseline. Committed clean; the
// matrix spec injects a deliberate TS2322 HERE (not the component) so the injected
// error provably lands in the spec file set, proving the spec tsconfig is checked.
//
// The fixture installs NO test-runner package (only @angular/* + nx + typescript),
// so the test globals are declared inline here to keep the file self-contained and
// the committed baseline green under `types: ["node"]`. Type-checking the spec file
// set is the point; running it is not (the executor never runs the tests).
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect<T>(actual: T): { toBe(expected: T): void };

describe('LocalLibComponent (spec-tsconfig type)', () => {
  it('constructs with the expected label', () => {
    const component = new LocalLibComponent();
    const label: string = component.label;
    expect(label).toBe('angular-typechecker matrix local lib');
  });
});
