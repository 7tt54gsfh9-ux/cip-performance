import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  acfmToMMSCFD,
  brakeHp,
  compressionRatio,
  cylinderAreas,
  dischargeTempF,
  endDisplacementCfm,
  equalRatioPressures,
  estimateK,
  isentropicHp,
  mmscfdToAcfm,
  rodLoadCycle,
  runPerformance,
  staticRodLoadsDA,
  tandemAreas,
  PRESET_PXT_3STAGE,
  stageSlots,
  suttonPseudoCritical,
  volumetricEfficiency,
  zDAK,
  zPapay,
  type RunConfig,
} from './calc';
import { frameById } from '../data/frames';
import { SEED_CYLINDERS } from '../data/cylinders';

const lookup = (id: string) => SEED_CYLINDERS.find((c) => c.id === id);

describe('basic arithmetic (hand-checked)', () => {
  it('compression ratio uses absolute pressures', () => {
    // 100 psig → 1200 psig at 14.4 psia atm
    expect(compressionRatio(114.4, 1214.4)).toBeCloseTo(10.6154, 4);
  });
  it('discharge temp Td = Ts·r^((k−1)/k)', () => {
    // 80°F = 539.67°R; 3^(0.3/1.3) = 1.288561 → 695.40°R = 235.73°F
    expect(dischargeTempF(80, 3, 1.3)).toBeCloseTo(235.73, 1);
  });
  it('GPSA VE = 100 − r − C[(Zs/Zd)r^(1/k) − 1]', () => {
    // 3^(1/1.3)=2.328190 → 100 − 3 − 20·1.328190 = 70.436
    expect(volumetricEfficiency(20, 3, 1.3, 1, 1)).toBeCloseTo(70.436, 2);
    expect(volumetricEfficiency(20, 3, 1.3, 1, 1, false)).toBeCloseTo(65.436, 2);
    expect(volumetricEfficiency(80, 12, 1.2, 1, 1)).toBe(0); // clamped
  });
  it('areas: HE = πD²/4, CE = HE − rod', () => {
    const a = cylinderAreas(2.0625, 1.125);
    expect(a.heIn2).toBeCloseTo(3.34104, 4);
    expect(a.rodIn2).toBeCloseTo(0.99402, 4);
    expect(a.ceIn2).toBeCloseTo(2.34702, 4);
  });
  it('displacement = A·S·RPM/1728', () => {
    expect(endDisplacementCfm(10, 3, 1728)).toBeCloseTo(30, 6);
  });
  it('standard flow conversion', () => {
    // 100 ACFM at standard conditions, Z = 1 → 144,000 SCFD
    expect(acfmToMMSCFD(100, 14.65, 60, 1)).toBeCloseTo(0.144, 6);
    expect(mmscfdToAcfm(acfmToMMSCFD(37, 300, 110, 0.95), 300, 110, 0.95)).toBeCloseTo(37, 6);
  });
  it('isentropic HP', () => {
    // 100 psia · 229.17 ACFM / 229.17 = 100; k=1.4, r=2 → (2^0.285714−1)/0.285714 = 0.76654
    expect(isentropicHp(100, 229.1667, 2, 1.4, 1, 1)).toBeCloseTo(76.654, 2);
    expect(brakeHp(80.75, 0.85, 0.95)).toBeCloseTo(100, 6);
  });
});

describe('gas properties', () => {
  it('Sutton pseudo-criticals for SG 0.65', () => {
    const { tpcR, ppcPsia } = suttonPseudoCritical(0.65);
    expect(tpcR).toBeCloseTo(365.11, 1);
    expect(ppcPsia).toBeCloseTo(670.13, 1);
  });
  it('DAK matches Standing-Katz chart points', () => {
    expect(Math.abs(zDAK(2, 1.5) - 0.82)).toBeLessThan(0.01); // S-K chart ≈ 0.82
    expect(Math.abs(zDAK(1, 1.3) - 0.84)).toBeLessThan(0.01); // S-K chart ≈ 0.84
    expect(zDAK(0, 1.5)).toBe(1);
  });
  it('Papay close to DAK at moderate conditions', () => {
    expect(Math.abs(zPapay(1, 1.6) - zDAK(1, 1.6))).toBeLessThan(0.02);
  });
  it('k estimate', () => {
    expect(estimateK(0.55)).toBeCloseTo(1.3, 6);
    expect(estimateK(0.65)).toBeCloseTo(1.275, 6);
    expect(estimateK(2)).toBe(1.1);
  });
});

describe('rod loads', () => {
  const a = cylinderAreas(4, 1.125);
  it('static DA gas loads', () => {
    // C = 400·12.5664 − 100·11.5723 = 3869.3 ; T = 400·11.5723 − 100·12.5664 = 3372.3
    const s = staticRodLoadsDA(100, 400, a);
    expect(s.compressionLb).toBeCloseTo(3869.3, 0);
    expect(s.tensionLb).toBeCloseTo(3372.3, 0);
  });
  it('cycle peaks equal the static formula for a DA throw', () => {
    const r = rodLoadCycle({ areas: a, strokeIn: 3, clearanceHePct: 18, clearanceCePct: 20, ps: 114.4, pd: 414.4, k: 1.27, atmPsia: 14.4, heActive: true, ceActive: true });
    expect(r.compressionLb).toBeCloseTo(3869.3, 0);
    expect(r.tensionLb).toBeCloseTo(3372.3, 0);
    expect(r.combinedLb).toBeCloseTo(3869.3 + 3372.3, 0);
    expect(r.reversalDeg).toBeGreaterThan(90);
  });
  it('crank-end deactivated → no tension, no reversal', () => {
    const r = rodLoadCycle({ areas: a, strokeIn: 3, clearanceHePct: 18, clearanceCePct: 20, ps: 114.4, pd: 414.4, k: 1.27, atmPsia: 14.4, heActive: true, ceActive: false });
    expect(r.tensionLb).toBe(0);
    expect(r.reversalDeg).toBe(0);
  });
});

describe('unit runs', () => {
  const frame = frameById('PHT');
  it('equal ratio pressures', () => {
    expect(equalRatioPressures(100, 900, 2)[1]).toBeCloseTo(300, 6);
  });
  it('sample PHT run computes and is internally consistent', () => {
    const r = runPerformance(DEFAULT_CONFIG, frame, lookup);
    expect(r.ok).toBe(true);
    expect(r.stages).toHaveLength(2);
    expect(r.stages[0].ratio).toBeCloseTo(r.stages[1].ratio, 6);
    expect(r.stages[0].ratio * r.stages[1].ratio).toBeCloseTo(1214.4 / 114.4, 4);
    expect(r.mmscfd).toBeGreaterThan(0);
  });
  it('balanced mode equalises stage flow', () => {
    const r = runPerformance({ ...DEFAULT_CONFIG, interstageMode: 'balanced' }, frame, lookup);
    expect(r.stages[0].mmscfd).toBeCloseTo(r.stages[1].mmscfd, 4);
  });
  it('flags overloads in red', () => {
    const cfg: RunConfig = {
      ...DEFAULT_CONFIG,
      stages: 1,
      throws: [
        { cylinderId: 'ph-10', stage: 1, deactivate: 'none', pocketOpenPct: 0 },
        { cylinderId: 'ph-10', stage: 1, deactivate: 'none', pocketOpenPct: 0 },
      ],
      suctionPsig: 50,
      dischargePsig: 600,
      rpm: 2300,
      driverHp: 100,
    };
    const r = runPerformance(cfg, frame, lookup);
    const red = r.flags.filter((f) => f.level === 'red').map((f) => f.msg).join('\n');
    expect(red).toMatch(/rod load/);
    expect(red).toMatch(/MAWP/);
    expect(red).toMatch(/RPM exceeds/);
    expect(red).toMatch(/driver/);
    expect(red).toMatch(/discharge temp/);
  });
  it('rejects discharge ≤ suction', () => {
    expect(runPerformance({ ...DEFAULT_CONFIG, dischargePsig: 50 }, frame, lookup).ok).toBe(false);
  });
});

describe('tandem throws', () => {
  it('tandem areas: rod reduces inboard CE, neck reduces both facing ends', () => {
    // A(4.5) = 15.9043, A(2.75) = 5.9396, A(1.125) = 0.99402, A(1.5) = 1.76715
    const t = tandemAreas(4.5, 2.75, 1.125, 1.125);
    expect(t.inboard.ceIn2).toBeCloseTo(14.9103, 3);
    expect(t.inboard.heIn2).toBeCloseTo(14.9103, 3);
    expect(t.outboard.heIn2).toBeCloseTo(5.9396, 3);
    expect(t.outboard.ceIn2).toBeCloseTo(4.9456, 3);
    const n = tandemAreas(4.5, 2.75, 1.125, 1.5);
    expect(n.inboard.heIn2).toBeCloseTo(14.1372, 3);
    expect(n.inboard.ceIn2).toBeCloseTo(14.9103, 3); // piston rod side unchanged
    expect(n.outboard.ceIn2).toBeCloseTo(4.1724, 3);
  });
  it('preset is 1st stage on throw 1, 2nd/3rd tandem on throw 2', () => {
    expect(stageSlots(PRESET_PXT_3STAGE.throws)).toBe(3);
    const [t1, t2] = PRESET_PXT_3STAGE.throws;
    expect(t1.kind).toBe('single');
    expect(t1.stage).toBe(1);
    expect(t2.kind).toBe('tandem');
    expect([t2.stage, t2.outStage]).toEqual([2, 3]);
  });
  const frame = frameById('PXT');
  const r = runPerformance(PRESET_PXT_3STAGE, frame, lookup);
  it('3-stage balance: stage flows agree within 0.5%', () => {
    expect(r.ok).toBe(true);
    expect(r.stages).toHaveLength(3);
    const q = r.stages.map((s) => s.mmscfd);
    const spread = (Math.max(...q) - Math.min(...q)) / Math.max(...q);
    expect(spread).toBeLessThan(0.005);
    const overall = r.stages.reduce((a, s) => a * s.ratio, 1);
    expect(overall).toBeCloseTo(1514.4 / 114.4, 4);
    expect(r.stages[1].tsF).toBe(120);
    expect(r.stages[2].tsF).toBe(120);
  });
  it('each interstage cooler temp applies to its own stage', () => {
    const r2 = runPerformance({ ...PRESET_PXT_3STAGE, interstageTempsF: [110, 130] }, frame, lookup);
    expect(r2.stages[1].tsF).toBe(110);
    expect(r2.stages[2].tsF).toBe(130);
    const q = r2.stages.map((s) => s.mmscfd);
    expect((Math.max(...q) - Math.min(...q)) / Math.max(...q)).toBeLessThan(0.005);
  });
  it('tandem rod load sums all four faces (hand check at 0°)', () => {
    // Default ends: inboard CE active, inboard HE @ stg-1 suction, outboard HE active, outboard CE @ stg-1 suction.
    // Peak compression near 0°: outHE at Pd3, inHE at Ps1, inCE at Ps2, outCE at Ps1 (gauge):
    //   F = Pd3·A_outHE + Ps1·A_inHE − Ps2·A_inCE − Ps1·A_outCE
    const t = tandemAreas(4.5, 2.75, 1.125, 1.125);
    const ps2 = r.stages[1].psPsig;
    const expected = 1500 * t.outboard.heIn2 + 100 * t.inboard.heIn2 - ps2 * t.inboard.ceIn2 - 100 * t.outboard.ceIn2;
    const tt = r.throws[1];
    expect(tt.kind).toBe('tandem');
    expect(tt.parts.map((p) => p.position)).toEqual(['inboard', 'outboard']);
    expect(tt.rod.compressionLb).toBeCloseTo(expected, 0);
    expect(tt.rod.reversalDeg).toBeGreaterThan(90);
    expect(tt.parts[0].he.refPsig).toBeCloseTo(100, 6);
  });
  it('vented end sits at 0 psig and adds no flow', () => {
    const cfg = {
      ...PRESET_PXT_3STAGE,
      throws: [PRESET_PXT_3STAGE.throws[0], { ...PRESET_PXT_3STAGE.throws[1], ends: { inHE: 'vent', inCE: 'active', outHE: 'active', outCE: 'vent' } as const }],
    };
    const rv = runPerformance(cfg, frame, lookup);
    const tp = rv.throws[1].parts;
    expect(tp[0].he.refPsig).toBeCloseTo(0, 6);
    expect(tp[1].ce.refPsig).toBeCloseTo(0, 6);
    expect(tp[0].he.acfm).toBe(0);
  });
  it('active end on a cylinder the library says is single-acting falls back to its stage suction', () => {
    const cfg = {
      ...PRESET_PXT_3STAGE,
      throws: [PRESET_PXT_3STAGE.throws[0], { ...PRESET_PXT_3STAGE.throws[1], ends: { inHE: 'active', inCE: 'active', outHE: 'active', outCE: 'active' } as const }],
    };
    const rr = runPerformance(cfg, frame, lookup);
    const tp = rr.throws[1].parts;
    expect(tp[0].he.active).toBe(false); // 4.5" inboard is SA-CE
    expect(tp[0].he.mode).toBe('s2');
    expect(tp[1].ce.active).toBe(false); // 2.75" outboard is SA-HE
  });
});
