import { Component } from '@angular/core';

// OUT-OF-PROJECT referenced project. The solution `tsconfig.json` lists
// `../outsider/tsconfig.lib.json` in references[]. The reference-walk boundary
// guard MUST SKIP this leaf entirely -- so this deliberate TS2322 must NEVER
// appear in the aggregated result, and (critically) includeDeps=true must NOT
// resurrect it: includeDeps governs imported SOURCE diagnostics, not which
// out-of-project REFERENCES become leaves. A no-guard baseline in the harness
// shows this error DOES appear if the guard is absent.
@Component({
  selector: 'outsider',
  standalone: true,
  template: '<p>outsider</p>',
})
export class OutsiderComponent {
  readonly outsiderError: number = 'OUTSIDER ERROR'; // TS2322 (Error) -- must NEVER be reported
}
