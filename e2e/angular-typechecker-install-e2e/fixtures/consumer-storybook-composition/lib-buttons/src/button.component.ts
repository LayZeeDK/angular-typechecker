import { Component } from '@angular/core';

// Composed-lib standalone component (Composition topology, plan 19-02). A
// self-contained standalone component with an inline template. Committed CLEAN and
// left clean: the e2e plants its deliberate error into button.stories.ts, never
// here.
@Component({
  selector: 'app-button',
  standalone: true,
  template: '<button>{{ label }}</button>',
})
export class ButtonComponent {
  readonly label: string = 'go';
}
