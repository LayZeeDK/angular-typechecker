import { Component } from '@angular/core';

// Phase-13 WALK-02 (SC5) walk-consumer fixture. This is the LIB leaf source: it
// is included by tsconfig.lib.json (which EXCLUDES *.spec.ts) and referenced by
// the SOLUTION tsconfig.json alongside the tsconfig.spec.json leaf. A single
// typecheck target pointed at the solution tsconfig.json walks BOTH
// leaves in one run. This file stays byte-unchanged during the cache test -- the
// mutation lands ONLY in walk-consumer.component.spec.ts, proving a spec-only
// edit busts the coarse single-target cache under the "default" named input.
// Committed clean so the green baseline run genuinely passes.
@Component({
  selector: 'fixture-walk-consumer',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class WalkConsumerComponent {
  readonly label = 'walk-consumer';
}
