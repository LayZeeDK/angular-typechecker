import { Component } from '@angular/core';

// Layout-B aggregated component (SB-06 criterion 1, centralized host). Lives OUTSIDE
// the host project dir (storybook-host/); reached ONLY through the host's widened
// ./.storybook include glob (../../aggregated-ui/**/*.ts) -- so it is a DECLARED
// rootName of the input set but NOT under the host base dir. THE motivating case: a
// naive directory-containment filter would SILENTLY DROP its diagnostics (a false
// pass); input-set membership keeps them.
//
// It uses an EXTERNAL `templateUrl`, so a template error attributes to the `.html`
// (never a rootName). Branch 4a keeps that `.html` diagnostic via its
// relatedInformation owner (this .ts, which IS in the input set). Committed CLEAN;
// the e2e plants the NG8002 into card.component.html.
@Component({
  selector: 'app-card',
  standalone: true,
  templateUrl: './card.component.html',
})
export class CardComponent {
  readonly title: string = 'card';
}
