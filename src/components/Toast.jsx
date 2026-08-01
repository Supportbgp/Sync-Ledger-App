export default function Toast({ msg, isErr, show }) {
  return (
    <div className={`toast${show ? ' show' : ''}`} style={{ background: isErr ? '#AE3B2E' : '#161F1B' }}>
      {msg}
    </div>
  );
}
