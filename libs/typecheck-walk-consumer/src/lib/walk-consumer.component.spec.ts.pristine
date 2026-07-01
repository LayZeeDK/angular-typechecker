import { WalkConsumerComponent } from './walk-consumer.component';

// Phase-13 WALK-02 (SC5) mutation target. This is the SPEC leaf source: it is
// included ONLY by tsconfig.spec.json and EXCLUDED by tsconfig.lib.json, so it is
// type-checked ONLY when the walk reaches the spec leaf. The cache test mutates
// THIS file (a *.spec.ts source) at runtime to inject a known TS2322 and asserts
// the coarse single walk-target cache MISSES -- which can only happen if the
// "default" named input hashes *.spec.ts sources (the WALK-02 swap). A
// byte-identical committed sidecar lives at walk-consumer.component.spec.ts.pristine
// for crash-safe revert. It MUST compile cleanly now (no committed error) so the
// green baseline run is genuinely GREEN.
//
// The fixture installs no test-runner types (types: []), so the test globals are
// declared inline to keep the committed baseline green. Type-checking the spec
// file set is the point; running it is not (the executor never runs the tests).
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect<T>(actual: T): { toBe(expected: T): void };

describe('WalkConsumerComponent (spec leaf)', () => {
  it('constructs with the expected label', () => {
    const component = new WalkConsumerComponent();
    const label: string = component.label;
    expect(label).toBe('walk-consumer');
  });
});
