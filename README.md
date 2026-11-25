# Eligeva

Tienda independiente en español de servicios digitales de streaming y creatividad. Incluye catálogo filtrable, fichas de oferta y un panel privado para administrar los servicios.

## Ejecutar localmente

Requiere Node.js 22 o posterior.

Instala las dependencias del frontend React:

```powershell
npm install
```

```powershell
Copy-Item .env.example .env
```

Completa `ADMIN_EMAIL` y `ADMIN_PASSWORD` en `.env`; usa una contraseña propia de al menos 12 caracteres. Luego ejecuta:

```powershell
npm start
```

Abre `http://localhost:2008`. `npm start` compila y prerenderiza el sitio y luego inicia el servidor en primer plano. `npm run build` solo compila y prerenderiza; no detiene ni inicia procesos. `npm test` compila antes de ejecutar las pruebas. Si el puerto 2008 ya está ocupado, el servidor informa el error sin detener el proceso existente. Si no se configuran las credenciales, el catálogo público funciona y el panel administrativo permanece deshabilitado.

## Funcionalidades

- Páginas independientes en `/catalogo`, `/nosotros`, `/faqs`, `/como-funciona` y `/aviso-legal`, además de la portada; cada una entrega HTML prerenderizado y su propio chunk React.
- Catálogo público con skeletons de carga, búsqueda con debounce, filtros por categoría y paginación en cliente y API; los GET idénticos concurrentes se comparten.
- Selección de servicios destacados y catálogo completo en secciones diferenciadas.
- Fichas de oferta con precio exacto en USD/VES, duración, entrega, condiciones y soporte; el servidor impide publicar una oferta sin esos datos y confirmación de autorización comercial.
- Las instalaciones nuevas no incluyen productos de ejemplo; los registros heredados incompletos quedan como borradores no visibles.
- El panel permite editar las tarjetas hipotéticas del simulador, su precio base, categoría, duración de referencia y tasa/fecha; siguen identificadas como ejemplos y no se convierten en ofertas de venta.
- «Adquirir ahora» abre un chat de Telegram con una consulta preescrita. El enlace público de consultas también aparece en el pie del sitio; la web no procesa pagos ni registra pedidos, confirma cobros o realiza entregas.
- Panel de administración protegido por sesión, con búsqueda, filtros, paginación, alta, edición, borrado lógico, publicación y orden de cards.
- Vista previa del contenido antes de guardarlo y registro de auditoría de cambios.
- Persistencia local en `data/catalog.json`, creado al iniciar el servidor por primera vez.
- Índices en memoria por categoría y estado para consultas públicas y administrativas habituales.
- Imágenes de logotipos limitadas a formatos WebP/AVIF; el servidor entrega sus MIME y caché adecuados. No hay imágenes raster locales ni scripts de terceros en la interfaz actual.
- Seguridad básica: contraseña derivada con `scrypt`, cookie `HttpOnly` y `SameSite=Strict`, token CSRF en cambios, validación de campos y URL HTTPS, límite de intentos de inicio de sesión y cabeceras de seguridad. En `NODE_ENV=production` exige `APP_ORIGIN` HTTPS y credenciales de administración; las cookies incluyen `Secure` y se envía HSTS.
- SEO técnico con URL canónica por página, `robots.txt`, `sitemap.xml` y `/api/health` para comprobación de vida.
- Diseño adaptable a móvil y escritorio; no usa cuentas de cliente ni cookies de analítica. Al abrir Telegram, el usuario sale del sitio y comparte allí su interacción bajo las políticas de Telegram.

## Identidad visual

El kit de marca editable está documentado en `BRAND_GUIDE.md` e incluye logotipos SVG, símbolo, flyer A4 y piezas para redes en formatos 4:5, 9:16 y 1200 × 630. Las ilustraciones son originales y la comunicación identifica a Eligeva como tienda independiente y no afiliada a las marcas listadas. La web usa `mark.svg` como favicon y en el acceso administrativo, `logo-dark.svg` en cabecera y pie y `social-cover.svg` en los metadatos de vista previa; define `APP_ORIGIN` al compilar para que `og:image` use la URL absoluta del dominio final.

## Alcance legal y operativo

Eligeva es una tienda independiente; no está afiliada, patrocinada ni respaldada por las marcas listadas. «Adquirir ahora» solo abre un chat con el operador para coordinar manualmente una oferta publicada; no es un checkout y la página no recibe ni verifica pagos ni pedidos. Antes de vender, confirma que cada oferta pueda comercializarse, define condiciones reales de servicio, cancelación y reembolso, y configura la facturación correspondiente. No pidas ni compartas por Telegram contraseñas, datos completos de tarjetas ni códigos de verificación.

No publiques ofertas que impliquen credenciales compartidas, suplantación, fraude o acceso no autorizado. Los nombres y logotipos pertenecen a sus respectivos titulares y no implican afiliación ni respaldo.

Esta entrega puede desplegarse como catálogo y canal de consultas, pero eso no acredita que esté lista para vender. Antes de aceptar pagos manualmente hacen falta autorización de comercialización de cada oferta, identidad legal y políticas reales, soporte, condiciones de pago y un proceso de conciliación, pedidos y entrega. Consulta `PRODUCTION_CHECKLIST.md`; no reutilices una contraseña de desarrollo.

En desarrollo local, el catálogo se guarda en `data/catalog.json`. En Vercel, Firebase Admin/Firestore persiste catálogo, simulador, auditoría, sesiones y límites de intentos; las ediciones usan transacciones con control de versión para evitar sobrescribir cambios simultáneos. El estado se guarda en un documento Firestore y rechaza escrituras por encima de 900 KB para evitar el límite máximo de 1 MiB por documento.

### Despliegue

Para conectar Firebase, crea un proyecto y una base de datos Cloud Firestore en modo nativo. En Firebase Console → Configuración del proyecto → Cuentas de servicio, genera una clave privada para una cuenta de servicio y añade en Vercel `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`, junto con `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 12 caracteres). La clave privada debe ser un secreto de Vercel y nunca una variable `VITE_*`; conserva el formato PEM o los saltos de línea como `\n`. Aplica `firestore.rules` desde Firebase Console o ejecuta `firebase deploy --only firestore:rules --project <project-id>`; las reglas bloquean clientes, mientras que el Admin SDK del servidor las omite. Usa un proyecto Firebase distinto para Preview y otro para Production. El primer acceso crea el documento de estado y usa `data/catalog.json` como semilla únicamente si Firestore aún está vacío. No incluyas credenciales en el frontend. `APP_ORIGIN` usa el dominio público asignado por Vercel si no se define manualmente; `VITE_TELEGRAM_USERNAME` tiene el valor público `rensgaaa` por defecto. `/api/health` es la ruta de comprobación de vida.

Revisa `PRODUCTION_CHECKLIST.md` para el análisis del mercado, la preparación comercial y las dependencias externas pendientes.

### CDN de assets

Para producción, configura `ASSET_CDN_URL` con la URL base HTTPS del CDN (por ejemplo, `https://cdn.example.com/eligeva`) tanto al compilar como al iniciar el servidor. El build publica las URLs de CSS, JavaScript y recursos Vite desde esa base; sincroniza el contenido de `dist/assets` con la ruta `/assets` del CDN y conserva la misma estructura. El servidor incorpora el origen configurado a su política CSP. Los scripts actuales son módulos de primera parte y no se carga JavaScript de terceros.

## Pruebas

```powershell
npm test
```

Las pruebas usan directorios temporales dentro del proyecto y los eliminan al terminar.