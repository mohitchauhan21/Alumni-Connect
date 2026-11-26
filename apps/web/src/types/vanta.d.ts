/** Vanta ships UMD bundles without types; each effect is a factory taking { el, THREE, ...options }. */
declare module 'vanta/dist/vanta.net.min' {
  const NET: (options: Record<string, unknown>) => { destroy: () => void };
  export default NET;
}

/** three r134 (the last release Vanta supports) ships without types; it is only handed to Vanta. */
declare module 'three';
