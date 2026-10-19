import type { EndResult, PartResult, RunConfig, RunResult, ThrowResult } from '../lib/calc';
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
  const rows: { label: string; cells: (string | { v: string; cls: string })[] }[] = [
    { label: 'Cylinder(s)', cells: S.map((s) => s.parts.map((p) => `T${p.throwIndex + 1}${posShort(p)} ${p.cylinder.boreIn}"`).join('\n')) },
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
        s.parts
          .map((p) => `${p.he.active ? fmt(p.he.ve, 1) : '—'} / ${p.ce.active ? fmt(p.ce.ve, 1) : '—'}`)
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

const posShort = (p: PartResult) => (p.position === 'inboard' ? ' in' : p.position === 'outboard' ? ' out' : '');

export function endText(e: EndResult): string {
  if (e.active) return `active · VE ${fmt(e.ve, 1)}%`;
  if (e.mode === 'vent') return 'vented 0 psig';
  return `at stg ${e.mode.slice(1)} suction (${fmt(e.refPsig, 0)} psig)`;
}

function PartRows({ p }: { p: PartResult }) {
  const pos = p.position === 'single' ? 'Cylinder' : p.position === 'inboard' ? 'Inboard' : 'Outboard';
  const heName = p.position === 'inboard' ? 'HE (neck side)' : p.position === 'outboard' ? 'HE (outer)' : 'HE';
  const ceName = p.position === 'outboard' ? 'CE (neck side)' : p.position === 'inboard' ? 'CE (rod side)' : 'CE';
  return (
    <div className="mt-2 rounded-lg bg-zinc-50 px-2 py-1.5 text-[12px] text-zinc-700">
      <div className="flex flex-wrap items-center gap-1.5">
        <b>
          {pos}: stage {p.stage} · {p.cylinder.boreIn}" · MAWP {fmt(p.cylinder.mawpPsig)} psig
        </b>
        {p.cylinder.placeholder && <Pill level="amber">placeholder</Pill>}
      </div>
      <div>
        {heName}: {fmt(p.he.areaIn2, 3)} in² · clr {fmt(p.he.clearancePct, 1)}% · {endText(p.he)}
      </div>
      <div>
        {ceName}: {fmt(p.ce.areaIn2, 3)} in² · clr {fmt(p.ce.clearancePct, 1)}% · {endText(p.ce)}
      </div>
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
              Throw {t.index + 1} · {t.kind === 'tandem' ? `Tandem stg ${t.parts.map((p) => p.stage).join(' + ')} · neck ${t.neckDiaIn}" (assumed)` : `Stage ${t.parts[0].stage} · ${t.parts[0].cylinder.boreIn}" bore`}
            </span>
          </div>
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-[11px] uppercase text-zinc-500">
                <th className="py-1 font-semibold">Gas rod load{t.kind === 'tandem' ? ' (all 4 ends)' : ''}</th>
                <th className="py-1 text-right font-semibold">lb</th>
                <th className="py-1 text-right font-semibold">Limit</th>
                <th className="py-1 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Compression', t.rod.compressionLb, r.frame.rodLoadCompressionLb, t.pctCompression],
                  ['Tension', t.rod.tensionLb, r.frame.rodLoadTensionLb, t.pctTension],
                  ['Combined', t.rod.combinedLb, r.frame.rodLoadCombinedLb, t.pctCombined],
                ] as const
              ).map(([label, v, l, pc]) => (
                <tr key={label} className="border-t border-zinc-100">
                  <td className="py-1">{label}</td>
                  <td className="py-1 text-right">{fmt(v)}</td>
                  <td className="py-1 text-right text-zinc-500">{lim(l)}</td>
                  <td className={'py-1 text-right ' + pctCls(pc)}>{fmt(pc, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1 text-[12px] text-zinc-600">
            Reversal (gas only): <b className={t.rod.reversalDeg < minRev ? red : ''}>{t.rod.reversalDeg}°</b>
          </div>
          {t.parts.map((p) => (
            <PartRows key={p.position} p={p} />
          ))}
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
