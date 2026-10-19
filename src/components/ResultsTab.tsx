import type { RunConfig, RunResult, ThrowResult } from '../lib/calc';
import { fmt } from '../lib/format';
import { Card, Pill } from './ui';

const red = 'text-[#B91C1C] font-bold';
const amber = 'text-amber-700 font-semibold';

function pctCls(p: number | null) {
  if (p == null) return '';
  return p > 100 ? red : p > 90 ? amber : 'text-green-800';
}

export function Summary({ r, cfg }: { r: RunResult; cfg: RunConfig }) {
  const reds = r.flags.filter((f) => f.level === 'red').length;
  const ambers = r.flags.filter((f) => f.level === 'amber').length;
  const hpCls = r.pctFrameHp > 100 ? red : r.pctFrameHp > 90 ? amber : '';
  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile label="Capacity" value={fmt(r.mmscfd, 3)} unit="MMSCFD" />
      <Tile label="Total BHP" value={fmt(r.bhp, 1)} unit={`${fmt(r.pctFrameHp, 0)}% of ${r.frame.ratedHp}`} cls={hpCls} />
      <Tile
        label="Checks"
        value={reds ? `${reds} red` : ambers ? `${ambers} amber` : 'OK'}
        unit={cfg.driverHp ? `driver ${fmt(cfg.driverHp)} HP` : `${r.frame.id} @ ${fmt(cfg.rpm)}`}
        cls={reds ? red : ambers ? amber : 'text-green-800'}
      />
    </div>
  );
}

function Tile({ label, value, unit, cls = '' }: { label: string; value: string; unit: string; cls?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm print:shadow-none">
      <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={'text-xl font-extrabold tabular-nums leading-tight ' + cls}>{value}</div>
      <div className="truncate text-[11px] text-zinc-500">{unit}</div>
    </div>
  );
}

export function FlagList({ r }: { r: RunResult }) {
  const order = { red: 0, amber: 1, info: 2 } as const;
  const flags = [...r.flags].sort((a, b) => order[a.level] - order[b.level]);
  if (!flags.some((f) => f.level !== 'info'))
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">All limits OK</div>
        {flags.map((f, i) => (
          <FlagRow key={i} level={f.level} msg={f.msg} />
        ))}
      </div>
    );
  return (
    <div className="space-y-2">
      {flags.map((f, i) => (
        <FlagRow key={i} level={f.level} msg={f.msg} />
      ))}
    </div>
  );
}

function FlagRow({ level, msg }: { level: 'red' | 'amber' | 'info'; msg: string }) {
  const c = {
    red: 'border-red-200 bg-red-50 text-[#B91C1C]',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    info: 'border-zinc-200 bg-zinc-50 text-zinc-600',
  }[level];
  return <div className={`rounded-xl border px-3 py-2 text-[13px] leading-snug ${c}`}>{msg}</div>;
}

export function StageTable({ r, cfg }: { r: RunResult; cfg: RunConfig }) {
  const S = r.stages;
  const throwsOf = (s: number) => r.throws.filter((t) => t.stage === s);
  const rows: { label: string; cells: (string | { v: string; cls: string })[] }[] = [
    { label: 'Suction press, psig', cells: S.map((s) => fmt(s.psPsig, 1)) },
    { label: 'Discharge press, psig', cells: S.map((s) => fmt(s.pdPsig, 1)) },
    { label: 'Compression ratio', cells: S.map((s) => ({ v: fmt(s.ratio, 2), cls: s.ratio > 4.5 ? amber : '' })) },
    { label: 'Suction temp, °F', cells: S.map((s) => fmt(s.tsF, 0)) },
    {
      label: 'Discharge temp, °F',
      cells: S.map((s) => ({ v: fmt(s.tdF, 0), cls: s.tdF > cfg.alarmDischargeTempF ? red : s.tdF > cfg.alarmDischargeTempF - 25 ? amber : '' })),
    },
    { label: 'Zs / Zd', cells: S.map((s) => `${fmt(s.zs, 3)} / ${fmt(s.zd, 3)}`) },
    {
      label: 'VE HE / CE, %',
      cells: S.map((s) =>
        throwsOf(s.stage)
          .map((t) => `${t.he.active ? fmt(t.he.ve, 1) : '—'} / ${t.ce.active ? fmt(t.ce.ve, 1) : '—'}`)
          .join('\n'),
      ),
    },
    { label: 'Inlet ACFM', cells: S.map((s) => fmt(s.acfm, 1)) },
    { label: 'Capacity, MMSCFD', cells: S.map((s) => ({ v: fmt(s.mmscfd, 3), cls: 'font-bold' })) },
    { label: 'Gas HP (isentropic)', cells: S.map((s) => fmt(s.ihp, 1)) },
    { label: 'BHP', cells: S.map((s) => ({ v: fmt(s.bhp, 1), cls: 'font-bold' })) },
  ];
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[300px] border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b-2 border-zinc-900 text-left">
            <th className="px-1 py-1.5 text-xs font-bold text-zinc-500"> </th>
            {S.map((s) => (
              <th key={s.stage} className="px-1 py-1.5 text-right text-xs font-bold">
                Stage {s.stage}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-zinc-100">
              <td className="px-1 py-1.5 text-[13px] text-zinc-600">{row.label}</td>
              {row.cells.map((c, i) => (
                <td key={i} className={'whitespace-pre-line px-1 py-1.5 text-right ' + (typeof c === 'string' ? '' : c.cls)}>
                  {typeof c === 'string' ? c : c.v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-zinc-900">
            <td className="px-1 py-1.5 text-[13px] font-bold">Unit</td>
            <td colSpan={S.length} className="px-1 py-1.5 text-right font-bold">
              {fmt(r.mmscfd, 3)} MMSCFD · {fmt(r.bhp, 1)} BHP ({fmt(r.pctFrameHp, 0)}% frame)
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function ThrowTable({ r, minRev = 15 }: { r: RunResult; minRev?: number }) {
  const lim = (v: number | null) => (v == null ? 'n/a' : fmt(v));
  return (
    <div className="space-y-3">
      {r.throws.map((t: ThrowResult) => (
        <div key={t.index} className="rounded-xl border border-zinc-200 p-3 print:break-inside-avoid">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold">
              Throw {t.index + 1} · Stage {t.stage} · {t.cylinder.boreIn}" bore
            </span>
            {t.cylinder.placeholder && <Pill level="amber">placeholder: verify with CiP data</Pill>}
          </div>
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-[11px] uppercase text-zinc-500">
                <th className="py-1 font-semibold">Gas rod load</th>
                <th className="py-1 text-right font-semibold">lb</th>
                <th className="py-1 text-right font-semibold">Limit</th>
                <th className="py-1 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-zinc-100">
                <td className="py-1">Compression</td>
                <td className="py-1 text-right">{fmt(t.rod.compressionLb)}</td>
                <td className="py-1 text-right text-zinc-500">{lim(r.frame.rodLoadCompressionLb)}</td>
                <td className={'py-1 text-right ' + pctCls(t.pctCompression)}>{fmt(t.pctCompression, 0)}</td>
              </tr>
              <tr className="border-t border-zinc-100">
                <td className="py-1">Tension</td>
                <td className="py-1 text-right">{fmt(t.rod.tensionLb)}</td>
                <td className="py-1 text-right text-zinc-500">{lim(r.frame.rodLoadTensionLb)}</td>
                <td className={'py-1 text-right ' + pctCls(t.pctTension)}>{fmt(t.pctTension, 0)}</td>
              </tr>
              <tr className="border-t border-zinc-100">
                <td className="py-1">Combined</td>
                <td className="py-1 text-right">{fmt(t.rod.combinedLb)}</td>
                <td className="py-1 text-right text-zinc-500">{lim(r.frame.rodLoadCombinedLb)}</td>
                <td className={'py-1 text-right ' + pctCls(t.pctCombined)}>{fmt(t.pctCombined, 0)}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-zinc-600">
            <span>Reversal (gas): <b className={t.rod.reversalDeg < minRev ? red : ''}>{t.rod.reversalDeg}°</b></span>
            <span>MAWP: <b>{fmt(t.cylinder.mawpPsig)} psig</b></span>
            <span>Clearance HE/CE: {fmt(t.he.clearancePct, 1)}% / {fmt(t.ce.clearancePct, 1)}%</span>
            <span>VE HE/CE: {t.he.active ? fmt(t.he.ve, 1) : 'off'} / {t.ce.active ? fmt(t.ce.ve, 1) : 'off'}</span>
            <span>Disp. HE/CE: {fmt(t.he.displacementCfm, 2)} / {fmt(t.ce.displacementCfm, 2)} CFM</span>
            <span>Area HE/CE: {fmt(t.areas.heIn2, 3)} / {fmt(t.areas.ceIn2, 3)} in²</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResultsTab({ r, cfg }: { r: RunResult; cfg: RunConfig }) {
  if (!r.ok) return <Card title="Results"><p className={red}>{r.error}</p></Card>;
  return (
    <div className="space-y-4">
      <Card title="Checks">
        <FlagList r={r} />
      </Card>
      <Card
        title="Performance"
        right={<span className="text-[11px] text-zinc-500">{r.balanced ? 'Balanced flow' : 'Equal ratios'} · k {fmt(r.k, 3)}</span>}
      >
        <StageTable r={r} cfg={cfg} />
        <p className="mt-2 text-[11px] text-zinc-500">
          Piston speed {fmt(r.pistonSpeedFpm)} ft/min · {cfg.zMethod === 'ideal' ? 'Z = 1' : 'Z via Sutton + ' + (cfg.zMethod === 'dak' ? 'DAK' : 'Papay')} · BHP = gas HP ÷ ({cfg.compEff} × {cfg.mechEff})
        </p>
      </Card>
      <Card title="Throws / rod loads">
        <ThrowTable r={r} minRev={cfg.minReversalDeg} />
      </Card>
    </div>
  );
}
