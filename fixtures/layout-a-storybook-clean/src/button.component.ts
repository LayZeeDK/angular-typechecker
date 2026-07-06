import { Component } from '@angular/core';

// Layout-A per-project scaffold component (SB-01), clean variant. No planted error
// anywhere in this fixture: the story below is CLEAN too, so the run is a fully
// checked PASS (criterion 1(A) clean side). OUT OF the plugin build.
@Component({
  selector: 'app-button',
  standalone: true,
  template: '<button>go</button>',
})
export class ButtonComponent {}
