import { Component } from '@angular/core';

// Leaf source with a KNOWN TS2322 so the WALK branch is OBSERVABLE: if the split
// walks the in-project reference, this error is reported (proving the leaf was
// actually type-checked, not false-cleaned by a short-circuit).
@Component({
  selector: 'split-broken',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class BrokenComponent {
  readonly count: number = 'not a number'; // TS2322 (Error)
  readonly label = 'ok';
}
