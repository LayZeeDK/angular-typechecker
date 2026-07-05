import { Component } from '@angular/core';
import * as i0 from "@angular/core";
// A cross-project component physically OUTSIDE the host dir (fixture/mylib),
// declared by the host leaf's "../../mylib/src/**/*.component.ts" glob.
export class MyComponent {
    constructor() {
        this.text = 'hi';
    }
    static { this.ɵfac = function MyComponent_Factory(__ngFactoryType__) { return new (__ngFactoryType__ || MyComponent)(); }; }
    static { this.ɵcmp = /*@__PURE__*/ i0.ɵɵdefineComponent({ type: MyComponent, selectors: [["my-cmp"]], decls: 2, vars: 1, template: function MyComponent_Template(rf, ctx) { if (rf & 1) {
            i0.ɵɵdomElementStart(0, "p");
            i0.ɵɵtext(1);
            i0.ɵɵdomElementEnd();
        } if (rf & 2) {
            i0.ɵɵadvance();
            i0.ɵɵtextInterpolate(ctx.text);
        } }, encapsulation: 2 }); }
}
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassMetadata(MyComponent, [{
        type: Component,
        args: [{
                selector: 'my-cmp',
                template: '<p>{{ text }}</p>',
            }]
    }], null, null); })();
(() => { (typeof ngDevMode === "undefined" || ngDevMode) && i0.ɵsetClassDebugInfo(MyComponent, { className: "MyComponent", filePath: ".planning/spikes/006-layout-b-rootnames/fixture/mylib/src/lib/my.component.ts", lineNumber: 9 }); })();
