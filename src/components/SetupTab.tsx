import { FRAMES, frameById } from '../data/frames';
import type { Cylinder } from '../data/cylinders';
import { GAS_PRESETS, estimateK, type Deactivate, type RunConfig, type ThrowConfig, type ZMethod } from '../lib/calc';
import { fmt } from '../lib/format';
import { Card, NumField, Pill, Seg, Select, Toggle } from './ui';

export function normaliseThrows(cfg: RunConfig, cylinders: Cylinder[]): RunConfig {
  const frame = frameById(cfg.frameId);
  const stages = Math.max(1, Math.min(cfg.stages, frame.throws, 3));
  const throws: ThrowConfig[] = [];
  for (let i = 0; i < frame.throws; i++) {
    const prev = cfg.throws[i] ?? cfg.throws[cfg.throws.length - 1];
    throws.push({
      cylinderId: prev?.cylinderId ?? cylinders[0].id,
      stage: Math.min(prev?.stage ?? 1, stages),
      deactivate: prev?.deactivate ?? 'none',
      pocketOpenPct: prev?.pocketOpenPct ?? 0,
    });
  }
  return { ...cfg, stages, throws };
}

function defaultStageLayout(n: number, count: number): number[] {
  // spread throws across stages: 1 stage → all 1; 2 stages on 2 throws → 1,2
  return Array.from({ length: count }, (_, i) => Math.min(n, Math.floor((i * n) / count) + 1));
}

export function SetupTab({
  cfg,
  set,
  cylinders,
}: {
  cfg: RunConfig;
  set: (c: RunConfig) => void;
  cylinders: Cylinder[];
}) {
  const frame = frameById(cfg.frameId);
  const up = (p: Partial<RunConfig>) => set({ ...cfg, ...p });
  const upThrow = (i: number, p: Partial<ThrowConfig>) => up({ throws: cfg.throws.map((t, j) => (j === i ? { ...t, ...p } : t)) });
  const maxStages = Math.min(3, frame.throws);
  const cylOpts = cylinders.map((c) => ({ value: c.id, label: `${c.name}${c.placeholder ? ' *' : ''}` }));

  return (
    <div className="space-y-4">
      <Card title="Unit">
        <div className="space-y-3">
          <Seg
            value={cfg.frameId}
            options={FRAMES.map((f) => ({ value: f.id, label: f.id }))}
            onChange={(id) => set(normaliseThrows({ ...cfg, frameId: id }, cylinders))}
          />
          <p className="text-xs text-zinc-500">
            {frame.id}: {frame.strokeIn}" stroke · {frame.rodDiaIn}" rod · {frame.throws} throws · {frame.ratedHp} HP
            {frame.approvedMaxHp ? ` (${frame.approvedMaxHp} w/ approval)` : ''} · {fmt(frame.maxRpm)} RPM
            {frame.approvedMaxRpm ? ` (${fmt(frame.approvedMaxRpm)} w/ approval)` : ''}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Speed" unit="RPM" value={cfg.rpm} min={1} onChange={(v) => v != null && up({ rpm: v })} />
            <div>
              <span className="mb-1 block text-xs font-semibold text-zinc-600">Stages</span>
              <Seg
                value={cfg.stages}
                options={[1, 2, 3].map((n) => ({ value: n, label: String(n), disabled: n > maxStages }))}
                onChange={(n) => {
                  const layout = defaultStageLayout(n, cfg.throws.length);
                  up({ stages: n, throws: cfg.throws.map((t, i) => ({ ...t, stage: layout[i] })) });
                }}
              />
            </div>
          </div>
          {cfg.stages > 1 && (
            <div>
              <span className="mb-1 block text-xs font-semibold text-zinc-600">Interstage pressure</span>
              <Seg
                value={cfg.interstageMode}
                options={[
                  { value: 'equal', label: 'Equal ratios' },
                  { value: 'balanced', label: 'Balance flow' },
                ]}
                onChange={(v) => up({ interstageMode: v })}
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Balance flow iterates the interstage pressure until every stage moves the same gas, which is how a running unit settles.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card title="Throws & cylinders">
        <div className="space-y-4">
          {cfg.throws.map((t, i) => {
            const cyl = cylinders.find((c) => c.id === t.cylinderId);
            const endOpts: { value: Deactivate; label: string }[] = [
              { value: 'none', label: cyl?.acting === 'SA-HE' ? 'HE only (SA)' : cyl?.acting === 'SA-CE' ? 'CE only (SA)' : 'Both (DA)' },
            ];
            if (cyl?.acting === 'DA')
              endOpts.push({ value: 'CE', label: 'HE only (CE off)' }, { value: 'HE', label: 'CE only (HE off)' });
            return (
              <div key={i} className="rounded-xl border border-zinc-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold">Throw {i + 1}</span>
                  {cyl?.placeholder && <Pill level="amber">placeholder: verify with CiP data</Pill>}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Select label="Cylinder" value={t.cylinderId} options={cylOpts} onChange={(v) => upThrow(i, { cylinderId: v, deactivate: 'none', pocketOpenPct: 0 })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Stage"
                      value={String(t.stage)}
                      options={Array.from({ length: cfg.stages }, (_, s) => ({ value: String(s + 1), label: `Stage ${s + 1}` }))}
                      onChange={(v) => upThrow(i, { stage: Number(v) })}
                    />
                    <Select label="Active ends" value={t.deactivate} options={endOpts} onChange={(v) => upThrow(i, { deactivate: v })} />
                  </div>
                </div>
                {cyl && (
                  <p className="mt-2 text-[11px] text-zinc-500">
                    {cyl.boreIn}" bore · clearance HE {cyl.clearanceHePct}% / CE {cyl.clearanceCePct}% · MAWP {fmt(cyl.mawpPsig)} psig
                    {cyl.pocketMaxIn3 > 0 ? ` · VV pocket ${cyl.pocketMaxIn3} in³` : ''}
                  </p>
                )}
                {cyl && cyl.pocketMaxIn3 > 0 && (
                  <div className="mt-3">
                    <NumField
                      label="Head-end pocket open"
                      unit="%"
                      value={t.pocketOpenPct}
                      min={0}
                      max={100}
                      onChange={(v) => v != null && upThrow(i, { pocketOpenPct: v })}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[11px] text-zinc-500">* placeholder cylinder. Add real CiP cylinders in the Cylinders tab.</p>
        </div>
      </Card>

      <Card title="Gas">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {GAS_PRESETS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => up({ sg: g.sg, k: g.k, autoK: false })}
                className={
                  'rounded-full border px-3 py-1.5 text-xs font-semibold ' +
                  (cfg.sg === g.sg && !cfg.autoK && cfg.k === g.k ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-700')
                }
              >
                {g.label} ({g.sg})
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Specific gravity" value={cfg.sg} min={0.5} max={1.8} onChange={(v) => v != null && up({ sg: v })} />
            <NumField
              label="k (Cp/Cv)"
              value={cfg.autoK ? Number(estimateK(cfg.sg).toFixed(3)) : cfg.k}
              min={1.01}
              max={1.67}
              disabled={cfg.autoK}
              onChange={(v) => v != null && up({ k: v })}
            />
          </div>
          <Toggle
            label="Estimate k from SG"
            hint="Approximation of GPSA Fig. 13-8. Turn off to enter k from a gas analysis."
            checked={cfg.autoK}
            onChange={(v) => up({ autoK: v, k: v ? cfg.k : Number(estimateK(cfg.sg).toFixed(3)) })}
          />
          <Select<ZMethod>
            label="Compressibility (Z)"
            value={cfg.zMethod}
            options={[
              { value: 'dak', label: 'Standing-Katz (DAK fit) + Sutton' },
              { value: 'papay', label: 'Papay + Sutton (quick)' },
              { value: 'ideal', label: 'Ideal gas (Z = 1)' },
            ]}
            onChange={(v) => up({ zMethod: v })}
          />
        </div>
      </Card>

      <Card title="Operating conditions">
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Suction pressure" unit="psig" value={cfg.suctionPsig} onChange={(v) => v != null && up({ suctionPsig: v })} />
          <NumField label="Suction temp" unit="°F" value={cfg.suctionTempF} onChange={(v) => v != null && up({ suctionTempF: v })} />
          <NumField label="Discharge pressure" unit="psig" value={cfg.dischargePsig} onChange={(v) => v != null && up({ dischargePsig: v })} />
          <NumField label="Interstage cooler out" unit="°F" value={cfg.interstageTempF} onChange={(v) => v != null && up({ interstageTempF: v })} />
          <NumField label="Atmospheric" unit="psia" value={cfg.atmPsia} min={8} max={15} hint="14.4 ≈ 500 ft. 14.7 at sea level." onChange={(v) => v != null && up({ atmPsia: v })} />
          <NumField label="Driver available" unit="HP" value={cfg.driverHp} allowEmpty min={0} hint="Optional" onChange={(v) => up({ driverHp: v })} />
        </div>
      </Card>

      <Card title="Assumptions & alarms">
        <div className="space-y-3">
          <Toggle label="Lubricated cylinders" hint="Non-lube subtracts another 5% VE (GPSA)." checked={cfg.lubricated} onChange={(v) => up({ lubricated: v })} />
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Compression eff." value={cfg.compEff} min={0.5} max={1} hint="Valve/flow losses. 0.85 default" onChange={(v) => v != null && up({ compEff: v })} />
            <NumField label="Mechanical eff." value={cfg.mechEff} min={0.5} max={1} hint="Frame friction. 0.95 default" onChange={(v) => v != null && up({ mechEff: v })} />
            <NumField label="Discharge temp alarm" unit="°F" value={cfg.alarmDischargeTempF} onChange={(v) => v != null && up({ alarmDischargeTempF: v })} />
            <NumField label="Min rod reversal" unit="°" value={cfg.minReversalDeg} min={0} max={180} hint="Gas load only" onChange={(v) => v != null && up({ minReversalDeg: v })} />
          </div>
        </div>
      </Card>
    </div>
  );
}
