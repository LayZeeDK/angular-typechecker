import { Component, ViewEncapsulation } from '@angular/core';

// Baseline NG2009 (COMPONENT_INVALID_SHADOW_DOM_SELECTOR,
// error_code.d.ts:80; Error). OUT OF the project graph; kept out of the plugin
// build by tsconfig.lib.json's include: ["src/**/*.ts"] scope. Do NOT add
// @ts-nocheck -- the diagnostic IS the fixture input.
//
// Trigger: `ViewEncapsulation.ShadowDom` requires a valid custom-element tag
// name, i.e. a selector CONTAINING a hyphen. This component uses a hyphen-less
// selector (`shadowdom`) under ShadowDom encapsulation, so the compiler
// surfaces NG2009 (display-encoded as -992009).
@Component({
  selector: 'shadowdom',
  standalone: true,
  encapsulation: ViewEncapsulation.ShadowDom,
  template: '<p>shadow dom</p>',
})
export class ShadowDomComponent {}
