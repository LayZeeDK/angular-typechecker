// Variant A: a HAND-WRITTEN ambient shim. Deliberately covers only ?raw / ?url / ?worker
// to contrast with `vite/client`, which declares the full query family (incl. ?inline).
// Types mirror vite/client so the imported values are REAL types (not `any`) -- misuse must
// still error (no-false-pass on types), only module RESOLUTION is satisfied.
declare module '*?raw' {
  const src: string;
  export default src;
}
declare module '*?url' {
  const src: string;
  export default src;
}
declare module '*?worker' {
  const workerConstructor: { new (): Worker };
  export default workerConstructor;
}
