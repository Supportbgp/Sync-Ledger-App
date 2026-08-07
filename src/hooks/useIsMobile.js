import { useEffect, useState } from 'react';

// Tracks a single CSS breakpoint via matchMedia rather than a resize
// listener + manual width math — avoids a layout thrash on every resize
// event and stays in sync with rotation/devtools-resize for free. Used to
// pick between two whole markup structures (e.g. CatalogTable's dense rows
// vs. stacked cards), not for fiddly per-pixel layout, so one shared
// breakpoint is enough.
export const MOBILE_BREAKPOINT = 700;

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const query = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}
