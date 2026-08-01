import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Toast from '../components/Toast.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Lightbox from '../components/Lightbox.jsx';

const UIContext = createContext(null);

export function useUI() {
  return useContext(UIContext);
}

export function UIProvider({ children }) {
  const [toastState, setToastState] = useState({ msg: '', isErr: false, show: false });
  const toastTimer = useRef(null);

  const toast = useCallback((msg, isErr) => {
    setToastState({ msg, isErr: !!isErr, show: true });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState(s => ({ ...s, show: false })), 2400);
  }, []);

  const [confirmState, setConfirmState] = useState(null);

  const showConfirm = useCallback((message, title, opts) => {
    return new Promise((resolve) => {
      setConfirmState({ message, title, requirePassword: !!(opts && opts.requirePassword), resolve });
    });
  }, []);

  const [lightboxUrl, setLightboxUrl] = useState(null);
  const openLightbox = useCallback((url) => { if (url) setLightboxUrl(url); }, []);
  const closeLightbox = useCallback(() => setLightboxUrl(null), []);

  const value = { toast, showConfirm, openLightbox };

  return (
    <UIContext.Provider value={value}>
      {children}
      <Toast msg={toastState.msg} isErr={toastState.isErr} show={toastState.show} />
      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          title={confirmState.title}
          requirePassword={confirmState.requirePassword}
          onResolve={(result) => { confirmState.resolve(result); setConfirmState(null); }}
        />
      )}
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={closeLightbox} />}
    </UIContext.Provider>
  );
}
