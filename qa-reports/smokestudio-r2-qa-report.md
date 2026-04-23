# Smoke Studio R2 — Reporte de Análisis QA
> **Metodología:** scoutqa-test skill (github/awesome-copilot)  
> **Fecha:** 2026-04-22  
> **Analista:** Claude Code (scoutqa-test static analysis)  
> **Repositorio:** https://github.com/GEPS2705/SmokeStudio.R2  
> **Rama:** main — commit `8085816`

---

## Resumen Ejecutivo

| Dimensión | Estado | Calificación |
|---|---|---|
| Estructura HTML | ✅ Buena | 8/10 |
| Sistema CSS/Diseño | ✅ Bueno | 8/10 |
| JavaScript Core (`main.js`) | ✅ Bueno | 7/10 |
| JavaScript Complejo (`smokescan.js`) | ⚠️ Necesita trabajo | 4/10 |
| Diseño Responsivo | ✅ Bueno | 8/10 |
| Rendimiento | ❌ Deficiente | 3/10 |
| Accesibilidad | ⚠️ Parcial | 6/10 |
| SEO | ⚠️ Parcial | 5/10 |
| Seguridad | ❌ Crítico | 2/10 |
| Integración Firebase | ❌ No funciona | 0/10 |
| Integración Gemini AI | ❌ No funciona | 0/10 |
| Calidad de Código | ⚠️ Regular | 5/10 |

### Conteo de Incidencias

| Severidad | Cantidad |
|---|---|
| 🔴 Crítico | 3 |
| 🟠 Alto | 5 |
| 🟡 Medio | 8 |
| 🔵 Bajo | 7 |
| ♿ Accesibilidad | 4 |
| **Total** | **27** |

---

## Metodología de Análisis

Este reporte fue generado aplicando la metodología del skill **scoutqa-test** de `github/awesome-copilot`, que cubre:

1. **Smoke Test** — Verificación de funcionalidad crítica (navegación, CTAs, formularios)
2. **Auditoría de Accesibilidad** — WCAG 2.1 AA compliance
3. **Análisis de Seguridad** — OWASP Top 10, exposición de credenciales
4. **Rendimiento** — Assets, lazy loading, imágenes
5. **Calidad de Código** — Patrones, deuda técnica, dead code
6. **SEO** — Meta tags, estructura, datos estructurados

> **Nota:** Se realizó análisis estático completo sobre los 4 archivos HTML, 2 CSS (4,729 líneas), y 2 archivos JS (1,793 líneas). El análisis live vía scoutqa CLI requiere cuenta activa en ScoutQA.ai.

---

## Hallazgos Detallados

---

### 🔴 CRÍTICO — 3 Incidencias

---

#### [C-01] Firebase no configurado — Autenticación completamente rota
- **Archivo:** `smokescan.js`, líneas 1135–1141
- **Descripción:** Las credenciales de Firebase son placeholders literales (`"TU_API_KEY"`, `"tu-proyecto.firebaseapp.com"`). `Firebase.initializeApp()` falla silenciosamente, rompiendo autenticación y Firestore.
- **Impacto:** SmokeScan no puede autenticar usuarios ni persistir datos en producción. Todos los flujos de login (Google/Microsoft OAuth) son no funcionales.
- **Evidencia:**
  ```js
  const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    // ...
  };
  ```
- **Recomendación:** Crear proyecto Firebase real, configurar variables de entorno (no hardcodear), activar Google/Microsoft OAuth providers.

---

#### [C-02] API Key de Gemini ausente — Función AI completamente rota
- **Archivo:** `smokescan.js`, línea de inicialización de `STATE.apiKey`
- **Descripción:** `STATE.apiKey` se inicializa como string vacío. La función `fetchGeminiAnalysis()` no puede hacer llamadas a la API de Gemini.
- **Impacto:** La característica core del producto (análisis AI de ideas) no funciona en producción. El sistema cae en modo simulado con respuestas fake.
- **Recomendación:** Implementar un backend proxy (Node.js/Cloud Function) para las llamadas a Gemini. Nunca exponer API keys en frontend.

---

#### [C-03] Sin backend — API keys expuestas si se configuran en frontend
- **Archivo:** `smokescan.js` (toda la capa de integración)
- **Descripción:** No existe servidor backend. Las llamadas a Gemini se hacen directamente desde el navegador. Si se configura una API key real en el código frontend, quedará expuesta públicamente.
- **Impacto:** Riesgo de abuso masivo de API key, costos ilimitados, posible suspensión de cuenta de Google Cloud.
- **Recomendación:** Implementar backend serverless (Firebase Cloud Functions o Vercel Edge Functions) como proxy para todas las llamadas externas.

---

### 🟠 ALTO — 5 Incidencias

---

#### [A-01] Vulnerabilidad XSS — innerHTML con datos de usuario sin sanitizar
- **Archivo:** `smokescan.js`, aproximadamente línea 1250
- **Descripción:** El nombre de usuario se inserta directamente en el DOM via `innerHTML`:
  ```js
  cta.innerHTML = 'Hola, ' + firstName;
  ```
- **Impacto:** Si un atacante controla `firstName` (posible con auth real), puede inyectar HTML/scripts maliciosos. Actualmente mitigado por auth mock, pero es un patrón peligroso.
- **Recomendación:** Usar `textContent` en lugar de `innerHTML`, o sanitizar con DOMPurify:
  ```js
  cta.textContent = `Hola, ${firstName}`;
  ```

---

#### [A-02] Control de intentos únicamente en cliente — Bypass trivial
- **Archivo:** `smokescan.js`, lógica de `FirebaseAuthService`
- **Descripción:** El límite de 2 intentos por día se gestiona con objetos en memoria del navegador. Un recargo de página resetea el contador.
- **Impacto:** Cualquier usuario puede usar SmokeScan ilimitadas veces sin autenticarse realmente, generando costos no controlados de API.
- **Recomendación:** Mover el control de intentos al backend con Firestore rate limiting por UID.

---

#### [A-03] Autenticación simulada (mock mode) activa en codebase
- **Archivo:** `smokescan.js`, clase `FirebaseAuthService`
- **Descripción:** El login de Google/Microsoft muestra un modal falso con usuarios hardcodeados. La consola imprime `"Iniciando sesión en Modo Simulador"` en cada intento.
- **Impacto:** Los usuarios no tienen sesión real. Si se despliega así, el producto no funciona. Los `console.log` filtran información de debugging en producción.
- **Recomendación:** Implementar OAuth real (Firebase Auth SDK) y eliminar todos los `console.log` o guardarlos detrás de un flag `DEBUG`.

---

#### [A-04] Sin reglas de seguridad en Firestore
- **Descripción:** Las reglas de Firestore no están configuradas en el repositorio. Por defecto Firestore en modo development permite leer/escribir cualquier dato a cualquier usuario.
- **Impacto:** Si Firebase se configura con las reglas por defecto, cualquier usuario puede leer y sobreescribir los datos de cualquier otro.
- **Recomendación:** Definir y versionar `firestore.rules` en el repositorio con reglas de seguridad basadas en UID.

---

#### [A-05] Imágenes sin optimizar — Hasta 1.6 MB por imagen
- **Archivos:** `assets/problem-stats.jpg` (1.6MB), `assets/hero-team.jpg` (1.1MB), `assets/cta-team.jpg` (945KB)
- **Descripción:** Las imágenes principales no tienen compresión adecuada, no hay formato WebP, ni `srcset` para dispositivos móviles.
- **Impacto:** En conexiones móviles 3G/4G el LCP (Largest Contentful Paint) supera los 4 segundos, penalizando fuertemente el SEO y la conversión.
- **Recomendación:** Comprimir a ≤200KB por imagen, generar variantes WebP, implementar `srcset` con breakpoints en 400/800/1200px.

---

### 🟡 MEDIO — 8 Incidencias

---

#### [M-01] `alert()` en UI de producción — 3 instancias
- **Archivo:** `smokescan.js`
- **Descripción:** Se usan `alert()` nativos del browser para mostrar errores al usuario (`"Ya no tienes intentos disponibles hoy"`, `"Completa todos los campos"`).
- **Impacto:** UX degradada, bloqueante del thread UI, no personalizable, inconsistente con el diseño del producto.
- **Recomendación:** Reemplazar con un componente de toast/snackbar o modal que siga el design system existente.

---

#### [M-02] `href=""` vacío en botón CTA principal
- **Archivo:** `index.html`, línea ~590
- **Descripción:** `<a href="" onclick="Calendly...">` tiene un `href` vacío, causando una recarga de página si `onclick` falla.
- **Impacto:** En caso de error del script Calendly, el botón de contacto principal recarga la página en lugar de informar el error.
- **Recomendación:** Cambiar a `href="javascript:void(0)"` o `<button type="button">`.

---

#### [M-03] Sin Open Graph meta tags — Compartido en redes sin preview
- **Archivos:** `index.html`, `nosotros.html`, `servicios.html`, `smokescan.html`
- **Descripción:** Ninguna página tiene tags `og:title`, `og:description`, `og:image`, `og:url`.
- **Impacto:** Al compartir links en WhatsApp, LinkedIn o Twitter, no aparece ninguna preview visual. Impacto directo en conversión de contenido social.
- **Recomendación:** Añadir bloque Open Graph estándar en `<head>` de cada página.

---

#### [M-04] Sin `robots.txt` ni `sitemap.xml`
- **Descripción:** El proyecto no incluye archivo `robots.txt` ni `sitemap.xml`.
- **Impacto:** Los crawlers de Google indexan de manera subóptima. La página SmokeScan (que no debería indexarse en su estado actual) podría aparecer en resultados.
- **Recomendación:** Crear `robots.txt` con directivas y `sitemap.xml` con las 4 páginas del sitio.

---

#### [M-05] Sin datos estructurados JSON-LD
- **Archivos:** Todas las páginas
- **Descripción:** No hay schema.org markup para `Organization`, `Service`, o `WebApplication`.
- **Impacto:** El sitio pierde la oportunidad de aparecer con rich snippets en Google (ratings, servicios, contacto).
- **Recomendación:** Añadir `<script type="application/ld+json">` con schema `Organization` en `index.html`.

---

#### [M-06] Dependencia CDN externa para PDF sin fallback
- **Archivo:** `smokescan.html` — carga de `html2pdf.js`
- **Descripción:** La función de exportar PDF depende de una librería cargada desde CDN sin verificación de integridad (`integrity` attr ausente).
- **Impacto:** Si el CDN falla o la versión cambia, la exportación de reportes queda rota sin notificación al usuario.
- **Recomendación:** Añadir `integrity` + `crossorigin` al script tag, o bundlear la librería localmente.

---

#### [M-07] Código comentado y features incompletas sin remover
- **Archivos:** `index.html` (líneas 482-502), `main.js` (líneas 163-178)
- **Descripción:** Existe un bloque "CLIENT LOGOS" comentado en el HTML y lógica de sincronización de nav activo comentada en JS. También hay una sección de logos de clientes que no fue implementada.
- **Impacto:** Aumenta la deuda técnica, confunde a futuros desarrolladores, señala features inacabadas.
- **Recomendación:** Eliminar código comentado. Si los features se van a retomar, usar issues en GitHub.

---

#### [M-08] Magic numbers dispersos en el código
- **Archivo:** `smokescan.js`, `main.js`
- **Descripción:** Valores como `88` (offset del nav), `0.18` (velocidad del parallax), `251` (longitud del path SVG del gauge) aparecen hardcodeados sin explicación.
- **Impacto:** Dificulta el mantenimiento. Si el nav cambia de altura, el número 88 aparece en múltiples lugares sin relación obvia.
- **Recomendación:** Extraer a constantes con nombre o variables CSS (`--nav-height: 88px`).

---

### 🔵 BAJO — 7 Incidencias

---

#### [B-01] Sin `README.md` en el repositorio
- **Descripción:** No existe documentación básica del proyecto.
- **Recomendación:** Crear `README.md` con descripción del proyecto, instrucciones de setup y despliegue.

---

#### [B-02] Sin archivo `.env.example`
- **Descripción:** No hay plantilla de variables de entorno para nuevos desarrolladores.
- **Recomendación:** Crear `.env.example` con todas las variables requeridas (Firebase, Gemini).

---

#### [B-03] `console.log` en código de producción — 4+ instancias
- **Archivo:** `smokescan.js`
- **Descripción:** Logs de debug como `"Iniciando sesión en Modo Simulador"` se imprimen en la consola del navegador en producción.
- **Recomendación:** Eliminar o envolver en `if (DEBUG) { ... }`.

---

#### [B-04] Global STATE no encapsulado
- **Archivo:** `smokescan.js`
- **Descripción:** El estado de la aplicación vive en un objeto global mutable sin ninguna abstracción.
- **Recomendación:** Encapsular en un módulo ES6 o clase con getters/setters.

---

#### [B-05] Sin persistencia de sesión en SmokeScan
- **Archivo:** `smokescan.js`
- **Descripción:** El estado del wizard (respuestas del usuario, paso actual) se pierde al recargar la página.
- **Recomendación:** Persistir en `localStorage` con serialización del STATE object.

---

#### [B-06] Enlace de contacto apunta a `servicios.html#contacto` pero el contacto está en `index.html`
- **Archivos:** Múltiples páginas
- **Descripción:** Algunos botones de CTA enlazan a `servicios.html#contacto` cuando el formulario real de contacto (Calendly) está en `index.html#contacto`.
- **Recomendación:** Unificar todos los CTAs de contacto a `index.html#contacto` o crear una sección Contacto real en `servicios.html`.

---

#### [B-07] Sin `CHANGELOG.md` ni release notes
- **Descripción:** El proyecto tiene historial de git activo pero no documenta versiones.
- **Recomendación:** Iniciar un `CHANGELOG.md` siguiendo la convención Keep a Changelog.

---

### ♿ ACCESIBILIDAD — 4 Incidencias

---

#### [ACC-01] Diferenciación solo por color en badges de viabilidad
- **Archivo:** `smokescan-styles.css`, `smokescan.js`
- **Descripción:** Los badges de estado (Verde="Alta viabilidad", Rojo="En desarrollo") usan solo color como diferenciador.
- **Impacto:** Usuarios con daltonismo (8% de hombres) no pueden distinguir los estados.
- **Recomendación:** Añadir iconos o etiquetas de texto junto al color. Ejemplo: `✓ Alta viabilidad`, `⚠ En desarrollo`.

---

#### [ACC-02] Cambio de score no anunciado via ARIA live regions
- **Archivo:** `smokescan.js` — función `updateGauge()`
- **Descripción:** Cuando el score del gauge cambia al seleccionar opciones, el cambio no se anuncia a lectores de pantalla.
- **Recomendación:**
  ```html
  <div aria-live="polite" aria-atomic="true" class="sr-only" id="score-announcement">
    Viabilidad actualizada: 68 puntos
  </div>
  ```

---

#### [ACC-03] Spinner de carga sin anuncio ARIA
- **Archivo:** `smokescan.html` / `smokescan.js` — secuencia de loading
- **Descripción:** El spinner y los mensajes de progreso del análisis AI no tienen `aria-live` ni `role="status"`.
- **Impacto:** Usuarios con lectores de pantalla no saben que la aplicación está procesando.
- **Recomendación:** Añadir `role="status"` al contenedor del loading y un `aria-live="polite"` para actualizaciones de progreso.

---

#### [ACC-04] Animaciones scroll-reveal no desactivadas para `prefers-reduced-motion`
- **Archivo:** `main.js` — `initRevealObserver()`, `styles.css`
- **Descripción:** Las animaciones de entrada (`.reveal → .visible`) ignoran `prefers-reduced-motion`. El código ya lo implementa para el logo ticker pero no para el resto de animaciones.
- **Recomendación:**
  ```css
  @media (prefers-reduced-motion: reduce) {
    .reveal { opacity: 1; transform: none; transition: none; }
  }
  ```

---

## Cobertura de Testing por Página

| Página | Smoke Test | Accesibilidad | Rendimiento | Seguridad |
|---|---|---|---|---|
| `index.html` | ⚠️ Parcial | ✅ Buena | ❌ Imágenes grandes | ✅ Sin issues |
| `nosotros.html` | ✅ OK | ✅ Buena | ❌ Imágenes grandes | ✅ Sin issues |
| `servicios.html` | ⚠️ Links rotos | ✅ Buena | ❌ Imágenes grandes | ✅ Sin issues |
| `smokescan.html` | ❌ Auth rota | ⚠️ Parcial | ✅ CSS/JS OK | ❌ XSS, mock auth |

---

## Hoja de Ruta de Correcciones

### Sprint 1 — Bloqueantes de Producción (1-2 semanas)
1. [C-01] Configurar Firebase real con variables de entorno
2. [C-02] Implementar backend proxy para Gemini API
3. [C-03] Remover mock auth, implementar Google/Microsoft OAuth real
4. [A-01] Corregir XSS — `innerHTML` → `textContent`
5. [A-04] Definir reglas de seguridad Firestore

### Sprint 2 — Calidad y Experiencia (1 semana)
6. [A-02] Mover rate limiting al backend
7. [A-05] Optimizar todas las imágenes + WebP + srcset
8. [M-01] Reemplazar `alert()` con componente UI propio
9. [M-02] Corregir `href=""` en CTA principal
10. [ACC-01-04] Implementar todas las correcciones de accesibilidad

### Sprint 3 — SEO y Documentación (3-4 días)
11. [M-03] Añadir Open Graph meta tags en todas las páginas
12. [M-04] Crear `robots.txt` y `sitemap.xml`
13. [M-05] Añadir JSON-LD schema markup
14. [B-01] Crear `README.md`
15. [B-02] Crear `.env.example`

### Sprint 4 — Deuda Técnica (1 semana)
16. [M-06] Añadir SRI a CDN scripts
17. [M-07] Eliminar código comentado
18. [M-08] Reemplazar magic numbers con constantes
19. [B-03] Eliminar `console.log` de producción
20. [B-04-B-07] Resto de mejoras de código

---

## Información del Proyecto Analizado

| Campo | Valor |
|---|---|
| Nombre | Smoke Studio R2 |
| Tipo | Marketing Site + SaaS MVP |
| Stack | HTML5 + CSS3 + Vanilla JS |
| Páginas | 4 (index, nosotros, servicios, smokescan) |
| Líneas de Código | ~11,395 (HTML: 4,873 / CSS: 4,729 / JS: 1,793) |
| Assets | 75 MB (mayormente imágenes) |
| Idioma | Español |
| Integraciones | Firebase, Gemini AI, GTM, Clarity, Calendly |
| Email contacto | hola@smokestud.io |
