// kind="note" (blue, "worth knowing") or "warn" (amber, "pay attention here").
export default function DocsCallout({ kind = 'note', children }) {
  return <div className={`docs-callout docs-callout-${kind}`}>{children}</div>;
}
