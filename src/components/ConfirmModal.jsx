import { useEffect, useRef, useState } from 'react';
import { supabaseClient, SHARED_LOGIN_EMAIL } from '../lib/supabase.js';
import { useModalBackClose, backdropClose } from '../hooks/useModalBackClose.js';

export default function ConfirmModal({ message, title, requirePassword, onResolve }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  useModalBackClose(() => onResolve(false));

  useEffect(() => {
    if (requirePassword && inputRef.current) {
      const t = setTimeout(() => inputRef.current.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [requirePassword]);

  async function handleOk() {
    if (requirePassword) {
      if (!password) { setError("Enter the shared password."); return; }
      setBusy(true);
      const { error: authErr } = await supabaseClient.auth.signInWithPassword({ email: SHARED_LOGIN_EMAIL, password });
      setBusy(false);
      if (authErr) { setError("Incorrect password."); return; }
    }
    onResolve(true);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleOk();
  }

  return (
    <div className="overlay show" onClick={backdropClose(() => onResolve(false))}>
      <div className="modal">
        <div className="modal-head">
          <div className="name">{title || "Are you sure?"}</div>
          <div className="meta">{message}</div>
        </div>
        {requirePassword && (
          <div className="modal-body">
            <input
              ref={inputRef}
              type="password"
              placeholder="Shared login password"
              autoComplete="off"
              style={{ width: '100%' }}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={handleKeyDown}
            />
            {error && <div className="status-line err">{error}</div>}
          </div>
        )}
        <div className="modal-foot">
          <button className="btn ghost small" onClick={() => onResolve(false)}>Cancel</button>
          <button className="btn danger small" disabled={busy} onClick={handleOk}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
