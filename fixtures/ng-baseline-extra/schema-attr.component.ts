import { Component } from '@angular/core';

// Baseline NG8002 (SCHEMA_INVALID_ATTRIBUTE, error_code.d.ts:242; Error). OUT
// OF the project graph; kept out of the plugin build by tsconfig.lib.json's
// include: ["src/**/*.ts"] scope. Do NOT add @ts-nocheck -- the diagnostic IS
// the fixture input.
//
// Trigger: a template binds an attribute (`[unknownAttr]`) that is not a known
// property of the target KNOWN element (`<div>`). Under `strictTemplates` the
// schema check surfaces NG8002 (display-encoded as -998002). The class is
// otherwise clean so the template code is the only NG error on this component.
@Component({
  selector: 'ng-baseline-extra-schema-attr',
  standalone: true,
  template: '<div [unknownAttr]="value"></div>',
})
export class SchemaAttrComponent {
  value = 'x';
}
