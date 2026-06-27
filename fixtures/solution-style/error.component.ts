import { Component, signal } from '@angular/core';

// Solution-style fixture LEAF source (Plan 02-02, D-03 / D-03a). This is the
// target of `tsconfig.app.json`'s reference. The component itself is minimal and
// valid -- the regression proof is that the SOLUTION-style `tsconfig.json`
// (files:[], references:[...]) produces ZERO rootNames regardless of whether the
// leaf source is clean or broken, so the engine's zero-rootNames guard must fire
// instead of reporting a false "0 files / 0 errors" clean. OUT OF the project
// graph; kept out of the plugin build by tsconfig.lib.json's
// include: ["src/**/*.ts"] scope (the fixtures live at the workspace root, not
// under the package). Do NOT add @ts-nocheck.
@Component({
  selector: 'solution-style-leaf',
  standalone: true,
  template: '<p>{{ status() }}</p>',
})
export class SolutionStyleLeafComponent {
  status = signal('ready');
}
