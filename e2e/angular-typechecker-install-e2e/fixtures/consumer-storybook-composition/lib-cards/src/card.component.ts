import { Component } from '@angular/core';

// Composed-lib standalone component (Composition topology, plan 19-02). A
// self-contained standalone component with an inline template. Committed CLEAN and
// left clean: the e2e plants its deliberate error into a story, never here.
@Component({
  selector: 'app-card',
  standalone: true,
  template: '<article>{{ heading }}</article>',
})
export class CardComponent {
  readonly heading: string = 'title';
}
