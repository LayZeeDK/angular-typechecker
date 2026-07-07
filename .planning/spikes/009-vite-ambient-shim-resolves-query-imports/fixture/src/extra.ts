// Base module for the `./extra?inline` import. Base file EXISTS. The hand shim does NOT declare
// `*?inline`, so variant A leaves this as a residual TS2307; `vite/client` declares it (variant B).
export {};
