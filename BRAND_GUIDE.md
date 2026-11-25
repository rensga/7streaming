# Identidad de marca · 7streaming

## Esencia

**7streaming es una tienda independiente de servicios digitales de entretenimiento y creatividad.** No está afiliada a las marcas del catálogo. El checkout está en preparación; no se deben prometer compras o pagos hasta integrar y probar una pasarela.

- **Idea central:** elegir con claridad, sin ruido ni promesas confusas.
- **Lema principal:** Menos ruido. Más buenas elecciones.
- **Lema de campaña:** Descubre. Compara. Decide.
- **Personalidad:** editorial, cálida, contemporánea, directa y transparente.
- **Promesa:** ofertas publicadas por 7streaming con precio, duración, condiciones y soporte claros, sin sugerir afiliación oficial.

## Logotipo y símbolo

Los originales vectoriales están en `public/brand/`:

- `logo-dark.svg`: logotipo para fondos oscuros; uso principal en la web.
- `logo-light.svg`: logotipo para fondos claros.
- `mark.svg`: símbolo compacto para favicon, avatar o espacios pequeños.

El siete geométrico representa exploración y movimiento; el pequeño acento triangular evoca avanzar. Conserva el espacio libre alrededor del símbolo (al menos el ancho del acento) y no deformes, inclines ni recolorees el logotipo. Usa `mark.svg` cuando el logotipo completo no quepa con legibilidad. No añadas el nombre o los símbolos de proveedores al logotipo.

## Paleta

| Color | Hex | Uso recomendado |
| --- | --- | --- |
| Carbón | `#101114` | Fondo principal |
| Carbón suave | `#15171A` | Fondo alternativo y contraste del símbolo |
| Superficie | `#1A1C21` | Tarjetas y paneles |
| Marfil | `#F3F1EC` | Texto principal sobre oscuro |
| Gris | `#9C9DA1` | Texto secundario |
| Lima | `#B9F36B` | Acción, foco y énfasis sobre oscuro |
| Coral | `#FF916B` | Acento pequeño de movimiento |
| Violeta | `#9A8CFF` | Acento secundario en ilustración |

Usa marfil o lima para texto legible sobre carbón. Reserva coral y violeta para detalles; no los uses como texto pequeño sobre fondos oscuros.

## Tipografía y composición

- **Titulares:** Manrope, peso 600–800; alternativa del sistema: Segoe UI.
- **Texto y controles:** DM Sans, peso 400–700; alternativa del sistema: Segoe UI.
- Prefiere titulares breves, buen espacio negativo, esquinas suavemente redondeadas e ilustraciones abstractas originales.
- Las piezas de `public/brand/` son SVG editables y pueden abrirse en Figma, Illustrator o Inkscape. Se pueden exportar al formato y tamaño requerido por cada canal.

## Voz y mensajes

Habla de descubrir, explorar, elegir y adquirir. Sé específico sobre el alcance de cada oferta y su estado de compra. Mantén un tono amable y seguro, nunca urgente ni engañoso; indica que el checkout no está habilitado mientras siga pendiente.

**Sí:** «Tienda independiente»; «Adquirir ahora» (solo cuando el checkout esté habilitado); «Sin afiliación con las marcas»; «Sin cuentas compartidas».

**No:** «Suscripción garantizada», «precio más barato» o «acceso exclusivo» si no se puede demostrar; nunca sugieras que 7streaming representa a una plataforma, está afiliado a ella o tiene autorización oficial sin acreditarlo. No publiques ofertas que impliquen credenciales compartidas o acceso no autorizado.

## Piezas incluidas

- `public/brand/flyer-a4.svg`: flyer vertical A4 en vector.
- `public/brand/social-feed.svg`: publicación vertical 4:5 (1080 × 1350).
- `public/brand/social-story.svg`: historia vertical 9:16 (1080 × 1920).
- `public/brand/social-cover.svg`: portada horizontal (1200 × 630).
- `public/brand/logo-dark.svg`, `logo-light.svg` y `mark.svg`: sistema de marca principal.

Las ilustraciones son abstractas y originales: no incluyen logotipos, personajes, carteles ni imágenes de las plataformas listadas. Si se personaliza una pieza, conserva el aviso de independencia y la aclaración de que las marcas pertenecen a sus titulares. No publiques precios ni disponibilidad sin verificarlos.

## Uso digital

La web usa el símbolo como favicon y el logotipo oscuro en cabecera y pie. El archivo `social-cover.svg` puede usarse como imagen de vista previa social; para producción, configura `og:image` con su URL absoluta en el dominio final y comprueba la previsualización en cada red antes de publicar.