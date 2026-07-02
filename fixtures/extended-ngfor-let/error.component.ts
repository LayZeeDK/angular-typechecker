import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

// Own program (D-03 split from Batch B) -- NG8105 MISSING_NGFOROF_LET
// (missingNgForOfLet). OUT OF the project graph; kept out of the plugin build by
// tsconfig.lib.json's include: ["src/**/*.ts"] scope. Do NOT add @ts-nocheck --
// the diagnostic IS the fixture input.
//
// NG8105 is a WARNING by default (no extendedDiagnostics.defaultCategory override
// in tsconfig.app.json). It fires when NgForOf is used but the `let` keyword is
// missing from the microsyntax (e.g. `*ngFor="item of items"` instead of
// `*ngFor="let item of items"`).
//
// WHY CommonModule IS imported here (unlike the sibling extended-batch-structural
// fixture): a bare `*ngFor` WITHOUT CommonModule raises NG8103
// (MISSING_CONTROL_FLOW_DIRECTIVE) in ADDITION to NG8105 -- colliding the NG8103
// count in the structural batch. Importing CommonModule resolves NgForOf as a real
// directive, so NG8103 does NOT fire and NG8105 is the ONLY diagnostic (verified by
// a real run). `items` is a valid array so no incidental TS error fires.
@Component({
  selector: 'extended-ngfor-let',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './error.component.html',
})
export class ExtendedNgForOfLetComponent {
  items = [1, 2, 3];
}
