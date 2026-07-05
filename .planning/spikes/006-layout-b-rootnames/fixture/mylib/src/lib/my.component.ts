import { Component } from '@angular/core';

// A cross-project component physically OUTSIDE the host dir (fixture/mylib),
// declared by the host leaf's "../../mylib/src/**/*.component.ts" glob.
@Component({
  selector: 'my-cmp',
  template: '<p>{{ text }}</p>',
})
export class MyComponent {
  text = 'hi';
}
