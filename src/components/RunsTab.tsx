import { useState } from 'react';
import type { RunConfig } from '../lib/calc';
import type { SavedRun } from '../lib/storage';
import { uid } from '../lib/storage';
import { Btn, Card, TextField } from './ui';

export function RunsTab({
  cfg,
  runs,
  setRuns,
  load,
  onCsv,
  onPrint,
  onReset,
  runName,
  setRunName,
}: {
  cfg: RunConfig;
  runs: SavedRun[];
  setRuns: (r: SavedRun[]) => void;
  load: (r: SavedRun) => void;
  onCsv: () => void;
  onPrint: () => void;
  onReset: () => void;
  runName: string;
  setRunName: (s: string) => void;
}) {
  const [msg, setMsg] = useState('');
  const save = () => {
    const name = runName.trim() || `${cfg.frameId} ${cfg.suctionPsig}→${cfg.dischargePsig} psig`;
    const existing = runs.find((r) => r.name === name);
    const run: SavedRun = { id: existing?.id ?? uid(), name, savedAt: new Date().toISOString(), config: cfg };
    setRuns(existing ? runs.map((r) => (r.id === run.id ? run : r)) : [run, ...runs]);
    setRunName(name);
    setMsg(existing ? `Updated “${name}”` : `Saved “${name}”`);
  };
  return (
    <div className="space-y-4">
      <Card title="Current run">
        <div className="space-y-3">
          <TextField label="Run name" value={runName} onChange={setRunName} placeholder="e.g. Smith #2 well – 100 psig suction" />
          <div className="grid grid-cols-3 gap-2">
            <Btn onClick={save}>Save</Btn>
            <Btn kind="light" onClick={onCsv}>CSV</Btn>
            <Btn kind="light" onClick={onPrint}>Print / PDF</Btn>
          </div>
          {msg && <p className="text-xs font-semibold text-green-800">{msg}</p>}
          <button className="text-xs font-semibold text-zinc-500 underline" onClick={() => confirm('Reset all inputs to defaults?') && onReset()}>
            Reset inputs to defaults
          </button>
        </div>
      </Card>
      <Card title={`Saved runs (${runs.length})`}>
        {runs.length === 0 && <p className="text-sm text-zinc-500">Saved runs stay on this device.</p>}
        {runs.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2.5 last:border-0">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{r.name}</div>
              <div className="text-[11px] text-zinc-500">
                {r.config.frameId} · {r.config.rpm} RPM · {r.config.suctionPsig}→{r.config.dischargePsig} psig · {new Date(r.savedAt).toLocaleString()}
              </div>
            </div>
            <div className="flex shrink-0 gap-3">
              <button className="text-xs font-semibold underline" onClick={() => load(r)}>Load</button>
              <button className="text-xs font-semibold text-[#B91C1C] underline" onClick={() => confirm(`Delete “${r.name}”?`) && setRuns(runs.filter((x) => x.id !== r.id))}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
