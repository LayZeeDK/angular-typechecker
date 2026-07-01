import { Component } from '@angular/core';

// Own program -- NG8108 SKIP_HYDRATION_NOT_STATIC (skipHydrationNotStatic). OUT OF
// the project graph; kept out of the plugin build by tsconfig.lib.json's
// include: ["src/**/*.ts"] scope. Do NOT add @ts-nocheck -- the diagnostic IS the
// fixture input.
//
// NG8108 is a WARNING by default (no extendedDiagnostics.defaultCategory override
// in tsconfig.app.json). It is a PURE STATIC-ATTRIBUTE check -- NOT a hydration
// runtime (RESEARCH refuted the "needs hydration context" hypothesis, line 227;
// bundle line 3321-3336). The check has two branches: a BOUND attribute
// (`[ngSkipHydration]="x"`) "should not be used as a binding", and a static TEXT
// attribute whose value is not "true"/"" -- "only accepts true or empty".
//
// This fixture uses the TEXT-ATTRIBUTE branch: `ngSkipHydration="yes"` -- a static
// attribute with a non-accepted value. A BOUND `[ngSkipHydration]="x"` instead
// co-fires NG8002 (SCHEMA_INVALID_ATTRIBUTE, an incidental Error) because the
// binding is an unknown property on the element schema; the static-text form does
// NOT, so NG8108 is the ONLY diagnostic (verified by a real run).
@Component({
  selector: 'extended-skip-hydration',
  standalone: true,
  templateUrl: './error.component.html',
})
export class ExtendedSkipHydrationComponent {}
