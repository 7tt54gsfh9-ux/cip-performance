// CiP cylinder library.
//
// *** EVERY ENTRY BELOW IS A PLACEHOLDER ***
// Real CiP cylinder data (clearance %, MAWP, pockets, acting type) is not
// public. Clearances are typical recip assumptions (HE ~15-20 %, CE ~18-22 %)
// and MAWPs are rough guesses scaled by bore. Replace with CiP cylinder
// sheets: edit the values, set `placeholder: false`, and fill `source`.
//
// Only the 2.0625" and 1.75" bores + their MAWPs come from a real package
// sheet (PHT/2, https://ngsgi.com/compressor-3306taa-hpgl.html); their
// clearances are still assumed.
//
// Fields
//   boreIn           cylinder bore, in
//   rodDiaIn         piston rod dia, in (null = use frame rod dia)
//   clearanceHePct   head-end fixed clearance, % of HE swept volume
//   clearanceCePct   crank-end fixed clearance, % of CE swept volume
//   mawpPsig         max allowable working pressure, psig
//   acting           'DA' double acting | 'SA-HE' head end only | 'SA-CE' crank end only
//   pocketMaxIn3     head-end variable volume pocket, max added volume in^3 (0 = none)

export type Acting = 'DA' | 'SA-HE' | 'SA-CE';

export interface Cylinder {
  id: string;
  name: string;
  boreIn: number;
  rodDiaIn: number | null;
  clearanceHePct: number;
  clearanceCePct: number;
  mawpPsig: number;
  acting: Acting;
  pocketMaxIn3: number;
  placeholder: boolean;
  source?: string;
  custom?: boolean;
}

const ph = (boreIn: number, mawpPsig: number, he: number, ce: number, pocketMaxIn3 = 0): Cylinder => ({
  id: `ph-${boreIn}`,
  name: `${boreIn}" placeholder`,
  boreIn,
  rodDiaIn: null,
  clearanceHePct: he,
  clearanceCePct: ce,
  mawpPsig,
  acting: 'DA',
  pocketMaxIn3,
  placeholder: true,
  source: 'Assumed typical values',
});

export const SEED_CYLINDERS: Cylinder[] = [
  {
    id: 'pkg-1.75',
    name: '1.75" (PHT/2 pkg 2nd stg)',
    boreIn: 1.75,
    rodDiaIn: null,
    clearanceHePct: 20,
    clearanceCePct: 22,
    mawpPsig: 5500,
    acting: 'DA',
    pocketMaxIn3: 0,
    placeholder: true,
    source: 'Bore + MAWP from ngsgi.com 3306TAA HPGL sheet; clearances assumed',
  },
  {
    id: 'pkg-2.0625',
    name: '2.0625" (PHT/2 pkg 1st stg)',
    boreIn: 2.0625,
    rodDiaIn: null,
    clearanceHePct: 20,
    clearanceCePct: 22,
    mawpPsig: 3975,
    acting: 'DA',
    pocketMaxIn3: 0,
    placeholder: true,
    source: 'Bore + MAWP from ngsgi.com 3306TAA HPGL sheet; clearances assumed',
  },
  // --- PXT 3-stage tandem preset (PLACEHOLDERS sized for ~100 → 1,500 psig gas lift duty)
  {
    id: 'ph-tdm-4.5-s1',
    name: '4.5" 1st stg (PXT 3-stg placeholder)',
    boreIn: 4.5,
    rodDiaIn: null,
    clearanceHePct: 17,
    clearanceCePct: 20,
    mawpPsig: 1200,
    acting: 'DA',
    pocketMaxIn3: 0,
    placeholder: true,
    source: 'Placeholder for PXT 3-stage preset: throw 1, double acting',
  },
  {
    id: 'ph-tdm-4.5-in',
    name: '4.5" 2nd stg tandem inboard (placeholder)',
    boreIn: 4.5,
    rodDiaIn: null,
    clearanceHePct: 17,
    clearanceCePct: 20,
    mawpPsig: 1500,
    acting: 'SA-CE',
    pocketMaxIn3: 0,
    placeholder: true,
    source: 'Placeholder for PXT 3-stage preset: tandem inboard, crank end acting',
  },
  {
    id: 'ph-tdm-2.75-out',
    name: '2.75" 3rd stg tandem outboard (placeholder)',
    boreIn: 2.75,
    rodDiaIn: null,
    clearanceHePct: 20,
    clearanceCePct: 22,
    mawpPsig: 2500,
    acting: 'SA-HE',
    pocketMaxIn3: 0,
    placeholder: true,
    source: 'Placeholder for PXT 3-stage preset: tandem outboard, head end acting',
  },
  ph(2.5, 3000, 20, 22),
  ph(3, 2500, 19, 21),
  ph(3.5, 2000, 18, 21),
  ph(4, 1700, 18, 20),
  ph(4.5, 1500, 17, 20),
  ph(5, 1300, 17, 20),
  ph(5.5, 1150, 16, 19),
  ph(6, 1000, 16, 19),
  ph(6.5, 900, 16, 19),
  ph(7, 800, 15, 18),
  ph(7.5, 750, 15, 18),
  ph(8, 700, 15, 18),
  ph(9, 600, 15, 18),
  ph(10, 500, 15, 18),
];
