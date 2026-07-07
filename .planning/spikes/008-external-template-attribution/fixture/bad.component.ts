import { Component } from '@angular/core';

// G1/G5: the component .ts is the compiler ROOTNAME; its template lives in a
// SEPARATE external `templateUrl` .html resource (NOT a rootName). The question
// is which file the template diagnostics attribute to -- this .ts, or the .html.
@Component({
  selector: 'bad-cmp',
  templateUrl: './bad.component.html',
})
export class BadComponent {
  value = 1;
  label = 'hi';
}
