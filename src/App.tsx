import { useCallback, useEffect, useMemo, useState } from 'react';
import { frameById } from './data/frames';
import { SEED_CYLINDERS, type Cylinder } from './data/cylinders';
import { DEFAULT_CONFIG, PRESET_PXT_3STAGE, runPerformance, type RunConfig } from './lib/calc';
import { downloadText, runToCsv } from './lib/csv';
import { fmt } from './lib/format';
import { loadCurrent, loadCustomCylinders, loadRuns, saveCurrent, saveCustomCylinders, saveRuns, type SavedRun } from './lib/storage';
import { CylindersTab } from './components/CylindersTab';
import { Disclaimer } from './components/Disclaimer';
import { PrintReport } from './components/PrintReport';
import { ResultsTab, Summary } from './components/ResultsTab';
import { RunsTab } from './components/RunsTab';
import { SetupTab, normaliseThrows } from './components/SetupTab';
import { WhatIfTab } from './components/WhatIfTab';

type Tab = 'setup' | 'results' | 'whatif' | 'cyl' | 'runs';
const TABS: { id: Tab; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'results', label: 'Results' },
  { id: 'whatif', label: 'What-if' },
  { id: 'cyl', label: 'Cylinders' },
  { id: 'runs', label: 'Runs' },
];

export default function App() {
  const [custom, setCustomState] = useState<Cylinder[]>(loadCustomCylinders);
  const cylinders = useMemo(() => [...custom, ...SEED_CYLINDERS], [custom]);
  const [cfg, setCfgState] = useState<RunConfig>(() => {
    const all = [...loadCustomCylinders(), ...SEED_CYLINDERS];
    // ?preset=pxt3 opens the PXT 3-stage tandem preset (shareable link)
    if (new URLSearchParams(location.search).get('preset') === 'pxt3') {
      history.replaceState(null, '', location.pathname + location.hash);
      return normaliseThrows({ ...PRESET_PXT_3STAGE, dischargePsig: 1500 }, all);
    }
    return normaliseThrows(loadCurrent(), all);
  });
  const [runs, setRunsState] = useState<SavedRun[]>(loadRuns);
  const [tab, setTabState] = useState<Tab>(() => {
    const h = location.hash.slice(1) as Tab;
    return TABS.some((t) => t.id === h) ? h : 'setup';
  });
  const setTab = (t: Tab) => {
    setTabState(t);
    history.replaceState(null, '', '#' + t);
  };
  const [runName, setRunName] = useState('');

  useEffect(() => saveCurrent(cfg), [cfg]);
  const setCustom = (c: Cylinder[]) => {
    setCustomState(c);
    saveCustomCylinders(c);
  };
  const setRuns = (r: SavedRun[]) => {
    setRunsState(r);
    saveRuns(r);
  };

  const lookup = useCallback((id: string) => cylinders.find((c) => c.id === id), [cylinders]);
  const frame = frameById(cfg.frameId);
  const result = useMemo(() => runPerformance(cfg, frame, lookup), [cfg, frame, lookup]);
  const reds = result.flags.filter((f) => f.level === 'red').length;
  const inUse = useMemo(() => new Set(cfg.throws.flatMap((t) => (t.kind === 'tandem' && t.outCylinderId ? [t.cylinderId, t.outCylinderId] : [t.cylinderId]))), [cfg]);

  const onCsv = () => {
    const name = runName || `${cfg.frameId}-run`;
    downloadText(`${name.replace(/[^\w.-]+/g, '_')}.csv`, runToCsv(name, cfg, result));
  };

  return (
    <div className="min-h-full bg-[#F7F5F0] text-zinc-900">
      <div className="print:hidden">
        <header className="sticky top-0 z-20 bg-[#121212] text-white shadow" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 pb-2 pt-3">
            <div>
              <h1 className="text-lg font-extrabold leading-tight tracking-tight">
                <span className="text-[#E11D2E]">CiP</span> Performance
              </h1>
              <p className="text-[11px] text-zinc-400">
                {frame.id} · {fmt(cfg.rpm)} RPM · {cfg.stages} stg · {cfg.suctionPsig}→{cfg.dischargePsig} psig
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTab('results')}
              className={'rounded-xl px-3 py-1.5 text-right ' + (reds ? 'bg-[#B91C1C]' : 'bg-white/10')}
            >
              <div className="text-sm font-extrabold tabular-nums">{result.ok ? `${fmt(result.mmscfd, 3)} MMSCFD` : '—'}</div>
              <div className="text-[11px] tabular-nums text-zinc-200">
                {result.ok ? `${fmt(result.bhp, 0)} BHP` : 'check inputs'}
                {reds ? ` · ${reds} ⚠` : ''}
              </div>
            </button>
          </div>
          <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 pb-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  window.scrollTo({ top: 0 });
                }}
                className={'flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] font-semibold ' + (tab === t.id ? 'bg-white text-zinc-900' : 'text-zinc-300')}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-3xl space-y-4 px-3 py-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
          {tab !== 'cyl' && tab !== 'runs' && result.ok && <Summary r={result} cfg={cfg} />}
          {!result.ok && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-[#B91C1C]">{result.error}</div>}
          {tab === 'setup' && <SetupTab cfg={cfg} set={setCfgState} cylinders={cylinders} />}
          {tab === 'results' && <ResultsTab r={result} cfg={cfg} />}
          {tab === 'whatif' && <WhatIfTab cfg={cfg} frame={frame} lookup={lookup} />}
          {tab === 'cyl' && <CylindersTab seed={SEED_CYLINDERS} custom={custom} setCustom={setCustom} inUse={inUse} />}
          {tab === 'runs' && (
            <RunsTab
              cfg={cfg}
              runs={runs}
              setRuns={setRuns}
              runName={runName}
              setRunName={setRunName}
              load={(r) => {
                setCfgState(normaliseThrows({ ...DEFAULT_CONFIG, ...r.config }, cylinders));
                setRunName(r.name);
                setTab('results');
              }}
              onCsv={onCsv}
              onPrint={() => window.print()}
              onReset={() => {
                setCfgState(DEFAULT_CONFIG);
                setRunName('');
              }}
            />
          )}
          {tab === 'setup' && (
            <button type="button" onClick={() => setTab('results')} className="w-full rounded-xl bg-[#121212] py-3 text-base font-bold text-white">
              See results
            </button>
          )}
          <Disclaimer />
        </main>
      </div>
      <PrintReport cfg={cfg} r={result} name={runName} />
    </div>
  );
}
