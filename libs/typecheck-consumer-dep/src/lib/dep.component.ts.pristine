import { Component } from '@angular/core';

// Phase-4 TEST-04 mutation target (D-15). This file is mutated at runtime by the
// dependency-error-busts-cache test in Plan 04-03 to inject a known TS/NG error
// into the DEP's SOURCE -- so the consumer's whole-program type-check (which
// compiles this .ts directly, because this lib is NON-buildable) must hash it
// via ^default and bust the cache. A byte-identical committed sidecar lives at
// dep.component.ts.pristine for crash-safe revert. It MUST compile cleanly now
// (no committed error) so run #1 of the cache test is genuinely GREEN.
export function depLabel(): string {
  return 'dep';
}

@Component({
  selector: 'fixture-dep',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class DepComponent {
  readonly label = depLabel();
}
