import { useState } from 'react';
import type { Acting, Cylinder } from '../data/cylinders';
import { fmt } from '../lib/format';
import { uid } from '../lib/storage';
import { Btn, Card, NumField, Pill, Select, TextField, Toggle } from './ui';

const blank = (): Cylinder => ({
  id: 'custom-' + uid(),
  name: 'Custom cylinder',
  boreIn: 4,
  rodDiaIn: null,
  clearanceHePct: 17,
  clearanceCePct: 20,
  mawpPsig: 1500,
  acting: 'DA',
  pocketMaxIn3: 0,
  placeholder: false,
  source: 'Entered in app',
  custom: true,
});

function Editor({ cyl, onSave, onCancel }: { cyl: Cylinder; onSave: (c: Cylinder) => void; onCancel: () => void }) {
  const [c, setC] = useState(cyl);
  const up = (p: Partial<Cylinder>) => setC({ ...c, ...p });
  return (
    <Card title={cyl.custom ? 'Edit custom cylinder' : 'New custom cylinder'}>
      <div className="space-y-3">
        <TextField label="Name" value={c.name} onChange={(v) => up({ name: v })} placeholder='e.g. 4.5" HP cyl (CiP sheet)' />
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Bore" unit="in" value={c.boreIn} min={0.5} max={20} onChange={(v) => v != null && up({ boreIn: v })} />
          <NumField label="Rod dia" unit="in" value={c.rodDiaIn} allowEmpty min={0.25} max={4} hint="Blank = frame rod" onChange={(v) => up({ rodDiaIn: v })} />
          <NumField label="Clearance HE" unit="%" value={c.clearanceHePct} min={0} max={200} onChange={(v) => v != null && up({ clearanceHePct: v })} />
          <NumField label="Clearance CE" unit="%" value={c.clearanceCePct} min={0} max={200} onChange={(v) => v != null && up({ clearanceCePct: v })} />
          <NumField label="MAWP" unit="psig" value={c.mawpPsig} min={0} onChange={(v) => v != null && up({ mawpPsig: v })} />
          <NumField label="HE VV pocket max" unit="in³" value={c.pocketMaxIn3} min={0} hint="0 = no pocket" onChange={(v) => v != null && up({ pocketMaxIn3: v })} />
        </div>
        <Select<Acting>
          label="Acting"
          value={c.acting}
          options={[
            { value: 'DA', label: 'Double acting' },
            { value: 'SA-HE', label: 'Single acting – head end' },
            { value: 'SA-CE', label: 'Single acting – crank end' },
          ]}
          onChange={(v) => up({ acting: v })}
        />
        <TextField label="Source / notes" value={c.source ?? ''} onChange={(v) => up({ source: v })} placeholder="CiP data sheet # / date" />
        <Toggle label="Still a placeholder" hint="Leave on until values come from CiP data." checked={c.placeholder} onChange={(v) => up({ placeholder: v })} />
        <div className="flex gap-2">
          <Btn onClick={() => onSave({ ...c, custom: true })}>Save cylinder</Btn>
          <Btn kind="light" onClick={onCancel}>Cancel</Btn>
        </div>
      </div>
    </Card>
  );
}

export function CylindersTab({
  seed,
  custom,
  setCustom,
  inUse,
}: {
  seed: Cylinder[];
  custom: Cylinder[];
  setCustom: (c: Cylinder[]) => void;
  inUse: Set<string>;
}) {
  const [editing, setEditing] = useState<Cylinder | null>(null);
  const save = (c: Cylinder) => {
    const exists = custom.some((x) => x.id === c.id);
    setCustom(exists ? custom.map((x) => (x.id === c.id ? c : x)) : [...custom, c]);
    setEditing(null);
  };
  const row = (c: Cylinder) => (
    <div key={c.id} className="flex items-start justify-between gap-3 border-b border-zinc-100 py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-bold">{c.name}</span>
          {c.placeholder ? <Pill level="amber">placeholder: verify with CiP data</Pill> : <Pill level="ok">verified</Pill>}
          {inUse.has(c.id) && <Pill level="info">in use</Pill>}
        </div>
        <div className="mt-0.5 text-[12px] text-zinc-500">
          {c.boreIn}" · HE {c.clearanceHePct}% / CE {c.clearanceCePct}% · MAWP {fmt(c.mawpPsig)} · {c.acting}
          {c.rodDiaIn ? ` · rod ${c.rodDiaIn}"` : ''}
          {c.pocketMaxIn3 > 0 ? ` · pocket ${c.pocketMaxIn3} in³` : ''}
        </div>
        {c.source && <div className="text-[11px] text-zinc-400">{c.source}</div>}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {c.custom ? (
          <>
            <button className="text-xs font-semibold text-zinc-900 underline" onClick={() => setEditing(c)}>Edit</button>
            {!inUse.has(c.id) && (
              <button className="text-xs font-semibold text-[#B91C1C] underline" onClick={() => confirm(`Delete ${c.name}?`) && setCustom(custom.filter((x) => x.id !== c.id))}>
                Delete
              </button>
            )}
          </>
        ) : (
          <button
            className="text-xs font-semibold text-zinc-900 underline"
            onClick={() => setEditing({ ...c, id: 'custom-' + uid(), name: c.name.replace(' placeholder', '') + ' (copy)', custom: false, source: 'Copied from ' + c.name })}
          >
            Copy & edit
          </button>
        )}
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      {editing ? (
        <Editor cyl={editing} onSave={save} onCancel={() => setEditing(null)} />
      ) : (
        <Btn className="w-full" onClick={() => setEditing(blank())}>+ Custom cylinder</Btn>
      )}
      <Card title={`My cylinders (${custom.length})`}>
        {custom.length ? custom.map(row) : <p className="text-sm text-zinc-500">None yet. Add one from a CiP cylinder sheet, or copy a placeholder and edit it.</p>}
      </Card>
      <Card title="Built-in library">
        <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Real CiP cylinder data isn't public yet. These are placeholders with typical clearances (HE 15–20%, CE 18–22%) and guessed MAWPs.
          Only the 1.75" and 2.0625" bores/MAWPs come from a real PHT/2 package sheet.
        </p>
        {seed.map(row)}
      </Card>
    </div>
  );
}
