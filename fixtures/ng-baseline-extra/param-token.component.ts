import { Component } from '@angular/core';

// Baseline NG2003 (PARAM_MISSING_TOKEN, error_code.d.ts:57; Error). OUT OF the
// project graph; kept out of the plugin build by tsconfig.lib.json's
// include: ["src/**/*.ts"] scope (the fixtures live at the workspace root, not
// under the package). Do NOT add @ts-nocheck -- the diagnostic IS the fixture
// input.
//
// Trigger: a constructor parameter typed as a PRIMITIVE (string) with no
// `@Inject()` token. The Angular compiler cannot resolve a DI token for a
// primitive, so it surfaces NG2003 (display-encoded as -992003).
@Component({
  selector: 'ng-baseline-extra-param-token',
  standalone: true,
  template: '<p>param token</p>',
})
export class ParamTokenComponent {
  constructor(private readonly label: string) {}
}
