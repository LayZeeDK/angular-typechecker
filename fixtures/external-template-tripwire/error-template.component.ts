import { Component } from '@angular/core';

// D-09.2 / D-09a(iii) tripwire fixture: a component whose template lives in a
// SEPARATE external `templateUrl` `.html` resource (NOT a compiler rootName). The
// `.html` carries a real NG8002 template error (binding to an unknown native
// property). Spike 008 verified that such external-template diagnostics attribute
// to the `.html` AND carry a `ts.Diagnostic.relatedInformation` pointing back to
// THIS owning component `.ts` -- the STABLE PUBLIC signal branch 4a relies on. The
// integration spec asserts that attribution invariant so a future Angular flip is
// caught LOUD instead of silently dropping the diagnostic.
//
// OUT OF the plugin's project graph: the fixtures live at the workspace root, kept
// out of the plugin build by tsconfig.lib.json's `include: ["src/**/*.ts"]` scope.
// The NG8002 error IS the fixture input -- no type-check-suppression directive.
@Component({
  selector: 'external-template-tripwire',
  standalone: true,
  templateUrl: './error-template.component.html',
})
export class ErrorTemplateComponent {
  value = 1;
}
