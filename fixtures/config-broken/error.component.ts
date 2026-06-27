import { Component, signal } from '@angular/core';

// Config-resolution fixture (Plan 02-02, D-07b / EXE-02). A broken standalone
// component mirroring the gate-b-error shape: it carries a deliberate TS2322 so
// the spec source below can import a real symbol while the spec tsconfig proves
// the *.spec.ts is type-checked. OUT OF the project graph; excluded from the
// plugin's tsconfig.lib.json (the broad fixtures/**/* exclude). Do NOT add
// @ts-nocheck -- the errors ARE the gate input.
@Component({
  selector: 'config-broken-error',
  standalone: true,
  templateUrl: './error.component.html',
})
export class ConfigBrokenErrorComponent {
  count: number = 'not a number'; // TS2322: string is not assignable to number

  status = signal('ready'); // interpolated un-invoked in the template -> NG8109
}
