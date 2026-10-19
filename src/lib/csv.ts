import type { RunConfig, RunResult } from './calc';

const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const n = (v: number, d = 3) => (isFinite(v) ? v.toFixed(d) : '');

export function runToCsv(name: string, cfg: RunConfig, r: RunResult): string {
  const rows: unknown[][] = [];
  rows.push(['CiP Performance run', name]);
  rows.push(['Generated', new Date().toLocaleString()]);
  rows.push(['Engineering estimate using standard GPSA methods; not OEM-certified. Verify critical applications with CiP engineering.']);
  rows.push([]);
  rows.push(['Inputs']);
  rows.push(['Frame', cfg.frameId], ['RPM', cfg.rpm], ['Stages', cfg.stages], ['Interstage mode', cfg.interstageMode]);
  rows.push(['SG', cfg.sg], ['k used', n(r.k, 3)], ['Z method', cfg.zMethod]);
  rows.push(['Suction psig', cfg.suctionPsig], ['Suction temp F', cfg.suctionTempF], ['Discharge psig', cfg.dischargePsig]);
  rows.push(['Interstage cooler outlets F', cfg.interstageTempsF.slice(0, Math.max(0, cfg.stages - 1)).join(' / ')], ['Atmospheric psia', cfg.atmPsia], ['Driver HP', cfg.driverHp ?? '']);
  rows.push(['Lubricated', cfg.lubricated ? 'yes' : 'no'], ['Compression eff', cfg.compEff], ['Mechanical eff', cfg.mechEff]);
  rows.push([]);
  rows.push(['Stage', 'Ps psig', 'Pd psig', 'Ratio', 'Ts F', 'Td F', 'Zs', 'Zd', 'ACFM', 'MMSCFD', 'IHP', 'BHP']);
  for (const s of r.stages)
    rows.push([s.stage, n(s.psPsig, 1), n(s.pdPsig, 1), n(s.ratio, 3), n(s.tsF, 1), n(s.tdF, 1), n(s.zs, 4), n(s.zd, 4), n(s.acfm, 2), n(s.mmscfd, 4), n(s.ihp, 1), n(s.bhp, 1)]);
  rows.push([]);
  rows.push(['Throw', 'Type', 'Rod comp lb', '% lim', 'Rod tens lb', '% lim', 'Combined lb', '% lim', 'Reversal deg', 'Neck dia in']);
  for (const t of r.throws)
    rows.push([
      t.index + 1, t.kind,
      n(t.rod.compressionLb, 0), t.pctCompression == null ? '' : n(t.pctCompression, 1),
      n(t.rod.tensionLb, 0), t.pctTension == null ? '' : n(t.pctTension, 1),
      n(t.rod.combinedLb, 0), t.pctCombined == null ? '' : n(t.pctCombined, 1),
      t.rod.reversalDeg, t.neckDiaIn ?? '',
    ]);
  rows.push([]);
  const endCsv = (e: RunResult['throws'][number]['parts'][number]['he']) =>
    e.active ? 'active' : e.mode === 'vent' ? 'vented' : `stg ${e.mode.slice(1)} suction (${n(e.refPsig ?? 0, 0)} psig)`;
  rows.push(['Throw', 'Position', 'Stage', 'Cylinder', 'Bore in', 'MAWP psig', 'HE area in2', 'HE clr %', 'HE', 'VE HE %', 'CE area in2', 'CE clr %', 'CE', 'VE CE %', 'Placeholder']);
  for (const t of r.throws)
    for (const p of t.parts)
      rows.push([
        t.index + 1, p.position, p.stage, p.cylinder.name, p.cylinder.boreIn, p.cylinder.mawpPsig,
        n(p.he.areaIn2, 3), n(p.he.clearancePct, 1), endCsv(p.he), p.he.active ? n(p.he.ve, 1) : '',
        n(p.ce.areaIn2, 3), n(p.ce.clearancePct, 1), endCsv(p.ce), p.ce.active ? n(p.ce.ve, 1) : '',
        p.cylinder.placeholder ? 'yes' : 'no',
      ]);
  rows.push([]);
  rows.push(['Unit MMSCFD', n(r.mmscfd, 4)], ['Total BHP', n(r.bhp, 1)], ['% frame HP', n(r.pctFrameHp, 1)]);
  rows.push([]);
  rows.push(['Flags']);
  for (const f of r.flags) rows.push([f.level.toUpperCase(), f.msg]);
  return rows.map((row) => row.map(esc).join(',')).join('\n');
}

export function downloadText(filename: string, text: string, mime = 'text/csv') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
