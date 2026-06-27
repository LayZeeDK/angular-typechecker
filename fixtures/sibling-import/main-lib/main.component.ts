import { Component } from '@angular/core';

import { describeDependency } from '@sibling/dependency-lib';

// Phase-3 sibling-import fixture: the MAIN (in-project) half. It lives UNDER the
// main-lib leaf-tsconfig `basePath` and imports the sibling dependency-lib via a
// `paths` alias (so the dependency's diagnostic lands OUTSIDE basePath ->
// suppressed by default; surfaced by `includeDeps: true`). It ALSO carries its
// own IN-PROJECT TS2322 so a kept diagnostic is always present alongside the
// suppressed sibling one.
//
// OUT OF the plugin build: the fixtures live at the workspace root, kept out by
// tsconfig.lib.json's include: ["src/**/*.ts"] scope. Do NOT add @ts-nocheck --
// the errors ARE the fixture input.
@Component({
  selector: 'sibling-import-main',
  standalone: true,
  template: '<p>{{ label }}</p>',
})
export class MainComponent {
  // In-project TS2322: kept by the default boundary filter.
  label: number = 'in-project error'; // TS2322: string is not assignable to number

  readonly dependencyDescription = describeDependency();
}
