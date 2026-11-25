import { BRAND_NAME } from '../../brand.js';

const questions = [
  [`¿${BRAND_NAME} está afiliada a las plataformas del catálogo?`, 'No. Somos una tienda independiente y no estamos afiliados, patrocinados ni respaldados por las marcas mencionadas. Sus nombres y logotipos pertenecen a sus titulares.'],
  ['¿Puedo adquirir un servicio desde la página?', 'En una oferta publicada, «Adquirir ahora» abre un chat de Telegram con una consulta preescrita para confirmar disponibilidad y acordar el método de pago directamente. También puedes iniciar una consulta desde el enlace del pie de página. La web no procesa el cobro, no registra pedidos ni confirma pagos.'],
  ['¿Los ejemplos de precios son definitivos?', 'No. Son importes ilustrativos, no tarifas oficiales ni ofertas disponibles. El administrador puede editar las tarjetas, los importes y la fecha de referencia desde el panel; la tasa no se actualiza en tiempo real y puede diferir de los precios comprador y vendedor actuales. Confirma el precio final por Telegram antes de adquirir un servicio.'],
  ['¿Venden cuentas compartidas?', 'No ofrecemos ni promovemos cuentas compartidas, credenciales ajenas o accesos no autorizados. Solo deben publicarse ofertas cuya comercialización esté permitida.'],
  ['¿Qué datos personales recopila el catálogo?', 'La navegación pública no requiere una cuenta ni solicita datos personales. Si eliges abrir Telegram, el usuario y el mensaje se comparten con ese servicio según sus políticas; el panel privado utiliza una cookie esencial para la sesión administrativa. No compartas contraseñas, datos de tarjeta ni códigos de verificación por chat.'],
  ['¿Cómo solicito cancelaciones o reembolsos?', 'Consulta y acuerda las condiciones de la oferta directamente antes de pagar. La página no registra compras ni gestiona pagos, cancelaciones o reembolsos; publica una oferta solo cuando sus términos reales estén definidos.'],
];

export default function FaqPage() {
  return <section className="content-page page-shell"><div className="eyebrow"><span className="eyebrow-dash" /> RESPUESTAS CLARAS</div><h1>Preguntas <span className="text-gradient">frecuentes.</span></h1><p className="page-lede">Lo esencial sobre nuestras ofertas, compras y pagos.</p><div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>;
}