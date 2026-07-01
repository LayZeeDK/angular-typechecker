import { NgModule } from '@angular/core';

// Baseline NG6100 (WARN_NGMODULE_ID_UNNECESSARY, error_code.d.ts:230;
// WARNING -- note the WARN_ prefix). OUT OF the project graph; kept out of the
// plugin build by tsconfig.lib.json's include: ["src/**/*.ts"] scope. Do NOT
// add @ts-nocheck -- the diagnostic IS the fixture input.
//
// Trigger: an `@NgModule({ id: module.id })`. The `module.id` idiom is a
// no-longer-needed legacy pattern, so the compiler surfaces NG6100
// (display-encoded as -996100) as a WARNING (it lands in warningCount, NOT
// errorCount). `module.id` is typed here via a local ambient declaration so the
// fixture needs no `@types/node` (the CommonJS `module` global).
declare const module: { id: string };

@NgModule({
  id: module.id,
})
export class NgModuleIdModule {}
