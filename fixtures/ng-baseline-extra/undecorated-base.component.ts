import { Component, Input } from '@angular/core';

// Baseline NG2007 (UNDECORATED_CLASS_USING_ANGULAR_FEATURES,
// error_code.d.ts:70; Error). OUT OF the project graph; kept out of the plugin
// build by tsconfig.lib.json's include: ["src/**/*.ts"] scope. Do NOT add
// @ts-nocheck -- the diagnostic IS the fixture input.
//
// Trigger: an UNDECORATED base class that uses an Angular feature (`@Input()`)
// is extended by a decorated component. Angular requires the base class to
// carry a class-level decorator when it uses Angular features, so it surfaces
// NG2007 (display-encoded as -992007).
export class UndecoratedBase {
  @Input() value = '';
}

@Component({
  selector: 'ng-baseline-extra-undecorated-base',
  standalone: true,
  template: '<p>undecorated base</p>',
})
export class UndecoratedBaseComponent extends UndecoratedBase {}
