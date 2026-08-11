// A backdrop click (anywhere in .overlay that isn't the modal card itself)
// should dismiss, same as Cancel — this is the standard-issue "tap outside
// to close" every native modal/sheet pattern already gives you for free.
//
// A previous version of this file also closed modals on the mobile back
// button/gesture (via a pushState/popstate dance) — real-device testing
// found it made Cancel and backdrop-tap also trigger a real "go back"
// navigation (the app has no history depth beneath a modal's pushed entry
// to safely consume), so it was dropped. Cancel and backdrop-tap are
// enough; the back button/gesture just does its normal thing again.
export function backdropClose(onClose) {
  return (e) => {
    if (e.target === e.currentTarget) onClose();
  };
}
