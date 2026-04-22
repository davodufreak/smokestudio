# Prompt de Corrección — Smoke Studio R2
> Copia y pega este prompt en Claude Code para corregir las incidencias encontradas en el análisis QA.  
> Ejecuta cada bloque por separado según la prioridad del sprint.

---

## PROMPT COMPLETO (todos los sprints)

```
Eres un desarrollador senior trabajando en el proyecto Smoke Studio R2 (repositorio: c:\Users\gerar\GPS-Codex\SmokeStudio.R2).

Se realizó un análisis QA completo con la metodología scoutqa-test y se encontraron 27 incidencias. Necesito que las corrijas en orden de prioridad. NO modifiques el diseño visual ni el copy — solo corrige los bugs, seguridad, accesibilidad y calidad de código indicados.

Antes de comenzar:
1. Lee los archivos main.js, smokescan.js, index.html, nosotros.html, servicios.html, smokescan.html, styles.css y smokescan-styles.css para entender el contexto completo.
2. Confirma cada cambio antes de aplicarlo.
3. No elimines funcionalidades existentes.

---

### SPRINT 1 — BLOQUEANTES DE PRODUCCIÓN (aplicar primero)

[C-01] Firebase — Crear archivo de configuración segura
- Crea un archivo `.env.example` en la raíz con las variables:
  FIREBASE_API_KEY=
  FIREBASE_AUTH_DOMAIN=
  FIREBASE_PROJECT_ID=
  FIREBASE_STORAGE_BUCKET=
  FIREBASE_MESSAGING_SENDER_ID=
  FIREBASE_APP_ID=
  GEMINI_API_KEY=
- En smokescan.js (líneas 1135-1141), reemplaza los valores hardcodeados por referencias a variables de entorno o un objeto de configuración que se cargue externamente.
- Añade una comprobación al inicio de smokescan.js que detecte si firebaseConfig contiene placeholders y muestre un mensaje de error claro en consola: "Firebase no configurado. Ver .env.example".

[C-02] Gemini API — Backend proxy
- Crea un archivo `api/gemini-proxy.js` (estilo Vercel Serverless o similar) que:
  - Reciba el payload del análisis desde el frontend via POST
  - Use la API key de Gemini desde variables de entorno del servidor
  - Devuelva la respuesta al frontend
- En smokescan.js, actualiza fetchGeminiAnalysis() para llamar a '/api/gemini-proxy' en lugar de directamente a la API de Gemini.
- Añade comentario en el código indicando que la API key debe estar en el servidor.

[C-03] Autenticación mock — Eliminar modo simulador
- En smokescan.js, elimina el bloque del modo simulador (clase FirebaseAuthService con usuarios hardcodeados).
- Reemplaza con la implementación real de Firebase Auth SDK para Google OAuth:
  ```js
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider)
  ```
- Añade manejo de errores con mensajes de usuario amigables (sin alert()).
- Elimina todos los console.log del tipo "Iniciando sesión en Modo Simulador".

[A-01] XSS — Corregir innerHTML con datos de usuario
- En smokescan.js, busca TODAS las ocurrencias de innerHTML donde se inserte contenido de usuario.
- Reemplaza con textContent o createElement/setAttribute.
- La línea específica: `cta.innerHTML = 'Hola, ' + firstName` → `cta.textContent = \`Hola, \${firstName}\``
- Busca también cualquier otra concatenación de strings de usuario en innerHTML.

[A-04] Firestore Security Rules
- Crea el archivo `firestore.rules` en la raíz del proyecto con reglas básicas:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /analyses/{analysisId} {
        allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      }
    }
  }
  ```

---

### SPRINT 2 — CALIDAD Y EXPERIENCIA

[A-02] Rate limiting en servidor
- En el backend proxy de Gemini (api/gemini-proxy.js), añade validación del UID del usuario y verificación contra Firestore de intentos del día.
- En el frontend (smokescan.js), elimina toda la lógica client-side de conteo de intentos.

[A-05] Imágenes — Optimización
- En todos los archivos HTML (index.html, nosotros.html, servicios.html, smokescan.html):
  - Añade `loading="lazy"` a todas las imágenes que no estén en el viewport inicial (todo excepto hero).
  - Añade `decoding="async"` a todas las imágenes.
  - Para las imágenes hero que tienen rutas directas, añade el atributo `fetchpriority="high"`.
  - Para cada <img> con JPG, añade una versión <picture> con source WebP:
    ```html
    <picture>
      <source srcset="assets/hero-team.webp" type="image/webp">
      <img src="assets/hero-team.jpg" alt="..." loading="eager">
    </picture>
    ```
  NOTA: Los archivos WebP deben ser generados externamente (usa squoosh.app o similar). Solo añade el markup por ahora.

[M-01] Reemplazar alert() — Crear componente de notificación
- En smokescan.js, busca todas las llamadas a alert() y window.alert().
- Crea una función showNotification(message, type) que:
  - Inyecte un elemento <div> con clase 'ss-toast' al body
  - Aplique estilos inline básicos (posición fixed bottom-right, padding, border-radius)
  - Use los colores del design system (error:#DC2626, success:#16A34A, warning:#D97706)
  - Se auto-elimine después de 4 segundos con una animación de fadeout
- Añade los estilos de .ss-toast en smokescan-styles.css.
- Reemplaza TODOS los alert() con showNotification().

[M-02] href vacío en CTA
- En index.html, línea ~590: cambia `<a href="" onclick="Calendly...">` a `<a href="javascript:void(0)" onclick="Calendly...">`
- O mejor aún, conviértelo a `<button type="button" onclick="Calendly...">` con la clase de botón correspondiente.

[ACC-01] Badges de viabilidad — Añadir texto e icono al color
- En smokescan.js, en la función updateBadge() o donde se generen los textos de badges:
  - Añade un icono delante de cada estado:
    - "Alta viabilidad" → "✓ Alta viabilidad"
    - "Listo para validar" → "→ Listo para validar"
    - "Prometedor" → "◎ Prometedor"
    - "En desarrollo" → "⚠ En desarrollo"
- Asegúrate de que los iconos no se lean como texto en lectores de pantalla usando aria-hidden="true" en los span de iconos.

[ACC-02] ARIA live region para score
- En smokescan.html, añade después del gauge SVG:
  ```html
  <div id="score-announcement" class="sr-only" aria-live="polite" aria-atomic="true"></div>
  ```
- En smokescan.js, función updateGauge(score), añade al final:
  ```js
  const announcement = document.getElementById('score-announcement');
  if (announcement) announcement.textContent = \`Viabilidad actualizada: \${score} puntos\`;
  ```

[ACC-03] Spinner de carga con ARIA
- En smokescan.html, en el contenedor del loading state, añade:
  ```html
  <div id="loading-container" role="status" aria-live="polite" aria-label="Analizando tu idea">
  ```
- Actualiza el texto de cada mensaje de progreso para que sea leído por el lector de pantalla.

[ACC-04] prefers-reduced-motion para animaciones
- En styles.css, añade al final del archivo:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .reveal {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }
    .reveal.visible {
      opacity: 1;
      transform: none;
    }
    * {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

---

### SPRINT 3 — SEO Y DOCUMENTACIÓN

[M-03] Open Graph meta tags
- En CADA archivo HTML (index.html, nosotros.html, servicios.html, smokescan.html), añade dentro de <head> después de los meta existentes:
  ```html
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Smoke Studio">
  <meta property="og:title" content="[TÍTULO DE LA PÁGINA]">
  <meta property="og:description" content="[DESCRIPCIÓN DE LA PÁGINA]">
  <meta property="og:image" content="[URL_DOMINIO]/assets/og-cover.jpg">
  <meta property="og:url" content="[URL_DOMINIO]/[ruta]">
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="[TÍTULO DE LA PÁGINA]">
  <meta name="twitter:description" content="[DESCRIPCIÓN DE LA PÁGINA]">
  <meta name="twitter:image" content="[URL_DOMINIO]/assets/og-cover.jpg">
  ```
  Reemplaza [TÍTULO], [DESCRIPCIÓN] y [URL_DOMINIO] con los valores reales de cada página.

[M-04] robots.txt y sitemap.xml
- Crea `robots.txt` en la raíz:
  ```
  User-agent: *
  Allow: /
  Disallow: /smokescan.html
  Sitemap: https://[TU_DOMINIO]/sitemap.xml
  ```
- Crea `sitemap.xml` en la raíz:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://[TU_DOMINIO]/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
    <url><loc>https://[TU_DOMINIO]/nosotros.html</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
    <url><loc>https://[TU_DOMINIO]/servicios.html</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
  </urlset>
  ```
  Reemplaza [TU_DOMINIO] con el dominio real del sitio.

[M-05] JSON-LD Schema
- En index.html, añade antes del cierre de </head>:
  ```html
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Smoke Studio",
    "url": "https://[TU_DOMINIO]",
    "logo": "https://[TU_DOMINIO]/assets/logo_dark.svg",
    "email": "hola@smokestud.io",
    "sameAs": [
      "https://www.instagram.com/smoke.studio.america",
      "https://www.linkedin.com/company/smokestudios"
    ],
    "description": "Consultora de validación de productos. Validamos tu idea antes de que inviertas.",
    "areaServed": "Americas",
    "serviceType": "Product Validation, Market Research, MVP Development"
  }
  </script>
  ```

[B-01] README.md
- Crea `README.md` en la raíz con:
  - Descripción del proyecto
  - Stack tecnológico
  - Instrucciones de setup (clonar, configurar .env, servir localmente)
  - Estructura de archivos
  - Variables de entorno requeridas
  - Instrucciones de despliegue

[B-02] .env.example
- Ya cubierto por [C-01]. Verifica que esté creado.

---

### SPRINT 4 — DEUDA TÉCNICA

[M-06] SRI en CDN scripts
- En smokescan.html, al script de html2pdf del CDN, añade:
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
          integrity="sha512-[HASH]"
          crossorigin="anonymous"
          referrerpolicy="no-referrer"></script>
  ```
  Obtén el hash SRI en: https://www.srihash.org/

[M-07] Eliminar código muerto
- En index.html: elimina las líneas 482-502 del bloque CLIENT LOGOS comentado.
- En main.js: elimina las líneas 163-178 del bloque de sync de nav comentado.
- Si estas features se retoman, crear issues en GitHub en su lugar.

[M-08] Magic numbers → constantes
- En main.js, extraer al inicio del archivo:
  ```js
  const NAV_HEIGHT = 88;         // altura del nav flotante
  const PARALLAX_SPEED = 0.18;   // velocidad del efecto parallax
  ```
- En smokescan.js:
  ```js
  const GAUGE_PATH_LENGTH = 251; // longitud del arco SVG del gauge (r=80, semicírculo)
  const MAX_ATTEMPTS_PER_DAY = 2;
  const MAX_CHALLENGE_MESSAGES = 6;
  ```

[B-03] console.log en producción
- En smokescan.js, añade al inicio del archivo:
  ```js
  const DEBUG = false; // cambiar a true en desarrollo local
  ```
- Envuelve TODOS los console.log existentes en:
  ```js
  if (DEBUG) console.log(...);
  ```

[B-04] Encapsular STATE
- En smokescan.js, convierte el objeto STATE global en un módulo con:
  ```js
  const AppState = (() => {
    const _state = { currentStep: 0, answers: {}, scores: {}, ... };
    return {
      get: (key) => _state[key],
      set: (key, value) => { _state[key] = value; },
      getAll: () => ({..._state}),
      reset: () => { /* ... */ }
    };
  })();
  ```
- Actualiza todas las referencias a STATE.xxx para usar AppState.get('xxx').

[B-05] Persistencia en localStorage
- En smokescan.js, añade funciones:
  ```js
  function saveToStorage() {
    localStorage.setItem('ss_wizard_state', JSON.stringify(STATE));
  }
  function loadFromStorage() {
    const saved = localStorage.getItem('ss_wizard_state');
    if (saved) Object.assign(STATE, JSON.parse(saved));
  }
  ```
- Llama a loadFromStorage() en el DOMContentLoaded y a saveToStorage() cada vez que cambia STATE.

[B-06] Links de contacto unificados
- Busca en todos los archivos HTML y JS: todas las ocurrencias de `servicios.html#contacto` que deberían apuntar a la sección de contacto real.
- Si el form de contacto (Calendly) está en index.html#contacto, reemplaza los enlaces de todos los CTAs de "Agenda una llamada" o similares para que apunten a index.html#contacto de manera consistente.

[B-07] CHANGELOG.md
- Crea `CHANGELOG.md` en la raíz con el formato Keep a Changelog:
  ```markdown
  # Changelog
  All notable changes to this project will be documented in this file.
  
  ## [Unreleased]
  ### Fixed
  - Firebase configuration security (C-01, C-02, C-03)
  - XSS vulnerability in user name display (A-01)
  - [resto de los fixes del reporte QA]
  ```

---

## VERIFICACIÓN FINAL

Después de aplicar todas las correcciones, verifica:

- [ ] Firebase se inicializa correctamente (sin errores en consola)
- [ ] Login con Google OAuth funciona
- [ ] SmokeScan completa el flujo de 7 pasos
- [ ] El análisis AI regresa resultados reales
- [ ] El PDF se exporta correctamente
- [ ] Ninguna imagen carga sin lazy loading (excepto hero)
- [ ] No hay alert() en ninguna parte del código
- [ ] No hay console.log en producción (DEBUG=false)
- [ ] Los badges de viabilidad tienen texto + icono
- [ ] El score se anuncia via ARIA live
- [ ] Las animaciones se desactivan con prefers-reduced-motion
- [ ] Open Graph aparece al compartir en redes sociales
- [ ] robots.txt y sitemap.xml son accesibles
- [ ] Lighthouse score: Performance >80, Accessibility >90, SEO >90
```

---

## PROMPTS POR SPRINT (versión corta)

### Solo Sprint 1 — Críticos
```
Analiza el archivo smokescan.js en c:\Users\gerar\GPS-Codex\SmokeStudio.R2 y aplica las siguientes correcciones de seguridad sin cambiar el diseño visual:

1. [C-01] Las líneas ~1135-1141 tienen credenciales Firebase hardcodeadas como placeholders. Crea un .env.example con las variables necesarias y agrega una validación al inicio del JS que detecte si los valores son placeholders y muestre un warning en consola.

2. [A-01] Busca todas las ocurrencias de innerHTML donde se inserte contenido del usuario (especialmente cta.innerHTML = 'Hola, ' + firstName). Cámbia las por textContent para prevenir XSS.

3. [A-03] Elimina todos los console.log que mencionan "Modo Simulador" y cualquier otro log de debugging que no debería estar en producción.

4. Crea el archivo firestore.rules con reglas básicas que solo permitan a usuarios autenticados leer/escribir sus propios documentos.

Confirma cada cambio antes de aplicarlo y no modifiques el diseño visual ni el copy.
```

### Solo Sprint 2 — Rendimiento y UX
```
En el proyecto c:\Users\gerar\GPS-Codex\SmokeStudio.R2, aplica las siguientes mejoras de rendimiento y experiencia sin cambiar el diseño:

1. [A-05] En todos los archivos HTML, añade loading="lazy" y decoding="async" a todas las imágenes que no sean el hero principal. Envuelve cada imagen en <picture> con source WebP preparado para cuando los archivos WebP estén disponibles.

2. [M-01] En smokescan.js, crea una función showNotification(message, type) que reemplace TODOS los alert(). La notificación debe aparecer como un toast en la esquina inferior derecha con los colores del design system (ver variables CSS en styles.css). Auto-eliminar después de 4 segundos.

3. [ACC-04] En styles.css, añade al final un media query @media (prefers-reduced-motion: reduce) que deshabilite todas las animaciones .reveal y transiciones.

4. [M-02] En index.html línea ~590, cambia href="" del botón CTA por href="javascript:void(0)".
```

### Solo Sprint 3 — SEO
```
En el proyecto c:\Users\gerar\GPS-Codex\SmokeStudio.R2, mejora el SEO sin tocar el diseño:

1. Lee index.html, nosotros.html, servicios.html y smokescan.html para entender el contenido de cada página.

2. Añade meta tags Open Graph y Twitter Card a cada página, usando títulos y descripciones apropiados al contenido de cada una.

3. Crea robots.txt que permita todo excepto smokescan.html, con referencia al sitemap.

4. Crea sitemap.xml con las 3 páginas públicas (index, nosotros, servicios).

5. En index.html, añade un bloque JSON-LD con schema Organization usando los datos reales: nombre "Smoke Studio", email "hola@smokestud.io", redes sociales Instagram y LinkedIn del footer.
```
