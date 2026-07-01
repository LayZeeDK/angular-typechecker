import { Component } from '@angular/core';

// Batch A -- the interpolation / expression-family extended diagnostics (D-03
// batch fixtures per program). OUT OF the project graph; kept out of the plugin
// build by tsconfig.lib.json's include: ["src/**/*.ts"] scope (the fixtures live
// at the workspace root, not under the package). Do NOT add @ts-nocheck -- the
// diagnostics ARE the fixture input.
//
// This ONE program's template (error.component.html) triggers exactly SIX
// extended diagnostics, each EXACTLY ONCE, all WARNING by default (no
// extendedDiagnostics.defaultCategory override in tsconfig.app.json). Each is an
// independent binding/interpolation check with no cross-interference, so the
// per-code occurrence count stays deterministic (CAT-01 exact-count):
//
//   NG8102 NULLISH_COALESCING_NOT_NULLABLE           `{{ nonNullable ?? 'x' }}`
//     -- LHS type excludes null/undefined, so `??` can never fall through.
//   NG8107 OPTIONAL_CHAIN_NOT_NULLABLE               `{{ nonNullable?.length }}`
//     -- LHS not nullable, so `?.` is pointless.
//   NG8114 UNPARENTHESIZED_NULLISH_COALESCING        `{{ (flag ? one : two) }}`... see html
//     -- `&&` mixed with `??` without parentheses.
//   NG8117 UNINVOKED_FUNCTION_IN_TEXT_INTERPOLATION  `{{ greet }}`
//     -- a function referenced but not invoked in a text interpolation.
//   NG8104 TEXT_ATTRIBUTE_NOT_BINDING                `<div attr.x="value">`
//     -- a static text attribute that looks like it was meant to be a binding.
//   NG8106 SUFFIX_NOT_SUPPORTED                      `[attr.width.px]="widthValue"`
//     -- a `.px` suffix on an attribute binding (suffixes are style-only).
//
// Every class member referenced in the template is a valid, correctly-typed
// non-nullable member so NONE of these produce an incidental TS or extra NG
// diagnostic (RESEARCH Pitfall 4). These SIX are the ONLY diagnostics.
@Component({
  selector: 'extended-batch-expression',
  standalone: true,
  templateUrl: './error.component.html',
})
export class ExtendedBatchExpressionComponent {
  // NG8102 + NG8107: a non-nullable string. `?? 'x'` and `?.length` are both
  // pointless because its type excludes null/undefined.
  nonNullable = 'always here';

  // NG8114: a boolean `&&` mixed with `??` without parentheses. `maybeNull` is
  // genuinely nullable so the `??` LHS (`flag && maybeNull`) CAN be null -- this
  // keeps NG8102 (nullish-not-nullable) from ALSO firing on the NG8114 line, so
  // each code's occurrence count stays clean (RESEARCH Pitfall 4).
  flag = true;
  maybeNull: string | null = null;

  // NG8117: a function referenced-but-not-invoked in a text interpolation.
  greet(): string {
    return 'hello';
  }

  // NG8106: a numeric value bound through `[attr.width.px]` (the `.px` suffix is
  // not supported on attribute bindings).
  widthValue = 5;
}
