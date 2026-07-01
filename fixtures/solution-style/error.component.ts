import { Component } from '@angular/core';

// Solution-style fixture APP-LEAF source (Phase 13, D-03a walk substrate). This
// is the target of `tsconfig.app.json`'s reference. It plants ONE plain TS2322
// (string assigned to a number-typed field) so the reference-walk union proves
// the app/lib leaf was type-checked. The template is a plain string literal --
// NO interpolated signal -- so no NG8117/NG8109 extended diagnostic co-fires
// (Pitfall 3, spike 001). OUT OF the project graph; kept out of the plugin build
// by tsconfig.lib.json's include: ["src/**/*.ts"] scope (the fixtures live at the
// workspace root, not under the package). Do NOT add @ts-nocheck.
@Component({
  selector: 'solution-style-leaf',
  standalone: true,
  template: '<p>ready</p>',
})
export class SolutionStyleLeafComponent {
  // Planted TS2322: string assigned to number. Proves the app/lib leaf was
  // type-checked. Plain TS error only -- no interpolated signal, so no NG8117 /
  // NG8109 co-fire (spike 001).
  count: number = 'not-a-number';
}
