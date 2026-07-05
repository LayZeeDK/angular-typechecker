// Imported by my.stories.ts but NOT matched by any include glob of the host
// leaf. Expected to appear as a program SourceFile (reachable via import) but
// NOT as a declared rootName -- the declared-input vs import-only distinction
// the SB-02 keep-rule hinges on.
export function label() {
    return 'hello from helper';
}
