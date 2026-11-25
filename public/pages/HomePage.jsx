export default function HomePage() {
  return (
    <>
      <section className="hero page-shell" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> Un mejor plan empieza con claridad</div>
          <h1 id="hero-title">Tu próximo<br />favorito está <span className="text-gradient">aquí.</span></h1>
          <p className="hero-lede">Explora las ofertas publicadas y consulta ejemplos orientativos en USD y bolívares; no son precios de venta.</p>
          <a className="button button-primary hero-cta" href="/catalogo">Ver catálogo <span aria-hidden="true">↗</span></a>
          <div className="hero-proof"><span className="proof-icon" aria-hidden="true">✓</span> Consultas por Telegram · tienda independiente</div>
        </div>
        <div className="hero-art" aria-label="Ilustración abstracta de una pantalla con contenido multimedia"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-sun" /><div className="art-window"><div className="art-window-top"><span /><span /><span /><i>tu próxima historia</i></div><div className="art-window-scene"><div className="scene-moon" /><div className="scene-ridge ridge-back" /><div className="scene-ridge ridge-front" /><div className="scene-caption">dale play<br />a lo que te mueve<span>.</span></div></div></div><div className="floating-tag tag-one"><span className="tag-dot tag-lime" /> Explora sin prisa</div><div className="floating-tag tag-two"><span className="tag-spark">✳</span> Tú eliges</div></div>
      </section>
      <section className="trust-strip" aria-label="Nuestro compromiso"><div className="trust-inner page-shell"><span className="trust-label">COMPRA CLARA Y RESPONSABLE</span><div><span className="trust-symbol">↗</span> Tienda independiente</div><div><span className="trust-symbol">◉</span> Condiciones visibles</div><div><span className="trust-symbol">◇</span> Sin cuentas compartidas</div></div></section>
      <section className="home-links page-shell"><a href="/como-funciona"><span>01 — CÓMO FUNCIONA</span><h2>Explora. Revisa.<br /><span className="text-gradient">Elige tú.</span></h2><p>Consulta referencias en USD y bolívares; no son precios de venta.</p><span className="step-arrow">↗</span></a><a href="/nosotros"><span>02 — INDEPENDENCIA</span><h2>Una tienda propia,<br />sin afiliaciones.</h2><p>Conoce nuestro compromiso de transparencia y comercialización responsable.</p><span className="step-arrow">↗</span></a><a href="/faqs"><span>03 — RESPUESTAS</span><h2>¿Tienes dudas?</h2><p>Resolvemos preguntas sobre ofertas, compras y pagos.</p><span className="step-arrow">↗</span></a></section>
    </>
  );
}