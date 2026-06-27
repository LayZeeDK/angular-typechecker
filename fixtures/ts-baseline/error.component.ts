import { Component } from '@angular/core';

// F2 -- TS template-driven baseline (TS2339). OUT OF the project graph: nothing
// in the workspace imports it, and it is excluded from the plugin's
// tsconfig.lib.json (fixtures/**/*), so the package build stays green. The error
// IS the fixture input, so no type-check-suppression directive is added.
//
// The class is otherwise clean; the template references a member that does NOT
// exist on the component class, so `strictTemplates` template type-checking
// surfaces it as TS2339 (raw TypeScript code -- "Property 'X' does not exist on
// type 'Y'"). This is the TEMPLATE-driven TS case (the plain class-level TS2322
// case is already covered by fixtures/gate-b-error).
@Component({
  selector: 'ts-baseline',
  standalone: true,
  templateUrl: './error.component.html',
})
export class TsBaselineComponent {
  title = 'hello';
}
