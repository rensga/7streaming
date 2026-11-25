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

const state = {
  category: 'Todos',
  search: '',
  services: [],
  csrfToken: '',
  adminEmail: '',
  adminPage: 1,
  adminPages: 1,
  adminTotal: 0,
  isAdmin: false,
  slugWasEdited: false,
  toastTimeout: null,
};

const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);

function node(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '7';
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

async function api(url, options = {}) {
  const method = options.method || 'GET';
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && state.csrfToken) headers['X-CSRF-Token'] = state.csrfToken;
  const response = await fetch(url, { ...options, method, headers, credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.isAdmin) await leaveAdmin(false);
    const error = new Error(data.error || 'No se pudo completar la solicitud.');
    error.status = response.status;
    error.fields = data.fields || {};
    throw error;
  }
  return data;
}

function showToast(message) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(state.toastTimeout);
  state.toastTimeout = setTimeout(() => { toast.hidden = true; }, 3400);
}

function serviceStatus(service) {
  return statusNames[service.status] || statusNames.active;
}

function createMonogram(service, className = 'service-monogram') {
  const mark = node('span', className, initials(service.name));
  const logo = safeHttpsUrl(service.logoUrl);
  if (logo) {
    const image = node('img');
    image.src = logo;
    image.alt = '';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => { image.remove(); }, { once: true });
    mark.replaceChildren(image);
  }
  return mark;
}

function createBadge(service) {
  if (service.status === 'sold_out') return node('span', 'card-badge unavailable', 'Agotado');
  if (service.status === 'coming_soon') return node('span', 'card-badge soon', 'Próximamente');
  if (service.isFeatured) return node('span', 'card-badge featured', '✳ Destacado');
  return node('span', 'card-badge', 'Más información');
}

function createServiceCard(service) {
  const card = node('article', 'service-card');
  const top = node('div', 'card-top');
  top.append(createMonogram(service), createBadge(service));

  const content = node('div', 'card-content');
  content.append(node('div', 'card-category', service.category));
  const titleRow = node('div', 'card-title-row');
  titleRow.append(node('h3', 'card-title', service.name));
  const status = node('span', `card-status ${service.status}`, serviceStatus(service));
  titleRow.append(status);
  content.append(titleRow, node('p', 'card-description', service.shortDescription));

  const price = node('div', 'card-price');
  const priceText = service.priceFrom ? `Desde ${service.priceFrom}` : 'Precio por confirmar';
  price.append(node('strong', '', priceText));
  content.append(price);

  const detail = node('button', 'card-link');
  detail.type = 'button';
  detail.append(node('span', '', 'Ver detalles'), node('span', '', '↗'));
  detail.addEventListener('click', () => openDetails(service));
  content.append(detail);
  card.append(top, content);
  return card;
}

function renderServices() {
  const grid = byId('service-grid');
  grid.replaceChildren(...state.services.map(createServiceCard));
  byId('result-count').textContent = `${state.services.length} ${state.services.length === 1 ? 'servicio disponible' : 'servicios disponibles'}`;
  byId('empty-state').hidden = state.services.length !== 0;
  grid.hidden = state.services.length === 0;
}

async function loadServices() {
  const params = new URLSearchParams();
  if (state.search) params.set('q', state.search);
  if (state.category !== 'Todos') params.set('category', state.category);
  const query = params.size ? `?${params}` : '';
  try {
    const { services } = await api(`/api/services${query}`);
    state.services = services;
    renderServices();
  } catch (error) {
    state.services = [];
    renderServices();
    byId('result-count').textContent = error.message;
  }
}

function renderCategories() {
  const list = byId('category-list');
  list.replaceChildren();
  categories.forEach((category) => {
    const button = node('button', `category-chip${state.category === category ? ' is-active' : ''}`, category);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(state.category === category));
    button.addEventListener('click', () => {
      state.category = category;
      renderCategories();
      loadServices();
    });
    list.append(button);
  });
}

function openDetails(service) {
  byId('detail-mark').replaceWith(createMonogram(service, 'detail-mark'));
  byId('detail-category').textContent = `${service.category} · ${serviceStatus(service)}`;
  byId('detail-title').textContent = service.name;
  byId('detail-description').textContent = service.longDescription;
  byId('detail-price').textContent = service.priceFrom ? `Precio: ${service.priceFrom}.` : 'Precio por confirmar.';
  const purchaseButton = byId('detail-purchase-button');
  purchaseButton.textContent = 'Adquirir ahora';
  purchaseButton.disabled = true;
  purchaseButton.setAttribute('aria-describedby', 'purchase-note');
  byId('detail-dialog').showModal();
}

function openLogin() {
  byId('login-error').hidden = true;
  byId('login-form').reset();
  byId('login-dialog').showModal();
  byId('login-email').focus();
}

function showAdminView() {
  state.isAdmin = true;
  document.body.classList.add('admin-mode');
  byId('admin-panel').hidden = false;
  byId('admin-identity').textContent = `Sesión iniciada como ${state.adminEmail}`;
  byId('admin-panel').scrollIntoView({ block: 'start' });
  loadAdminServices();
}

async function enterAdmin() {
  try {
    const session = await api('/api/auth/session');
    if (session.authenticated) {
      state.csrfToken = session.csrfToken;
      state.adminEmail = session.email;
      showAdminView();
      return;
    }
    openLogin();
  } catch (error) {
    showToast(error.message);
  }
}

async function leaveAdmin(notify = true) {
  if (state.isAdmin) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-Token': state.csrfToken, 'Content-Type': 'application/json' },
        body: '{}',
      });
    } catch { /* La vista también se cierra si la sesión ya expiró. */ }
  }
  state.isAdmin = false;
  state.csrfToken = '';
  state.adminEmail = '';
  document.body.classList.remove('admin-mode');
  byId('admin-panel').hidden = true;
  if (notify) showToast('Sesión administrativa cerrada.');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitLogin(event) {
  event.preventDefault();
  const errorBox = byId('login-error');
  errorBox.hidden = true;
  const submitButton = event.submitter;
  if (submitButton) submitButton.disabled = true;
  try {
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
    state.csrfToken = result.csrfToken;
    state.adminEmail = result.email;
    byId('login-dialog').close();
    showAdminView();
    showToast('Sesión iniciada.');
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function adminQuery() {
  const params = new URLSearchParams({ page: String(state.adminPage), pageSize: '20' });
  const search = byId('admin-search').value.trim();
  const status = byId('admin-status').value;
  const category = byId('admin-category').value;
  if (search) params.set('q', search);
  if (status) params.set('status', status);
  if (category) params.set('category', category);
  return params;
}

async function loadAdminServices() {
  const rows = byId('admin-rows');
  rows.replaceChildren();
  try {
    const { services, pagination } = await api(`/api/admin/services?${adminQuery()}`);
    byId('admin-empty').hidden = services.length !== 0;
    services.forEach((service) => rows.append(createAdminRow(service)));
    state.adminPages = Math.max(1, pagination.pages);
    state.adminTotal = pagination.total;
    byId('admin-page-label').textContent = `Página ${pagination.page} de ${state.adminPages} · ${state.adminTotal} servicios`;
    byId('admin-prev').disabled = pagination.page <= 1;
    byId('admin-next').disabled = pagination.page >= state.adminPages;
  } catch (error) {
    byId('admin-empty').hidden = false;
    byId('admin-empty').textContent = error.message;
  }
}

function createAdminRow(service) {
  const row = node('tr');
  const serviceCell = node('td');
  const serviceInfo = node('div', 'admin-service');
  serviceInfo.append(node('span', 'admin-service-icon', initials(service.name)));
  const serviceName = node('span');
  serviceName.append(node('strong', '', service.name), node('small', '', service.slug));
  serviceInfo.append(serviceName);
  serviceCell.append(serviceInfo);

  const categoryCell = node('td', '', service.category);
  const statusCell = node('td');
  statusCell.append(node('span', `status-badge ${service.status}`, serviceStatus(service)));
  const visibilityCell = node('td');
  const visibility = node('button', `visibility-toggle${service.published ? ' is-published' : ''}`, service.published ? 'Publicado' : 'Oculto');
  visibility.type = 'button';
  visibility.addEventListener('click', async () => {
    try {
      await api(`/api/admin/services/${service.id}/visibility`, {
        method: 'PATCH', body: JSON.stringify({ published: !service.published }),
      });
      showToast(service.published ? 'Servicio oculto del catálogo.' : 'Servicio publicado en el catálogo.');
      await Promise.all([loadAdminServices(), loadServices()]);
    } catch (error) { showToast(error.message); }
  });
  visibilityCell.append(visibility);

  const orderCell = node('td', '', String(service.sortOrder));
  const actionsCell = node('td');
  const actions = node('div', 'table-actions');
  const edit = node('button', 'table-action', 'Editar');
  edit.type = 'button';
  edit.addEventListener('click', () => openServiceEditor(service));
  const remove = node('button', 'table-action delete', 'Eliminar');
  remove.type = 'button';
  remove.addEventListener('click', () => deleteService(service));
  actions.append(edit, remove);
  actionsCell.append(actions);
  row.append(serviceCell, categoryCell, statusCell, visibilityCell, orderCell, actionsCell);
  return row;
}

async function deleteService(service) {
  if (!window.confirm(`¿Eliminar “${service.name}” del catálogo? La ficha se conservará en el registro de auditoría.`)) return;
  try {
    await api(`/api/admin/services/${service.id}`, { method: 'DELETE' });
    showToast('Servicio eliminado del catálogo.');
    await Promise.all([loadAdminServices(), loadServices()]);
  } catch (error) { showToast(error.message); }
}

function openServiceEditor(service = null) {
  const form = byId('service-form');
  form.reset();
  state.slugWasEdited = Boolean(service);
  byId('service-dialog-title').textContent = service ? 'Editar servicio' : 'Añadir servicio';
  const fields = {
    id: service?.id || '',
    name: service?.name || '',
    slug: service?.slug || '',
    shortDescription: service?.shortDescription || '',
    longDescription: service?.longDescription || '',
    logoUrl: service?.logoUrl || '',
    category: service?.category || 'Video',
    status: service?.status || 'active',
    sortOrder: service?.sortOrder ?? state.adminTotal + 1,
    priceFrom: service?.priceFrom || '',
    seoTitle: service?.seoTitle || '',
    seoDescription: service?.seoDescription || '',
  };
  Object.entries(fields).forEach(([name, value]) => {
    const input = form.elements.namedItem(name);
    if (input) input.value = String(value);
  });
  byId('service-featured').checked = Boolean(service?.isFeatured);
  byId('service-published').checked = service ? Boolean(service.published) : true;
  renderPreview();
  byId('service-dialog').showModal();
}

function servicePayload(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  return {
    ...values,
    sortOrder: Number(values.sortOrder),
    isFeatured: byId('service-featured').checked,
    published: byId('service-published').checked,
  };
}

function renderPreview() {
  const payload = servicePayload(byId('service-form'));
  const preview = byId('service-preview');
  const top = node('div', 'card-top');
  const mark = node('span', 'service-monogram', initials(payload.name));
  const logo = safeHttpsUrl(payload.logoUrl);
  if (logo) {
    const image = node('img');
    image.src = logo;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => image.remove(), { once: true });
    mark.replaceChildren(image);
  }
  top.append(mark, node('span', 'card-badge', payload.published ? 'Disponible' : 'Oculto'));
  const content = node('div', 'card-content');
  content.append(node('div', 'card-category', payload.category || 'Categoría'));
  content.append(node('div', 'card-title-row'), node('p', 'card-description', payload.shortDescription || 'Descripción breve del servicio.'));
  content.querySelector('.card-title-row').append(node('h3', 'card-title', payload.name || 'Nombre del servicio'));
  const price = payload.priceFrom ? `Desde ${payload.priceFrom}` : 'Precio por confirmar';
  content.append(node('div', 'card-price', price));
  preview.replaceChildren(top, content);
}

async function submitService(event) {
  event.preventDefault();
  const payload = servicePayload(event.currentTarget);
  const id = payload.id;
  delete payload.id;
  const button = event.submitter;
  if (button) button.disabled = true;
  try {
    await api(id ? `/api/admin/services/${id}` : '/api/admin/services', {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(payload),
    });
    byId('service-dialog').close();
    showToast(id ? 'Cambios guardados.' : 'Servicio añadido al catálogo.');
    await Promise.all([loadAdminServices(), loadServices()]);
  } catch (error) {
    if (Object.keys(error.fields || {}).length) {
      const fieldNames = {
        name: 'nombre', slug: 'slug', shortDescription: 'descripción corta', longDescription: 'descripción completa',
        logoUrl: 'logo', category: 'categoría', status: 'estado', sortOrder: 'orden',
      };
      const details = Object.entries(error.fields).map(([field, message]) => `${fieldNames[field] || field}: ${message}`).join(' ');
      showToast(details);
    } else showToast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadAudit() {
  const panel = byId('audit-panel');
  panel.hidden = !panel.hidden;
  if (panel.hidden) return;
  try {
    const { logs } = await api('/api/admin/audit?page=1&pageSize=30');
    const list = byId('audit-list');
    list.replaceChildren();
    if (!logs.length) {
      list.append(node('li', '', 'Todavía no hay cambios registrados.'));
      return;
    }
    logs.forEach((log) => {
      const item = node('li');
      const date = new Date(log.createdAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
      item.append(node('time', 'audit-date', date));
      const description = node('span');
      description.append(node('strong', 'audit-action', actionNames[log.action] || log.action), document.createTextNode(` ${log.serviceName} · ${log.actor}`));
      item.append(description);
      list.append(item);
    });
  } catch (error) { showToast(error.message); }
}

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function init() {
  byId('current-year').textContent = String(new Date().getFullYear());
  renderCategories();
  loadServices();

  byId('admin-entry').addEventListener('click', enterAdmin);
  byId('login-form').addEventListener('submit', submitLogin);
  byId('admin-logout').addEventListener('click', () => leaveAdmin());
  byId('back-to-site').addEventListener('click', () => leaveAdmin(false));
  byId('new-service').addEventListener('click', () => openServiceEditor());
  byId('service-form').addEventListener('submit', submitService);
  byId('audit-toggle').addEventListener('click', loadAudit);
  byId('admin-prev').addEventListener('click', () => { state.adminPage -= 1; loadAdminServices(); });
  byId('admin-next').addEventListener('click', () => { state.adminPage += 1; loadAdminServices(); });
  byId('admin-status').addEventListener('change', () => { state.adminPage = 1; loadAdminServices(); });
  byId('admin-category').addEventListener('change', () => { state.adminPage = 1; loadAdminServices(); });
  byId('admin-search').addEventListener('input', debounce(() => { state.adminPage = 1; loadAdminServices(); }, 180));
  byId('clear-filters').addEventListener('click', () => {
    state.category = 'Todos';
    state.search = '';
    byId('catalog-search').value = '';
    renderCategories();
    loadServices();
  });

  byId('catalog-search').addEventListener('input', debounce((event) => {
    state.search = event.target.value.trim();
    loadServices();
  }, 180));

  byId('service-name').addEventListener('input', () => {
    if (!state.slugWasEdited) byId('service-slug').value = slugify(byId('service-name').value);
    renderPreview();
  });
  byId('service-slug').addEventListener('input', () => { state.slugWasEdited = true; renderPreview(); });
  byId('service-form').addEventListener('input', renderPreview);
  byId('service-form').addEventListener('change', renderPreview);

  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog').close());
  });
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  const menuToggle = byId('menu-toggle');
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!open));
    $('#main-nav-mobile').classList.toggle('is-open', !open);
  });
  $('#main-nav-mobile').querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    menuToggle.setAttribute('aria-expanded', 'false');
    $('#main-nav-mobile').classList.remove('is-open');
  }));

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      byId('catalog-search').focus();
    }
  });
}

function debounce(callback, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), delay);
  };
}

init();