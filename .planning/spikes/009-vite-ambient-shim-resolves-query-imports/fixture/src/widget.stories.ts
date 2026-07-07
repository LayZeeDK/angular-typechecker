// A story-like module exercising Vite-specific import queries plus two control imports.
// The angular-typechecker engine KEEPS these TS2307s because the file is a declared rootName
// (in-project / input-set membership) -- the fix must live in the CONSUMER tsconfig, not the tool.

import rawSnippet from './snippet.md?raw'; // ?raw  (base file EXISTS)
import iconUrl from './icon.svg?url'; // ?url   (base file EXISTS)
import WidgetWorker from './worklet?worker'; // ?worker (base file EXISTS)
import inlineExtra from './extra?inline'; // ?inline (base EXISTS) -- hand shim does NOT declare this; vite/client DOES

import missing from './does-not-exist'; // CONTROL: plain missing module (no query) -- MUST always TS2307
import ghostRaw from './ghost.md?raw'; // PROBE: ?raw on a NONEXISTENT base -- wildcard-existence blind spot

// no-false-pass on TYPES: a shim types ?raw as `string`, so this misuse must still error (TS2322).
// In baseline (unresolved -> `any`), no TS2322 fires -- proving the shim gives REAL types.
const misuse: number = rawSnippet;

export const used = [rawSnippet, iconUrl, WidgetWorker, inlineExtra, missing, ghostRaw, misuse];
