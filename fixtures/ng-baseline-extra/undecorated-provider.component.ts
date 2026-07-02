import { Component } from '@angular/core';

// Baseline NG2005 (UNDECORATED_PROVIDER, error_code.d.ts:60; Error). OUT OF the
// project graph; kept out of the plugin build by tsconfig.lib.json's
// include: ["src/**/*.ts"] scope. Do NOT add @ts-nocheck -- the diagnostic IS
// the fixture input.
//
// Trigger: a plain class with NO `@Injectable()`/`@Directive()`/`@Component()`
// decorator -- AND a non-empty constructor (the compiler only flags providers
// that REQUIRE a factory, i.e. classes with >=1 constructor parameter; verified
// against resolveProvidersRequiringFactory in v22.0.4) -- is listed as a
// provider. Angular cannot construct an undecorated provider, so it surfaces
// NG2005 (display-encoded as -992005).
export class UndecoratedDependency {}

export class UndecoratedService {
  constructor(readonly dependency: UndecoratedDependency) {}
}

@Component({
  selector: 'ng-baseline-extra-undecorated-provider',
  standalone: true,
  template: '<p>undecorated provider</p>',
  providers: [UndecoratedService],
})
export class UndecoratedProviderComponent {}
