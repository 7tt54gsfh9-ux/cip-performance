# CiP Performance

Installable, offline-capable web app (PWA) for estimating reciprocating compressor performance on
NGSG **CiP ("Cylinders in Plane")** frames: PVT, PXT, PHT. Similar in spirit to Ariel's Performance
Program, built on standard GPSA methods.

Live: https://7tt54gsfh9-ux.github.io/cip-performance/

> **Engineering estimate using standard GPSA methods, not OEM-certified.** Verify critical
> applications with CiP engineering. Built-in cylinder data are **placeholders** until real CiP
> cylinder sheets are entered.

## Features

- **Setup**: frame, RPM, 1–3 stages (3 stages unlock when a throw is set to **tandem**), single or tandem per throw, a
  **PXT 3-stage (tandem)** preset (also `?preset=pxt3`), cylinder + stage per throw, double/single acting, end deactivation,
  head-end variable-volume pocket % open, gas SG/k (presets or auto-k), Z method,
  suction P/T, discharge P, interstage cooler outlet temp (default 120 °F), atmospheric pressure (default
  14.4 psia), optional driver HP, efficiencies, alarms.
- **Results**: Ariel-style per-stage table (Ps, Pd, ratio, Ts, Td, Zs/Zd, VE HE/CE, ACFM, MMSCFD, gas HP,
  BHP) plus per-throw gas rod loads (compression / tension / combined, % of frame limit, reversal degrees).
- **Checks** (red = over a limit, amber = near a limit / needs CiP approval): rod load vs frame
  limits, no or short gas-load reversal, total BHP vs frame rating (amber in the "with approval" band),
  RPM vs frame max, discharge temp alarm (default 300 °F), discharge pressure vs cylinder MAWP (amber > 90 %),
  driver HP exceeded, no flow (VE ≤ 0), high stage ratio (> 4.5), stage flow imbalance at equal ratios.
- **What-if**: sweep suction pressure or RPM; small SVG chart of capacity and BHP, red dots where a red flag trips.
- **Cylinders**: built-in library + custom cylinder editor (saved on the device).
- **Runs**: save/load named runs (localStorage), export CSV, print / save as PDF.

Units: psig, °F, MMSCFD at **14.65 psia & 60 °F**.

## Formulas (all in `src/lib/calc.ts`)

| Item | Method |
|---|---|
| Pseudo-criticals | Sutton (1985): Tpc = 169.2 + 349.5·SG − 74.0·SG² (°R); Ppc = 756.8 − 131.0·SG − 3.6·SG² (psia) |
| Z | Dranchuk–Abou-Kassem fit of Standing-Katz (default), Papay (quick), or ideal. Evaluated at suction and at discharge (P, Td) |
| k | User value, or estimate k = 1.30 − 0.25·(SG − 0.55), clamped 1.10–1.32 (rough fit to GPSA Fig. 13-8 near 150 °F) |
| Interstage | Equal ratios r = (Pd/Ps)^(1/n) by default; "Balance flow" iterates interstage pressures (Gauss-Seidel + bisection) until every stage moves the same MMSCFD |
| Ratio | r = Pd,abs / Ps,abs (flange pressures; no valve/pulsation/interstage ΔP) |
| Td | Td = Ts · r^((k−1)/k) (°R, isentropic) |
| VE | GPSA: VE = 100 − r − C·[(Zs/Zd)·r^(1/k) − 1] (%). The "− r" term is GPSA's loss allowance; non-lube subtracts another 5 %. C = end clearance % (HE includes any open pocket volume). Clamped ≥ 0 |
| Areas | A_HE = πD²/4; A_CE = A_HE − πd²/4 (d = rod dia; no tail rod) |
| Displacement | per end: A·stroke·RPM / 1728 (ft³/min) |
| Capacity | MMSCFD = ACFM · 1440 · (Ps/14.65) · (519.67/Ts) / Zs / 10⁶, ACFM = Σ(end displacement × VE) |
| Gas HP | IHP = Ps·Q/229.17 · k/(k−1) · [r^((k−1)/k) − 1] · (Zs+Zd)/(2Zs) |
| BHP | IHP / (η_comp · η_mech), defaults 0.85 × 0.95 ≈ 0.81 overall. Close to GPSA's quick estimate BHP/MMSCFD ≈ 22·r·N·F |
| Rod load (gas) | Ideal indicator cycle over 360° (slider-crank, L/R = 4, isentropic re-expansion/compression with clearance), gauge pressures. For a DA throw the peaks reduce to **C = Pd·A_HE − Ps·A_CE**, **T = Pd·A_CE − Ps·A_HE**. Combined = C + T. An inactive end (SA or deactivated) is held at suction pressure |
| Reversal | Crank degrees spent in the minority load direction (gas load only, no inertia). 0 = no reversal (red); below the min (default 15°) is red |
| Piston speed | 2 · stroke · RPM / 12 (ft/min), info only |

Equal-ratio mode on a multi-stage unit usually won't balance flow. The app reports the
lowest stage flow as unit capacity, sums stage BHP as calculated, and flags the imbalance.
Use **Balance flow** to see how the running unit actually settles.

## Tandem throws

A throw can carry one cylinder or a tandem: an **inboard** (frame-side) and an **outboard** cylinder on one rod,
each assigned its own stage. Working areas (`tandemAreas` in `calc.ts`):

| End | Area |
|---|---|
| Inboard CE (rod side) | A_in − A_rod |
| Inboard HE (neck side) | A_in − A_neck |
| Outboard CE (neck side) | A_out − A_neck |
| Outboard HE (outer head) | A_out |

The tandem neck dia is editable and **assumed equal to the piston rod (1.125")** unless known.

Each tandem end has a reference: **active** (compressing for its stage), **vented** (0 psig), or **held at
stage N suction**. Default arrangement (ASSUMPTION, typical small-frame HP tandem):

- outboard (HP) cylinder: head end active; neck-side crank end at 1st-stage suction
- inboard cylinder: crank end active; neck-side head end at 1st-stage suction

The two active ends compress on opposite strokes, which keeps peak rod load down and gives reversal.
An end that the cylinder library marks as non-acting (SA) falls back to its own stage suction even if set active.
Inactive ends on single cylinders sit at their own stage suction, as before.

Rod load for a tandem sums the gas force of all four faces at each crank degree (gauge pressures; HE faces push toward
the crank, CE faces pull) and checks compression, tension, combined and reversal against the frame limits.
MAWP is checked against the higher of the stage discharge and any referenced pressure.

Preset **PXT 3-stage (tandem)**: throw 1 = 1st stage 4.5" DA; throw 2 = tandem 2nd-stage 4.5" inboard (CE acting)
+ 3rd-stage 2.75" outboard (HE acting), balanced flow. All placeholder cylinders sized for ~100 → 1,500 psig.

Each interstage has its own cooler-outlet temperature (stage 2 and stage 3 suction temps).

## Frame data (`src/data/frames.ts`)

From https://ngsgi.com/pdfs/cip_pxt_pht.pdf:

| Frame | Max RPM | Rated HP | Stroke | Rod | Throws | Tension | Compression | Combined |
|---|---|---|---|---|---|---|---|---|
| PVT | 2200 | 100 (125 w/ approval) | 2.5" | 1.125" | 2 | n/a | 7,500 | n/a |
| PXT | 1800 (2100 w/ approval) | 175 | 3" | 1.125" | 2 | 7,500 | 8,500 | 16,000 |
| PHT | 1800 (2100 w/ approval) | 250 (280 w/ approval) | 3" | 1.125" | 2 | 10,000 | 11,000 | 20,000 |

**Discrepancy:** the PHT/2 package sheet (https://ngsgi.com/compressor-3306taa-hpgl.html) lists
11,500 C / 10,500 T / 20,000 total. The spec-sheet values above are the defaults.

## Adding real cylinder data

Two options:

1. **In the app** (no code): Cylinders → *+ Custom cylinder* (or *Copy & edit* a placeholder).
   Enter bore, rod dia (blank = frame rod), HE/CE clearance %, MAWP, acting type, HE pocket max volume (in³),
   source. Turn off "Still a placeholder" once the values come from a CiP sheet. Saved on that device only.
2. **For everyone** (code): edit `src/data/cylinders.ts`. Change the values, set
   `placeholder: false`, fill in `source`, and keep the `id` stable so saved runs keep working.
   Then rebuild and deploy.

Clearance should be % of that end's swept volume. If a sheet gives clearance volume in in³, use
`100 × Vc / (A × stroke)`.

## Not modeled / stubbed

- Valve & pulsation losses, interstage pressure drop, and cooler ΔP (flange-to-flange pressures used)
- Inertia loads and crosshead pin reversal per OEM method (gas-load-only screen)
- Real CiP clearances, MAWPs, and pocket sizes (placeholders, apart from the 1.75" and 2.0625" bore/MAWP)
- Gas composition input (SG + k only), and liquids/condensation
- Fixed clearance pockets/plugs, and side-stream stages
- Tandem packing/neck leakage and the real CiP tandem end arrangement (defaults assumed)

## Development

```bash
npm install
npm test        # vitest, core calc checks
npm run dev
npm run build
```

Icons: `python3 scripts/make_icons.py` (needs Pillow).

Deploy (GitHub Pages, branch `gh-pages`): build, copy `dist/` to a temp dir, add `.nojekyll`,
`git init`, commit, `git push -f` to `gh-pages`.
