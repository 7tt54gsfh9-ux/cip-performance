import type { RunConfig, RunResult } from '../lib/calc';
import { fmt } from '../lib/format';
import { Disclaimer } from './Disclaimer';
import { FlagList, StageTable, Summary, ThrowTable } from './ResultsTab';

export function PrintReport({ cfg, r, name }: { cfg: RunConfig; r: RunResult; name: string }) {
  const inputs: [string, string][] = [
    ['Frame', `${cfg.frameId} · ${r.frame.strokeIn}" stroke · ${r.frame.rodDiaIn}" rod`],
    ['Speed', `${fmt(cfg.rpm)} RPM`],
    ['Stages', `${cfg.stages} (${cfg.interstageMode === 'balanced' ? 'balanced flow' : 'equal ratios'})`],
    ['Gas', `SG ${cfg.sg} · k ${fmt(r.k, 3)} · Z ${cfg.zMethod.toUpperCase()}`],
    ['Suction', `${cfg.suctionPsig} psig @ ${cfg.suctionTempF}°F`],
    ['Discharge', `${cfg.dischargePsig} psig`],
    ['Interstage cooler', `${cfg.interstageTempF}°F`],
    ['Atmospheric', `${cfg.atmPsia} psia`],
    ['Driver', cfg.driverHp ? `${fmt(cfg.driverHp)} HP` : '—'],
    ['Efficiencies', `comp ${cfg.compEff} · mech ${cfg.mechEff} · ${cfg.lubricated ? 'lubricated' : 'non-lube'}`],
  ];
  return (
    <div className="hidden space-y-3 bg-white p-2 text-zinc-900 print:block">
      <div className="flex items-end justify-between border-b-2 border-zinc-900 pb-2">
        <div>
          <div className="text-xl font-extrabold">CiP Performance</div>
          <div className="text-sm">{name || 'Unsaved run'}</div>
        </div>
        <div className="text-right text-xs">{new Date().toLocaleString()}</div>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {inputs.map(([k, v]) => (
            <tr key={k}>
              <td className="w-40 py-0.5 font-semibold">{k}</td>
              <td className="py-0.5">{v}</td>
            </tr>
          ))}
          {r.throws.map((t) => (
            <tr key={t.index}>
              <td className="py-0.5 font-semibold">Throw {t.index + 1}</td>
              <td className="py-0.5">
                Stage {t.stage} · {t.cylinder.name} · {cfg.throws[t.index].deactivate === 'none' ? t.cylinder.acting : `${cfg.throws[t.index].deactivate} deactivated`}
                {t.cylinder.placeholder ? ' · PLACEHOLDER DATA' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {r.ok ? (
        <>
          <Summary r={r} cfg={cfg} />
          <StageTable r={r} cfg={cfg} />
          <ThrowTable r={r} minRev={cfg.minReversalDeg} />
          <FlagList r={r} />
        </>
      ) : (
        <p>{r.error}</p>
      )}
      <Disclaimer />
    </div>
  );
}
