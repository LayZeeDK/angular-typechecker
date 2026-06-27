import { Component, signal } from '@angular/core';

// Deliberate-error fixture for GATE B (D-13/D-17). OUT OF the project graph:
// nothing in the workspace imports it, and it is excluded from the plugin's
// tsconfig.lib.json, so apps/ng-spike-app stays green (TS #36017). Do NOT add
// @ts-nocheck -- the errors ARE the gate input.
@Component({
  selector: 'gate-b-error',
  standalone: true,
  templateUrl: './error.component.html',
})
export class GateBErrorComponent {
  count: number = 'not a number'; // TS2322: string is not assignable to number

  status = signal('ready'); // interpolated un-invoked in the template -> NG8109
}
