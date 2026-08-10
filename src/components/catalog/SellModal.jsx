import { useState } from 'react';
import { useModalBackClose, backdropClose } from '../../hooks/useModalBackClose.js';

export default function SellModal({ card, onClose, onConfirm }) {
  // A single physical copy has nothing to choose — asking for a quantity
  // just to type "1" is friction for the most common case. Only cards
  // stocked 2+ deep get the stepper.
  const isSingleCopy = card.qty === 1;
  const [qty, setQty] = useState(1);
  useModalBackClose(onClose);

  function clamp(n) {
    return Math.max(1, Math.min(n, card.qty));
  }

  return (
    <div className="overlay show" onClick={backdropClose(onClose)}>
      <div className="modal">
        <div className="modal-head">
          <div className="name">{card.name}</div>
          <div className="meta">{`${card.set || ""} · ${card.condition || ""} · ${card.printing || ""}`}</div>
        </div>
        <div className="modal-body">
          {isSingleCopy ? (
            <div style={{ fontSize: '14px' }}>Mark this item as sold?</div>
          ) : (
            <div className="qty-row">
              <button onClick={() => setQty(q => clamp(q - 1))}>−</button>
              <input
                type="number" min="1" value={qty}
                onChange={(e) => setQty(clamp(parseInt(e.target.value || 1)))}
              />
              <button onClick={() => setQty(q => clamp(q + 1))}>+</button>
              <span style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>{card.qty} in stock</span>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost small" onClick={onClose}>Cancel</button>
          <button className="btn small" onClick={() => onConfirm(isSingleCopy ? 1 : clamp(qty))}>Mark sold</button>
        </div>
      </div>
    </div>
  );
}
