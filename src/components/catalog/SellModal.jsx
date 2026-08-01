import { useState } from 'react';

export default function SellModal({ card, onClose, onConfirm }) {
  const [qty, setQty] = useState(1);

  function clamp(n) {
    return Math.max(1, Math.min(n, card.qty));
  }

  return (
    <div className="overlay show">
      <div className="modal">
        <div className="modal-head">
          <div className="name">{card.name}</div>
          <div className="meta">{`${card.set || ""} · ${card.condition || ""} · ${card.printing || ""}`}</div>
        </div>
        <div className="modal-body">
          <div className="qty-row">
            <button onClick={() => setQty(q => clamp(q - 1))}>−</button>
            <input
              type="number" min="1" value={qty}
              onChange={(e) => setQty(clamp(parseInt(e.target.value || 1)))}
            />
            <button onClick={() => setQty(q => clamp(q + 1))}>+</button>
            <span style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>{card.qty} in stock</span>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost small" onClick={onClose}>Cancel</button>
          <button className="btn small" onClick={() => onConfirm(clamp(qty))}>Mark sold</button>
        </div>
      </div>
    </div>
  );
}
