import { Component } from '@angular/core';

// TEST-03 matrix fixture: the BUILDABLE LIBRARY project type (D-07). The buildable
// shape is distinguished STRUCTURALLY by a `build` target referencing
// @nx/angular:ng-packagr-lite (project.json) -- which is NEVER run and whose
// executor Nx never resolves when running angular-typecheck (OQ-1), so NO
// @nx/angular dependency is needed. Type-checked at tsconfig.lib.json via the
// PUBLISHED executor id; committed clean; the matrix spec injects a deliberate
// TS2322 into a per-run TMP copy to prove the packaged check runs for this type.
@Component({
  selector: 'buildable-lib-root',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class BuildableLibComponent {
  readonly label: string = 'angular-typechecker matrix buildable lib';
}
