import { Component } from '@angular/core';

import { makeTitle } from '../layout-b-dependency/thing';

// Layout-B aggregated component, reached through the host's widened `.storybook`
// include (a DECLARED rootName of the input set). It uses an EXTERNAL `templateUrl`
// (a `.html` on disk), so the planted NG8002 attributes to the `.html` -- NOT this
// `.ts`. `.html` is never a rootName, so a naive rootNames-only filter would
// SILENTLY DROP it (the false pass). Branch 4a resolves the `.html` diagnostic's
// `relatedInformation` owner (this component `.ts`, which IS in the input set) and
// KEEPs it -- the kill-shot (criterion 2; threat T-17-02).
//
// It also imports `makeTitle` from a dependency that lives OUTSIDE the widened
// include AND outside the host base dir -- the isolation input (criterion 3).
@Component({
  selector: 'app-card',
  standalone: true,
  templateUrl: './card.component.html',
})
export class CardComponent {
  title = makeTitle();
}
