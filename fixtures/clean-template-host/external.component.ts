import { Component } from '@angular/core';

// D-09a(i) clean-host fixture, component 1 of 2: a CLEAN component with an EXTERNAL
// `templateUrl` `.html` template. The `.html` is NOT a compiler rootName, so it is
// classified in-graph purely by the D-04a narrowed base clause (it lives under the
// host tsconfig dir). This guards that a clean host's own external template is
// never miscounted as a suppressed-out-of-graph diagnostic (a false
// coverage-incomplete). See clean-host counterpart inline.component.ts.
@Component({
  selector: 'clean-external',
  standalone: true,
  templateUrl: './external.component.html',
})
export class ExternalTemplateComponent {
  title = 'hello';
}
