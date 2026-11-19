// Cystic kidney disease simulator — pure model (no DOM).
// Time axis = patient age (years), except acquired cystic disease (years on dialysis).
// Values marked "Model" are teaching assumptions tuned to the textbook course.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const crFromFg = (fg) => clamp(90 / Math.max(fg, 4), 0.4, 20);

/** Ravine ultrasound criteria for ADPKD in at-risk family members (cysts per kidney). */
export function ravine(age, left, right) {
  if (age < 30) return left + right >= 2;
  if (age < 60) return left >= 2 && right >= 2;
  return left >= 4 && right >= 4;
}

export const GAUGES = {
  fg: { unit: 'mL/min', dec: 0, normal: [90, 140], yMin: 0 },
  tkv: { unit: 'mL', dec: 0, normal: [200, 450], yMin: 0 },        // total kidney volume, both kidneys
  pas: { unit: 'mmHg', dec: 0, normal: [100, 139] },
  quistes: { unit: 'n', dec: 0, normal: null, yMin: 0 },          // cysts per kidney on ultrasound
  prev: { unit: '%', dec: 0, normal: null, yMin: 0, yMax: 100 },
  portal: { unit: 'mmHg', dec: 0, normal: [1, 5], yMin: 0 },       // portal pressure gradient
  diuresis: { unit: 'L/24 h', dec: 1, normal: [0.8, 2.5], yMin: 0 },
  urico: { unit: 'mg/dL', dec: 1, normal: [3.5, 7.0] },
  calciuria: { unit: 'mg/24 h', dec: 0, normal: [50, 250], yMin: 0 },
  litiasis: { unit: 'n', dec: 0, normal: null, yMin: 0 },          // cumulative stone episodes
  tumor: { unit: 'cm', dec: 1, normal: [0, 2.9], yMin: 0 },        // largest renal tumour
  riesgo: { unit: '%', dec: 0, normal: null, yMin: 0, yMax: 100 }, // cumulative risk index (Model)
  aml: { unit: 'cm', dec: 1, normal: [0, 3.9], yMin: 0 },          // largest angiomyolipoma
};

const R = (key, min, max, step, def, unit = '', dec = 0) => ({ key, min, max, step, def, unit, dec });
const Ch = (key, options, def) => ({ key, type: 'choice', options, def });

export const ENTITIES = [
  { key: 'pqrad', loc: 'colector', unit: 'years', tMax: 80, dt: 0.5, treat: true,
    params: [Ch('gen', ['pkd1', 'pkd2', 'pkd3'], 'pkd1'), Ch('sexo', ['varon', 'mujer'], 'varon'), Ch('hta_precoz', ['si', 'no'], 'si'), R('inicio', 18, 60, 1, 30)],
    tiles: ['fg', 'tkv', 'pas', 'quistes'], charts: ['fg', 'tkv'],
    steps: ['mutacion', 'calcio_ampc', 'quistes', 'ravine', 'hta', 'extrarrenal', 'ir', 'tolvaptan'] },
  { key: 'pqrar', loc: 'colector', unit: 'years', tMax: 25, dt: 0.25, treat: true,
    params: [R('severidad', 1, 10, 1, 6), R('inicio', 1, 15, 0.5, 4, '', 1)],
    tiles: ['fg', 'portal', 'tkv'], charts: ['fg', 'portal'],
    steps: ['mutacion', 'rinones_grandes', 'pulmon', 'fibrosis_hepatica', 'ht_portal', 'ir', 'tto'] },
  { key: 'simples', loc: 'distal', unit: 'years', tMax: 90, dt: 0.5, treat: false,
    params: [Ch('sexo', ['varon', 'mujer'], 'varon')],
    tiles: ['quistes', 'prev', 'fg'], charts: ['prev', 'fg'],
    steps: ['dilatacion', 'quiste', 'edad', 'benigno'] },
  { key: 'nefronoptisis', loc: 'corticomedular', unit: 'years', tMax: 25, dt: 0.25, treat: false,
    params: [R('progresion', 1, 10, 1, 6)],
    tiles: ['fg', 'diuresis'], charts: ['fg', 'diuresis'],
    steps: ['mutacion', 'poliuria', 'quistes', 'extrarrenal', 'irt'] },
  { key: 'medular', loc: 'corticomedular', unit: 'years', tMax: 80, dt: 0.5, treat: false,
    params: [R('progresion', 1, 10, 1, 5)],
    tiles: ['fg', 'urico'], charts: ['fg', 'urico'],
    steps: ['mutacion', 'quistes_ocultos', 'hiperuricemia', 'ir', 'irt'] },
  { key: 'esponja', loc: 'colector', unit: 'years', tMax: 70, dt: 0.25, treat: true,
    params: [R('calcio', 200, 500, 10, 380, 'mg/24 h'), R('inicio', 15, 60, 1, 30)],
    tiles: ['calciuria', 'litiasis', 'fg'], charts: ['litiasis', 'calciuria'],
    steps: ['dilatacion', 'hipercalciuria', 'litiasis', 'hematuria', 'sin_ir', 'tto'] },
  { key: 'vhl', loc: 'tumor', unit: 'years', tMax: 70, dt: 0.25, treat: true,
    params: [R('crecimiento', 0.2, 0.8, 0.05, 0.4, 'cm', 2)],
    tiles: ['tumor', 'riesgo', 'fg'], charts: ['tumor', 'riesgo'],
    steps: ['mutacion', 'hemangioblastoma', 'quistes', 'carcinoma', 'feocromocitoma', 'cirugia'] },
  { key: 'et', loc: 'tumor', unit: 'years', tMax: 60, dt: 0.25, treat: true,
    params: [R('crecimiento', 0.1, 0.6, 0.05, 0.3, 'cm', 2)],
    tiles: ['aml', 'riesgo', 'fg'], charts: ['aml', 'riesgo'],
    steps: ['mutacion', 'piel', 'aml', 'quistes', 'sangrado', 'tto'] },
  { key: 'adquirida', loc: 'difuso', unit: 'years', tMax: 20, dt: 0.25, treat: true,
    params: [R('cribado', 1, 5, 0.5, 2, '', 1)],
    tiles: ['quistes', 'riesgo'], charts: ['quistes', 'riesgo'],
    steps: ['erc', 'factores', 'quistes', 'sangrado', 'carcinoma', 'angiotc'] },
];

export function defaults(key) {
  const e = ENTITIES.find(x => x.key === key);
  return Object.fromEntries(e.params.map(p => [p.key, p.def]));
}

function runner(e, init, step) {
  const points = [], events = [], fired = new Set();
  const emit = (t, key, args = []) => { if (fired.has(key)) return; fired.add(key); events.push({ t, key, args }); };
  const st = { ...init };
  const n = Math.round(e.tMax / e.dt);
  for (let i = 0; i <= n; i++) {
    const t = +(i * e.dt).toFixed(6);
    const o = step(st, t, e.dt, emit);
    for (const k of Object.keys(o.g)) o.g[k] = Number.isFinite(o.g[k]) ? Math.max(0, o.g[k]) : 0;
    points.push({ t, g: o.g, active: o.active, lesion: clamp(o.lesion ?? 0, 0, 1), badge: o.badge || null });
  }
  return { points, events };
}
const ckd = (fg, t, emit) => { if (fg < 60) emit(t, 'g3', [60]); if (fg < 30) emit(t, 'g4', [30]); if (fg < 15) emit(t, 'g5', [15]); };
const E = (k) => ENTITIES.find(x => x.key === k);

const MODELS = {
  // ADPKD: cysts grow exponentially from adolescence (Model rates: PKD1 5.5 %/yr, PKD2 2.2 %/yr, PKD3 0.8 %/yr;
  // + 0.6 %/yr for male sex and for early HTA). GFR stays normal until total kidney volume is large, then falls.
  // Tolvaptan roughly halves TKV growth (TEMPO 3:4) and slows GFR loss.
  pqrad(p, treated) {
    let r = { pkd1: 0.055, pkd2: 0.022, pkd3: 0.008 }[p.gen];
    if (p.sexo === 'varon') r += 0.006;
    if (p.hta_precoz === 'si') r += 0.006;
    const cystC = { pkd1: 0.35, pkd2: 0.18, pkd3: 0.06 }[p.gen];
    return runner(E('pqrad'), { tkv: 280, fg: 110, on: false }, (s, t, dt, emit) => {
      if (treated && t >= p.inicio) { if (!s.on) emit(t, 'tolvaptan'); s.on = true; }
      if (t > 10) s.tkv *= Math.exp(r * (s.on ? 0.5 : 1) * Math.max(0, 1 - s.tkv / 9000) * dt);
      const burden = Math.max(0, Math.log(s.tkv / 650));
      if (t > 25) s.fg = Math.max(4, s.fg - (0.5 + 3.4 * burden * (s.on ? 0.7 : 1)) * dt);
      const cysts = Math.floor(cystC * Math.max(0, t - 8) ** 1.25 * (s.on ? 0.8 : 1));
      const pas = 118 + 30 * clamp((s.tkv - 500) / 1500, 0, 1) + (p.hta_precoz === 'si' && t > 25 ? 14 : 0) - (s.on ? 10 : 0);
      const rv = t >= 20 && ravine(t, cysts, cysts);
      if (rv) emit(t, 'ravine', [Math.round(t)]);
      if (pas >= 140) emit(t, 'hta');
      if (s.tkv > 1500) emit(t, 'extrarrenal');
      ckd(s.fg, t, emit);
      const active = ['mutacion'];
      if (t > 10) active.push('calcio_ampc');
      if (cysts > 0) active.push('quistes');
      if (rv) active.push('ravine');
      if (pas >= 140) active.push('hta');
      if (s.tkv > 1500) active.push('extrarrenal');
      if (s.fg < 60) active.push('ir');
      if (s.on) active.push('tolvaptan');
      return { g: { fg: s.fg, cr: crFromFg(s.fg), tkv: s.tkv, pas, quistes: cysts }, active,
        lesion: clamp(Math.log(s.tkv / 280) / 3, 0, 1), badge: s.fg < 15 ? 'g5' : rv ? 'ravine' : null };
    });
  },

  // ARPKD (PKHD1 / fibrocystin): enlarged kidneys from birth, pulmonary hypoplasia if severe, congenital hepatic
  // fibrosis → portal hypertension; GFR loss leads to ESRD in childhood/adolescence. Treatment targets portal HTA.
  pqrar(p, treated) {
    const sev = p.severidad / 10;
    return runner(E('pqrar'), { fg: 80, on: false }, (s, t, dt, emit) => {
      if (treated && t >= p.inicio) { if (!s.on) emit(t, 'tto'); s.on = true; }
      if (t > 0) s.fg = Math.max(4, s.fg - (2 + 6 * sev) * dt);
      const portalRaw = 4 + 14 * sev * clamp(t / 12, 0, 1);
      const portal = s.on ? 4 + (portalRaw - 4) * 0.55 : portalRaw;
      const tkv = 350 + 600 * sev;
      if (sev >= 0.8) emit(0, 'pulmon');
      if (portal > 10) emit(t, 'ht_portal');
      ckd(s.fg, t, emit);
      const active = ['mutacion', 'rinones_grandes'];
      if (sev >= 0.8 && t < 1) active.push('pulmon');
      if (t > 1) active.push('fibrosis_hepatica');
      if (portal > 10) active.push('ht_portal');
      if (s.fg < 60) active.push('ir');
      if (s.on) active.push('tto');
      return { g: { fg: s.fg, cr: crFromFg(s.fg), portal, tkv }, active, lesion: 0.5 + 0.5 * sev,
        badge: portal > 10 ? 'ht_portal' : null };
    });
  },

  // Simple cysts: acquired, rise with age (10 % at 50–70, 20–30 % > 70, more in men); no renal failure.
  simples(p) {
    const m = p.sexo === 'varon' ? 1.15 : 0.85;
    return runner(E('simples'), {}, (s, t, dt, emit) => {
      const prev = m * (t < 40 ? 0 : t < 50 ? (t - 40) : t < 70 ? 10 + (t - 50) * 0.25 : 15 + (t - 70) * 0.6);
      const cysts = t < 45 ? 0 : Math.floor((t - 45) / 15) + 1;
      const fg = t < 40 ? 110 : 110 - 0.8 * (t - 40);
      if (cysts > 0) emit(t, 'quiste');
      const active = ['dilatacion'];
      if (cysts > 0) active.push('quiste', 'benigno');
      if (t >= 50) active.push('edad');
      return { g: { prev: clamp(prev, 0, 30), quistes: cysts, fg, cr: crFromFg(fg) }, active, lesion: cysts ? 0.15 + 0.05 * cysts : 0,
        badge: cysts ? 'benigno' : null };
    });
  },

  // Nephronophthisis (AR, nephrocystins 1–5): early polyuria, cortico-medullary cysts, ESRD before 20.
  nefronoptisis(p) {
    const k = p.progresion / 10;
    return runner(E('nefronoptisis'), { fg: 100 }, (s, t, dt, emit) => {
      if (t > 3) s.fg = Math.max(4, s.fg - (3 + 8 * k) * dt);
      const diur = 1 + 2.2 * clamp((t - 2) / 6, 0, 1);
      if (diur > 2.5) emit(t, 'poliuria');
      ckd(s.fg, t, emit);
      const active = ['mutacion'];
      if (diur > 2) active.push('poliuria');
      if (t > 5) active.push('quistes', 'extrarrenal');
      if (s.fg < 15) active.push('irt');
      return { g: { fg: s.fg, cr: crFromFg(s.fg), diuresis: diur }, active, lesion: clamp((100 - s.fg) / 90, 0.1, 1),
        badge: s.fg < 15 ? 'g5' : null };
    });
  },

  // Medullary cystic disease (AD, uromodulin): same picture as nephronophthisis but in adults; hyperuricaemia.
  medular(p) {
    const k = p.progresion / 10;
    return runner(E('medular'), { fg: 110 }, (s, t, dt, emit) => {
      if (t > 18) s.fg = Math.max(4, s.fg - (1 + 2.4 * k) * dt);
      const urico = 5 + 3.8 * clamp((t - 12) / 20, 0, 1);
      if (urico > 7) emit(t, 'hiperuricemia');
      ckd(s.fg, t, emit);
      const active = ['mutacion', 'quistes_ocultos'];
      if (urico > 7) active.push('hiperuricemia');
      if (s.fg < 60) active.push('ir');
      if (s.fg < 15) active.push('irt');
      return { g: { fg: s.fg, cr: crFromFg(s.fg), urico }, active, lesion: clamp((110 - s.fg) / 100, 0.1, 1),
        badge: s.fg < 15 ? 'g5' : null };
    });
  },

  // Medullary sponge kidney: dilated collecting ducts + hypercalciuria → recurrent stones and haematuria;
  // no renal failure. Thiazides + fluids lower calciuria and stone episodes (Model rate ∝ calciuria − 200).
  esponja(p, treated) {
    return runner(E('esponja'), { stones: 0, acc: 0, on: false }, (s, t, dt, emit) => {
      if (treated && t >= p.inicio) { if (!s.on) emit(t, 'tto'); s.on = true; }
      const calc = s.on ? 200 + (p.calcio - 200) * 0.4 : p.calcio;
      if (t > 15) {
        s.acc += Math.max(0, (calc - 180) / 100) * 0.12 * dt;
        while (s.acc >= 1) { s.acc -= 1; s.stones++; emit(t, `colico${Math.min(s.stones, 20)}`, [s.stones]); }
      }
      const active = ['dilatacion'];
      if (calc > 250) active.push('hipercalciuria');
      if (s.stones > 0) active.push('litiasis', 'hematuria');
      active.push('sin_ir');
      if (s.on) active.push('tto');
      return { g: { calciuria: calc, litiasis: s.stones, fg: 105 - 0.3 * Math.max(0, t - 40) }, active,
        lesion: 0.2 + 0.03 * Math.min(20, s.stones), badge: calc > 250 ? 'hipercalciuria' : null };
    });
  },

  // Von Hippel-Lindau (VHL 3p25, tumour suppressor): multifocal clear-cell RCC; metastatic risk climbs once a
  // tumour exceeds ~3 cm. Surveillance + nephron-sparing surgery at 3 cm resets the largest tumour (standard care).
  vhl(p, treated) {
    return runner(E('vhl'), { size: 0, risk: 0, H: 0, fg: 105, ops: 0 }, (s, t, dt, emit) => {
      if (t > 22) s.size = Math.min(12, s.size + p.crecimiento * dt);
      if (treated && s.size >= 3) { s.ops++; s.size = 0.3; s.fg -= 8; emit(t, `cirugia${Math.min(s.ops, 6)}`, [s.ops]); }
      if (t > 0) s.H += (s.size > 3 ? 0.05 * (s.size - 3) : 0.001 * s.size) * dt;
      s.risk = 100 * (1 - Math.exp(-s.H));
      if (t >= 18) emit(18, 'hemangioblastoma');
      if (t >= 26) emit(26, 'feocromocitoma');
      if (s.size >= 3) emit(t, 'umbral');
      const active = ['mutacion'];
      if (t >= 18) active.push('hemangioblastoma');
      if (t > 20) active.push('quistes');
      if (s.size > 1) active.push('carcinoma');
      if (t >= 26) active.push('feocromocitoma');
      if (treated && s.ops > 0) active.push('cirugia');
      return { g: { tumor: s.size, riesgo: s.risk, fg: s.fg, cr: crFromFg(s.fg) }, active, lesion: clamp(s.size / 5, 0.1, 1),
        badge: s.size >= 3 ? 'tumor3' : null };
    });
  },

  // Tuberous sclerosis: renal angiomyolipomas grow from childhood; bleeding risk rises above ~4 cm.
  // Treatment of large AML (mTOR inhibitor or embolisation, standard care) shrinks them.
  et(p, treated) {
    return runner(E('et'), { size: 0, risk: 0, H: 0, on: false }, (s, t, dt, emit) => {
      if (t > 8 && !s.on) s.size = Math.min(12, s.size + p.crecimiento * dt);
      if (treated && s.size >= 3.5 && !s.on) { s.on = true; emit(t, 'tto'); }
      if (s.on) s.size = Math.max(1.5, s.size - 0.35 * dt);
      if (t > 0) s.H += (s.size > 4 ? 0.04 * (s.size - 4) : 0) * dt;
      s.risk = 100 * (1 - Math.exp(-s.H));
      if (t >= 3) emit(3, 'piel');
      if (s.size > 4) emit(t, 'aml4');
      const active = ['mutacion'];
      if (t >= 3) active.push('piel');
      if (s.size > 0.5) active.push('aml', 'quistes');
      if (s.size > 4) active.push('sangrado');
      if (s.on) active.push('tto');
      return { g: { aml: s.size, riesgo: s.risk, fg: 105 - 0.4 * Math.max(0, t - 30) }, active, lesion: clamp(s.size / 6, 0.05, 1),
        badge: s.size > 4 ? 'aml4' : null };
    });
  },

  // Acquired cystic disease: cysts (0.5–2 cm) appear in advanced CKD/dialysis and multiply with time on dialysis;
  // renal carcinoma risk rises. Periodic imaging (angio-CT if septa/solid content) catches tumours early.
  adquirida(p, treated) {
    return runner(E('adquirida'), { risk: 0 }, (s, t, dt, emit) => {
      const cysts = Math.floor(2 + 1.6 * t);
      const raw = 0.6 * t * t / 10;
      if (t > 0) s.risk = treated ? Math.min(100, raw * 0.25) : Math.min(100, raw);
      if (cysts >= 5) emit(t, 'multiples');
      if (treated) for (let k = p.cribado; k <= t + 1e-9; k += p.cribado) emit(k, `cribado${Math.round(k / p.cribado)}`, [Math.round(k * 10) / 10]);
      const active = ['erc', 'factores', 'quistes'];
      if (t > 6) active.push('sangrado');
      if (s.risk > 5) active.push('carcinoma');
      if (treated) active.push('angiotc');
      return { g: { quistes: cysts, riesgo: s.risk, fg: 6 }, active, lesion: clamp(cysts / 30, 0.1, 1),
        badge: s.risk > 10 ? 'carcinoma' : null };
    });
  },
};

export function simulate(key, params, treated = false) {
  const e = ENTITIES.find(x => x.key === key);
  if (!e) throw new Error(`unknown entity ${key}`);
  const p = { ...defaults(key), ...params };
  return MODELS[key](p, treated && e.treat);
}

export const PRESETS = {
  pkd1_varon: { entity: 'pqrad', params: { gen: 'pkd1', sexo: 'varon', hta_precoz: 'si', inicio: 30 } },
  pkd2_mujer: { entity: 'pqrad', params: { gen: 'pkd2', sexo: 'mujer', hta_precoz: 'no', inicio: 40 } },
  tolvaptan_tardio: { entity: 'pqrad', params: { gen: 'pkd1', sexo: 'varon', hta_precoz: 'si', inicio: 45 } },
  recien_nacido_pqrar: { entity: 'pqrar', params: { severidad: 9, inicio: 3 } },
  quiste_casual: { entity: 'simples', params: { sexo: 'varon' } },
  nefronoptisis_juvenil: { entity: 'nefronoptisis', params: { progresion: 6 } },
  quistica_medular_adulto: { entity: 'medular', params: { progresion: 5 } },
  litiasis_recurrente: { entity: 'esponja', params: { calcio: 420, inicio: 28 } },
  vhl_vigilancia: { entity: 'vhl', params: { crecimiento: 0.4 } },
  et_angiomiolipoma: { entity: 'et', params: { crecimiento: 0.35 } },
  dialisis_largo_plazo: { entity: 'adquirida', params: { cribado: 2 } },
};
