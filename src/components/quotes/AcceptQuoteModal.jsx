import { useEffect, useState } from 'react';
import { channelDefaultsForLocation } from '../../lib/cardUtils.js';
import LocationPicker from '../LocationPicker.jsx';

// Fires when a quote is being Saved with an Accepted status (cash or store
// credit) for the first time — the moment its line items are about to
// become real Catalog rows. Real feedback: staff had no way to say *where*
// those new physical cards actually live (which binder/case) or which
// platforms they're meant to be listed on, so every accepted quote's items
// landed with a blank location and the "assumed everywhere" channel
// default — invisible until someone went and fixed each row by hand.
// Blocking on this here, once, for the whole batch is cheaper than fixing
// it per-item after the fact in Catalog.
export default function AcceptQuoteModal({ itemCount, catalog, locations, onConfirm, onCancel }) {
  const [location, setLocation] = useState('');
  const [channels, setChannels] = useState({ posChannel: false, tcgplayerChannel: false, collectrChannel: false });
  const [channelsTouched, setChannelsTouched] = useState(false);

  // Same "follow the majority of this binder/case's existing items until
  // staff manually touch a checkbox" pattern EditModal already uses for a
  // brand-new catalog item — location is what actually drives a sensible
  // channel default here, not some other trigger.
  useEffect(() => {
    if (channelsTouched) return;
    if (!location.trim()) {
      setChannels({ posChannel: false, tcgplayerChannel: false, collectrChannel: false });
      return;
    }
    setChannels(channelDefaultsForLocation(catalog, location.trim()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  function setChannel(field, value) {
    setChannelsTouched(true);
    setChannels(c => ({ ...c, [field]: value }));
  }

  const hasLocation = location.trim().length > 0;
  const hasChannel = channels.posChannel || channels.tcgplayerChannel || channels.collectrChannel;
  const canSave = hasLocation && hasChannel;

  return (
    <div className="overlay show">
      <div className="modal">
        <div className="modal-head">
          <div className="name">Where are these cards going?</div>
          <div className="meta">
            You're about to add {itemCount} new card{itemCount === 1 ? '' : 's'} to the Catalog.
          </div>
        </div>
        <div className="modal-body">
          <div className="field-group">
            <label>Binder / case / collection</label>
            <LocationPicker
              locations={locations}
              value={location}
              onChange={setLocation}
              ariaLabel="Binder / case / collection"
            />
          </div>
          <div className="field-group">
            <label>Where does this live?</label>
            <div className="checkbox-row">
              <input type="checkbox" id="aq_posChannel" checked={channels.posChannel} onChange={(e) => setChannel('posChannel', e.target.checked)} />
              <label htmlFor="aq_posChannel" style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>In-store / POS</label>
            </div>
            <div className="checkbox-row">
              <input type="checkbox" id="aq_tcgplayerChannel" checked={channels.tcgplayerChannel} onChange={(e) => setChannel('tcgplayerChannel', e.target.checked)} />
              <label htmlFor="aq_tcgplayerChannel" style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>TCG Player</label>
            </div>
            <div className="checkbox-row">
              <input type="checkbox" id="aq_collectrChannel" checked={channels.collectrChannel} onChange={(e) => setChannel('collectrChannel', e.target.checked)} />
              <label htmlFor="aq_collectrChannel" style={{ margin: 0, fontFamily: "'Inter',sans-serif", textTransform: 'none', letterSpacing: 'normal' }}>Collectr</label>
            </div>
            {!hasChannel && <div className="status-line" style={{ marginTop: '4px' }}>Select at least one.</div>}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn secondary" onClick={onCancel}>Cancel</button>
          <button className="btn" disabled={!canSave} onClick={() => onConfirm(location.trim(), channels)}>Save</button>
        </div>
      </div>
    </div>
  );
}
