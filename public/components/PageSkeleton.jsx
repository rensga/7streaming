export default function PageSkeleton() {
  return (
    <div className="page-shell page-loading" role="status" aria-label="Cargando página">
      <span className="visually-hidden">Cargando página…</span>
      <div className="skeleton-block skeleton-kicker" />
      <div className="skeleton-block skeleton-title" />
      <div className="skeleton-block skeleton-copy" />
      <div className="skeleton-card-grid">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item}><div className="skeleton-block skeleton-art" /><div className="skeleton-block skeleton-line" /><div className="skeleton-block skeleton-line short" /></div>)}</div>
    </div>
  );
}