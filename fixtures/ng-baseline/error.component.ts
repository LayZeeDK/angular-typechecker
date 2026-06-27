import { Component } from '@angular/core';

// F3 -- NG baseline (NG8001 = SCHEMA_INVALID_ELEMENT, an Error by default). OUT OF
// the project graph; kept out of the plugin build by tsconfig.lib.json's
// include: ["src/**/*.ts"] scope (the fixtures live at the workspace root, not
// under the package). The error IS the fixture input, so no
// type-check-suppression directive is added.
//
// Chosen NG baseline code: NG8001 (SCHEMA_INVALID_ELEMENT, verified = 8001 in
// installed @angular/compiler-cli@22.0.4 error_code.d.ts:238). The template uses
// an unknown custom element (`<unknown-widget>`) that is neither a known HTML
// element nor a declared/imported Angular component, so the Angular compiler
// surfaces NG8001 (display-encoded as -998001). It is a hard Error by default
// (no extendedDiagnostics promotion needed), so it lands in errorCount.
@Component({
  selector: 'ng-baseline',
  standalone: true,
  templateUrl: './error.component.html',
})
export class NgBaselineComponent {}
