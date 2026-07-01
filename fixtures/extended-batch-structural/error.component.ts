import { Component } from '@angular/core';

// Batch B -- the structural / control-flow-directive-family extended diagnostics
// (D-03 batch fixtures per program). OUT OF the project graph; kept out of the
// plugin build by tsconfig.lib.json's include: ["src/**/*.ts"] scope. Do NOT add
// @ts-nocheck -- the diagnostics ARE the fixture input.
//
// This standalone component imports NO CommonModule and declares NO structural
// directive, so the control-flow-family checks fire. The template
// (error.component.html) is engineered so each target extended diagnostic fires
// EXACTLY ONCE (CAT-01 exact-count). Both are WARNING by default:
//
//   NG8103 MISSING_CONTROL_FLOW_DIRECTIVE  `*ngIf="flag"` without CommonModule.
//   NG8116 MISSING_STRUCTURAL_DIRECTIVE    `*appMissing="flag"` -- an unknown
//     structural directive that is used but not imported/declared.
//
// D-03 SPLIT NOTE (verified by a real run): NG8105 (MISSING_NGFOROF_LET) was
// SPLIT OUT into its own program (fixtures/extended-ngfor-let/). A bare
// `*ngFor="items"` here (no CommonModule) raises NG8103 a SECOND time in addition
// to NG8105, colliding the NG8103 count. NG8105 only fires cleanly (without an
// extra NG8103) when CommonModule IS imported, so it lives in its own fixture.
// Every referenced member is valid so no incidental TS error pollutes the counts.
@Component({
  selector: 'extended-batch-structural',
  standalone: true,
  templateUrl: './error.component.html',
})
export class ExtendedBatchStructuralComponent {
  flag = true;
}
