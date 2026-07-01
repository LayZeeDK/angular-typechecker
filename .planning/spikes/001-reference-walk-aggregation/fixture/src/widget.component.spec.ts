import { WidgetComponent } from './widget.component';

// SPEC-ONLY source: reachable only through the spec leaf (a build never compiles
// specs -- the named differentiator). It carries its own unique TS2322 so the
// aggregated set must contain a diagnostic that the lib leaf alone can NEVER
// produce -- the completeness proof. It deliberately avoids Jasmine/Vitest
// globals so it emits EXACTLY one planted TS2322 and no incidental TS2304 noise.
export function specOnlyError(widget: WidgetComponent): number {
  // Unique to the spec leaf: a string assigned to a number-typed const.
  const planted: number = 'spec-only error'; // TS2322 (Error) -- spec leaf only

  return planted + widget.count;
}
