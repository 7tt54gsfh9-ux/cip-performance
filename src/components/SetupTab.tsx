import { FRAMES, frameById } from '../data/frames';
import type { Cylinder } from '../data/cylinders';
import {
  DEFAULT_TANDEM_ENDS,
  GAS_PRESETS,
  PRESET_PXT_3STAGE,
  estimateK,
  stageSlots,
  type Deactivate,
  type EndMode,
  type RunConfig,
  type ThrowConfig,
  type ZMethod,
} from '../lib/calc';
import { fmt } from '../lib/format';
import { Card, NumField, Pill, Seg, Select, Toggle } from './ui';

export function normaliseThrows(cfg: RunConfig, cylinders: Cylinder[]): RunConfig {
  const frame = frameById(cfg.frameId);
  const throws: ThrowConfig[] = [];
  for (let i = 0; i < frame.throws; i++) {
    const prev = cfg.throws?.[i] ?? cfg.throws?.[cfg.throws.length - 1];
    const kind = prev?.kind === 'tandem' ? 'tandem' : 'single';
    const t: ThrowConfig = {
      kind,
      cylinderId: prev?.cylinderId ?? cylinders[0].id,
      stage: prev?.stage ?? 1,
      deactivate: prev?.deactivate ?? 'none',
      pocketOpenPct: prev?.pocketOpenPct ?? 0,
    };
    if (kind === 'tandem') {
      t.outCylinderId = prev?.outCylinderId ?? TANDEM_OUT_DEFAULT;
      t.outStage = prev?.outStage ?? Math.min(3, t.stage + 1);
      t.neckDiaIn = prev?.neckDiaIn ?? frame.rodDiaIn;
      t.ends = { ...DEFAULT_TANDEM_ENDS, ...(prev?.ends ?? {}) };
    }
    throws.push(t);
  }
  const slots = stageSlots(throws);
  const stages = Math.max(1, Math.min(cfg.stages, slots, 3));
  for (const t of throws) {
    t.stage = Math.min(t.stage, stages);
    if (t.kind === 'tandem') t.outStage = Math.min(t.outStage ?? stages, stages);
  }
  const legacy = cfg.interstageTempF ?? 120;
  const temps = [0, 1].map((i) => cfg.interstageTempsF?.[i] ?? legacy);
  return { ...cfg, stages, throws, interstageTempsF: temps };
}

const TANDEM_OUT_DEFAULT = 'ph-tdm-2.75-out';

/** Spread stages over the throw stage-slots in order (throw 1, throw 1 outboard, throw 2, ...). */
function relayout(throws: ThrowConfig[], n: number): ThrowConfig[] {
  const count = stageSlots(throws);
  const at = (i: number) => Math.min(n, Math.floor((i * n) / count) + 1);
  let i = 0;
  return throws.map((t) => {
    const stage = at(i++);
    if (t.kind !== 'tandem') return { ...t, stage };
    return { ...t, stage, outStage: at(i++) };
  });
}

const END_MODE_LABEL: Record<EndMode, string> = {
  active: 'Active (compressing)',
  vent: 'Vented (0 psig)',
  s1: 'At stg 1 suction',
  s2: 'At stg 2 suction',
  s3: 'At stg 3 suction',
};

function EndModeSelect({ label, value, stages, onChange }: { label: string; value: EndMode; stages: number; onChange: (m: EndMode) => void }) {
  const opts = (['active', 'vent', 's1', 's2', 's3'] as EndMode[])
    .filter((m) => !m.startsWith('s') || Number(m.slice(1)) <= stages)
    .map((m) => ({ value: m, label: END_MODE_LABEL[m] }));
  return <Select<EndMode> label={label} value={value} options={opts} onChange={onChange} />;
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
  const slots = stageSlots(cfg.throws);
  const maxStages = Math.min(3, slots);
  const setThrows = (throws: ThrowConfig[], stages = cfg.stages) => set(normaliseThrows({ ...cfg, throws, stages }, cylinders));
  const toggleTandem = (i: number, on: boolean) => {
    const throws = cfg.throws.map((t, j) => {
      if (j !== i) return t;
      if (!on) return { ...t, kind: 'single' as const };
      return {
        ...t,
        kind: 'tandem' as const,
        deactivate: 'none' as const,
        outCylinderId: t.outCylinderId ?? TANDEM_OUT_DEFAULT,
        outStage: Math.min(3, t.stage + 1),
        neckDiaIn: t.neckDiaIn ?? frame.rodDiaIn,
        ends: t.ends ?? { ...DEFAULT_TANDEM_ENDS },
      };
    });
    const needed = Math.max(...throws.map((t) => (t.kind === 'tandem' ? (t.outStage ?? 1) : t.stage)));
    setThrows(throws, Math.max(cfg.stages, needed));
  };
  const applyPreset = () =>
    set(
      normaliseThrows(
        {
          ...cfg,
          frameId: PRESET_PXT_3STAGE.frameId,
          rpm: PRESET_PXT_3STAGE.rpm,
          stages: PRESET_PXT_3STAGE.stages,
          interstageMode: PRESET_PXT_3STAGE.interstageMode,
          throws: PRESET_PXT_3STAGE.throws.map((t) => ({ ...t, ends: t.ends ? { ...t.ends } : undefined })),
        },
        cylinders,
      ),
    );
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
                onChange={(n) => up({ stages: n, throws: relayout(cfg.throws, n) })}
              />
              {slots < 3 && <p className="mt-1 text-[11px] text-zinc-500">Make a throw tandem to unlock 3 stages.</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={applyPreset}
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm font-semibold text-zinc-800"
          >
            Preset: PXT 3-stage (tandem)
            <span className="block text-[11px] font-normal text-zinc-500">
              1st stage on throw 1; 2nd (inboard) + 3rd (outboard) tandem on throw 2. Placeholder cylinders; keeps your pressures and gas.
            </span>
          </button>
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
            const out = t.outCylinderId ? cylinders.find((c) => c.id === t.outCylinderId) : undefined;
            const tandem = t.kind === 'tandem';
            const stageOpts = Array.from({ length: cfg.stages }, (_, s) => ({ value: String(s + 1), label: `Stage ${s + 1}` }));
            const endOpts: { value: Deactivate; label: string }[] = [
              { value: 'none', label: cyl?.acting === 'SA-HE' ? 'HE only (SA)' : cyl?.acting === 'SA-CE' ? 'CE only (SA)' : 'Both (DA)' },
            ];
            if (cyl?.acting === 'DA') endOpts.push({ value: 'CE', label: 'HE only (CE off)' }, { value: 'HE', label: 'CE only (HE off)' });
            const ends = t.ends ?? DEFAULT_TANDEM_ENDS;
            const setEnd = (k: keyof typeof ends, m: EndMode) => upThrow(i, { ends: { ...ends, [k]: m } });
            const pocketCyl = tandem ? out : cyl;
            const info = (c: Cylinder | undefined) =>
              c && (
                <p className="mt-1 text-[11px] text-zinc-500">
                  {c.boreIn}" bore · clr HE {c.clearanceHePct}% / CE {c.clearanceCePct}% · MAWP {fmt(c.mawpPsig)} psig · {c.acting}
                  {c.placeholder ? ' · placeholder' : ''}
                </p>
              );
            return (
              <div key={i} className="rounded-xl border border-zinc-200 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold">Throw {i + 1}{tandem ? ' · tandem' : ''}</span>
                  {(cyl?.placeholder || (tandem && out?.placeholder)) && <Pill level="amber">placeholder: verify with CiP data</Pill>}
                </div>
                <div className="mb-3">
                  <Seg
                    value={tandem ? 'tandem' : 'single'}
                    options={[
                      { value: 'single', label: 'Single cylinder' },
                      { value: 'tandem', label: 'Tandem' },
                    ]}
                    onChange={(v) => toggleTandem(i, v === 'tandem')}
                  />
                </div>
                {!tandem ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Select label="Cylinder" value={t.cylinderId} options={cylOpts} onChange={(v) => upThrow(i, { cylinderId: v, deactivate: 'none', pocketOpenPct: 0 })} />
                      <div className="grid grid-cols-2 gap-3">
                        <Select label="Stage" value={String(t.stage)} options={stageOpts} onChange={(v) => upThrow(i, { stage: Number(v) })} />
                        <Select label="Active ends" value={t.deactivate} options={endOpts} onChange={(v) => upThrow(i, { deactivate: v })} />
                      </div>
                    </div>
                    {info(cyl)}
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-zinc-50 p-2">
                      <div className="mb-2 text-xs font-bold text-zinc-600">Inboard (frame side)</div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Select label="Cylinder" value={t.cylinderId} options={cylOpts} onChange={(v) => upThrow(i, { cylinderId: v })} />
                        <Select label="Stage" value={String(t.stage)} options={stageOpts} onChange={(v) => upThrow(i, { stage: Number(v) })} />
                        <EndModeSelect label="Crank end (rod side)" value={ends.inCE} stages={cfg.stages} onChange={(m) => setEnd('inCE', m)} />
                        <EndModeSelect label="Head end (neck side)" value={ends.inHE} stages={cfg.stages} onChange={(m) => setEnd('inHE', m)} />
                      </div>
                      {info(cyl)}
                    </div>
                    <div className="rounded-lg bg-zinc-50 p-2">
                      <div className="mb-2 text-xs font-bold text-zinc-600">Outboard</div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Select label="Cylinder" value={t.outCylinderId ?? ''} options={cylOpts} onChange={(v) => upThrow(i, { outCylinderId: v, pocketOpenPct: 0 })} />
                        <Select label="Stage" value={String(t.outStage ?? t.stage)} options={stageOpts} onChange={(v) => upThrow(i, { outStage: Number(v) })} />
                        <EndModeSelect label="Crank end (neck side)" value={ends.outCE} stages={cfg.stages} onChange={(m) => setEnd('outCE', m)} />
                        <EndModeSelect label="Head end (outer)" value={ends.outHE} stages={cfg.stages} onChange={(m) => setEnd('outHE', m)} />
                      </div>
                      {info(out)}
                    </div>
                    <NumField
                      label="Tandem rod / neck dia"
                      unit="in"
                      value={t.neckDiaIn ?? frame.rodDiaIn}
                      min={0.25}
                      max={4}
                      hint="ASSUMED equal to the piston rod unless you know otherwise. Reduces the two ends that face the neck."
                      onChange={(v) => v != null && upThrow(i, { neckDiaIn: v })}
                    />
                    <p className="text-[11px] text-zinc-500">
                      Default (assumed): inboard crank end + outboard head end compress on opposite strokes; the two neck-side ends are referenced to 1st-stage suction.
                      An end the cylinder library marks single-acting can't be set active — it falls back to its own stage suction.
                    </p>
                  </div>
                )}
                {pocketCyl && pocketCyl.pocketMaxIn3 > 0 && (
                  <div className="mt-3">
                    <NumField
                      label={tandem ? 'Outboard head-end pocket open' : 'Head-end pocket open'}
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
          {Array.from({ length: Math.max(0, cfg.stages - 1) }, (_, j) => (
            <NumField
              key={j}
              label={`Cooler out → stg ${j + 2}`}
              unit="°F"
              value={cfg.interstageTempsF[j] ?? 120}
              onChange={(v) => v != null && up({ interstageTempsF: cfg.interstageTempsF.map((x, m) => (m === j ? v : x)) })}
            />
          ))}
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
