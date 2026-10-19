// CiP ("Cylinders in Plane") frame data.
// Source: NGSG public spec sheet https://ngsgi.com/pdfs/cip_pxt_pht.pdf
//
// DATA DISCREPANCY (PHT): the PHT/2 package sheet
// (https://ngsgi.com/compressor-3306taa-hpgl.html) lists rod loads of
// 11,500 lb compression / 10,500 lb tension / 20,000 lb combined.
// The frame spec sheet lists 11,000 / 10,000 / 20,000. We use the more
// conservative spec-sheet values as defaults until CiP confirms.

export interface FrameSpec {
  id: string;
  name: string;
  maxRpm: number;
  /** RPM allowed only with CiP approval (null if none published). */
  approvedMaxRpm: number | null;
  ratedHp: number;
  /** HP allowed only with CiP approval (null if none published). */
  approvedMaxHp: number | null;
  strokeIn: number;
  rodDiaIn: number;
  throws: number;
  /** Gas rod load limits, lb. null = not published. */
  rodLoadTensionLb: number | null;
  rodLoadCompressionLb: number;
  rodLoadCombinedLb: number | null;
  notes: string[];
}

export const FRAMES: FrameSpec[] = [
  {
    id: 'PVT',
    name: 'PVT',
    maxRpm: 2200,
    approvedMaxRpm: null,
    ratedHp: 100,
    approvedMaxHp: 125,
    strokeIn: 2.5,
    rodDiaIn: 1.125,
    throws: 2,
    rodLoadTensionLb: null,
    rodLoadCompressionLb: 7500,
    rodLoadCombinedLb: null,
    notes: ['100 HP rated; up to 125 HP with CiP approval.', 'Only a compression rod load (7,500 lb) is published.'],
  },
  {
    id: 'PXT',
    name: 'PXT',
    maxRpm: 1800,
    approvedMaxRpm: 2100,
    ratedHp: 175,
    approvedMaxHp: null,
    strokeIn: 3,
    rodDiaIn: 1.125,
    throws: 2,
    rodLoadTensionLb: 7500,
    rodLoadCompressionLb: 8500,
    rodLoadCombinedLb: 16000,
    notes: ['1800 RPM; up to 2100 RPM with CiP approval.'],
  },
  {
    id: 'PHT',
    name: 'PHT',
    maxRpm: 1800,
    approvedMaxRpm: 2100,
    ratedHp: 250,
    approvedMaxHp: 280,
    strokeIn: 3,
    rodDiaIn: 1.125,
    throws: 2,
    rodLoadTensionLb: 10000,
    rodLoadCompressionLb: 11000,
    rodLoadCombinedLb: 20000,
    notes: [
      '1800 RPM; up to 2100 RPM with CiP approval. 250 HP; up to 280 HP with approval.',
      'Package sheet (3306TAA HPGL) lists 11,500 C / 10,500 T / 20,000 total. Spec-sheet values used here.',
    ],
  },
];

export const frameById = (id: string): FrameSpec => FRAMES.find((f) => f.id === id) ?? FRAMES[2];
