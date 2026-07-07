import { Component } from '@angular/core';

// Layout-A per-project scaffold component (SB-06 criterion 1). A self-contained
// standalone component with an inline template. Committed CLEAN and left clean: the
// e2e plants its deliberate error into button.stories.ts, never here.
@Component({
  selector: 'app-button',
  standalone: true,
  template: '<button>{{ label }}</button>',
})
export class ButtonComponent {
  readonly label: string = 'go';
}
