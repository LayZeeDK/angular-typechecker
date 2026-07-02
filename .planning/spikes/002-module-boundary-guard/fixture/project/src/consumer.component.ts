import { Component } from '@angular/core';

import { extDepValue } from '@ext/dep';
import { inDepValue } from '@in/dep';

// In-project consumer. It is itself CLEAN. It imports BOTH a path-mapped dep that
// lives INSIDE the project (`@in/dep` -> ./indep/src) and one that lives OUTSIDE
// it (`@ext/dep` -> ../external-dep/src). Both dep SOURCES are pulled into this
// leaf's Program, so their diagnostics are governed by the EXISTING diagnostic
// boundary filter (basePath = project dir) + includeDeps -- the mechanism this
// spike must show is UNCHANGED under the reference-walk.
@Component({
  selector: 'boundary-consumer',
  standalone: true,
  template: '<p>{{ total }}</p>',
})
export class ConsumerComponent {
  readonly total = inDepValue + extDepValue;
}
