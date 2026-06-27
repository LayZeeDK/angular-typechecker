import { Component } from '@angular/core';

// F6 -- the category-PROMOTION proof (ENG-04 / D-01 fact). OUT OF the project
// graph; excluded from the plugin's tsconfig.lib.json. Do NOT add @ts-nocheck.
//
// SAME extended-diagnostic shape as fixtures/extended-v13 (NG8101 =
// INVALID_BANANA_IN_BOX) -- but this fixture's tsconfig sets
// `angularCompilerOptions.extendedDiagnostics.defaultCategory: "error"`, which
// auto-promotes the SAME code from its default WARNING into a hard Error. The
// integration spec asserts the diagnostic's category is Error and that it is
// counted in errorCount (not warningCount), proving the engine honors `.category`
// rather than code sign (L-4).
@Component({
  selector: 'extended-promoted',
  standalone: true,
  templateUrl: './error.component.html',
})
export class ExtendedPromotedComponent {
  value = '';
  update = '';
}
