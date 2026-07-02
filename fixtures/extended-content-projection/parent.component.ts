import { Component } from '@angular/core';

import { ExtendedContentProjectionChildComponent } from './child.component';

// Own program (parent half) -- NG8011 CONTROL_FLOW_PREVENTING_CONTENT_PROJECTION
// (controlFlowPreventingContentProjection). OUT OF the project graph; kept out of
// the plugin build by tsconfig.lib.json's include: ["src/**/*.ts"] scope. Do NOT
// add @ts-nocheck -- the diagnostic IS the fixture input.
//
// This PARENT component imports the child (which declares an `<ng-content>` slot)
// and projects an `@if` block with MORE THAN ONE ROOT NODE into it. Per the
// compiler's own example (error_code.d.ts:306-319): a control-flow node projected
// at the root prevents its direct descendants from being projected when it has
// more than one root node -- so NG8011 fires ONCE on this template.
//
// `flag` is a valid boolean member and the child is a valid import, so NG8011 is
// the ONLY diagnostic (no incidental TS/NG error; NG8113 does NOT fire because the
// child IS referenced in the template).
@Component({
  selector: 'extended-content-projection',
  standalone: true,
  imports: [ExtendedContentProjectionChildComponent],
  templateUrl: './parent.component.html',
})
export class ExtendedContentProjectionParentComponent {
  flag = true;
}
