import { Component, signal } from '@angular/core';

// RES-02 fault-isolation fixture: the SURVIVOR half (component B). OUT OF the
// project graph: nothing in the workspace imports it, and it is kept out of the
// plugin build by tsconfig.lib.json's include: ["src/**/*.ts"] scope (the
// fixtures live at the workspace root, not under the package). Do NOT add
// @ts-nocheck -- the errors ARE the fixture input.
//
// This component carries a PLAIN template error using the established
// gate-b-error model: a TS2322 in a field initializer plus an interpolated
// un-invoked signal (NG8109) in the template. TODAY (whole-program early-return)
// the TCB-poison component's FatalDiagnosticError abandons the remaining files,
// so this survivor's template diagnostic VANISHES. After RES-02 (per-file loop)
// it SURVIVES -- this is the failing-then-passing differentiator plan 09-02 will
// assert against this same fixture.
@Component({
  selector: 'fault-isolation-survivor',
  standalone: true,
  templateUrl: './survivor.component.html',
})
export class SurvivorComponent {
  count: number = 'not a number'; // TS2322: string is not assignable to number

  status = signal('ready'); // interpolated un-invoked in the template -> NG8109
}
