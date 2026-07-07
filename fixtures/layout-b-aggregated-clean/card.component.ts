import { Component } from '@angular/core';

// Layout-B CLEAN aggregated component with an EXTERNAL `templateUrl` (a `.html` on
// disk). Exercises D-04a: an external-template component on a fully clean host must
// be classified in-graph (never counted as suppressed-out-of-graph), so a correct
// classification yields `suppressedInGraphErrorCount === 0` AND
// `suppressedInGraphWarningCount === 0` by construction (criterion 4). No
// dependency import here -- nothing outside the input set to suppress.
@Component({
  selector: 'app-card',
  standalone: true,
  templateUrl: './card.component.html',
})
export class CardComponent {
  title = 'card';
}
