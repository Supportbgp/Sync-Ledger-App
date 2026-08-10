import { useEffect, useRef } from 'react';

// Mobile testing found the browser/gesture back button just navigated away
// from the app entirely while a modal was open, instead of closing the
// modal — pushes a throwaway history entry the instant a modal mounts, and
// treats the resulting 'popstate' (back) as "close this modal" rather than
// a real page navigation.
//
// Known limitation: if two modals are open at once (e.g. a delete
// confirmation stacked on top of the Edit modal), both currently close on a
// single back press rather than just the topmost — this app has no global
// modal stack to arbitrate that, and one back press closing both is still
// strictly better than the pre-existing behavior of leaving the app.
export function useModalBackClose(onClose) {
  const closingViaPopRef = useRef(false);

  useEffect(() => {
    const mountedAt = Date.now();
    window.history.pushState({ modal: true }, '');

    function handlePopState() {
      // React 18's <StrictMode> (main.jsx) double-invokes this effect in
      // dev — mount, cleanup, mount again — all synchronously. The first
      // mount's cleanup calls history.back() below, which is asynchronous;
      // by the time that resolves into a real 'popstate' event, the SECOND
      // mount's listener (this one) is already attached, so it fires here
      // and closes the modal the instant it opens — a real physical back
      // press can't land within 100ms of the modal even rendering, so
      // treat anything that fast as this artifact rather than a real one.
      if (Date.now() - mountedAt < 100) return;
      closingViaPopRef.current = true;
      onClose();
    }
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Consume the entry we pushed if the modal closed some other way
      // (Cancel/Save/backdrop tap) — otherwise Back would need pressing
      // twice next time: once to no-op past our stale entry, once for real.
      if (!closingViaPopRef.current) window.history.back();
    };
    // Deliberately only on mount/unmount — re-running this per onClose
    // identity change would push a new history entry on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// A backdrop click (anywhere in .overlay that isn't the modal card itself)
// should dismiss, same as Cancel — this is the standard-issue "tap outside
// to close" every native modal/sheet pattern already gives you for free.
export function backdropClose(onClose) {
  return (e) => {
    if (e.target === e.currentTarget) onClose();
  };
}
