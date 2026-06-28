import { Component } from '@angular/core';

// TEST-03 matrix fixture: the LOCAL NON-BUILDABLE LIBRARY project type (D-07).
// project.json has NO build target -- type-checked at tsconfig.lib.json via the
// PUBLISHED executor id. Self-contained standalone component, committed clean; the
// matrix spec injects a deliberate TS2322 into a per-run TMP copy to prove the
// packaged check runs for the local-lib type.
@Component({
  selector: 'local-lib-root',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class LocalLibComponent {
  readonly label: string = 'angular-typechecker matrix local lib';
}
