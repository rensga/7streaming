import { useEffect, useRef, useState } from 'react';
import PriceSimulator from '../components/PriceSimulator.jsx';
import ServiceCard from '../components/ServiceCard.jsx';
import { api } from '../lib/api.js';

const categories = ['Todos', 'Video', 'Música', 'Diseño', 'Educación', 'Otros'];
const PAGE_SIZE = 6;

function CatalogSkeleton() {
  return <div className="service-grid" role="status" aria-label="Cargando servicios">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item}><div className="skeleton-block skeleton-art" /><div className="skeleton-block skeleton-line" /><div className="skeleton-block skeleton-line short" /></div>)}</div>;
}

export default function CatalogPage({ priceSimulation, priceSimulationError, onRetryPriceSimulation }) {
  const [category, setCategory] = useState('Todos');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [services, setServices] = useState([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const searchRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set('q', search.trim());
      if (category !== 'Todos') params.set('category', category);
      setLoading(true);
      setError('');
      api(`/api/services?${params}`)
        .then((result) => {
          if (!active) return;
          setServices(result.services);
          setPages(Math.max(1, result.pagination.pages));
          setTotal(result.pagination.total);
        })
        .catch((requestError) => {
          if (!active) return;
          setServices([]);
          setError(requestError.message);
        })
        .finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [category, search, page, reloadKey]);

  const featuredServices = category === 'Todos' && !search.trim() && page === 1 ? services.filter((service) => service.isFeatured).slice(0, 3) : [];
  const featuredIds = new Set(featuredServices.map((service) => service.id));
  const otherServices = featuredServices.length ? services.filter((service) => !featuredIds.has(service.id)) : services;
  const hasFilters = category !== 'Todos' || Boolean(search.trim());

  return (
    <section className="catalog-section page-shell" aria-labelledby="catalog-title">
      <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-dash" /> ELIGE TU PRÓXIMO PLAN</div><h1 id="catalog-title">Un mundo para <span className="text-gradient">descubrir.</span></h1></div><p className="section-note">Consulta ejemplos de precio orientativos; las ofertas publicadas incluirán sus condiciones completas.</p></div>
      <PriceSimulator simulation={priceSimulation} loadError={priceSimulationError} onRetry={onRetryPriceSimulation} />
      <div className="catalog-controls"><div className="category-list" aria-label="Filtrar por categoría">{categories.map((item) => <button key={item} className={`category-chip${category === item ? ' is-active' : ''}`} type="button" aria-pressed={category === item} onClick={() => { setCategory(item); setPage(1); }}>{item}</button>)}</div><label className="search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg><span className="visually-hidden">Buscar servicios</span><input ref={searchRef} type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Busca un servicio..." autoComplete="off" /><kbd>⌘ K</kbd></label></div>
      <div className="catalog-meta"><span aria-live="polite">{loading ? 'Cargando catálogo…' : error ? 'No se pudo cargar el catálogo' : `${total} ${total === 1 ? 'oferta publicada' : 'ofertas publicadas'}`}</span><span className="catalog-meta-right"><span className="status-pulse" /> Publicación sujeta a autorización</span></div>
      {loading ? <CatalogSkeleton /> : error ? <div className="empty-state catalog-error" role="alert"><span className="empty-icon" aria-hidden="true">!</span><h3>No pudimos cargar el catálogo</h3><p>{error}</p><button className="button button-outline" type="button" onClick={() => setReloadKey((key) => key + 1)}>Reintentar</button></div> : services.length === 0 ? <div className="empty-state"><span className="empty-icon" aria-hidden="true">{hasFilters ? '⌕' : '◇'}</span><h3>{hasFilters ? 'No encontramos resultados' : 'Aún no hay ofertas publicadas'}</h3><p>{hasFilters ? 'Prueba otra búsqueda o cambia la categoría.' : 'Los ejemplos de precio de arriba son ilustrativos y no están disponibles para adquirir.'}</p>{hasFilters && <button className="text-button" type="button" onClick={() => { setCategory('Todos'); setSearch(''); setPage(1); }}>Quitar filtros <span aria-hidden="true">→</span></button>}</div> : null}
      {!loading && !error && featuredServices.length > 0 && <div className="catalog-group"><div className="catalog-group-heading"><h2>Selección destacada</h2><span>Descubre opciones seleccionadas</span></div><div className="service-grid">{featuredServices.map((service) => <ServiceCard key={service.id} service={service} />)}</div></div>}
      {!loading && !error && otherServices.length > 0 && <div className="catalog-group">{featuredServices.length > 0 && <div className="catalog-group-heading"><h2>Todos los servicios</h2></div>}<div className="service-grid">{otherServices.map((service) => <ServiceCard key={service.id} service={service} />)}</div></div>}
      {total > PAGE_SIZE && <nav className="catalog-pagination" aria-label="Paginación del catálogo"><button className="button button-outline" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>← Anterior</button><span>Página {page} de {pages}</span><button className="button button-outline" type="button" onClick={() => setPage((current) => Math.min(pages, current + 1))} disabled={page >= pages || loading}>Siguiente →</button></nav>}
    </section>
  );
}