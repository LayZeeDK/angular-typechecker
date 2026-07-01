import { Component } from '@angular/core';

// Baseline NG1001 (DECORATOR_ARG_NOT_LITERAL, error_code.d.ts:12 -> code 1001;
// Error). OUT OF the project graph; kept out of the plugin build by
// tsconfig.lib.json's include: ["src/**/*.ts"] scope. Do NOT add @ts-nocheck --
// the diagnostic IS the fixture input.
//
// Trigger: the `@Component()` decorator argument is a VARIABLE reference, not an
// object literal. Angular's static metadata reader requires a literal, so it
// surfaces NG1001 (display-encoded as -991001). Because the metadata cannot be
// analyzed, no template diagnostics fire on this component -- that is why the
// template-driven baseline codes (NG8002, NG8004) live on their OWN components.
const metadata = {
  selector: 'ng-baseline-extra-non-literal',
  standalone: true,
  template: '<p>non literal</p>',
};

@Component(metadata)
export class NonLiteralComponent {}
