import { Component } from '@angular/core';

// Layout-A per-project scaffold component (SB-01). Clean by construction: the ONLY
// planted error in this fixture lives in the sibling `*.stories.ts` (the story
// surface the shipped reference-walk must type-check). The template is a plain
// string literal -- no interpolation -- so no extended NG diagnostic co-fires
// (Pitfall 3, spike 001). OUT OF the plugin build (fixtures live at the workspace
// root, not under the package). Do NOT add @ts-nocheck.
@Component({
  selector: 'app-button',
  standalone: true,
  template: '<button>go</button>',
})
export class ButtonComponent {}
