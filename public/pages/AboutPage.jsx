export default function AboutPage() {
  return (
    <section className="content-page page-shell">
      <div className="eyebrow"><span className="eyebrow-dash" /> QUIÉNES SOMOS</div>
      <h1>Elegir bien empieza con <span className="text-gradient">información clara.</span></h1>
      <p className="page-lede">7streaming es una tienda independiente de servicios digitales de entretenimiento y creatividad.</p>
      <section className="content-panel"><h2>Una tienda independiente</h2><p>No estamos afiliados, patrocinados ni respaldados por Netflix, Disney+, Spotify, Max, Prime Video, Canva ni otras marcas del catálogo. Sus nombres y logotipos identifican los servicios y pertenecen a sus respectivos titulares.</p></section>
      <section className="content-panel"><h2>Transparencia siempre</h2><p>Publicamos con claridad el precio, la duración, las condiciones y el soporte de cada oferta. No ofrecemos cuentas compartidas ni pedimos contraseñas de tus plataformas. Si configuras el contacto, «Adquirir ahora» abre Telegram para consultar la oferta y acordar el pago directamente; la web no procesa cobros.</p></section>
      <a className="button button-primary" href="/catalogo">Explorar el catálogo ↗</a>
    </section>
  );
}