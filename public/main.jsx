import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BRAND_NAME } from '../brand.js';
import PageSkeleton from './components/PageSkeleton.jsx';
import { api } from './lib/api.js';
import { DEFAULT_PRICE_SIMULATION, formatServicePrice } from './lib/pricing.js';
import { createTelegramContactUrl, DEFAULT_TELEGRAM_USERNAME } from './lib/telegram.js';
import './styles.css';
import './responsive.css';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const CatalogPage = lazy(() => import('./pages/CatalogPage.jsx'));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'));
const FaqPage = lazy(() => import('./pages/FaqPage.jsx'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage.jsx'));
const LegalPage = lazy(() => import('./pages/LegalPage.jsx'));
const ServiceDetailPage = lazy(() => import('./pages/ServiceDetailPage.jsx'));

const pageRoutes = {
  '/': HomePage,
  '/catalogo': CatalogPage,
  '/nosotros': AboutPage,
  '/faqs': FaqPage,
  '/como-funciona': HowItWorksPage,
  '/aviso-legal': LegalPage,
};

const categories = ['Todos', 'Video', 'Música', 'Diseño', 'Educación', 'Otros'];
const statusNames = {
  active: 'Disponible',
  inactive: 'Inactivo',
  sold_out: 'Agotado',
  coming_soon: 'Próximamente',
};
const actionNames = {
  created: 'creó',
  updated: 'actualizó',
  published: 'publicó',
  unpublished: 'despublicó',
  deleted: 'eliminó',
  reordered: 'reordenó',
};

function safeHttpsUrl(value = '') {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'E';
}

function Dialog({ open, onClose, className = '', labelledBy, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={className}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      {children}
    </dialog>
  );
}

function ServiceMark({ service, className = 'service-monogram' }) {
  const logo = safeHttpsUrl(service.logoUrl);
  const [failedLogo, setFailedLogo] = useState('');
  return (
    <span className={className}>
      {logo && failedLogo !== logo ? <img src={logo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedLogo(logo)} /> : initials(service.name)}
    </span>
  );
}

function ServiceCard({ service, onDetails }) {
  const status = statusNames[service.status] || statusNames.active;
  const badge = service.status === 'sold_out'
    ? <span className="card-badge unavailable">Agotado</span>
    : service.status === 'coming_soon'
      ? <span className="card-badge soon">Próximamente</span>
      : service.isFeatured
        ? <span className="card-badge featured">✳ Destacado</span>
        : <span className="card-badge">Más información</span>;

  return (
    <article className="service-card">
      <div className="card-top"><ServiceMark service={service} />{badge}</div>
      <div className="card-content">
        <div className="card-category">{service.category}</div>
        <div className="card-title-row">
          <h3 className="card-title">{service.name}</h3>
          <span className={`card-status ${service.status}`}>{status}</span>
        </div>
        <p className="card-description">{service.shortDescription}</p>
        <div className="card-price"><strong>{formatServicePrice(service)}</strong></div>
        <button className="card-link" type="button" onClick={() => onDetails(service)}>
          Ver detalles <span aria-hidden="true">↗</span>
        </button>
      </div>
    </article>
  );
}

function ServicePreview({ service }) {
  return (
    <div className="preview-card">
      <div className="card-top">
        <ServiceMark service={service} />
        <span className="card-badge">{service.published ? 'Ficha del servicio' : 'Oculto'}</span>
      </div>
      <div className="card-content">
        <div className="card-category">{service.category || 'Categoría'}</div>
        <div className="card-title-row"><h3 className="card-title">{service.name || 'Nombre del servicio'}</h3></div>
        <p className="card-description">{service.shortDescription || 'Descripción breve del servicio.'}</p>
        <div className="card-price">{formatServicePrice(service)}</div>
      </div>
    </div>
  );
}

function createNewService(total) {
  return {
    id: '', name: '', slug: '', shortDescription: '', longDescription: '', logoUrl: '',
    category: 'Video', status: 'active', sortOrder: total + 1, priceAmount: '', currency: 'USD',
    duration: '', deliveryDetails: '', conditions: '', supportDetails: '', authorizedToSell: false,
    seoTitle: '', seoDescription: '', isFeatured: false, published: false, slugWasEdited: false,
  };
}

function serviceForEdit(service) {
  return {
    ...service,
    priceAmount: Number.isSafeInteger(service.priceAmount) ? (service.priceAmount / 100).toFixed(2) : '',
    slugWasEdited: true,
  };
}

function priceSimulationForEdit(pricing) {
  return {
    rate: String(pricing.rate),
    rateDate: pricing.rateDate,
    services: pricing.services.map((service) => ({
      ...service,
      monthlyUsd: (service.monthlyUsdCents / 100).toFixed(2),
    })),
  };
}

function ServiceEditor({ service, onChange, onSubmit, onClose, busy }) {
  const change = (event) => {
    const { name, value, checked, type } = event.target;
    onChange((current) => {
      const next = { ...current, [name]: type === 'checkbox' ? checked : value };
      if (name === 'name' && !current.slugWasEdited) next.slug = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (name === 'slug') next.slugWasEdited = true;
      return next;
    });
  };

  return (
    <Dialog open={Boolean(service)} onClose={onClose} className="site-dialog service-editor-dialog" labelledBy="service-dialog-title">
      {service && (
        <form className="service-editor" onSubmit={onSubmit}>
          <div className="editor-header">
            <div><div className="eyebrow"><span className="eyebrow-dash" /> GESTIÓN DEL CATÁLOGO</div><h2 id="service-dialog-title">{service.id ? 'Editar servicio' : 'Añadir servicio'}</h2></div>
            <button className="dialog-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
          </div>
          <div className="editor-content">
            <div className="editor-fields">
              <div className="field-row"><label className="field-label" htmlFor="service-name">Nombre <span>*</span></label><input className="text-input" id="service-name" name="name" value={service.name} onChange={change} maxLength="80" required /></div>
              <div className="field-row"><label className="field-label" htmlFor="service-slug">Slug único <span>*</span></label><input className="text-input" id="service-slug" name="slug" value={service.slug} onChange={change} maxLength="90" pattern="[a-z0-9]+(-[a-z0-9]+)*" required /><small>Solo minúsculas, números y guiones.</small></div>
              <div className="field-row"><label className="field-label" htmlFor="service-short">Descripción corta <span>*</span></label><input className="text-input" id="service-short" name="shortDescription" value={service.shortDescription} onChange={change} maxLength="180" required /></div>
              <div className="field-row"><label className="field-label" htmlFor="service-long">Descripción completa <span>*</span></label><textarea className="text-input" id="service-long" name="longDescription" value={service.longDescription} onChange={change} rows="3" maxLength="2000" required /></div>
              <div className="field-row"><label className="field-label" htmlFor="service-logo">URL del logo <span className="optional">Opcional</span></label><input className="text-input" id="service-logo" name="logoUrl" type="url" value={service.logoUrl} onChange={change} placeholder="https://cdn.example/logo.webp" /><small>Usa una URL HTTPS de imagen WebP o AVIF.</small></div>
              <div className="field-pair">
                <div className="field-row"><label className="field-label" htmlFor="service-category">Categoría <span>*</span></label><select className="text-input" id="service-category" name="category" value={service.category} onChange={change} required>{categories.slice(1).map((category) => <option key={category}>{category}</option>)}</select></div>
                <div className="field-row"><label className="field-label" htmlFor="service-status">Estado</label><select className="text-input" id="service-status" name="status" value={service.status} onChange={change}><option value="active">Disponible</option><option value="sold_out">Agotado</option><option value="coming_soon">Próximamente</option><option value="inactive">Inactivo</option></select></div>
              </div>
              <div className="field-row"><label className="field-label" htmlFor="service-order">Orden de visualización</label><input className="text-input" id="service-order" name="sortOrder" type="number" min="0" max="10000" step="1" value={service.sortOrder} onChange={change} /></div>
              <div className="field-pair">
                <div className="field-row"><label className="field-label" htmlFor="service-price">Precio exacto <span className="optional">Borrador</span></label><input className="text-input" id="service-price" name="priceAmount" type="number" min="0.01" max="999999999.99" step="0.01" value={service.priceAmount} onChange={change} placeholder="0.00" /></div>
                <div className="field-row"><label className="field-label" htmlFor="service-currency">Moneda</label><select className="text-input" id="service-currency" name="currency" value={service.currency} onChange={change}><option value="USD">USD — dólar estadounidense</option><option value="VES">VES — bolívar</option></select></div>
              </div>
              <div className="field-row"><label className="field-label" htmlFor="service-duration">Duración de la oferta</label><input className="text-input" id="service-duration" name="duration" value={service.duration} onChange={change} maxLength="80" placeholder="Ej.: 1 mes" /></div>
              <div className="field-row"><label className="field-label" htmlFor="service-delivery">Entrega</label><textarea className="text-input" id="service-delivery" name="deliveryDetails" value={service.deliveryDetails} onChange={change} rows="2" maxLength="500" placeholder="Cómo y cuándo recibe el cliente la compra" /></div>
              <div className="field-row"><label className="field-label" htmlFor="service-conditions">Condiciones de la oferta</label><textarea className="text-input" id="service-conditions" name="conditions" value={service.conditions} onChange={change} rows="3" maxLength="1200" placeholder="Restricciones, compatibilidad, renovación y cancelación" /></div>
              <div className="field-row"><label className="field-label" htmlFor="service-support">Soporte posventa</label><textarea className="text-input" id="service-support" name="supportDetails" value={service.supportDetails} onChange={change} rows="2" maxLength="300" placeholder="Canal y plazo de atención" /></div>
              <div className="field-pair seo-fields">
                <div className="field-row"><label className="field-label" htmlFor="service-seo-title">Título SEO</label><input className="text-input" id="service-seo-title" name="seoTitle" value={service.seoTitle} onChange={change} maxLength="100" /></div>
                <div className="field-row"><label className="field-label" htmlFor="service-seo-description">Descripción SEO</label><input className="text-input" id="service-seo-description" name="seoDescription" value={service.seoDescription} onChange={change} maxLength="180" /></div>
              </div>
              <label className="check-row"><input name="isFeatured" type="checkbox" checked={service.isFeatured} onChange={change} /><span className="check-box" /><span>Destacar en el catálogo</span></label>
              <label className="check-row"><input name="authorizedToSell" type="checkbox" checked={service.authorizedToSell} onChange={change} /><span className="check-box" /><span>Confirmo que {BRAND_NAME} está autorizada a comercializar esta oferta</span></label>
              <label className="check-row"><input name="published" type="checkbox" checked={service.published} onChange={change} /><span className="check-box" /><span>Visible en el catálogo público</span></label>
              <p className="editor-disclaimer">La publicación exige precio exacto, moneda, duración, entrega, condiciones, soporte y autorización comercial. Esta confirmación es responsabilidad del operador y no constituye una licencia.</p>
            </div>
            <aside className="preview-column"><div className="preview-label">VISTA PREVIA</div><ServicePreview service={service} /><p>La ficha solo abre una consulta por Telegram si se configura el usuario público; la web no procesa pagos ni crea pedidos.</p></aside>
          </div>
          <div className="editor-footer"><button className="button button-outline" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit" disabled={busy}>Guardar servicio <span aria-hidden="true">→</span></button></div>
        </form>
      )}
    </Dialog>
  );
}

function PriceSimulationEditor({ pricing, onChange, onSubmit, onClose, busy, error }) {
  const changeField = (event) => {
    const { name, value } = event.target;
    onChange((current) => ({ ...current, [name]: value }));
  };
  const changeService = (index, event) => {
    const { name, value } = event.target;
    onChange((current) => ({
      ...current,
      services: current.services.map((service, serviceIndex) => serviceIndex === index
        ? { ...service, [name]: value }
        : service),
    }));
  };

  return (
    <Dialog open={Boolean(pricing)} onClose={onClose} className="site-dialog service-editor-dialog price-simulation-editor-dialog" labelledBy="price-simulation-dialog-title">
      {pricing && (
        <form className="service-editor" onSubmit={onSubmit}>
          <div className="editor-header">
            <div><div className="eyebrow"><span className="eyebrow-dash" /> PRECIOS ILUSTRATIVOS</div><h2 id="price-simulation-dialog-title">Editar tarjetas de precios</h2></div>
            <button className="dialog-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
          </div>
          <div className="editor-content price-simulation-editor-content">
            <div className="editor-fields">
              <div className="field-pair">
                <div className="field-row"><label className="field-label" htmlFor="simulation-rate">Tasa de referencia (Bs. por USDT)</label><input className="text-input" id="simulation-rate" name="rate" type="number" min="0.01" max="1000000" step="0.01" value={pricing.rate} onChange={changeField} required /></div>
                <div className="field-row"><label className="field-label" htmlFor="simulation-date">Fecha del snapshot</label><input className="text-input" id="simulation-date" name="rateDate" type="date" value={pricing.rateDate} onChange={changeField} required /></div>
              </div>
              <p className="editor-disclaimer">Estos valores ilustrativos no son ofertas ni tarifas oficiales. Cambiarlos no crea pedidos ni confirma autorización comercial.</p>
              <div className="simulation-card-editor-list">
                {pricing.services.map((service, index) => (
                  <fieldset className="simulation-card-editor" key={index}>
                    <legend>Tarjeta {index + 1}: {service.name || 'Sin nombre'}</legend>
                    <div className="field-pair">
                      <div className="field-row"><label className="field-label" htmlFor={`simulation-name-${index}`}>Nombre</label><input className="text-input" id={`simulation-name-${index}`} name="name" value={service.name} onChange={(event) => changeService(index, event)} maxLength="80" required /></div>
                      <div className="field-row"><label className="field-label" htmlFor={`simulation-category-${index}`}>Categoría</label><select className="text-input" id={`simulation-category-${index}`} name="category" value={service.category} onChange={(event) => changeService(index, event)} required>{categories.slice(1).map((category) => <option key={category}>{category}</option>)}</select></div>
                      <div className="field-row"><label className="field-label" htmlFor={`simulation-price-${index}`}>Importe ilustrativo (USD)</label><input className="text-input" id={`simulation-price-${index}`} name="monthlyUsd" type="number" min="0.01" max="999999999.99" step="0.01" value={service.monthlyUsd} onChange={(event) => changeService(index, event)} required /></div>
                      <div className="field-row"><label className="field-label" htmlFor={`simulation-period-${index}`}>Texto de duración</label><input className="text-input" id={`simulation-period-${index}`} name="periodLabel" value={service.periodLabel} onChange={(event) => changeService(index, event)} maxLength="40" required /></div>
                    </div>
                  </fieldset>
                ))}
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
          </div>
          <div className="editor-footer"><button className="button button-outline" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar precios'} <span aria-hidden="true">→</span></button></div>
        </form>
      )}
    </Dialog>
  );
}

function AdminPanel({
  email, services, page, pages, total, search, category, status, auditOpen, auditLogs, loading, error,
  onSearch, onCategory, onStatus, onPrevious, onNext, onVisibility, onEdit, onDelete, onNew, onLogout,
  onBack, onToggleAudit, onEditPricing, pricingLoading,
}) {
  return (
    <section className="admin-section page-shell" id="admin-panel" aria-labelledby="admin-title">
      <div className="admin-heading">
        <div><div className="eyebrow"><span className="eyebrow-dash" /> ESPACIO PRIVADO</div><h1 id="admin-title">Panel de <span className="text-gradient">servicios.</span></h1><p className="admin-identity">Sesión iniciada como {email}</p></div>
        <div className="admin-heading-actions"><button className="button button-quiet" type="button" onClick={onBack}>← Volver al catálogo</button><button className="button button-outline" type="button" onClick={onLogout}>Cerrar sesión</button><button className="button button-outline" type="button" onClick={onEditPricing} disabled={pricingLoading}>{pricingLoading ? 'Cargando…' : 'Editar referencias'}</button><button className="button button-primary" type="button" onClick={onNew}><span aria-hidden="true">＋</span> Añadir servicio</button></div>
      </div>
      <div className="admin-toolbar">
        <label className="search-box admin-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg><span className="visually-hidden">Buscar en los servicios</span><input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar por nombre o slug..." /></label>
        <label className="select-wrap"><span className="visually-hidden">Filtrar por categoría</span><select value={category} onChange={(event) => onCategory(event.target.value)}><option value="">Todas las categorías</option>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="select-wrap"><span className="visually-hidden">Filtrar por estado</span><select value={status} onChange={(event) => onStatus(event.target.value)}><option value="">Todos los estados</option><option value="active">Disponible</option><option value="sold_out">Agotado</option><option value="coming_soon">Próximamente</option><option value="inactive">Inactivo</option></select></label>
        <button className="button button-quiet audit-toggle" type="button" onClick={onToggleAudit}>{auditOpen ? 'Ocultar actividad' : 'Ver actividad'} <span aria-hidden="true">↗</span></button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Servicio</th><th>Categoría</th><th>Estado</th><th>Visibilidad</th><th>Orden</th><th><span className="visually-hidden">Acciones</span></th></tr></thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id}>
                <td><div className="admin-service"><span className="admin-service-icon">{initials(service.name)}</span><span><strong>{service.name}</strong><small>{service.slug}</small></span></div></td>
                <td>{service.category}</td>
                <td><span className={`status-badge ${service.status}`}>{statusNames[service.status] || statusNames.active}</span></td>
                <td><button className={`visibility-toggle${service.published ? ' is-published' : ''}`} type="button" onClick={() => onVisibility(service)}>{service.published ? 'Publicado' : 'Oculto'}</button></td>
                <td>{service.sortOrder}</td>
                <td><div className="table-actions"><button className="table-action" type="button" onClick={() => onEdit(service)}>Editar</button><button className="table-action delete" type="button" onClick={() => onDelete(service)}>Eliminar</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {error ? <div className="admin-empty">{error}</div> : services.length === 0 && <div className="admin-empty">{loading ? 'Cargando servicios…' : 'No hay servicios que coincidan con el filtro.'}</div>}
      </div>
      <div className="table-pagination"><span>Página {page} de {pages} · {total} servicios</span><div><button className="icon-button" type="button" aria-label="Página anterior" onClick={onPrevious} disabled={page <= 1}>←</button><button className="icon-button" type="button" aria-label="Página siguiente" onClick={onNext} disabled={page >= pages}>→</button></div></div>
      {auditOpen && <section className="audit-panel" aria-labelledby="audit-title"><div className="audit-heading"><div><div className="eyebrow"><span className="eyebrow-dash" /> TRAZABILIDAD</div><h2 id="audit-title">Actividad reciente</h2></div><span className="audit-note">Últimos cambios de catálogo</span></div><ol className="audit-list">{auditLogs.length ? auditLogs.map((log) => <li key={log.id}><time className="audit-date">{new Date(log.createdAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</time><span><strong className="audit-action">{actionNames[log.action] || log.action}</strong> {log.serviceName} · {log.actor}</span></li>) : <li>Todavía no hay cambios registrados.</li>}</ol></section>}
    </section>
  );
}

function NotFoundPage() {
  return <section className="content-page page-shell"><div className="eyebrow"><span className="eyebrow-dash" /> PÁGINA NO ENCONTRADA</div><h1>Este camino no <span className="text-gradient">existe.</span></h1><p className="page-lede">La dirección puede haber cambiado o no estar disponible.</p><a className="button button-primary" href="/">Volver al inicio</a></section>;
}

export function App({ initialPath, initialPage }) {
  const pathname = initialPath || (typeof window === 'undefined' ? '/' : window.location.pathname);
  const telegramContactUrl = createTelegramContactUrl(import.meta.env.VITE_TELEGRAM_USERNAME || DEFAULT_TELEGRAM_USERNAME);
  const isServiceDetailPath = /^\/catalogo\/[a-f0-9]{16}:[a-z0-9-]+$/.test(pathname);
  const RoutePage = initialPage || pageRoutes[pathname] || (isServiceDetailPath ? ServiceDetailPage : NotFoundPage);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [toast, setToast] = useState('');
  const [adminServices, setAdminServices] = useState([]);
  const [adminPage, setAdminPage] = useState(1);
  const [adminPages, setAdminPages] = useState(1);
  const [adminTotal, setAdminTotal] = useState(0);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminCategory, setAdminCategory] = useState('');
  const [adminStatus, setAdminStatus] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [priceSimulation, setPriceSimulation] = useState(DEFAULT_PRICE_SIMULATION);
  const [priceSimulationError, setPriceSimulationError] = useState('');
  const [priceSimulationEditor, setPriceSimulationEditor] = useState(null);
  const [priceSimulationEditorError, setPriceSimulationEditorError] = useState('');
  const [priceSimulationEditorBusy, setPriceSimulationEditorBusy] = useState(false);
  const [priceSimulationLoading, setPriceSimulationLoading] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [editor, setEditor] = useState(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const toastTimer = useRef(null);

  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3400);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const loadPriceSimulation = useCallback(async () => {
    setPriceSimulationError('');
    try {
      const { pricing } = await api('/api/pricing');
      setPriceSimulation(pricing);
    } catch (error) {
      setPriceSimulationError(`No se pudieron cargar las referencias de precio: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    if (pathname !== '/catalogo') return undefined;
    loadPriceSimulation();
    return undefined;
  }, [pathname, loadPriceSimulation]);

  useEffect(() => {
    document.body.classList.toggle('admin-mode', isAdmin);
    return () => document.body.classList.remove('admin-mode');
  }, [isAdmin]);


  const loadAdminServices = useCallback(async () => {
    const params = new URLSearchParams({ page: String(adminPage), pageSize: '20' });
    if (adminSearch.trim()) params.set('q', adminSearch.trim());
    if (adminStatus) params.set('status', adminStatus);
    if (adminCategory) params.set('category', adminCategory);
    setAdminLoading(true);
    setAdminError('');
    try {
      const result = await api(`/api/admin/services?${params}`, {}, csrfToken);
      setAdminServices(result.services);
      setAdminPages(Math.max(1, result.pagination.pages));
      setAdminTotal(result.pagination.total);
    } catch (error) {
      setAdminServices([]);
      setAdminError(error.message);
      if (error.status === 401) {
        setIsAdmin(false);
        setCsrfToken('');
        setAdminEmail('');
      }
    } finally {
      setAdminLoading(false);
    }
  }, [adminPage, adminSearch, adminStatus, adminCategory, csrfToken]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const timer = setTimeout(loadAdminServices, 180);
    return () => clearTimeout(timer);
  }, [isAdmin, loadAdminServices]);

  useEffect(() => {
    if (!isAdmin || !auditOpen) return undefined;
    let active = true;
    api('/api/admin/audit?page=1&pageSize=30', {}, csrfToken)
      .then(({ logs }) => { if (active) setAuditLogs(logs); })
      .catch((error) => { if (active) showToast(error.message); });
    return () => { active = false; };
  }, [isAdmin, auditOpen, csrfToken, showToast]);


  const enterAdmin = async () => {
    try {
      const session = await api('/api/auth/session');
      if (session.authenticated) {
        setCsrfToken(session.csrfToken);
        setAdminEmail(session.email);
        setIsAdmin(true);
      } else {
        setLoginError('');
        setLoginOpen(true);
      }
    } catch (error) {
      showToast(error.message);
    }
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError('');
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
      setCsrfToken(result.csrfToken);
      setAdminEmail(result.email);
      setLoginOpen(false);
      setIsAdmin(true);
      showToast('Sesión iniciada.');
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoginBusy(false);
    }
  };

  const leaveAdmin = async (notify = true) => {
    if (isAdmin) {
      try {
        await api('/api/auth/logout', { method: 'POST', body: '{}' }, csrfToken);
      } catch { /* La vista se cierra aunque la sesión ya haya expirado. */ }
    }
    setIsAdmin(false);
    setCsrfToken('');
    setAdminEmail('');
    setAuditOpen(false);
    setPriceSimulationEditor(null);
    if (notify) showToast('Sesión administrativa cerrada.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openPriceSimulationEditor = async () => {
    setPriceSimulationLoading(true);
    setPriceSimulationEditorError('');
    try {
      const { pricing } = await api('/api/admin/pricing', {}, csrfToken);
      setPriceSimulationEditor(priceSimulationForEdit(pricing));
    } catch (error) {
      showToast(error.message);
      if (error.status === 401) await leaveAdmin(false);
    } finally {
      setPriceSimulationLoading(false);
    }
  };

  const submitPriceSimulation = async (event) => {
    event.preventDefault();
    if (!priceSimulationEditor) return;
    setPriceSimulationEditorBusy(true);
    setPriceSimulationEditorError('');
    const payload = {
      rate: Number(priceSimulationEditor.rate),
      rateDate: priceSimulationEditor.rateDate,
      services: priceSimulationEditor.services.map(({ monthlyUsd, ...service }) => ({
        ...service,
        monthlyUsdCents: Math.round(Number(monthlyUsd) * 100),
      })),
    };
    try {
      const { pricing } = await api('/api/admin/pricing', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }, csrfToken);
      setPriceSimulation(pricing);
      setPriceSimulationError('');
      setPriceSimulationEditor(null);
      showToast('Tarjetas y tasa de referencia actualizadas.');
    } catch (error) {
      setPriceSimulationEditorError(Object.values(error.fields || {}).join(' ') || error.message);
      if (error.status === 401) await leaveAdmin(false);
    } finally {
      setPriceSimulationEditorBusy(false);
    }
  };

  const mutateService = async (service, method, url, body, successMessage) => {
    try {
      await api(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }, csrfToken);
      showToast(successMessage);
      await loadAdminServices();
      return true;
    } catch (error) {
      showToast(Object.values(error.fields || {}).join(' ') || error.message);
      if (error.status === 401) await leaveAdmin(false);
      return false;
    }
  };

  const toggleVisibility = (service) => mutateService(
    service,
    'PATCH',
    `/api/admin/services/${service.id}/visibility`,
    { published: !service.published },
    service.published ? 'Servicio oculto del catálogo.' : 'Servicio publicado en el catálogo.',
  );

  const deleteService = async (service) => {
    if (!window.confirm(`¿Eliminar “${service.name}” del catálogo? La ficha se conservará en el registro de auditoría.`)) return;
    await mutateService(service, 'DELETE', `/api/admin/services/${service.id}`, undefined, 'Servicio eliminado del catálogo.');
  };

  const openEditor = (service = null) => {
    setEditor(service ? serviceForEdit(service) : createNewService(adminTotal));
  };

  const submitService = async (event) => {
    event.preventDefault();
    if (!editor) return;
    setEditorBusy(true);
    const id = editor.id;
    const { slugWasEdited, ...payload } = editor;
    payload.sortOrder = Number(payload.sortOrder);
    try {
      payload.priceAmount = payload.priceAmount === '' ? null : Math.round(Number(payload.priceAmount) * 100);
      await api(id ? `/api/admin/services/${id}` : '/api/admin/services', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      }, csrfToken);
      setEditor(null);
      showToast(id ? 'Cambios guardados.' : 'Servicio añadido al catálogo.');
      await loadAdminServices();
    } catch (error) {
      if (Object.keys(error.fields || {}).length) {
        const fieldNames = {
          name: 'nombre', slug: 'slug', shortDescription: 'descripción corta', longDescription: 'descripción completa',
          logoUrl: 'logo', category: 'categoría', status: 'estado', sortOrder: 'orden', priceAmount: 'precio',
          currency: 'moneda', duration: 'duración', deliveryDetails: 'entrega', conditions: 'condiciones',
          supportDetails: 'soporte', authorizedToSell: 'autorización comercial',
        };
        showToast(Object.entries(error.fields).map(([field, message]) => `${fieldNames[field] || field}: ${message}`).join(' '));
      } else showToast(error.message);
      if (error.status === 401) await leaveAdmin(false);
    } finally {
      setEditorBusy(false);
    }
  };


  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label={`${BRAND_NAME}, inicio`}><img className="brand-logo" src="/brand/logo-dark.svg" alt="" width="300" height="64" /></a>
        <nav className={`main-nav${menuOpen ? ' is-open' : ''}`} id="main-nav-mobile" aria-label="Navegación principal">
          <a href="/catalogo" onClick={() => setMenuOpen(false)}>Catálogo</a><a href="/nosotros" onClick={() => setMenuOpen(false)}>Nosotros</a><a href="/faqs" onClick={() => setMenuOpen(false)}>FAQs</a><a href="/como-funciona" onClick={() => setMenuOpen(false)}>Cómo funciona</a>
        </nav>
        <button className="button button-quiet admin-entry" type="button" onClick={enterAdmin}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.7-3 8-7 10-4-2-7-5.3-7-10V6l7-3Zm0 4a3 3 0 0 0-3 3v1H8v5h8v-5h-1v-1a3 3 0 0 0-3-3Zm-1 4v-1a1 1 0 1 1 2 0v1h-2Z" /></svg> Administración</button>
        <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="main-nav-mobile" onClick={() => setMenuOpen((open) => !open)}><span /><span /></button>
      </header>

      <main id="main-content"><Suspense fallback={<PageSkeleton />}><RoutePage path={pathname} priceSimulation={priceSimulation} priceSimulationError={priceSimulationError} onRetryPriceSimulation={loadPriceSimulation} /></Suspense></main>

      {isAdmin && <AdminPanel email={adminEmail} services={adminServices} page={adminPage} pages={adminPages} total={adminTotal} search={adminSearch} category={adminCategory} status={adminStatus} auditOpen={auditOpen} auditLogs={auditLogs} loading={adminLoading} error={adminError} pricingLoading={priceSimulationLoading} onEditPricing={openPriceSimulationEditor} onSearch={(value) => { setAdminSearch(value); setAdminPage(1); }} onCategory={(value) => { setAdminCategory(value); setAdminPage(1); }} onStatus={(value) => { setAdminStatus(value); setAdminPage(1); }} onPrevious={() => setAdminPage((page) => Math.max(1, page - 1))} onNext={() => setAdminPage((page) => Math.min(adminPages, page + 1))} onVisibility={toggleVisibility} onEdit={openEditor} onDelete={deleteService} onNew={() => openEditor()} onLogout={() => leaveAdmin()} onBack={() => leaveAdmin(false)} onToggleAudit={() => setAuditOpen((open) => !open)} />}

      <footer className="site-footer"><div className="page-shell footer-top"><a className="brand footer-brand" href="/" aria-label={`${BRAND_NAME}, inicio`}><img className="brand-logo" src="/brand/logo-dark.svg" alt="" width="300" height="64" /></a><p>Menos ruido. Más buenas elecciones.</p><a className="footer-telegram" href={telegramContactUrl} target="_blank" rel="noopener noreferrer">Consultar por Telegram ↗</a><a className="back-top" href="/">Volver al inicio <span aria-hidden="true">↑</span></a></div><div className="page-shell footer-bottom"><span>© {new Date().getFullYear()} {BRAND_NAME}. Tienda independiente.</span><span>No afiliada a las marcas mencionadas.</span><a href="/aviso-legal">Aviso legal y privacidad</a></div></footer>

      <Dialog open={loginOpen} onClose={() => setLoginOpen(false)} className="site-dialog login-dialog" labelledBy="login-title"><form className="dialog-card login-card" onSubmit={submitLogin}><button className="dialog-close" type="button" onClick={() => setLoginOpen(false)} aria-label="Cerrar">×</button><img className="dialog-mark" src="/brand/mark.svg" alt="" width="36" height="36" /><div className="eyebrow"><span className="eyebrow-dash" /> ACCESO RESTRINGIDO</div><h2 id="login-title">Bienvenido<br /><span className="text-gradient">de vuelta.</span></h2><p>Solo el administrador autorizado puede gestionar el catálogo.</p><label className="field-label" htmlFor="login-email">Correo electrónico</label><input className="text-input" id="login-email" name="email" type="email" autoComplete="username" required /><label className="field-label" htmlFor="login-password">Contraseña</label><input className="text-input" id="login-password" name="password" type="password" autoComplete="current-password" required />{loginError && <p className="form-error" role="alert">{loginError}</p>}<button className="button button-primary form-submit" type="submit" disabled={loginBusy}>Iniciar sesión <span aria-hidden="true">→</span></button></form></Dialog>

      <ServiceEditor service={editor} onChange={setEditor} onSubmit={submitService} onClose={() => setEditor(null)} busy={editorBusy} />
      <PriceSimulationEditor pricing={priceSimulationEditor} onChange={setPriceSimulationEditor} onSubmit={submitPriceSimulation} onClose={() => { setPriceSimulationEditor(null); setPriceSimulationEditorError(''); }} busy={priceSimulationEditorBusy} error={priceSimulationEditorError} />
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </>
  );
}