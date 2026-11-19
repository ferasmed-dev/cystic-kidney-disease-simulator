import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTITIES, GAUGES, PRESETS, simulate, defaults, crFromFg, ravine } from '../src/model.js';
import { STR } from '../src/i18n.js';

const last = r => r.points[r.points.length - 1];
const at = (r, t) => r.points.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
const min = (r, g) => Math.min(...r.points.map(p => p.g[g]));
const max = (r, g) => Math.max(...r.points.map(p => p.g[g]));
const evs = r => r.events.map(e => e.key);

/* ---------- generic: every entity ---------- */
for (const e of ENTITIES) {
  test(`${e.key}: well-formed output (defaults, extremes, both arms)`, () => {
    const variants = [defaults(e.key)];
    for (const p of e.params.filter(q => q.type !== 'choice')) {
      variants.push({ ...defaults(e.key), [p.key]: p.min }, { ...defaults(e.key), [p.key]: p.max });
    }
    for (const p of e.params.filter(q => q.type === 'choice')) for (const o of p.options) variants.push({ ...defaults(e.key), [p.key]: o });
    for (const v of variants) for (const tr of [false, true]) {
      const r = simulate(e.key, v, tr);
      assert.equal(r.points.length, Math.round(e.tMax / e.dt) + 1);
      for (let i = 1; i < r.points.length; i++) assert.ok(r.points[i].t > r.points[i - 1].t);
      for (const pt of r.points) {
        for (const g of [...e.tiles, ...e.charts]) {
          assert.ok(Number.isFinite(pt.g[g]) && pt.g[g] >= 0, `${e.key} ${g}=${pt.g[g]}`);
          assert.ok(GAUGES[g], `gauge ${g} defined`);
        }
        for (const a of pt.active) assert.ok(e.steps.includes(a), `${e.key} unknown step ${a}`);
        assert.ok(pt.lesion >= 0 && pt.lesion <= 1);
      }
      for (const ev of r.events) assert.ok(ev.t >= 0 && ev.t <= e.tMax);
    }
  });
}

test('pure: same input → same output, params not mutated', () => {
  for (const e of ENTITIES) {
    const p = defaults(e.key); const copy = JSON.stringify(p);
    assert.deepEqual(simulate(e.key, p, true), simulate(e.key, p, true));
    assert.equal(JSON.stringify(p), copy);
  }
});

test('creatinine falls as GFR rises and is ~0.9 at 100 mL/min', () => {
  assert.ok(Math.abs(crFromFg(100) - 0.9) < 1e-9);
  assert.ok(crFromFg(30) > crFromFg(60));
});

test('i18n: every key used by the model exists in ES and EN', () => {
  for (const lang of ['es', 'en']) {
    const S = STR[lang];
    for (const e of ENTITIES) {
      const E = S.ent[e.key];
      for (const f of ['name', 'what', 'params', 'sees', 'tto']) assert.ok(E[f], `${lang} ${e.key}.${f}`);
      for (const st of e.steps) assert.ok(E.steps[st], `${lang} step ${e.key}.${st}`);
      for (const p of e.params) {
        assert.ok(S.params[p.key], `${lang} param ${p.key}`);
        if (p.type === 'choice') for (const o of p.options) assert.ok(S.choice[p.key][o], `${lang} choice ${p.key}.${o}`);
      }
      for (const g of [...e.tiles, ...e.charts]) assert.ok(S.gauges[g], `${lang} gauge ${g}`);
      assert.ok(S.units[e.unit]);
      for (const tr of [false, true]) {
        const r = simulate(e.key, defaults(e.key), tr);
        for (const ev of r.events) assert.equal(typeof S.ev[ev.key], 'function', `${lang} event ${ev.key}`);
        for (const pt of r.points) if (pt.badge) assert.ok(S.badge[pt.badge], `${lang} badge ${pt.badge}`);
      }
    }
    for (const k of Object.keys(PRESETS)) assert.ok(S.presets[k], `${lang} preset ${k}`);
  }
});

/* ---------- presets ---------- */
test('presets reference valid entities and parameters', () => {
  for (const [k, pr] of Object.entries(PRESETS)) {
    const e = ENTITIES.find(x => x.key === pr.entity);
    assert.ok(e, k);
    for (const pk of Object.keys(pr.params)) assert.ok(e.params.some(p => p.key === pk), `${k}.${pk}`);
    for (const ev of [...simulate(pr.entity, pr.params, false).events, ...simulate(pr.entity, pr.params, true).events]) {
      assert.equal(typeof STR.es.ev[ev.key], 'function', `${k} event ${ev.key}`);
    }
  }
});

/* ---------- mechanisms ---------- */
const ageAt = (r, key) => (r.events.find(e => e.key === key) || {}).t;

test('Ravine criteria boundaries', () => {
  assert.equal(ravine(25, 2, 0), true);
  assert.equal(ravine(25, 1, 0), false);
  assert.equal(ravine(45, 2, 1), false);
  assert.equal(ravine(45, 2, 2), true);
  assert.equal(ravine(65, 3, 4), false);
  assert.equal(ravine(65, 4, 4), true);
});

test('ADPKD: PKD1 reaches ESRD in the 50s, PKD2 is milder, PKD3 mild; TKV grows before GFR falls', () => {
  const p1 = simulate('pqrad', PRESETS.pkd1_varon.params);
  const esrd = ageAt(p1, 'g5');
  assert.ok(esrd >= 48 && esrd <= 60, `PKD1 ESRD at ${esrd}`);
  const p2 = simulate('pqrad', PRESETS.pkd2_mujer.params);
  assert.ok(at(p2, 70).g.fg > 60, 'PKD2: normal-ish function at 70');
  assert.ok(at(simulate('pqrad', { gen: 'pkd3', sexo: 'mujer', hta_precoz: 'no' }), 80).g.fg > 70);
  assert.ok(at(p1, 35).g.tkv > 2 * at(p1, 15).g.tkv && at(p1, 35).g.fg > 85, 'cysts grow for decades before GFR falls');
  const f = ageAt(simulate('pqrad', { gen: 'pkd1', sexo: 'mujer', hta_precoz: 'no' }), 'g5');
  assert.ok(f > esrd, 'male sex and early HTA accelerate');
  assert.ok(ageAt(p1, 'ravine') >= 20, 'ultrasound not used before 20');
});

test('ADPKD: tolvaptan slows TKV growth and delays ESRD; earlier start helps more', () => {
  const P = PRESETS.pkd1_varon.params;
  const u = simulate('pqrad', P, false), t = simulate('pqrad', P, true), late = simulate('pqrad', PRESETS.tolvaptan_tardio.params, true);
  assert.ok(at(t, 50).g.tkv < at(u, 50).g.tkv * 0.8);
  assert.ok(ageAt(t, 'g5') > ageAt(u, 'g5') + 5 && ageAt(t, 'g5') > ageAt(late, 'g5'));
});

test('ARPKD: ESRD in childhood and portal hypertension; treatment lowers the portal gradient', () => {
  const u = simulate('pqrar', PRESETS.recien_nacido_pqrar.params, false);
  assert.ok(ageAt(u, 'g5') < 15 && max(u, 'portal') > 10 && u.events.some(e => e.key === 'pulmon'));
  assert.ok(max(simulate('pqrar', PRESETS.recien_nacido_pqrar.params, true), 'portal') < max(u, 'portal') - 3);
});

test('simple cysts: absent before 40, ~10 % at 50–70, 20–30 % over 70; GFR only ages', () => {
  const r = simulate('simples', {});
  assert.equal(at(r, 35).g.quistes, 0);
  assert.ok(Math.abs(at(r, 60).g.prev - 11) < 4 && at(r, 80).g.prev >= 20 && at(r, 80).g.prev <= 30);
  assert.ok(at(r, 80).g.fg > 60);
});

test('nephronophthisis vs medullary cystic disease: ESRD < 20 years vs in adulthood', () => {
  const n = simulate('nefronoptisis', PRESETS.nefronoptisis_juvenil.params);
  assert.ok(ageAt(n, 'g5') < 20 && ageAt(n, 'poliuria') < ageAt(n, 'g3'));
  const m = simulate('medular', PRESETS.quistica_medular_adulto.params);
  assert.ok(ageAt(m, 'g5') > 40 && max(m, 'urico') > 7);
});

test('medullary sponge kidney: stones without renal failure; thiazides reduce episodes', () => {
  const u = simulate('esponja', PRESETS.litiasis_recurrente.params, false);
  const t = simulate('esponja', PRESETS.litiasis_recurrente.params, true);
  assert.ok(last(u).g.litiasis >= 8 && last(t).g.litiasis < last(u).g.litiasis - 3);
  assert.ok(min(u, 'fg') > 60);
  assert.ok(last(simulate('esponja', { calcio: 220 })).g.litiasis < last(u).g.litiasis);
});

test('VHL: surveillance + surgery at 3 cm keeps tumours small and metastatic risk low', () => {
  const u = simulate('vhl', PRESETS.vhl_vigilancia.params, false), t = simulate('vhl', PRESETS.vhl_vigilancia.params, true);
  assert.ok(max(t, 'tumor') <= 3.1 && last(u).g.tumor > 8);
  assert.ok(last(t).g.riesgo < 15 && last(u).g.riesgo > 80);
  assert.ok(t.events.filter(e => e.key.startsWith('cirugia')).length >= 3, 'multifocal: repeated surgery');
});

test('tuberous sclerosis: AML > 4 cm raises bleeding risk; treatment shrinks it', () => {
  const u = simulate('et', PRESETS.et_angiomiolipoma.params, false), t = simulate('et', PRESETS.et_angiomiolipoma.params, true);
  assert.ok(max(u, 'aml') > 4 && last(u).g.riesgo > 30);
  assert.ok(last(t).g.aml < 4 && last(t).g.riesgo < 5);
});

test('acquired cystic disease: cysts multiply with years on dialysis; surveillance lowers carcinoma risk', () => {
  const u = simulate('adquirida', PRESETS.dialisis_largo_plazo.params, false), t = simulate('adquirida', PRESETS.dialisis_largo_plazo.params, true);
  assert.ok(last(u).g.quistes > at(u, 2).g.quistes * 3);
  assert.ok(last(t).g.riesgo < last(u).g.riesgo / 2);
});
