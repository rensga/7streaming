const errorPages = {
  '/403': {
    code: '403',
    eyebrow: 'ACCESO DENEGADO',
    title: 'No tienes permiso para entrar.',
    description: 'Esta sección está restringida. Si necesitas administrar el sitio, inicia sesión desde el acceso privado.',
  },
  '/500': {
    code: '500',
    eyebrow: 'ERROR DEL SERVIDOR',
    title: 'Algo no salió como esperábamos.',
    description: 'No pudimos completar la solicitud. Intenta de nuevo más tarde o vuelve al inicio.',
  },
};

export default function ErrorPage({ path = '/404' }) {
  const page = errorPages[path] || {
    code: '404',
    eyebrow: 'PÁGINA NO ENCONTRADA',
    title: 'No encontramos lo que buscabas.',
    description: 'La dirección puede haber cambiado o ya no estar disponible. Puedes volver al inicio o explorar el catálogo.',
  };

  return (
    <section className="content-page error-page page-shell" aria-labelledby="error-title">
      <div className="eyebrow"><span className="eyebrow-dash" /> {page.eyebrow}</div>
      <p className="error-code" aria-hidden="true">{page.code}</p>
      <h1 id="error-title">{page.title}</h1>
      <p className="page-lede">{page.description}</p>
      <div className="error-actions">
        <a className="button button-primary" href="/">Volver al inicio</a>
        <a className="button button-outline" href="/catalogo">Explorar catálogo</a>
      </div>
    </section>
  );
}