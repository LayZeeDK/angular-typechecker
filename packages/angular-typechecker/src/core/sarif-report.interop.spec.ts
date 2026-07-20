import { describe, expect, it } from 'vitest';

// D-04: `import type * as` erases at compile, so the type used for the defensive
// interop cast does not put node-sarif-builder on this spec's require graph. It
// also gives the RAW declared namespace (no synthetic esModuleInterop `default`),
// which is what the `(mod.default ?? mod)` cast needs -- mirrors sarif-report.ts.
import type * as NodeSarifBuilder from 'node-sarif-builder';

// VER-04 / D-03 REAL-import interop (NOT mocked -- Pitfall 9). `sarif-report.ts`
// reaches the SARIF builder ONLY through `await import('node-sarif-builder')` and
// destructures it via the defensive `(mod.default ?? mod)` form (the package is
// plain CommonJS, so `await import()` cannot throw `ERR_REQUIRE_ESM`; the lazy
// import is a startup-leanness win). This spec exercises the GENUINE package -- a
// mocked unit test cannot catch a CJS-under-`await import()` shape drift. It is a
// `test`-tier spec (needs only `node_modules`, NOT the cold-compiler integration
// tier), mirroring the shipped real-import shape of `compiler-loader.spec.ts`.
describe('node-sarif-builder interop (VER-04/D-03: real await import(), not mocked)', () => {
  it('resolves the four builders via (mod.default ?? mod) and builds SARIF 2.1.0', async () => {
    const mod = await import('node-sarif-builder');
    const {
      SarifBuilder,
      SarifRunBuilder,
      SarifResultBuilder,
      SarifRuleBuilder,
    } =
      (mod as typeof NodeSarifBuilder & { default?: typeof NodeSarifBuilder })
        .default ?? mod;

    // All four builder classes resolve through the defensive access (D-03).
    expect(typeof SarifBuilder).toBe('function');
    expect(typeof SarifRunBuilder).toBe('function');
    expect(typeof SarifResultBuilder).toBe('function');
    expect(typeof SarifRuleBuilder).toBe('function');

    // A minimal run must serialize to a SARIF 2.1.0 log (the builder bakes the
    // version + $schema by construction -- what the real interop must preserve).
    const runBuilder = new SarifRunBuilder().initSimple({
      toolDriverName: 'angular-typechecker',
      toolDriverVersion: '0.0.0',
    });
    const logBuilder = new SarifBuilder();
    logBuilder.addRun(runBuilder);

    const payload = JSON.parse(
      logBuilder.buildSarifJsonString({ indent: false }),
    ) as { version: string };

    expect(payload.version).toBe('2.1.0');
  });
});
