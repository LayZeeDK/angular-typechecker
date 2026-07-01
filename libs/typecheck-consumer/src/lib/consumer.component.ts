import { Component } from '@angular/core';

import { depLabel } from '@fixtures/typecheck-consumer-dep';

// Phase-4 TEST-04 consumer fixture (D-11). It carries the typecheck
// target and imports the NON-buildable dep via the namespaced @fixtures alias
// (a static import resolved to SOURCE via the tsconfig.base.json paths alias).
// That static import is what forms the consumer->dep Nx project-graph edge, so
// ^default reaches the dep source (D-10). Because the dep is inlined source, a
// type error injected into the dep lands IN this consumer's program and survives
// the default boundary filter. Clean/green now so cache run #1 passes.
@Component({
  selector: 'fixture-consumer',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class ConsumerComponent {
  readonly label = depLabel();
}
