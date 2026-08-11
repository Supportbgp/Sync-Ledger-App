export default function DocsSection({ id, title, children }) {
  return (
    <section id={id} className="docs-section">
      <h2 className="docs-section-title">{title}</h2>
      {children}
    </section>
  );
}
