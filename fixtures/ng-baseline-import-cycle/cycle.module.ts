import { NgModule } from '@angular/core';

import { FirstComponent } from './first.component';
import { SecondComponent } from './second.component';

// Baseline NG3003 (IMPORT_CYCLE_DETECTED, error_code.d.ts:166; Error) -- the
// NgModule that wires the mutually-referencing components. OUT OF the project
// graph; kept out of the plugin build by tsconfig.lib.json's
// include: ["src/**/*.ts"] scope. Do NOT add @ts-nocheck -- the diagnostic IS
// the fixture input.
//
// FirstComponent and SecondComponent each USE the other's selector in their
// template but do NOT import each other -- they share scope ONLY through this
// module's `declarations`. To compile the two templates Angular must GENERATE an
// import in each direction (first -> second AND second -> first), which is a
// cyclic import. Under `compilationMode: "partial"` (tsconfig.app.json) the
// cycle-handling strategy is Error (remote scoping is unavailable), so the
// compiler raises NG3003 on the component whose template use closes the cycle.
@NgModule({
  declarations: [FirstComponent, SecondComponent],
})
export class CycleModule {}
