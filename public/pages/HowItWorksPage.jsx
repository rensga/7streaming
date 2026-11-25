const steps = [
  ['01', 'Explora el catálogo', 'Revisa únicamente las ofertas publicadas y sus datos comerciales. Las simulaciones de precios son ejemplos, no precios de venta.'],
  ['02', 'Confirma las condiciones', 'Comprueba el precio final, duración, entrega, condiciones y soporte antes de comprometerte.'],
  ['03', 'Consulta por Telegram', '«Adquirir ahora» abre un chat con una consulta preescrita para coordinar disponibilidad y pago directamente. También puedes usar el enlace del pie de página. La página no procesa cobros ni crea pedidos.'],
];

export default function HowItWorksPage() {
  return <section className="content-page page-shell"><div className="eyebrow"><span className="eyebrow-dash" /> FÁCIL, DIRECTO, TUYO</div><h1>Descubre. Compara.<br /><span className="text-gradient">Decide tú.</span></h1><p className="page-lede">Revisa las ofertas publicadas o consulta por Telegram para solicitar información.</p><div className="steps-list page-steps">{steps.map(([number, title, description]) => <article className="step-item" key={number}><span className="step-num">{number}</span><div><h2>{title}</h2><p>{description}</p></div><span className="step-arrow">↗</span></article>)}</div><a className="button button-primary" href="/catalogo">Ver catálogo ↗</a></section>;
}