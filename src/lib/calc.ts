/**
 * CiP Performance — core calculation module.
 *
 * Everything that produces a number lives here so it can be audited in one
 * place. Methods follow the GPSA Engineering Data Book (Section 13,
 * Reciprocating Compressors) unless noted. Results are ENGINEERING ESTIMATES,
 * not OEM-certified performance.
 *
 * Conventions
 *   - Pressures: inputs in psig, internal thermodynamics in psia.
 *   - Temperatures: inputs in °F, internal thermodynamics in °R (°F + 459.67).
 *   - Standard conditions: 14.65 psia & 60 °F (gas-measurement standard).
 *   - Flow: MMSCFD at standard conditions.
 *   - Rod loads: gas loads only (no inertia), lb. + = compression, − = tension.
 */

import type { FrameSpec } from '../data/frames';
import type { Acting, Cylinder } from '../data/cylinders';

export const P_STD_PSIA = 14.65;
export const T_STD_F = 60;
export const R_OFFSET = 459.67;
/** 144 in²/ft² ÷ 33,000 ft·lbf/min/HP → HP = psia·ACFM / 229.17 */
export const HP_CONST = 33000 / 144;

export const toPsia = (psig: number, atmPsia: number) => psig + atmPsia;
export const toPsig = (psia: number, atmPsia: number) => psia - atmPsia;
export const toRankine = (f: number) => f + R_OFFSET;
export const toF = (r: number) => r - R_OFFSET;

// ---------------------------------------------------------------- gas props

/** Sutton (1985) pseudo-critical properties of natural gas from SG. °R, psia. */
export function suttonPseudoCritical(sg: number): { tpcR: number; ppcPsia: number } {
  return {
    tpcR: 169.2 + 349.5 * sg - 74.0 * sg * sg,
    ppcPsia: 756.8 - 131.0 * sg - 3.6 * sg * sg,
  };
}

/** Papay (1968) explicit Z correlation. Quick; fine below Ppr ≈ 8. */
export function zPapay(ppr: number, tpr: number): number {
  return 1 - (3.53 * ppr) / Math.pow(10, 0.9813 * tpr) + (0.274 * ppr * ppr) / Math.pow(10, 0.8157 * tpr);
}

const DAK = [0.3265, -1.07, -0.5339, 0.01569, -0.05165, 0.5475, -0.7361, 0.1844, 0.1056, 0.6134, 0.721];

function dakZofRho(rho: number, t: number): number {
  const [A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11] = DAK;
  const r2 = rho * rho;
  return (
    1 +
    (A1 + A2 / t + A3 / t ** 3 + A4 / t ** 4 + A5 / t ** 5) * rho +
    (A6 + A7 / t + A8 / (t * t)) * r2 -
    A9 * (A7 / t + A8 / (t * t)) * rho ** 5 +
    A10 * (1 + A11 * r2) * (r2 / t ** 3) * Math.exp(-A11 * r2)
  );
}

/**
 * Dranchuk & Abou-Kassem (1975) fit of the Standing-Katz chart.
 * Solves Z = f(ρr) with ρr = 0.27·Ppr/(Z·Tpr) by Newton iteration
 * (falls back to Papay if it fails to converge).
 */
export function zDAK(ppr: number, tpr: number): number {
  if (ppr <= 0) return 1;
  let rho = (0.27 * ppr) / tpr; // Z = 1 guess
  for (let i = 0; i < 60; i++) {
    const f = (r: number) => dakZofRho(r, tpr) - (0.27 * ppr) / (r * tpr);
    const fv = f(rho);
    const h = 1e-6 * Math.max(rho, 1e-3);
    const d = (f(rho + h) - fv) / h;
    if (!isFinite(d) || d === 0) break;
    let next = rho - fv / d;
    if (next <= 0) next = rho / 2;
    if (Math.abs(next - rho) < 1e-10) {
      rho = next;
      const z = (0.27 * ppr) / (rho * tpr);
      return z > 0.2 && z < 2 ? z : zPapay(ppr, tpr);
    }
    rho = next;
  }
  return zPapay(ppr, tpr);
}

export type ZMethod = 'dak' | 'papay' | 'ideal';

/** Compressibility factor at p (psia), T (°F) for a gas of given SG. */
export function zFactor(pPsia: number, tF: number, sg: number, method: ZMethod = 'dak'): number {
  if (method === 'ideal') return 1;
  const { tpcR, ppcPsia } = suttonPseudoCritical(sg);
  const ppr = pPsia / ppcPsia;
  const tpr = toRankine(tF) / tpcR;
  return method === 'papay' ? zPapay(ppr, tpr) : zDAK(ppr, tpr);
}

/**
 * Rough k (Cp/Cv) for sweet natural gas from SG, approximating GPSA Fig. 13-8
 * at typical compressor temperatures (~150 °F): SG 0.55 → 1.30, 0.65 → 1.275,
 * 0.80 → 1.24, 1.00 → 1.19. Clamped 1.10–1.32. Override when you have a gas analysis.
 */
export function estimateK(sg: number): number {
  return Math.min(1.32, Math.max(1.1, 1.3 - 0.25 * (sg - 0.55)));
}

export interface GasPreset {
  id: string;
  label: string;
  sg: number;
  k: number;
}

export const GAS_PRESETS: GasPreset[] = [
  { id: 'lean', label: 'Lean / dry gas', sg: 0.6, k: 1.29 },
  { id: 'pipeline', label: 'Typical field gas', sg: 0.65, k: 1.27 },
  { id: 'rich', label: 'Rich gas', sg: 0.75, k: 1.24 },
  { id: 'vrich', label: 'Very rich / associated', sg: 0.85, k: 1.21 },
];

// ------------------------------------------------------- thermodynamics

export const compressionRatio = (psPsia: number, pdPsia: number) => pdPsia / psPsia;

/** Ideal (isentropic) discharge temperature, °F: Td = Ts·r^((k−1)/k) in °R. */
export function dischargeTempF(tsF: number, r: number, k: number): number {
  return toF(toRankine(tsF) * Math.pow(r, (k - 1) / k));
}

/**
 * GPSA volumetric efficiency, % (GPSA eq. 13-12):
 *   VE = 100 − r − C·[(Zs/Zd)·r^(1/k) − 1]
 * The "− r" term is GPSA's allowance for slippage/valve/heating losses.
 * Non-lubricated cylinders: GPSA says subtract an additional 5 %.
 * C is clearance in % of swept volume. Clamped at 0 (no flow).
 */
export function volumetricEfficiency(
  clearancePct: number,
  r: number,
  k: number,
  zs: number,
  zd: number,
  lubricated = true,
): number {
  const ve = 100 - r - clearancePct * ((zs / zd) * Math.pow(r, 1 / k) - 1) - (lubricated ? 0 : 5);
  return Math.max(0, ve);
}

export interface Areas {
  heIn2: number;
  ceIn2: number;
  rodIn2: number;
}

export function cylinderAreas(boreIn: number, rodDiaIn: number): Areas {
  const he = (Math.PI / 4) * boreIn * boreIn;
  const rod = (Math.PI / 4) * rodDiaIn * rodDiaIn;
  return { heIn2: he, ceIn2: he - rod, rodIn2: rod };
}

/** Piston displacement of one cylinder end, ACFM = area·stroke·RPM / 1728. */
export const endDisplacementCfm = (areaIn2: number, strokeIn: number, rpm: number) => (areaIn2 * strokeIn * rpm) / 1728;

/** Actual inlet ft³/min → MMSCFD at 14.65 psia & 60 °F (Z_std taken as 1). */
export function acfmToMMSCFD(acfm: number, psPsia: number, tsF: number, zs: number): number {
  return (acfm * 1440 * (psPsia / P_STD_PSIA) * (toRankine(T_STD_F) / toRankine(tsF)) * (1 / zs)) / 1e6;
}

/** MMSCFD → actual inlet ft³/min (inverse of acfmToMMSCFD). */
export function mmscfdToAcfm(q: number, psPsia: number, tsF: number, zs: number): number {
  return (q * 1e6) / (1440 * (psPsia / P_STD_PSIA) * (toRankine(T_STD_F) / toRankine(tsF)) * (1 / zs));
}

/**
 * Isentropic ("adiabatic") gas horsepower (GPSA eq. 13-15 form):
 *   IHP = Ps·Q/229.17 · k/(k−1) · [r^((k−1)/k) − 1] · (Zs+Zd)/(2·Zs)
 * Ps psia, Q actual inlet ft³/min.
 */
export function isentropicHp(psPsia: number, acfm: number, r: number, k: number, zs: number, zd: number): number {
  const e = (k - 1) / k;
  return ((psPsia * acfm) / HP_CONST) * (1 / e) * (Math.pow(r, e) - 1) * ((zs + zd) / 2 / zs);
}

/**
 * Brake HP = IHP / (ηcomp · ηmech).
 * ηcomp (default 0.85) covers valve & flow losses; ηmech (default 0.95) covers
 * frame friction. Overall ≈ 0.81, which lands close to GPSA's quick estimate
 * BHP/MMSCFD ≈ 22·r·N·F for typical ratios.
 */
export const brakeHp = (ihp: number, compEff: number, mechEff: number) => ihp / (compEff * mechEff);

// ------------------------------------------------------------ rod loads

export interface EndPressures {
  /** psia */
  ps: number;
  /** psia */
  pd: number;
}

export interface RodLoadResult {
  /** Peak gas load toward the crank (rod compression), lb (≥ 0 or the least-tension value) */
  compressionLb: number;
  /** Peak gas load away from the crank (rod tension), lb, reported positive */
  tensionLb: number;
  /** compression + tension */
  combinedLb: number;
  /** Crank degrees the gas load spends in its minority direction (0 = no reversal) */
  reversalDeg: number;
}

/**
 * Simple static gas rod loads for a double-acting throw (gauge pressures):
 *   compression = Pd·A_HE − Ps·A_CE
 *   tension     = Pd·A_CE − Ps·A_HE
 */
export function staticRodLoadsDA(psPsig: number, pdPsig: number, a: Areas) {
  return {
    compressionLb: pdPsig * a.heIn2 - psPsig * a.ceIn2,
    tensionLb: pdPsig * a.ceIn2 - psPsig * a.heIn2,
  };
}

/** Piston distance from HE dead centre, in. Slider-crank with L = lRatio × crank radius. */
export function pistonPosition(thetaDeg: number, strokeIn: number, lRatio = 4): number {
  const rc = strokeIn / 2;
  const L = lRatio * rc;
  const t = (thetaDeg * Math.PI) / 180;
  return rc * (1 - Math.cos(t)) + L - Math.sqrt(L * L - rc * rc * Math.sin(t) ** 2);
}

/**
 * Gas rod load over one revolution from an ideal indicator cycle
 * (isentropic re-expansion/compression with clearance, flat suction and
 * discharge at the flange pressures). An inactive end (single-acting or
 * deactivated) sits at suction pressure. Inertia is NOT included, so the
 * reversal figure is a gas-load-only screen.
 */
export function rodLoadCycle(opts: {
  areas: Areas;
  strokeIn: number;
  clearanceHePct: number;
  clearanceCePct: number;
  ps: number;
  pd: number;
  k: number;
  atmPsia: number;
  heActive: boolean;
  ceActive: boolean;
  stepDeg?: number;
}): RodLoadResult {
  const { areas, strokeIn: S, ps, pd, k, atmPsia, heActive, ceActive } = opts;
  const step = opts.stepDeg ?? 1;
  const vcHe = (opts.clearanceHePct / 100) * areas.heIn2 * S;
  const vcCe = (opts.clearanceCePct / 100) * areas.ceIn2 * S;
  const vmaxHe = vcHe + areas.heIn2 * S;
  const vmaxCe = vcCe + areas.ceIn2 * S;
  let maxF = -Infinity;
  let minF = Infinity;
  let degC = 0;
  let degT = 0;
  for (let th = 0; th < 360; th += step) {
    const x = pistonPosition(th, S);
    const vHe = vcHe + areas.heIn2 * x;
    const vCe = vcCe + areas.ceIn2 * (S - x);
    let pHe = ps;
    let pCe = ps;
    if (heActive) {
      pHe = th < 180 ? Math.max(ps, pd * Math.pow(vcHe / vHe, k)) : Math.min(pd, ps * Math.pow(vmaxHe / vHe, k));
    }
    if (ceActive) {
      pCe = th < 180 ? Math.min(pd, ps * Math.pow(vmaxCe / vCe, k)) : Math.max(ps, pd * Math.pow(vcCe / vCe, k));
    }
    const f = (pHe - atmPsia) * areas.heIn2 - (pCe - atmPsia) * areas.ceIn2;
    maxF = Math.max(maxF, f);
    minF = Math.min(minF, f);
    if (f > 0) degC += step;
    else if (f < 0) degT += step;
  }
  const compressionLb = Math.max(0, maxF);
  const tensionLb = Math.max(0, -minF);
  return {
    compressionLb,
    tensionLb,
    combinedLb: compressionLb + tensionLb,
    reversalDeg: Math.min(degC, degT),
  };
}

// ------------------------------------------------------------- run model

export type Deactivate = 'none' | 'HE' | 'CE';

export interface ThrowConfig {
  cylinderId: string;
  stage: number; // 1-based
  deactivate: Deactivate;
  /** 0–100 % of the cylinder's head-end pocket volume opened */
  pocketOpenPct: number;
}

export interface RunConfig {
  frameId: string;
  rpm: number;
  stages: number;
  throws: ThrowConfig[];
  sg: number;
  k: number;
  autoK: boolean;
  zMethod: ZMethod;
  suctionPsig: number;
  suctionTempF: number;
  dischargePsig: number;
  interstageTempF: number;
  atmPsia: number;
  driverHp: number | null;
  interstageMode: 'equal' | 'balanced';
  lubricated: boolean;
  compEff: number;
  mechEff: number;
  alarmDischargeTempF: number;
  minReversalDeg: number;
}

export const DEFAULT_CONFIG: RunConfig = {
  frameId: 'PHT',
  rpm: 1800,
  stages: 2,
  throws: [
    { cylinderId: 'pkg-2.0625', stage: 1, deactivate: 'none', pocketOpenPct: 0 },
    { cylinderId: 'pkg-1.75', stage: 2, deactivate: 'none', pocketOpenPct: 0 },
  ],
  sg: 0.65,
  k: 1.275,
  autoK: true,
  zMethod: 'dak',
  suctionPsig: 100,
  suctionTempF: 80,
  dischargePsig: 1200,
  interstageTempF: 120,
  atmPsia: 14.4,
  driverHp: null,
  interstageMode: 'equal',
  lubricated: true,
  compEff: 0.85,
  mechEff: 0.95,
  alarmDischargeTempF: 300,
  minReversalDeg: 15,
};

export type FlagLevel = 'red' | 'amber' | 'info';
export interface Flag {
  level: FlagLevel;
  msg: string;
}

export interface EndResult {
  active: boolean;
  clearancePct: number;
  ve: number;
  displacementCfm: number;
  acfm: number;
}

export interface ThrowResult {
  index: number; // 0-based
  stage: number;
  cylinder: Cylinder;
  areas: Areas;
  he: EndResult;
  ce: EndResult;
  rod: RodLoadResult;
  pctCompression: number | null;
  pctTension: number | null;
  pctCombined: number | null;
}

export interface StageResult {
  stage: number;
  psPsig: number;
  pdPsig: number;
  psPsia: number;
  pdPsia: number;
  ratio: number;
  tsF: number;
  tdF: number;
  zs: number;
  zd: number;
  acfm: number;
  mmscfd: number;
  ihp: number;
  bhp: number;
  throws: number[];
}

export interface RunResult {
  ok: boolean;
  error?: string;
  k: number;
  frame: FrameSpec;
  stages: StageResult[];
  throws: ThrowResult[];
  /** Unit capacity: min stage flow (equal-ratio) or balanced flow */
  mmscfd: number;
  bhp: number;
  pctFrameHp: number;
  pistonSpeedFpm: number;
  flags: Flag[];
  balanced: boolean;
  balanceIterations: number;
}

export function effectiveK(cfg: RunConfig): number {
  return cfg.autoK ? estimateK(cfg.sg) : cfg.k;
}

/** Cylinder end activity after acting type + deactivation. */
export function activeEnds(acting: Acting, deactivate: Deactivate) {
  return {
    he: acting !== 'SA-CE' && deactivate !== 'HE',
    ce: acting !== 'SA-HE' && deactivate !== 'CE',
  };
}

interface StageCtx {
  cfg: RunConfig;
  frame: FrameSpec;
  k: number;
  lookup: (id: string) => Cylinder | undefined;
}

/** Compute one stage's thermodynamics and per-throw ends at given flange pressures (psia). */
function computeStage(ctx: StageCtx, stage: number, psPsia: number, pdPsia: number) {
  const { cfg, frame, k, lookup } = ctx;
  const tsF = stage === 1 ? cfg.suctionTempF : cfg.interstageTempF;
  const r = compressionRatio(psPsia, pdPsia);
  const tdF = dischargeTempF(tsF, r, k);
  const zs = zFactor(psPsia, tsF, cfg.sg, cfg.zMethod);
  const zd = zFactor(pdPsia, tdF, cfg.sg, cfg.zMethod);
  const throwIdx: number[] = [];
  const throws: ThrowResult[] = [];
  let acfm = 0;
  cfg.throws.forEach((t, i) => {
    if (t.stage !== stage) return;
    const cyl = lookup(t.cylinderId);
    if (!cyl) return;
    throwIdx.push(i);
    const rodDia = cyl.rodDiaIn ?? frame.rodDiaIn;
    const areas = cylinderAreas(cyl.boreIn, rodDia);
    const act = activeEnds(cyl.acting, t.deactivate);
    const pocketVol = (cyl.pocketMaxIn3 || 0) * (Math.min(100, Math.max(0, t.pocketOpenPct)) / 100);
    const cHe = cyl.clearanceHePct + (100 * pocketVol) / (areas.heIn2 * frame.strokeIn);
    const cCe = cyl.clearanceCePct;
    const mkEnd = (active: boolean, area: number, c: number): EndResult => {
      const pd = endDisplacementCfm(area, frame.strokeIn, cfg.rpm);
      const ve = active ? volumetricEfficiency(c, r, k, zs, zd, cfg.lubricated) : 0;
      return { active, clearancePct: c, ve, displacementCfm: pd, acfm: active ? (pd * ve) / 100 : 0 };
    };
    const he = mkEnd(act.he, areas.heIn2, cHe);
    const ce = mkEnd(act.ce, areas.ceIn2, cCe);
    acfm += he.acfm + ce.acfm;
    const rod = rodLoadCycle({
      areas,
      strokeIn: frame.strokeIn,
      clearanceHePct: cHe,
      clearanceCePct: cCe,
      ps: psPsia,
      pd: pdPsia,
      k,
      atmPsia: cfg.atmPsia,
      heActive: act.he,
      ceActive: act.ce,
    });
    const pct = (v: number, lim: number | null) => (lim ? (100 * v) / lim : null);
    throws.push({
      index: i,
      stage,
      cylinder: cyl,
      areas,
      he,
      ce,
      rod,
      pctCompression: pct(rod.compressionLb, frame.rodLoadCompressionLb),
      pctTension: pct(rod.tensionLb, frame.rodLoadTensionLb),
      pctCombined: pct(rod.combinedLb, frame.rodLoadCombinedLb),
    });
  });
  const mmscfd = acfmToMMSCFD(acfm, psPsia, tsF, zs);
  const ihp = isentropicHp(psPsia, acfm, r, k, zs, zd);
  const st: StageResult = {
    stage,
    psPsig: toPsig(psPsia, cfg.atmPsia),
    pdPsig: toPsig(pdPsia, cfg.atmPsia),
    psPsia,
    pdPsia,
    ratio: r,
    tsF,
    tdF,
    zs,
    zd,
    acfm,
    mmscfd,
    ihp,
    bhp: brakeHp(ihp, cfg.compEff, cfg.mechEff),
    throws: throwIdx,
  };
  return { st, throws };
}

/** Equal compression ratio per stage → array of n+1 absolute pressures. */
export function equalRatioPressures(psPsia: number, pdPsia: number, n: number): number[] {
  const r = Math.pow(pdPsia / psPsia, 1 / n);
  return Array.from({ length: n + 1 }, (_, i) => psPsia * Math.pow(r, i));
}

/**
 * Solve interstage pressures so every stage moves the same MMSCFD.
 * Gauss-Seidel sweeps; each interstage pressure found by bisection on
 * Q(stage j) − Q(stage j+1), which is monotonic in that pressure.
 */
export function balancePressures(
  flowAt: (stage: number, ps: number, pd: number) => number,
  p: number[],
): { p: number[]; iterations: number } {
  const n = p.length - 1;
  const out = p.slice();
  let it = 0;
  for (; it < 60 && n > 1; it++) {
    let maxMove = 0;
    for (let j = 1; j < n; j++) {
      let lo = out[j - 1] * 1.0001;
      let hi = out[j + 1] * 0.9999;
      const f = (pi: number) => flowAt(j, out[j - 1], pi) - flowAt(j + 1, pi, out[j + 1]);
      let flo = f(lo);
      const fhi = f(hi);
      let next: number;
      if (flo * fhi > 0) {
        next = Math.abs(flo) < Math.abs(fhi) ? lo : hi;
      } else {
        for (let b = 0; b < 80; b++) {
          const mid = (lo + hi) / 2;
          const fm = f(mid);
          if (fm * flo > 0) {
            lo = mid;
            flo = fm;
          } else hi = mid;
          if (hi - lo < 1e-4) break;
        }
        next = (lo + hi) / 2;
      }
      maxMove = Math.max(maxMove, Math.abs(next - out[j]));
      out[j] = next;
    }
    if (maxMove < 0.01) {
      it++;
      break;
    }
  }
  return { p: out, iterations: it };
}

/** Full unit performance run with all limit checks. */
export function runPerformance(
  cfg: RunConfig,
  frame: FrameSpec,
  lookup: (id: string) => Cylinder | undefined,
): RunResult {
  const k = effectiveK(cfg);
  const flags: Flag[] = [];
  const empty: RunResult = {
    ok: false,
    k,
    frame,
    stages: [],
    throws: [],
    mmscfd: 0,
    bhp: 0,
    pctFrameHp: 0,
    pistonSpeedFpm: (2 * frame.strokeIn * cfg.rpm) / 12,
    flags,
    balanced: false,
    balanceIterations: 0,
  };
  const ps = toPsia(cfg.suctionPsig, cfg.atmPsia);
  const pd = toPsia(cfg.dischargePsig, cfg.atmPsia);
  if (!(ps > 0) || !(pd > ps)) return { ...empty, error: 'Discharge pressure must be above suction pressure.' };
  if (!(cfg.rpm > 0)) return { ...empty, error: 'RPM must be above 0.' };
  for (let s = 1; s <= cfg.stages; s++) {
    if (!cfg.throws.some((t) => t.stage === s && lookup(t.cylinderId)))
      return { ...empty, error: `Stage ${s} has no cylinder assigned.` };
  }
  const ctx: StageCtx = { cfg, frame, k, lookup };
  let p = equalRatioPressures(ps, pd, cfg.stages);
  let iterations = 0;
  if (cfg.interstageMode === 'balanced' && cfg.stages > 1) {
    const sol = balancePressures((s, a, b) => computeStage(ctx, s, a, b).st.mmscfd, p);
    p = sol.p;
    iterations = sol.iterations;
  }
  const stages: StageResult[] = [];
  const throws: ThrowResult[] = [];
  for (let s = 1; s <= cfg.stages; s++) {
    const { st, throws: th } = computeStage(ctx, s, p[s - 1], p[s]);
    stages.push(st);
    throws.push(...th);
  }
  throws.sort((a, b) => a.index - b.index);
  const flows = stages.map((s) => s.mmscfd);
  const mmscfd = Math.min(...flows);
  const bhp = stages.reduce((a, s) => a + s.bhp, 0);
  const pctFrameHp = (100 * bhp) / frame.ratedHp;

  // ---- checks
  const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  if (cfg.rpm > frame.maxRpm) {
    if (frame.approvedMaxRpm && cfg.rpm <= frame.approvedMaxRpm)
      flags.push({ level: 'amber', msg: `${fmt(cfg.rpm)} RPM is above ${frame.id} standard ${fmt(frame.maxRpm)} RPM — needs CiP approval (max ${fmt(frame.approvedMaxRpm)}).` });
    else flags.push({ level: 'red', msg: `${fmt(cfg.rpm)} RPM exceeds ${frame.id} max ${fmt(frame.approvedMaxRpm ?? frame.maxRpm)} RPM.` });
  }
  if (bhp > frame.ratedHp) {
    if (frame.approvedMaxHp && bhp <= frame.approvedMaxHp)
      flags.push({ level: 'amber', msg: `${fmt(bhp)} BHP is above ${frame.id} rated ${frame.ratedHp} HP — needs CiP approval (max ${frame.approvedMaxHp}).` });
    else flags.push({ level: 'red', msg: `${fmt(bhp)} BHP exceeds ${frame.id} frame rating (${frame.approvedMaxHp ?? frame.ratedHp} HP).` });
  }
  if (cfg.driverHp && bhp > cfg.driverHp)
    flags.push({ level: 'red', msg: `${fmt(bhp)} BHP exceeds driver available ${fmt(cfg.driverHp)} HP.` });
  for (const s of stages) {
    if (s.tdF > cfg.alarmDischargeTempF)
      flags.push({ level: 'red', msg: `Stage ${s.stage} discharge temp ${fmt(s.tdF)}°F is over the ${fmt(cfg.alarmDischargeTempF)}°F alarm.` });
    else if (s.tdF > cfg.alarmDischargeTempF - 25)
      flags.push({ level: 'amber', msg: `Stage ${s.stage} discharge temp ${fmt(s.tdF)}°F is within 25°F of the alarm.` });
    if (s.ratio > 4.5) flags.push({ level: 'amber', msg: `Stage ${s.stage} ratio ${fmt(s.ratio, 2)} is high for one stage.` });
    if (s.mmscfd <= 0) flags.push({ level: 'red', msg: `Stage ${s.stage} moves no gas (VE ≤ 0). Ratio too high for the clearance.` });
  }
  for (const t of throws) {
    const tag = `Throw ${t.index + 1} (stg ${t.stage}, ${t.cylinder.boreIn}")`;
    const st = stages[t.stage - 1];
    if (st.pdPsig > t.cylinder.mawpPsig)
      flags.push({ level: 'red', msg: `${tag}: discharge ${fmt(st.pdPsig)} psig exceeds cylinder MAWP ${fmt(t.cylinder.mawpPsig)} psig.` });
    else if (st.pdPsig > 0.9 * t.cylinder.mawpPsig)
      flags.push({ level: 'amber', msg: `${tag}: discharge is over 90% of MAWP — check relief valve margin.` });
    const chk = (label: string, v: number, lim: number | null, pct: number | null) => {
      if (lim == null || pct == null) return;
      if (pct > 100) flags.push({ level: 'red', msg: `${tag}: ${label} rod load ${fmt(v)} lb exceeds ${fmt(lim)} lb (${fmt(pct)}%).` });
      else if (pct > 90) flags.push({ level: 'amber', msg: `${tag}: ${label} rod load at ${fmt(pct)}% of limit.` });
    };
    chk('compression', t.rod.compressionLb, frame.rodLoadCompressionLb, t.pctCompression);
    chk('tension', t.rod.tensionLb, frame.rodLoadTensionLb, t.pctTension);
    chk('combined', t.rod.combinedLb, frame.rodLoadCombinedLb, t.pctCombined);
    if (t.rod.reversalDeg <= 0) flags.push({ level: 'red', msg: `${tag}: no gas rod load reversal.` });
    else if (t.rod.reversalDeg < cfg.minReversalDeg)
      flags.push({ level: 'red', msg: `${tag}: gas load reversal only ${fmt(t.rod.reversalDeg)}° (min ${cfg.minReversalDeg}°).` });
    if (t.cylinder.placeholder) flags.push({ level: 'info', msg: `${tag}: placeholder cylinder data — verify with CiP data.` });
  }
  if (frame.rodLoadTensionLb == null) flags.push({ level: 'info', msg: `${frame.id}: no published tension/combined rod load limit; only compression checked.` });
  if (cfg.stages > 1 && cfg.interstageMode === 'equal') {
    const mx = Math.max(...flows);
    if (mx > 0 && (mx - mmscfd) / mx > 0.05)
      flags.push({ level: 'amber', msg: `Stage flows don't balance at equal ratios (${flows.map((f) => fmt(f, 3)).join(' vs ')} MMSCFD). Unit capacity shown is the lowest stage; switch to "Balance flow" for the real interstage pressure.` });
  }
  return {
    ok: true,
    k,
    frame,
    stages,
    throws,
    mmscfd,
    bhp,
    pctFrameHp,
    pistonSpeedFpm: (2 * frame.strokeIn * cfg.rpm) / 12,
    flags,
    balanced: cfg.interstageMode === 'balanced',
    balanceIterations: iterations,
  };
}

// ------------------------------------------------------------- what-if

export type SweepParam = 'suction' | 'rpm';
export interface SweepPoint {
  x: number;
  mmscfd: number;
  bhp: number;
  red: number;
}

export function sweep(
  cfg: RunConfig,
  frame: FrameSpec,
  lookup: (id: string) => Cylinder | undefined,
  param: SweepParam,
  from: number,
  to: number,
  steps = 20,
): SweepPoint[] {
  const pts: SweepPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    const c: RunConfig = param === 'rpm' ? { ...cfg, rpm: x } : { ...cfg, suctionPsig: x };
    const r = runPerformance(c, frame, lookup);
    if (!r.ok) continue;
    pts.push({ x, mmscfd: r.mmscfd, bhp: r.bhp, red: r.flags.filter((f) => f.level === 'red').length });
  }
  return pts;
}
