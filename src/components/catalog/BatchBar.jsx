export default function BatchBar({ count, onMarkSold, onDelete, onClear }) {
  return (
    <div className="batch-bar show">
      <span>{count} selected</span>
      <div className="spacer"></div>
      <button className="btn blue small" onClick={onMarkSold}>Mark sold</button>
      <button className="btn danger small" onClick={onDelete}>Delete</button>
      <button className="btn ghost small" onClick={onClear}>Clear selection</button>
    </div>
  );
}
