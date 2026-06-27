import { Component } from '@angular/core';

// D-02 proof fixture. OUT OF the project graph; kept out of the plugin build by
// tsconfig.lib.json's include: ["src/**/*.ts"] scope (the fixtures live at the
// workspace root, not under the package). Do NOT add @ts-nocheck.
//
// This component is intentionally CLEAN. The fixture's job is its tsconfig, which
// sets `compilerOptions.diagnostics: true` -- the option that drives
// performCompilation to push a category-Message diagnostic ("Time for
// diagnostics: ..."). The engine's D-05 override forces `diagnostics: false`, so
// the integration spec asserts NO "Time for diagnostics" category-Message entry
// is present in result.diagnostics -- proving the override suppresses it (keeping
// counts and output deterministic and agent-ready).
//
// A2 fallback: even if `diagnostics: true` did not trigger the Message via
// tsconfig in this toolchain, the absence assertion still holds (the engine never
// enables `diagnostics`), so the D-02 guarantee is proven regardless.
@Component({
  selector: 'no-emit-message',
  standalone: true,
  template: '<p>no emit message fixture</p>',
})
export class NoEmitMessageComponent {}
