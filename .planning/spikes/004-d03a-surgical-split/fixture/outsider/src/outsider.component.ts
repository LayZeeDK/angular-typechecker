import { Component } from '@angular/core';

// OUT-OF-PROJECT referenced leaf (relative to ../oop-refs). Its TS2322 must NEVER
// be reported: after the boundary guard removes this out-of-project reference,
// zero in-project leaves survive, so the split must SYNTHESIZE the guard error
// (references-present-but-none-in-project) rather than walk this.
@Component({
  selector: 'oop-outsider',
  standalone: true,
  template: '<p>outsider</p>',
})
export class OopOutsiderComponent {
  readonly boom: number = 'OUTSIDER ERROR'; // TS2322 -- must NEVER be reported
}
