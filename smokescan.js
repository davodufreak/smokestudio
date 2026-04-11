/* =============================================
   SMOKESCAN — smokescan.js
   Gemini AI-powered wizard with live scoring
   ============================================= */

'use strict';

/* ─── STATE ─── */
const STATE = {
  currentStep: 0,
  answers: {
    step1: { selection: null, desc: '', link: '' },
    step2: { selection: null, desc: '' },
    step3: { selections: [], desc: '' },
    step4: { selection: null, desc: '' },
    step5: { selection: null, desc: '' },
  },
  scores: { claridad: 0, mercado: 0, competencia: 0, revenue: 0 },
  totalScore: 0,
  aiResult: null,
  apiKey: 'AIzaSyDbtvznN_L9lMqGFaYqCJ8cBzes-sR1-Ao', // pre-loaded
  isEditMode: false,
  editReturnStep: null,
  appliedSteps: {},
  baseAiScores: null,
};

/* ─── SCORE WEIGHTS (heuristic, pre-AI) ─── */
const SCORE_MAP = {
  step2: { first_hand: 22, observed: 18, informed: 12, intuition: 6 },
  step3: { b2c: 8, smb: 9, enterprise: 8, educacion: 6, freelancers: 7 }, // sum of selections up to 25
  step4: { few_alternatives: 20, established: 18, no_competitors: 14, crowded: 8 },
  step5: { subscription: 22, freemium: 20, usage: 18, license: 16, ads: 12, undefined: 4 },
};

/* ─── DOM REFS ─── */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

/* ─── GAUGE HELPERS ─── */
function scoreToOffset(score) {
  // Path length ~251 for semicircle; 0 score = all dashed (251), 100 = none dashed (0)
  return 251 - (score / 100) * 251;
}

function needlePosition(score) {
  // Semicircle from angle 180° (left) to 0° (right), center at (100,110), r=80
  const angle = Math.PI - (score / 100) * Math.PI; // 180° to 0°
  const cx = 100 + 80 * Math.cos(angle);
  const cy = 110 - 80 * Math.sin(angle);
  return { cx, cy };
}

function updateGauge(score, fillId, needleId, numId, badgeId) {
  const fill   = $(fillId);
  const needle = $(needleId);
  const num    = $(numId);
  const badge  = $(badgeId);

  if (fill)   fill.setAttribute('stroke-dashoffset', scoreToOffset(score));
  if (needle) {
    const { cx, cy } = needlePosition(score);
    needle.setAttribute('cx', cx.toFixed(2));
    needle.setAttribute('cy', cy.toFixed(2));
  }
  if (num) {
    num.textContent = Math.round(score);
    // Animate number
    num.style.transform = 'scale(1.15)';
    setTimeout(() => { num.style.transform = 'scale(1)'; }, 200);
  }
  if (badge) updateBadge(score, badge);
}

function updateBadge(score, badge) {
  if (!badge) return;

  // Detect which element type we're updating
  const isRv2 = badge.id === 'ss-status-badge-r';

  if (isRv2) {
    // Light card badge (Step_7B results)
    badge.className = 'ss-rv2-status';
    if (score >= 86) {
      badge.classList.add('alta-viabilidad');
      badge.textContent = 'Alta viabilidad';
    } else if (score >= 71) {
      badge.classList.add('validar');
      badge.textContent = 'Listo para validar';
    } else if (score >= 51) {
      badge.classList.add('promisoria');
      badge.textContent = 'Promisoria';
    } else if (score >= 31) {
      badge.classList.add('mejorable');
      badge.textContent = 'Mejorable';
    } else {
      badge.classList.add('en-desarrollo');
      badge.textContent = 'En desarrollo';
    }
  } else {
    // Dark panel badge (wizard score panel)
    badge.className = 'ss-status-badge';
    if (score >= 86) {
      badge.textContent = 'Alta viabilidad';
      badge.classList.add('badge-viable');
    } else if (score >= 71) {
      badge.textContent = 'Listo para validar';
      badge.classList.add('badge-ready');
    } else if (score >= 51) {
      badge.textContent = 'Promisoria';
      badge.classList.add('badge-promising');
    } else if (score >= 31) {
      badge.textContent = 'Con potencial';
      badge.classList.add('badge-potential');
    } else {
      badge.textContent = 'En desarrollo';
      badge.classList.add('badge-developing');
    }
  }
}

/* ─── QUALITY LABEL ─── */
function getQualityLabel(score, max) {
  const pct = max ? (score / max) * 100 : score;
  if (pct < 36) return { label: 'Crítica',    cls: 'critica' };
  if (pct < 60) return { label: 'Mejorable',  cls: 'mejorable' };
  if (pct < 84) return { label: 'Promisoria', cls: 'promisoria' };
  return             { label: 'Sólida',      cls: 'solida' };
}

function updateBreakdown(scores, prefix = '') {
  const cats = ['claridad', 'mercado', 'competencia', 'revenue'];
  cats.forEach(cat => {
    const val = Math.round(scores[cat] || 0);
    const scoreEl = $(`${prefix}bd-${cat}-score`) || $(`${prefix}rbd-${cat}-score`);
    const fillEl  = $(`${prefix}bd-${cat}-fill`)  || $(`${prefix}rbd-${cat}-fill`);
    if (scoreEl) {
      scoreEl.textContent = `${val}/25`;
      scoreEl.classList.toggle('active', val > 0);
    }
    if (fillEl) fillEl.style.width = `${(val / 25) * 100}%`;
  });
}

function updateStickyScore(scores, total) {
  const sticky = $('ss-sticky-score');
  if (!sticky) return;
  sticky.classList.add('visible');

  const stickyVal = $('ss-sticky-value');
  if (stickyVal) stickyVal.textContent = Math.round(total);

  const cats = { claridad: 0, mercado: 1, competencia: 2, revenue: 3 };
  Object.keys(cats).forEach(cat => {
    const val = Math.round(scores[cat] || 0);
    const fill  = $(`sticky-${cat}-fill`);
    const score = $(`sticky-${cat}-score`);
    if (fill)  fill.style.width = `${(val / 25) * 100}%`;
    if (score) {
      score.textContent = `${val}/25`;
      score.classList.toggle('active', val > 0);
    }
  });
}

/* ─── SCORE CALCULATION (heuristic) ─── */
function calcHeuristicScores() {
  const a = STATE.answers;
  const s = { claridad: 0, mercado: 0, competencia: 0, revenue: 0 };

  // Claridad (step 2)
  if (a.step2.selection) s.claridad = SCORE_MAP.step2[a.step2.selection] || 0;
  // Bonus for detailed description
  if (a.step2.desc?.length > 80) s.claridad = Math.min(25, s.claridad + 3);

  // Mercado / audiencia (step 3)
  const selectedAudience = a.step3.selections || [];
  const rawAudience = selectedAudience.reduce((sum, v) => sum + (SCORE_MAP.step3[v] || 0), 0);
  s.mercado = Math.min(25, rawAudience);
  if (a.step3.desc?.length > 80) s.mercado = Math.min(25, s.mercado + 3);

  // Competencia (step 4)
  if (a.step4.selection) s.competencia = SCORE_MAP.step4[a.step4.selection] || 0;
  if (a.step4.desc?.length > 60) s.competencia = Math.min(25, s.competencia + 2);

  // Revenue (step 5)
  if (a.step5.selection) s.revenue = SCORE_MAP.step5[a.step5.selection] || 0;
  if (a.step5.desc?.length > 60) s.revenue = Math.min(25, s.revenue + 2);

  return s;
}

function applyScores(scores) {
  STATE.scores = { ...scores };
  STATE.totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  // Update desktop gauge
  updateGauge(STATE.totalScore, 'ss-gauge-fill', 'ss-needle-dot', 'ss-score-num', 'ss-status-badge');
  updateBreakdown(STATE.scores);

  // Update sticky
  updateStickyScore(STATE.scores, STATE.totalScore);
}

/* ─── STEPPER UI ─── */
function updateStepper(current) {
  for (let i = 1; i <= 5; i++) {
    const dot  = $(`dot-${i}`);
    const line = $(`line-${i}`);
    if (!dot) continue;

    dot.classList.remove('active', 'done');
    if (i < current) {
      dot.classList.add('done');
      dot.innerHTML = `<svg width="14" height="14" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    } else if (i === current) {
      dot.classList.add('active');
      dot.textContent = i;
    } else {
      dot.textContent = i;
    }

    if (line) line.classList.toggle('done', i < current);
  }
}

/* ─── STEP NAVIGATION ─── */
function showStep(n, direction = 'forward') {
  // Hide all step contents
  $$('[id^="step-"]').forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('fade-in');
  });

  // Hide stepper for loading
  const stepper = $('ss-stepper');
  if (stepper) stepper.style.display = (n === 6) ? 'none' : 'flex';

  const target = $(`step-${n}`);
  if (!target) return;
  target.classList.remove('hidden');
  target.classList.add('fade-in');

  updateStepper(n);
  STATE.currentStep = n;

  // Scroll to wizard on mobile
  if (window.innerWidth < 768) {
    setTimeout(() => {
      const card = $('ss-card');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}

/* ─── OPTION SELECTION ─── */
function initOptions() {
  $$('.ss-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const step   = opt.dataset.step;
      const value  = opt.dataset.value;
      const isMulti = opt.dataset.multi === 'true';

      if (isMulti) {
        // Toggle in multi-select
        opt.classList.toggle('selected');
        const selections = Array.from($$(`#opts-step${step} .ss-option.selected`)).map(o => o.dataset.value);
        STATE.answers[`step${step}`].selections = selections;
      } else {
        // Single select
        $$(`#opts-step${step} .ss-option`).forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        STATE.answers[`step${step}`].selection = value;
      }

      // Recalculate scores after step 2+
      if (['2','3','4','5'].includes(step)) {
        const scores = calcHeuristicScores();
        applyScores(scores);
      }
    });
  });
}

/* ─── NEXT / BACK BUTTONS ─── */
function initNavButtons() {
  // Next buttons
  $$('.ss-btn-next[data-next]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextStep = parseInt(btn.dataset.next);
      const current  = STATE.currentStep;

      // Gather textarea values
      const textarea = document.querySelector(`#step-${current} .ss-textarea`);
      const input    = document.querySelector(`#step-${current} .ss-input`);
      if (textarea) STATE.answers[`step${current}`].desc = textarea.value;
      if (input)    STATE.answers[`step${current}`].link = input.value;

      // Recalculate after text changes
      const scores = calcHeuristicScores();
      applyScores(scores);

      showStep(nextStep);
    });
  });

  // Back buttons
  $$('.ss-btn-back[data-prev]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prev = parseInt(btn.dataset.prev);
      showStep(prev, 'back');
    });
  });

  // Complete button (step 5 → loading → results)
  const completeBtn = $('btn-complete');
  if (completeBtn) {
    completeBtn.addEventListener('click', () => {
      // Save last textarea
      const desc5 = $('desc-step5');
      if (desc5) STATE.answers.step5.desc = desc5.value;

      // Final heuristic score calculation
      const scores = calcHeuristicScores();
      applyScores(scores);

      startLoadingSequence();
    });
  }
}

/* ─── LOADING ANIMATION (Step 5 → 6) ─── */
function startLoadingSequence() {
  const card      = $('ss-card');
  const scorePanel = $('ss-score-panel');
  const editBanner = $('ss-edit-banner');

  // Hide edit banner
  if (editBanner) editBanner.classList.add('hidden');

  // Phase 1: Fade out right panel
  if (scorePanel) scorePanel.classList.add('hiding');

  // Phase 2: Compress the card smoothly
  setTimeout(() => {
    if (!card) return;

    // Get current width
    const currentWidth = card.offsetWidth;
    card.style.width = currentWidth + 'px';
    card.style.transition = 'all 0.85s cubic-bezier(0.22, 1, 0.36, 1)';

    // Show step 6 loader (hide others first)
    $$('[id^="step-"]').forEach(el => el.classList.add('hidden'));
    const loading = $('step-6');
    if (loading) loading.classList.remove('hidden');
    const stepper = $('ss-stepper');
    if (stepper) stepper.style.display = 'none';

    // Compress
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.maxWidth = '380px';
        card.style.margin   = '0 auto';
        card.style.padding  = '48px 32px';
        card.style.borderRadius = '32px';
      });
    });

    // Also compress the grid
    const grid = $('ss-wizard-grid');
    if (grid) {
      grid.style.transition = 'all 0.85s cubic-bezier(0.22,1,0.36,1)';
      grid.style.gridTemplateColumns = '1fr';
    }

  }, 200);

  // Phase 3: Run loading messages + API call
  setTimeout(() => {
    runLoadingMessages();
    fetchGeminiAnalysis();
  }, 800);
}

const LOADING_MESSAGES = [
  'Evaluando claridad del problema…',
  'Analizando segmento de mercado…',
  'Calculando viabilidad competitiva…',
  'Revisando modelo de revenue…',
  'Generando insights personalizados…',
  'Preparando tu reporte…',
];

let loadingMsgInterval;

function runLoadingMessages() {
  let i = 0;
  const el = $('ss-loading-msg');
  if (!el) return;
  el.textContent = LOADING_MESSAGES[0];
  loadingMsgInterval = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = LOADING_MESSAGES[i];
      el.style.opacity = '1';
    }, 300);
  }, 1600);
}

/* ─── GEMINI API CALL (or simulated fallback) ─── */
async function fetchGeminiAnalysis() {
  const a = STATE.answers;
  const apiKey = STATE.apiKey;

  const promptContext = `
Tipo de producto: ${a.step1.selection || 'indefinido'}. ${a.step1.desc ? 'Descripción: ' + a.step1.desc : ''}
Claridad del problema: ${a.step2.selection}. ${a.step2.desc ? 'Detalle: ' + a.step2.desc : ''}
Audiencia objetivo: ${(a.step3.selections || []).join(', ')}. ${a.step3.desc ? 'Tamaño estimado: ' + a.step3.desc : ''}
Panorama competitivo: ${a.step4.selection}. ${a.step4.desc ? 'Diferenciador: ' + a.step4.desc : ''}
Modelo de revenue: ${a.step5.selection}. ${a.step5.desc ? 'Hipótesis de ingresos: ' + a.step5.desc : ''}
`.trim();

  const systemPrompt = `Eres un consultor senior experto en validación de startups y product-market fit. 
Analiza el siguiente resumen de idea de producto digital y responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin texto extra).
El JSON debe tener exactamente esta estructura:
{
  "scores": { "claridad": número_del_0_al_25, "mercado": número_del_0_al_25, "competencia": número_del_0_al_25, "revenue": número_del_0_al_25 },
  "totalScore": número_del_0_al_100,
  "statusLabel": "En desarrollo" | "Con potencial" | "Listo para validar" | "Alta viabilidad",
  "headline": "frase corta impactante sobre la idea (máx 12 palabras)",
  "summary": "párrafo de 2-3 oraciones con la evaluación general de la idea.",
  "strengths": ["fortaleza 1 concreta", "fortaleza 2 concreta", "fortaleza 3 concreta"],
  "risks": ["riesgo 1 concreto", "riesgo 2 concreto", "riesgo 3 concreto"],
  "categories": [
    { "name": "Claridad del problema", "linkedStep": 2, "score": número_0_a_25, "desc": "evaluación específica de 1-2 oraciones" },
    { "name": "Conocimiento del mercado", "linkedStep": 3, "score": número_0_a_25, "desc": "evaluación específica de 1-2 oraciones" },
    { "name": "Validación competitiva", "linkedStep": 4, "score": número_0_a_25, "desc": "evaluación específica de 1-2 oraciones" },
    { "name": "Modelo de revenue", "linkedStep": 5, "score": número_0_a_25, "desc": "evaluación específica de 1-2 oraciones" }
  ],
  "nextSteps": [
    { "title": "acción concreta", "description": "explicación de 1 oración sobre por qué y cómo hacerlo", "impact": número_de_1_a_8, "linkedStep": número_del_1_al_5 },
    { "title": "acción concreta 2", "description": "explicación", "impact": número_de_1_a_8, "linkedStep": número_del_1_al_5 },
    { "title": "acción concreta 3", "description": "explicación", "impact": número_de_1_a_8, "linkedStep": número_del_1_al_5 },
    { "title": "acción concreta 4", "description": "explicación", "impact": número_de_1_a_8, "linkedStep": número_del_1_al_5 }
  ]
}
Los scores deben ser coherentes: el totalScore debe ser la suma de los 4 sub-scores.
Sé honesto y específico — no genérico. Basa los insights en los datos concretos provistos.`;

  let result = null;

  if (apiKey && apiKey.length > 20) {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + promptContext }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        result = JSON.parse(text);
      }
    } catch (err) {
      console.warn('Gemini API error, using simulated result:', err);
    }
  }

  // ─ Simulated result (fallback) ─
  if (!result) {
    result = generateSimulatedResult();
  }

  clearInterval(loadingMsgInterval);

  // Ensure minimum display time of loading screen
  setTimeout(() => {
    STATE.aiResult = result;
    STATE.baseAiScores = { ...result.scores };
    applyScores(result.scores);
    showResults(result);
  }, 3200);
}

/* ─── SIMULATED RESULT GENERATOR ─── */
function generateSimulatedResult() {
  const scores = calcHeuristicScores();
  const total  = Math.round(Object.values(scores).reduce((a, b) => a + b, 0));
  const a = STATE.answers;

  const problemLabel = {
    first_hand: 'de primera mano', observed: 'observado en el entorno',
    informed: 'basado en datos', intuition: 'hipotético',
  }[a.step2.selection] || 'en exploración';

  const revenueLabel = {
    subscription: 'suscripción recurrente', freemium: 'modelo freemium',
    usage: 'pago por uso', license: 'licencia única',
    ads: 'publicidad', undefined: 'modelo no definido',
  }[a.step5.selection] || 'por definir';

  const compLabel = {
    no_competitors: 'mercado sin explorar', few_alternatives: 'pocas alternativas',
    established: 'competencia establecida', crowded: 'mercado muy competido',
  }[a.step4.selection] || 'panorama competitivo';

  let statusLabel = 'En desarrollo';
  if (total >= 80) statusLabel = 'Alta viabilidad';
  else if (total >= 60) statusLabel = 'Listo para validar';
  else if (total >= 35) statusLabel = 'Con potencial';

  // Strengths based on answers
  const strengths = [];
  if (['first_hand', 'observed'].includes(a.step2.selection)) strengths.push('Problema validado desde la experiencia real, lo que reduce el riesgo de construir algo que nadie necesite.');
  if (['subscription', 'freemium'].includes(a.step5.selection)) strengths.push('Modelo de revenue recurrente con alta predictibilidad y potencial de crecimiento compuesto.');
  if (['few_alternatives', 'established'].includes(a.step4.selection)) strengths.push('Espacio de mercado con demanda probada y oportunidad de diferenciación clara.');
  if (a.step3.selections?.includes('smb') || a.step3.selections?.includes('enterprise')) strengths.push('Segmento B2B con mayor poder de compra y menor sensibilidad al precio.');
  if (strengths.length < 2) strengths.push('Hay una oportunidad de posicionamiento único si se ejecuta con claridad.');

  const risks = [];
  if (['intuition', 'informed'].includes(a.step2.selection)) risks.push('El problema no está validado con usuarios reales — existe riesgo de construir una solución sin demanda.');
  if (a.step5.selection === 'undefined') risks.push('Sin un modelo de revenue definido es difícil proyectar viabilidad económica o atraer inversión.');
  if (a.step4.selection === 'crowded') risks.push('Mercado muy competido: sin un diferenciador claro y sostenible, la adquisición de usuarios será costosa.');
  if (a.step4.selection === 'no_competitors') risks.push('La ausencia de competidores puede indicar falta de mercado — es fundamental validar la demanda antes de construir.');
  if (risks.length < 2) risks.push('Se requiere mayor detalle en las hipótesis de mercado para reducir la incertidumbre del análisis.');

  return {
    scores,
    totalScore: total,
    statusLabel,
    headline: `Tu idea tiene ${statusLabel.toLowerCase()} y ${total >= 50 ? 'fundamentos sólidos' : 'áreas clave por fortalecer'}`,
    summary: `Tu idea de "${a.step1.selection || 'producto digital'}" presenta un problema ${problemLabel} con un ${compLabel}. Con un ${revenueLabel}, el potencial de viabilidad es ${statusLabel.toLowerCase()}. El análisis revela oportunidades concretas para elevar tu score completando las áreas de mejora identificadas.`,
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 3),
    categories: [
      {
        name: 'Claridad del problema',
        linkedStep: 2,
        score: scores.claridad,
        desc: scores.claridad >= 18
          ? 'La claridad del problema es alta. Tienes evidencia suficiente para comenzar la validación con usuarios.'
          : 'El problema aún necesita mayor validación con usuarios reales para reducir el riesgo de product-market fit.',
      },
      {
        name: 'Conocimiento del mercado',
        linkedStep: 3,
        score: scores.mercado,
        desc: scores.mercado >= 18
          ? 'Tienes buen entendimiento de tus segmentos objetivo, lo que facilita el diseño de experimentos de validación.'
          : 'Profundizar en el tamaño y comportamiento de tu audiencia elevará significativamente la precisión del análisis.',
      },
      {
        name: 'Validación competitiva',
        linkedStep: 4,
        score: scores.competencia,
        desc: scores.competencia >= 18
          ? 'El panorama competitivo es favorable. Hay espacio para diferenciación y los usuarios están familiarizados con la categoría.'
          : 'Es crucial definir un diferenciador clave y sostenible antes de invertir en desarrollo o adquisición de usuarios.',
      },
      {
        name: 'Modelo de revenue',
        linkedStep: 5,
        score: scores.revenue,
        desc: scores.revenue >= 18
          ? 'El modelo de negocio elegido es probado en el mercado y tiene alta predictibilidad de revenue.'
          : 'Definir y documentar el modelo de revenue con hipótesis de precio y proyecciones aumentará tu puntuación y atraerá mejores oportunidades.',
      },
    ],
    nextSteps: [
      {
        title: 'Realiza 5 entrevistas de problema',
        description: 'Valida el problema con usuarios reales antes de escribir una línea de código. Busca patrones en sus respuestas.',
        impact: 7,
        linkedStep: 2,
      },
      {
        title: 'Define tu TAM, SAM y SOM',
        description: 'Cuantifica el mercado objetivo con datos reales para priorizar el segmento de mayor oportunidad.',
        impact: 6,
        linkedStep: 3,
      },
      {
        title: 'Crea una tabla de competidores detallada',
        description: 'Mapea al menos 5 alternativas directas e indirectas y define tu ventaja competitiva sostenible.',
        impact: 5,
        linkedStep: 4,
      },
      {
        title: 'Construye tu modelo financiero básico',
        description: 'Proyecta ingresos a 12 meses con hipótesis realistas de precio, conversión y crecimiento.',
        impact: 6,
        linkedStep: 5,
      },
    ],
  };
}

/* ─── RENDER RESULTS (Step 7) ─── */
function showResults(result) {
  const formPhase    = $('ss-form-phase');
  const resultsPhase = $('ss-results-phase');
  if (!formPhase || !resultsPhase) return;

  // Hide wizard, show results
  formPhase.style.opacity = '0';
  formPhase.style.transform = 'scale(0.96)';
  formPhase.style.transition = 'all 0.5s cubic-bezier(0.22,1,0.36,1)';

  setTimeout(() => {
    formPhase.classList.add('hidden');
    resultsPhase.classList.remove('hidden');
    resultsPhase.style.opacity = '0';
    resultsPhase.style.transform = 'translateY(20px)';
    resultsPhase.style.transition = 'all 0.6s cubic-bezier(0.22,1,0.36,1)';

    requestAnimationFrame(() => {
      resultsPhase.style.opacity = '1';
      resultsPhase.style.transform = 'translateY(0)';
    });
  }, 450);

  // Populate results content
  populateResults(result);

  // Update both gauges
  setTimeout(() => {
    const s = result.scores;
    applyScores(s);
    updateGauge(result.totalScore, 'ss-gauge-fill-r', 'ss-needle-dot-r', 'ss-score-num-r', 'ss-status-badge-r');
    updateBreakdown(s, 'r');
    updateStickyScore(s, result.totalScore);
  }, 600);
}

function updateBreakdown(scores, prefix) {
  const p = prefix ? `${prefix}bd-` : 'bd-';
  const cats = ['claridad', 'mercado', 'competencia', 'revenue'];
  cats.forEach(cat => {
    const val = Math.round(scores[cat] || 0);
    const scoreEl = $(`${p}${cat}-score`);
    const fillEl  = $(`${p}${cat}-fill`);
    if (scoreEl) {
      scoreEl.textContent = `${val}/25`;
      scoreEl.classList.toggle('active', val > 0);
    }
    if (fillEl) fillEl.style.width = `${(val / 25) * 100}%`;
  });
}

function populateResults(result) {
  // Headline & summary
  const headline = $('ss-results-headline');
  const summary  = $('ss-results-summary');
  if (headline) headline.textContent = result.headline || '';
  if (summary)  summary.textContent  = result.summary  || '';

  // Category rows
  const catRows = $('ss-cat-rows');
  if (catRows && result.categories) {
    catRows.innerHTML = result.categories.map((cat, i) => {
      const q = getQualityLabel(cat.score, 25);
      return `
        <div class="ss-cat-row">
          <div class="ss-cat-row__top">
            <span class="ss-cat-row__name">${cat.name}</span>
            <span class="ss-cat-row__quality ${q.cls}">${q.label}</span>
          </div>
          <div class="ss-cat-row__bottom">
            <button class="ss-cat-row__link" data-linked-step="${cat.linkedStep}">
              Agregar información
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <span class="ss-cat-row__pts">${Math.round(cat.score)} de 25 puntos</span>
          </div>
        </div>
      `;
    }).join('');

    // Bind row links
    $$('.ss-cat-row__link').forEach(btn => {
      btn.addEventListener('click', () => {
        goToEditStep(parseInt(btn.dataset.linkedStep));
      });
    });
  }

  // Action items v2 with checkboxes
  const actionsV2 = $('ss-actions-v2');
  if (actionsV2 && result.nextSteps) {
    actionsV2.innerHTML = result.nextSteps.map((step, i) => `
      <div class="ss-action-v2-item" id="action-v2-${i}">
        <div class="ss-action-v2-num">${i + 1}</div>
        <div class="ss-action-v2-body">
          <div class="ss-action-v2-title">${step.title}</div>
          <div class="ss-action-v2-desc">${step.description}</div>
          <div class="ss-action-v2-impact">+ ${step.impact} puntos potenciales</div>
        </div>
        <div class="ss-action-v2-check"
             id="check-${i}"
             data-action-index="${i}"
             data-impact="${step.impact}"
             role="checkbox"
             aria-checked="false"></div>
      </div>
    `).join('');

    // Bind checkboxes
    $$('.ss-action-v2-check').forEach(check => {
      check.addEventListener('click', () => {
        const idx  = parseInt(check.dataset.actionIndex);
        const isOn = check.classList.toggle('checked');
        STATE.appliedSteps[idx] = isOn;
        check.setAttribute('aria-checked', isOn ? 'true' : 'false');
        recalcResultsScore();
      });
    });
  }

  // Download report
  const dlBtn = $('ss-download-btn');
  if (dlBtn) {
    dlBtn.onclick = () => {
      const a = STATE.answers;
      const r = STATE.aiResult;
      const text = [
        'SMOKESCAN™ — Reporte de análisis',
        '='.repeat(40),
        '',
        `Score total: ${Math.round(r?.totalScore || STATE.totalScore)} / 100`,
        `Estado: ${r?.statusLabel || ''}`,
        '',
        `Producto: ${a.step1.selection || ''} — ${a.step1.desc || ''}`,
        `Problema: ${a.step2.selection || ''} — ${a.step2.desc || ''}`,
        `Audiencia: ${(a.step3.selections || []).join(', ')} — ${a.step3.desc || ''}`,
        `Competencia: ${a.step4.selection || ''} — ${a.step4.desc || ''}`,
        `Revenue: ${a.step5.selection || ''} — ${a.step5.desc || ''}`,
        '',
        'ANÁLISIS',
        r?.headline || '',
        r?.summary  || '',
        '',
        'PUNTUACIÓN POR CATEGORÍA',
        ...(r?.categories || []).map(c => `${c.name}: ${Math.round(c.score)}/25 — ${c.desc}`),
        '',
        'PRÓXIMOS PASOS',
        ...(r?.nextSteps || []).map((s, i) => `${i+1}. ${s.title}: ${s.description} (+${s.impact} pts)`),
      ].join('\n');

      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'smokescan-reporte.txt';
      link.click();
      URL.revokeObjectURL(url);
    };
  }
}

/* ─── CHECKBOX-BASED SCORE ADJUSTMENT ─── */
function recalcResultsScore() {
  if (!STATE.aiResult) return;

  const base  = { ...STATE.baseAiScores };
  const steps = STATE.aiResult.nextSteps || [];
  let bonusTotal = 0;

  Object.keys(STATE.appliedSteps).forEach(idx => {
    if (STATE.appliedSteps[idx]) {
      const step = steps[parseInt(idx)];
      if (step) bonusTotal += step.impact;
    }
  });

  const adjustedTotal = Math.min(100, (STATE.aiResult.totalScore || 0) + bonusTotal);
  const adjustedScores = { ...base };

  if (bonusTotal > 0) {
    const proportions = { claridad: 0.3, mercado: 0.25, competencia: 0.25, revenue: 0.2 };
    Object.keys(adjustedScores).forEach(k => {
      adjustedScores[k] = Math.min(25, adjustedScores[k] + bonusTotal * (proportions[k] || 0.25));
    });
  }

  // Update compact gauge + badge
  updateGauge(adjustedTotal, 'ss-gauge-fill-r', 'ss-needle-dot-r', 'ss-score-num-r', 'ss-status-badge-r');
  updateStickyScore(adjustedScores, adjustedTotal);

  // Update category row scores + quality labels
  if (STATE.aiResult.categories) {
    const keys = ['claridad', 'mercado', 'competencia', 'revenue'];
    $$('.ss-cat-row').forEach((row, i) => {
      const key = keys[i] || 'claridad';
      const newScore = Math.min(25, Math.round(adjustedScores[key] || 0));
      const ptsEl  = row.querySelector('.ss-cat-row__pts');
      const qualEl = row.querySelector('.ss-cat-row__quality');
      if (ptsEl) ptsEl.textContent = `${newScore} de 25 puntos`;
      if (qualEl) {
        const q = getQualityLabel(newScore, 25);
        qualEl.className = `ss-cat-row__quality ${q.cls}`;
        qualEl.textContent = q.label;
      }
    });
  }
}

/* ─── EDIT MODE — go back to a step from results ─── */
function goToEditStep(stepNum) {
  const formPhase    = $('ss-form-phase');
  const resultsPhase = $('ss-results-phase');
  const editBanner   = $('ss-edit-banner');
  const scorePanel   = $('ss-score-panel');
  const applyBtn     = $('ss-btn-apply-changes');

  STATE.isEditMode    = true;
  STATE.editReturnStep = stepNum;

  // Restore pre-selected options in the target step
  restoreStepSelections(stepNum);

  // Show form phase
  resultsPhase.classList.add('hidden');
  formPhase.classList.remove('hidden');
  formPhase.style.opacity = '1';
  formPhase.style.transform = 'none';

  // Restore card size
  const card = $('ss-card');
  if (card) {
    card.style.maxWidth = '';
    card.style.margin   = '';
    card.style.padding  = '';
    card.style.borderRadius = '';
    card.style.width    = '';
    card.style.transition = '';
  }

  // Restore grid
  const grid = $('ss-wizard-grid');
  if (grid) { grid.style.gridTemplateColumns = ''; grid.style.transition = ''; }

  // Show & update score panel
  if (scorePanel) {
    scorePanel.classList.remove('hiding');
    scorePanel.style.opacity = '1';
    scorePanel.style.transform = 'none';
  }

  // Show edit banner
  if (editBanner) editBanner.classList.remove('hidden');

  // Show stepper
  const stepper = $('ss-stepper');
  if (stepper) stepper.style.display = 'flex';

  // Navigate to step
  showStep(stepNum);

  // Bind apply changes button
  if (applyBtn) {
    applyBtn.onclick = () => applyChangesAndReanalyze();
  }

  // Show API banner in case user wants to add key — hidden since key is pre-loaded
  // const apiBanner = $('ss-api-banner');
  // if (apiBanner && !STATE.apiKey) apiBanner.style.display = 'flex';
}

function restoreStepSelections(stepNum) {
  const a = STATE.answers;
  const grid = $(`opts-step${stepNum}`);
  if (!grid) return;

  $$(`#opts-step${stepNum} .ss-option`).forEach(opt => opt.classList.remove('selected'));

  if (stepNum === 3) {
    const sels = a.step3.selections || [];
    sels.forEach(val => {
      const opt = grid.querySelector(`[data-value="${val}"]`);
      if (opt) opt.classList.add('selected');
    });
  } else {
    const key   = `step${stepNum}`;
    const selVal = a[key]?.selection;
    if (selVal) {
      const opt = grid.querySelector(`[data-value="${selVal}"]`);
      if (opt) opt.classList.add('selected');
    }
  }

  // Restore textarea
  const desc = document.querySelector(`#step-${stepNum} .ss-textarea`);
  const key = `step${stepNum}`;
  if (desc && STATE.answers[key]?.desc) desc.value = STATE.answers[key].desc;
}

async function applyChangesAndReanalyze() {
  const current = STATE.currentStep;

  // Save current textarea
  const textarea = document.querySelector(`#step-${current} .ss-textarea`);
  if (textarea) STATE.answers[`step${current}`].desc = textarea.value;

  // Save selections from current step
  if (current === 3) {
    const selEls = $$(`#opts-step${current} .ss-option.selected`);
    STATE.answers.step3.selections = Array.from(selEls).map(o => o.dataset.value);
  } else {
    const selEl = document.querySelector(`#opts-step${current} .ss-option.selected`);
    if (selEl) STATE.answers[`step${current}`].selection = selEl.dataset.value;
  }

  // Recalc heuristic
  const scores = calcHeuristicScores();
  applyScores(scores);

  // Reset applied toggles
  STATE.appliedSteps = {};

  // Run loading sequence again
  STATE.isEditMode = false;
  startLoadingSequence();
}

/* ─── START BUTTON ─── */
function initStartButton() {
  const btn = $('ss-start-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    // Show wizard section
    const wizardSection = $('ss-wizard');
    if (wizardSection) wizardSection.style.display = 'block';

    // API key is pre-loaded, keep banner hidden
    showStep(1);

    // Show sticky (mobile only via CSS)
    const sticky = $('ss-sticky-score');
    if (sticky) sticky.classList.add('visible');

    // Smooth scroll
    setTimeout(() => {
      const formPhase = $('ss-form-phase');
      if (formPhase) formPhase.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  });
}

/* ─── STICKY SCORE TOGGLE ─── */
function initStickyScore() {
  const toggle = $('ss-sticky-toggle');
  const sticky = $('ss-sticky-score');
  if (!toggle || !sticky) return;

  toggle.addEventListener('click', () => {
    sticky.classList.toggle('expanded');
  });
}

/* ─── API KEY MANAGEMENT ─── */
function initApiKey() {
  // Key is pre-loaded in STATE — hide the banner entirely
  const apiBanner = $('ss-api-banner');
  if (apiBanner) apiBanner.style.display = 'none';

  // Also prefill the input if it exists (for transparency)
  const input = $('ss-api-key-input');
  if (input && STATE.apiKey) input.value = STATE.apiKey;
}

/* ─── RESET ─── */
function initReset() {
  const btn = $('ss-reset-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!confirm('¿Reiniciar el análisis? Se perderán tus respuestas actuales.')) return;

    // Reset state
    STATE.answers = {
      step1: { selection: null, desc: '', link: '' },
      step2: { selection: null, desc: '' },
      step3: { selections: [], desc: '' },
      step4: { selection: null, desc: '' },
      step5: { selection: null, desc: '' },
    };
    STATE.scores       = { claridad: 0, mercado: 0, competencia: 0, revenue: 0 };
    STATE.totalScore   = 0;
    STATE.aiResult     = null;
    STATE.baseAiScores = null;
    STATE.appliedSteps = {};
    STATE.isEditMode   = false;

    // Reset UI
    $$('.ss-option').forEach(o => o.classList.remove('selected'));
    $$('.ss-textarea, .ss-input').forEach(el => el.value = '');

    // Reset card dimensions
    const card = $('ss-card');
    if (card) {
      card.style.cssText = '';
    }

    const grid = $('ss-wizard-grid');
    if (grid) grid.style.cssText = '';

    // Reset gauge
    applyScores({ claridad: 0, mercado: 0, competencia: 0, revenue: 0 });

    // Hide edit banner
    const editBanner = $('ss-edit-banner');
    if (editBanner) editBanner.classList.add('hidden');

    // Show form, hide results
    const formPhase    = $('ss-form-phase');
    const resultsPhase = $('ss-results-phase');
    formPhase.classList.remove('hidden');
    formPhase.style.cssText = '';
    resultsPhase.classList.add('hidden');

    // Score panel
    const scorePanel = $('ss-score-panel');
    if (scorePanel) {
      scorePanel.classList.remove('hiding');
      scorePanel.style.cssText = '';
    }

    showStep(1);

    // Scroll to top of wizard
    const wizardSection = $('ss-wizard');
    if (wizardSection) wizardSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ─── NAV SCROLL (matches main.js pattern) ─── */
function initNav() {
  const navWrapper = $('nav-wrapper');
  if (navWrapper) {
    window.addEventListener('scroll', () => {
      navWrapper.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
  }
}

/* ─── MOBILE MENU (matches main.js) ─── */
function initMobileMenu() {
  const hamburger   = $('hamburger');
  const mobileMenu  = $('mobile-menu');
  const mobileClose = $('mobile-close');
  if (!hamburger || !mobileMenu) return;

  const open  = () => { mobileMenu.classList.add('open'); hamburger.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { mobileMenu.classList.remove('open'); hamburger.classList.remove('open'); document.body.style.overflow = ''; };

  hamburger.addEventListener('click', () => mobileMenu.classList.contains('open') ? close() : open());
  if (mobileClose) mobileClose.addEventListener('click', close);
  $$('.mobile-link:not(.mobile-link--accordion), .mobile-sublink').forEach(l => l.addEventListener('click', close));

  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  const srvBtn = $('mobile-servicios-btn');
  const srvSub = $('mobile-servicios-sub');
  if (srvBtn && srvSub) {
    srvBtn.addEventListener('click', () => {
      const isOpen = srvSub.classList.toggle('open');
      srvBtn.classList.toggle('open', isOpen);
    });
  }
}

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initMobileMenu();
  initStartButton();
  initOptions();
  initNavButtons();
  initStickyScore();
  initApiKey();
  initReset();

  // Hide wizard by default (shown on start click)
  const wizardSection = $('ss-wizard');
  // Wizard stays visible but steps are hidden; step 0 = welcome
  // Show wizard immediately if URL has #start param
  if (window.location.hash === '#start') {
    $('ss-start-btn')?.click();
  }
});
