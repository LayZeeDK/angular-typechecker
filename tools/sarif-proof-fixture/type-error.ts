// SARIF proof fixture -- the `typescript` family input. Under `strict: true` this
// assignment of a string literal to a `: number` const fires TS2322 (typescript,
// SARIF level error). Self-contained: no imports, no cross-file coupling.
export const proofTypeError: number = 'not a number';
