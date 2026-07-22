import { Component } from '@angular/core';

// SARIF proof fixture -- the template-family inputs. A standalone component with an
// EXTERNAL templateUrl so its template diagnostics attribute to the `.html` (never
// this `.ts`): the coarse `.html`-origin family heuristic then tags the unknown
// property as `template-type-check` and the extended NG8xxx as
// `extended-diagnostics`. `value` is the single member both bindings reference.
@Component({
  selector: 'sarif-proof',
  standalone: true,
  templateUrl: './proof.component.html',
})
export class ProofComponent {
  readonly value = 1;
}
