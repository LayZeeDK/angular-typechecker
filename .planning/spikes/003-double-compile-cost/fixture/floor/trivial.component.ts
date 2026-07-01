import { Component } from '@angular/core';

// Fixed-overhead floor: the smallest possible Angular compile (one trivial
// component, no bindings, no deps). t_floor isolates the per-performCompilation
// fixed cost (program creation + @angular/core .d.ts load + TCB infra) so the
// dep's MARGINAL type-check cost can be recovered as (t_depOnly - t_floor).
@Component({
  selector: 'floor-trivial',
  standalone: true,
  template: '<p>floor</p>',
})
export class TrivialComponent {}
