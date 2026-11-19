// Schematic of a kidney in coronal section with its cysts. Where the cysts form (collecting duct,
// cortico-medullary junction, distal tubule, tumour, diffuse/acquired) depends on the entity; the
// kidney grows with total kidney volume and fades as GFR falls.
export function drawSchematic(box, e, pt, tr) {
  const L = pt.lesion;
  const fg = pt.g.fg ?? 100;
  const health = Math.max(0, Math.min(1, fg / 100));
  const tkv = pt.g.tkv;
  const scale = tkv ? Math.min(1.55, 0.8 + 0.25 * Math.log(tkv / 280 + 1)) : (e.loc === 'difuso' ? 0.78 : 1);
  const hot = 'var(--hot)';
  const seed = (i, a) => ((Math.sin(i * 12.9898 + a * 78.233) * 43758.5453) % 1 + 1) % 1;
  const cx = 250, cy = 122, rx = Math.min(160, 95 * scale), ry = Math.min(108, 92 * scale);
  const inK = (i) => { const a = seed(i, 1) * Math.PI * 2, r = Math.sqrt(seed(i, 2)) * 0.82; return [cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a)]; };
  let cysts = '';
  const C = (x, y, r, fill = 'var(--cyst)', stroke = 'var(--s1)') => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`;
  if (e.loc === 'colector' && e.key !== 'esponja') {
    const n = Math.round(4 + 40 * L);
    for (let i = 0; i < n; i++) { const [x, y] = inK(i); cysts += C(x, y, 5 + 14 * L * seed(i, 3)); }
  } else if (e.key === 'esponja') {
    for (let i = 0; i < 9; i++) { const a = -1.1 + i * 0.28; const x = cx + 30 * Math.cos(a) + 25, y = cy + 70 * Math.sin(a);
      cysts += `<path d="M${cx - 20} ${cy} L${x} ${y}" stroke="var(--s1)" stroke-width="${4 + 3 * L}" stroke-linecap="round" opacity=".7"/>`;
      if (pt.g.litiasis && i < Math.min(9, pt.g.litiasis)) cysts += `<circle cx="${x}" cy="${y}" r="4" fill="var(--ink2)"/>`; }
  } else if (e.loc === 'corticomedular') {
    const n = Math.round(3 + 14 * L);
    for (let i = 0; i < n; i++) { const a = -1.3 + (2.6 * i) / Math.max(1, n - 1); cysts += C(cx + rx * 0.55 * Math.cos(a) + 10, cy + ry * 0.6 * Math.sin(a), 4 + 3 * seed(i, 4)); }
  } else if (e.loc === 'distal') {
    const n = pt.g.quistes || 0;
    for (let i = 0; i < n; i++) { const [x, y] = inK(i + 3); cysts += C(x, y, 10 + 4 * seed(i, 5)); }
  } else if (e.loc === 'tumor') {
    for (let i = 0; i < 6; i++) { const [x, y] = inK(i + 7); cysts += C(x, y, 5 + 4 * seed(i, 6)); }
    const size = pt.g.tumor ?? pt.g.aml ?? 0;
    if (size > 0.2) cysts += `<circle cx="${cx + rx * 0.35}" cy="${cy - ry * 0.35}" r="${4 + size * 6}" fill="${hot}" opacity=".55" stroke="${hot}" stroke-width="2"/>`;
  } else if (e.loc === 'difuso') {
    const n = Math.min(40, pt.g.quistes || 0);
    for (let i = 0; i < n; i++) { const [x, y] = inK(i + 11); cysts += C(x, y, 3 + 4 * seed(i, 7)); }
  }
  const locLabel = tr(`schem.loc.${e.loc}`);
  const showLiver = e.key === 'pqrar' || e.key === 'pqrad';
  box.innerHTML = `
<svg viewBox="0 0 700 260" role="img" aria-label="${tr('schem.aria')}">
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="var(--tissue)" stroke="var(--tissue-line)" stroke-width="2" style="filter:saturate(${0.35 + 0.65 * health})"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="var(--page)" opacity="${0.5 * (1 - health)}"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.55}" ry="${ry * 0.62}" fill="none" stroke="var(--tissue-line)" stroke-dasharray="4 4" opacity=".7"/>
  <path d="M${cx - rx * 0.9} ${cy - 18} Q${cx - rx * 0.55} ${cy} ${cx - rx * 0.9} ${cy + 18}" stroke="var(--tissue-line)" stroke-width="3" fill="none"/>
  ${cysts}
  <text x="${cx}" y="252" text-anchor="middle">${tr('schem.rinon')}${tkv ? ` · TKV ${Math.round(tkv)} mL` : ''}</text>
  <text x="470" y="40" class="lbl-on">${locLabel}</text>
  <text x="470" y="62">${tr('schem.cortex')} / ${tr('schem.medulla')}</text>
  ${showLiver ? `<text x="470" y="90">${tr(e.key === 'pqrar' ? 'schem.liverFib' : 'schem.liverCyst')}</text>` : ''}
  <circle cx="480" cy="120" r="8" fill="var(--cyst)" stroke="var(--s1)"/><text x="496" y="124">${tr('schem.cyst')}</text>
  ${e.loc === 'tumor' ? `<circle cx="480" cy="146" r="8" fill="${hot}" opacity=".55"/><text x="496" y="150">${tr(e.key === 'et' ? 'schem.aml' : 'schem.ccr')}</text>` : ''}
  ${e.key === 'esponja' ? `<circle cx="480" cy="146" r="5" fill="var(--ink2)"/><text x="496" y="150">${tr('schem.stone')}</text>` : ''}
  <text x="640" y="40" text-anchor="middle">${tr('schem.fg')}</text>
  <text x="640" y="62" text-anchor="middle" style="font-size:18px;font-weight:700;fill:var(--ink)">${Math.round(fg)}</text>
  <rect x="628" y="74" width="24" height="160" rx="6" fill="none" stroke="var(--axis)"/>
  <rect x="628" y="${74 + 160 * (1 - Math.min(1, fg / 120))}" width="24" height="${160 * Math.min(1, fg / 120)}" rx="6" fill="var(--s1)" opacity=".7"/>
</svg>`;
}
