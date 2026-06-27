import { Component } from '@angular/core';

// F8 -- the D-05 / L-1 composite-triangle regression input. OUT OF the project
// graph; kept out of the plugin build by tsconfig.lib.json's
// include: ["src/**/*.ts"] scope (the fixtures live at the workspace root, not
// under the package). Do NOT add @ts-nocheck.
//
// This component is intentionally CLEAN. The fixture's job is its tsconfig.json,
// which DELIBERATELY sets the three options that, WITHOUT the D-05 emit-
// neutralizing override, would make TypeScript report the bogus option-conflict
// triangle: TS5053 ("Option 'X' cannot be specified with option 'Y'"), TS6304
// ("Composite projects may not disable declaration emit"), and TS6379. The
// integration spec asserts NONE of 5053/6304/6379 are present -- proving the
// engine's override (with `composite: false` as the gatekeeper) neutralizes the
// triangle on a classic-base workspace (ROADMAP criterion 1).
@Component({
  selector: 'composite-triangle',
  standalone: true,
  template: '<p>composite triangle fixture</p>',
})
export class CompositeTriangleComponent {}
