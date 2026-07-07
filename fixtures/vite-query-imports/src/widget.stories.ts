// SB-09 hermetic fixture: a Vite/Analog story-like module exercising bundler-query
// imports (?raw / ?url / ?worker / ?inline) plus a plain-missing control.
//
// The angular-typechecker engine KEEPS these TS2307 because the file is a declared
// rootName (in-project / input-set membership) -- the fix lives in the CONSUMER
// tsconfig ("types": ["vite/client"]), never in the tool. The base files
// (snippet.md / icon.svg / worklet.ts / extra.ts) EXIST, so only the bundler-query
// resolution and the plain-missing control are unresolved: the `?` suffix matches
// the SPECIFIER, not the file, so TypeScript reports TS2307 on the baseline leg and
// vite/client's ambient wildcards clear it on the other leg.

import rawSnippet from './snippet.md?raw';
import iconUrl from './icon.svg?url';
import WidgetWorker from './worklet?worker';
import inlineExtra from './extra?inline';

// CONTROL: a plain missing module (NO `?` query) -- MUST always fail TS2307 on BOTH
// legs and MUST NEVER be flagged by the bundler-query advisory (D-06(a), no false
// positive).
import missing from './does-not-exist';

export const used = [rawSnippet, iconUrl, WidgetWorker, inlineExtra, missing];
