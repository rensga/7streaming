import { BRAND_NAME } from '../../brand.js';

const notices = [
  ['Aviso de independencia', `${BRAND_NAME} es una tienda independiente y no está afiliada, patrocinada ni respaldada por Netflix, Disney+, Spotify, Max, Prime Video, Canva ni ninguna otra marca mencionada. Sus nombres y logotipos pertenecen a sus respectivos titulares; su uso no implica autorización ni respaldo.`],
  ['Comercialización responsable', 'Solo deben publicarse productos o servicios cuya comercialización esté permitida por sus titulares y por la legislación aplicable. No ofrecemos cuentas compartidas, credenciales ajenas ni acceso no autorizado.'],
  ['Privacidad', 'El catálogo público no requiere una cuenta ni solicita datos personales. Si el usuario elige abrir Telegram, ese servicio recibe la interacción según sus propias políticas. El panel administrativo usa una cookie de sesión esencial y protegida; no se utilizan analítica ni cookies publicitarias.'],
  ['Términos, pagos y reembolsos', 'En ofertas publicadas, «Adquirir ahora» puede abrir una consulta en Telegram para acordar directamente disponibilidad y método de pago. Esta web no procesa cobros, registra pedidos, confirma pagos ni gestiona entregas o reembolsos. Revisa y acuerda todas las condiciones con el operador antes de pagar; no envíes por chat contraseñas, datos completos de tarjetas ni códigos de verificación.'],
];

export default function LegalPage() {
  return <section className="content-page page-shell"><div className="eyebrow"><span className="eyebrow-dash" /> INFORMACIÓN IMPORTANTE</div><h1>Aviso legal y <span className="text-gradient">privacidad.</span></h1><p className="page-lede">Información sobre independencia, comercialización y tratamiento básico de datos.</p><div className="faq-list">{notices.map(([title, text]) => <details key={title}><summary>{title}</summary><p>{text}</p></details>)}</div></section>;
}