import { useMemo, useState } from 'react';
import type { FrameSpec } from '../data/frames';
import type { Cylinder } from '../data/cylinders';
import { sweep, type RunConfig, type SweepParam, type SweepPoint } from '../lib/calc';
import { fmt } from '../lib/format';
import { Card, NumField, Seg } from './ui';

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

function Chart({ pts, xLabel, frameHp, current }: { pts: SweepPoint[]; xLabel: string; frameHp: number; current: number }) {
  const W = 340;
  const H = 220;
  const m = { l: 44, r: 44, t: 24, b: 34 };
  if (pts.length < 2) return <p className="text-sm text-zinc-500">Not enough valid points in that range.</p>;
  const x0 = pts[0].x;
  const x1 = pts[pts.length - 1].x;
  const qMax = niceMax(Math.max(...pts.map((p) => p.mmscfd)));
  const bMax = Math.max(...pts.map((p) => p.bhp));
  const showFrame = frameHp <= bMax * 1.5;
  const hMax = niceMax(showFrame ? Math.max(frameHp, bMax) : bMax);
  const X = (x: number) => m.l + ((x - x0) / (x1 - x0 || 1)) * (W - m.l - m.r);
  const YQ = (q: number) => H - m.b - (q / qMax) * (H - m.t - m.b);
  const YH = (h: number) => H - m.b - (h / hMax) * (H - m.t - m.b);
  const path = (f: (p: SweepPoint) => number) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${f(p).toFixed(1)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="What-if chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={YQ(t * qMax)} y2={YQ(t * qMax)} stroke="#e4e4e7" strokeWidth={1} />
          <text x={m.l - 4} y={YQ(t * qMax) + 3} fontSize={9} textAnchor="end" fill="#1d4ed8">
            {fmt(t * qMax, qMax < 1 ? 2 : 1)}
          </text>
          <text x={W - m.r + 4} y={YH(t * hMax) + 3} fontSize={9} fill="#121212">
            {fmt(t * hMax, 0)}
          </text>
          <text x={X(x0 + t * (x1 - x0))} y={H - m.b + 13} fontSize={9} textAnchor="middle" fill="#52525b">
            {fmt(x0 + t * (x1 - x0), 0)}
          </text>
        </g>
      ))}
      {showFrame && (
        <>
          <line x1={m.l} x2={W - m.r} y1={YH(frameHp)} y2={YH(frameHp)} stroke="#B91C1C" strokeDasharray="4 3" strokeWidth={1} />
          <text x={W - m.r - 2} y={YH(frameHp) - 3} fontSize={8} textAnchor="end" fill="#B91C1C">
            frame {frameHp} HP
          </text>
        </>
      )}
      {current >= x0 && current <= x1 && <line x1={X(current)} x2={X(current)} y1={m.t} y2={H - m.b} stroke="#a1a1aa" strokeDasharray="2 3" />}
      <path d={path((p) => YQ(p.mmscfd))} fill="none" stroke="#1d4ed8" strokeWidth={2.2} />
      <path d={path((p) => YH(p.bhp))} fill="none" stroke="#121212" strokeWidth={2.2} />
      {pts.map((p, i) => (
        <circle key={i} cx={X(p.x)} cy={YH(p.bhp)} r={p.red ? 3.2 : 1.8} fill={p.red ? '#B91C1C' : '#121212'} />
      ))}
      <text x={(m.l + W - m.r) / 2} y={H - 4} fontSize={10} textAnchor="middle" fill="#3f3f46">
        {xLabel}
      </text>
      <text x={4} y={10} fontSize={9} fill="#1d4ed8">MMSCFD</text>
      <text x={W - 4} y={10} fontSize={9} textAnchor="end" fill="#121212">BHP</text>
    </svg>
  );
}

function showNote(frameHp: number, pts: SweepPoint[]) {
  const b = Math.max(0, ...pts.map((p) => p.bhp));
  return frameHp > b * 1.5 ? ` Frame rating (${frameHp} HP) is well above this range.` : '';
}

export function WhatIfTab({ cfg, frame, lookup }: { cfg: RunConfig; frame: FrameSpec; lookup: (id: string) => Cylinder | undefined }) {
  const [param, setParam] = useState<SweepParam>('suction');
  const defaults = (p: SweepParam) =>
    p === 'rpm'
      ? { from: Math.round(frame.maxRpm / 2), to: frame.approvedMaxRpm ?? frame.maxRpm }
      : { from: Math.max(0, Math.round(cfg.suctionPsig * 0.5)), to: Math.max(10, Math.round(cfg.suctionPsig * 1.5)) };
  const [range, setRange] = useState(defaults('suction'));
  const pts = useMemo(() => sweep(cfg, frame, lookup, param, range.from, range.to, 20), [cfg, frame, lookup, param, range]);
  const unit = param === 'rpm' ? 'RPM' : 'psig';
  return (
    <div className="space-y-4">
      <Card title="What-if sweep">
        <div className="space-y-3">
          <Seg
            value={param}
            options={[
              { value: 'suction', label: 'Suction pressure' },
              { value: 'rpm', label: 'RPM' },
            ]}
            onChange={(p) => {
              setParam(p);
              setRange(defaults(p));
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumField label="From" unit={unit} value={range.from} onChange={(v) => v != null && setRange({ ...range, from: v })} />
            <NumField label="To" unit={unit} value={range.to} onChange={(v) => v != null && setRange({ ...range, to: v })} />
          </div>
          <Chart pts={pts} xLabel={param === 'rpm' ? 'Speed, RPM' : 'Suction pressure, psig'} frameHp={frame.ratedHp} current={param === 'rpm' ? cfg.rpm : cfg.suctionPsig} />
          <div className="flex flex-wrap gap-3 text-[11px] text-zinc-600">
            <span><b className="text-blue-700">━</b> Capacity</span>
            <span><b>━</b> BHP</span>
            <span><b className="text-[#B91C1C]">●</b> point with a red flag</span>
            <span>Everything else held at Setup values.{showNote(frame.ratedHp, pts)}</span>
          </div>
        </div>
      </Card>
      <Card title="Points">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b-2 border-zinc-900 text-right text-xs">
                <th className="px-1 py-1 text-left">{unit}</th>
                <th className="px-1 py-1">MMSCFD</th>
                <th className="px-1 py-1">BHP</th>
                <th className="px-1 py-1">Red flags</th>
              </tr>
            </thead>
            <tbody>
              {pts.map((p) => (
                <tr key={p.x} className={'border-b border-zinc-100 text-right ' + (p.red ? 'text-[#B91C1C]' : '')}>
                  <td className="px-1 py-1 text-left">{fmt(p.x, 0)}</td>
                  <td className="px-1 py-1">{fmt(p.mmscfd, 3)}</td>
                  <td className="px-1 py-1">{fmt(p.bhp, 1)}</td>
                  <td className="px-1 py-1">{p.red || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
