// T11 NEGATIVE control -- declares ONLY `.ts` (no `.mdx`, no jsx-less `.tsx`), so
// the include-driven detection finds nothing and notTypeCheckedDeclaredFiles is
// empty -> undefined. A checkable rootName keeps rootNamesCount > 0 and the verdict
// clean, isolating the difference from the green fixture to the declared surface
// alone. OUT OF the plugin build.
export const title: string = 'Clean control (no uncheckable declared files)';
