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
