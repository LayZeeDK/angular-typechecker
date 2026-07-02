import { Component, computed, Input, signal } from '@angular/core';

// A non-buildable local dep with real compile weight: 8 standalone components,
// each with a template that strictTemplates must generate a TCB for. This is the
// dep whose SOURCE gets pulled into BOTH the lib leaf and the spec leaf (via the
// consumer import chain), so it is type-checked twice under the reference-walk.
// All clean -- this is a benchmark, not an error test.

@Component({
  selector: 'dep-alpha',
  standalone: true,
  template: '<p>{{ title() }} — {{ doubled() }} ({{ count }})</p>',
})
export class AlphaComponent {
  @Input() count = 0;
  readonly title = signal('alpha');
  readonly doubled = computed(() => this.count * 2);
}

@Component({
  selector: 'dep-beta',
  standalone: true,
  template: '<span [class.on]="active">{{ label() }}</span>',
})
export class BetaComponent {
  @Input() active = false;
  readonly label = signal('beta');
}

@Component({
  selector: 'dep-gamma',
  standalone: true,
  template: '<ul><li>{{ name() }}</li><li>{{ size }}</li></ul>',
})
export class GammaComponent {
  @Input() size = 1;
  readonly name = signal('gamma');
}

@Component({
  selector: 'dep-delta',
  standalone: true,
  template: '<button [disabled]="busy">{{ caption() }}</button>',
})
export class DeltaComponent {
  @Input() busy = false;
  readonly caption = signal('delta');
}

@Component({
  selector: 'dep-epsilon',
  standalone: true,
  template: '<div [title]="hint()">{{ value }}</div>',
})
export class EpsilonComponent {
  @Input() value = '';
  readonly hint = computed(() => `hint:${this.value}`);
}

@Component({
  selector: 'dep-zeta',
  standalone: true,
  template: '<p>{{ upper() }}</p>',
})
export class ZetaComponent {
  @Input() text = '';
  readonly upper = computed(() => this.text.toUpperCase());
}

@Component({
  selector: 'dep-eta',
  standalone: true,
  template: '<p>{{ ratio() }}</p>',
})
export class EtaComponent {
  @Input() numerator = 1;
  @Input() denominator = 1;
  readonly ratio = computed(() => this.numerator / this.denominator);
}

@Component({
  selector: 'dep-theta',
  standalone: true,
  template: '<p>{{ greeting() }}</p>',
})
export class ThetaComponent {
  @Input() who = 'world';
  readonly greeting = computed(() => `hello ${this.who}`);
}
