import { MyComponent } from './my.component';
import { label } from './untracked-helper';
// Story-shaped object WITHOUT importing @storybook/angular -- G2 is a pure
// config-parse / rootNames question and must not depend on a forced Storybook
// install (that is G3/G4's substrate). Imports the component (declared by a
// glob) and the helper (import-only, declared by no glob).
export const meta = {
    title: 'MyComponent',
    component: MyComponent,
};
export const Primary = {
    args: { text: label() },
};
