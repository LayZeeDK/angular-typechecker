import { Component } from '@angular/core';

import {
  AlphaComponent,
  BetaComponent,
  DeltaComponent,
  GammaComponent,
} from '@dep/widgets';

// Thin in-project consumer. It imports several dep components so the WHOLE dep
// source module (all 8 components in widgets.ts) is pulled into this leaf's
// Program via the `@dep/widgets` barrel -- and, transitively, into the spec
// leaf's Program (the spec imports this consumer). The dep therefore compiles in
// BOTH leaves: the double-compile this spike measures.
@Component({
  selector: 'cost-consumer',
  standalone: true,
  imports: [AlphaComponent, BetaComponent, GammaComponent, DeltaComponent],
  template: `
    <dep-alpha [count]="3" />
    <dep-beta [active]="true" />
    <dep-gamma [size]="2" />
    <dep-delta [busy]="false" />
  `,
})
export class ConsumerComponent {}
