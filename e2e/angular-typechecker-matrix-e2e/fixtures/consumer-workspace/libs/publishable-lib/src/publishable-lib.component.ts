import { Component } from '@angular/core';

// TEST-03 matrix fixture: the PUBLISHABLE LIBRARY project type (D-07). The
// publishable shape is distinguished STRUCTURALLY by a `build` target referencing
// @nx/angular:package + an importPath-style per-lib package.json
// (@fixtures/publishable-lib) -- the build is NEVER run and its executor is never
// resolved when running typecheck (OQ-1), so NO @nx/angular dependency is
// needed. Type-checked at tsconfig.lib.json via the PUBLISHED executor id;
// committed clean; the matrix spec injects a deliberate TS2322 into a per-run TMP
// copy to prove the packaged check runs for this type.
@Component({
  selector: 'publishable-lib-root',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class PublishableLibComponent {
  readonly label: string = 'angular-typechecker matrix publishable lib';
}
