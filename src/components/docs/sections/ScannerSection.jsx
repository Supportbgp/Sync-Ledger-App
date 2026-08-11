import DocsSection from '../DocsSection.jsx';
import DocsCallout from '../DocsCallout.jsx';

export default function ScannerSection() {
  return (
    <DocsSection id="scan-binder" title="Scan Binder">
      <p>
        Scans one full binder page (a grid of clear pockets, one card each)
        and identifies every card on it automatically. Works best with one
        full page at a time, evenly lit.
      </p>

      <h3>Getting a photo in</h3>
      <p>
        The drop zone opens your phone's regular photo picker (camera or
        library, whatever your phone offers). If you specifically want the
        camera to open right away, use the separate{' '}
        <strong>"Take a photo"</strong> button below it — some phones don't
        reliably offer a camera option from the regular picker.
      </p>

      <h3>Reviewing what was found</h3>
      <p>
        After "Scan this page" finishes, each detected card gets its own
        review row: name, game, set, and rarity (all editable, in case the
        scan guessed wrong), plus a <strong>confidence badge</strong>{' '}
        (low/medium/high) showing how sure the scan was about that
        particular card.
      </p>
      <p>
        Each row's thumbnail has its own Photo/Stock toggle, same idea as
        the Edit modal — "Photo" is a crop taken directly from your page
        photo, "Stock" is a searched reference image. Use{' '}
        <strong>Find another image</strong> if the auto-picked stock
        candidate is wrong (correct the name/set/rarity fields first, then
        search again). <strong>Find market price</strong> reveals the
        Market Value for whichever image is currently showing — it doesn't
        run a new search, it just uses whatever was already fetched
        alongside that image.
      </p>
      <p>
        Fill in Condition and Price yourself for each row — the scan never
        guesses those. Use <strong>+ Add missed card</strong> for anything
        the scan skipped, and remove (✕) any row that shouldn't be added.
      </p>
      <p>
        The Binder/case picker and Channels checkboxes at the top apply to
        the whole batch. When everything on the page looks right, "Add N
        item(s) to catalog" commits all of them at once.
      </p>
      <DocsCallout kind="note">
        A card's crop occasionally clips the top edge slightly, especially
        for the bottom row of a page (steeper camera angle there makes it
        harder for the scan to judge). If a crop looks off, just switch that
        row's toggle to Stock, or re-photograph the page straighter-on.
      </DocsCallout>
    </DocsSection>
  );
}
