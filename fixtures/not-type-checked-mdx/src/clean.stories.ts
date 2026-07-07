// T11 GREEN fixture -- a clean, checkable `.ts` rootName so the run is a genuine
// green PASS (rootNamesCount > 0), not a vacuous zero-files one. Plain Angular-free
// TypeScript: the ONLY point of this fixture is to prove the advisory
// (notTypeCheckedDeclaredFiles) fires on the sibling `.mdx` / jsx-less `.tsx` while
// this checkable surface stays clean. OUT OF the plugin build.
export const title: string = 'Not-type-checked advisory demo';
