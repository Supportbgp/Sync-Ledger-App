import { useModalBackClose } from '../hooks/useModalBackClose.js';

export default function Lightbox({ url, onClose }) {
  useModalBackClose(onClose);
  return (
    <div className="overlay show" onClick={onClose}>
      <img
        src={url}
        style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '10px', objectFit: 'contain' }}
        alt=""
      />
    </div>
  );
}
