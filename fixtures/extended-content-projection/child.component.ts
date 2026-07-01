import { Component } from '@angular/core';

// Own program (child half) -- NG8011 CONTROL_FLOW_PREVENTING_CONTENT_PROJECTION
// (controlFlowPreventingContentProjection). OUT OF the project graph; kept out of
// the plugin build by tsconfig.lib.json's include: ["src/**/*.ts"] scope. Do NOT
// add @ts-nocheck.
//
// This is the CHILD component that declares a content-projection slot via
// `<ng-content select="[projectsIntoSlot]">` (child.component.html). The PARENT
// (parent.component.ts) projects an `@if` block WITH MORE THAN ONE ROOT NODE into
// this component -- which raises NG8011 on the parent's template (the control-flow
// node at the projection root prevents its descendants from being projected).
//
// NG8011 is a WARNING by default (no extendedDiagnostics.defaultCategory override
// in tsconfig.app.json). It is one of the two OUT-OF-BAND checks (no
// `extended/checks/` factory) but it is a NORMAL promotable member (D-09 CORRECTED
// 2026-07-01, triple-verified) -- default Warning, promotable to Error via
// `extendedDiagnostics.defaultCategory: "error"`. It is NOT special-cased as "not
// promotable" anywhere.
@Component({
  selector: 'extended-content-projection-child',
  standalone: true,
  templateUrl: './child.component.html',
})
export class ExtendedContentProjectionChildComponent {}
