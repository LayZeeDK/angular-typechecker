import { Component, Input } from '@angular/core';

// A clean, valid Angular component (inline template type-checks under
// strictTemplates). No template errors, no extended-diagnostic triggers.
@Component({
  selector: 'app-button',
  template: '<button type="button">{{ label }}</button>',
})
export class ButtonComponent {
  @Input() label = '';
}
