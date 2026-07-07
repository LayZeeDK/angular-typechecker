import { Component } from '@angular/core';

// G4-core: an inline template with a binding to an unknown native property.
// Under strictTemplates this fires NG8002 ("Can't bind to 'X' since it isn't a
// known property of 'div'") as an ERROR by default. Inline template => the
// diagnostic attributes to THIS component .ts (in-project, unambiguous).
@Component({
  selector: 'bad-cmp',
  template: '<div [nonExistentProp]="value"></div>',
})
export class BadComponent {
  value = 1;
}
