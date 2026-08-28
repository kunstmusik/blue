# BlueX7 Modern Renderer — Attribution

The BlueX7 modern renderer is derived from the reviewed `bluex7.orc` produced by
the transient `dx7-emulation` precursor project, imported into this repository
with the project owner's authorization. The exact imported baseline is recorded
in `provenance.json` (SHA-256 `2523caebbae4d28cba134a14b3a9f59d6647ebfaf3728d3dfba87de0f4732dda`,
precursor commit `0482f608cae693516321fa7c3f1ccef31e6ee5e4`). The precursor is
not a runtime or build dependency of blue-electron; only this single imported
source file was used. No ROM voice bank, demo, render, or precursor tooling is
included.

## Incorporated sources

- **Google Mobile Synthesis FM (msfa)** — Copyright 2012 Google Inc. The
  orchestra's reference lookup tables (`giDx7VelTab`, `giDx7ExpScale`,
  `giDx7LevelLut`, `giDx7PegRate`, `giDx7PegLevel`, `giDx7PmsTab`) are
  transcribed exactly from the msfa sources (`dx7note.cc`, `env.cc`,
  `pitchenv.cc`). msfa is licensed under the Apache License, Version 2.0; the
  full license text is in [`LICENSES/Apache-2.0.txt`](LICENSES/Apache-2.0.txt).

- **hether repository (no longer available)** — the amplitude-modulation
  sensitivity values (`giDx7AmsTab` = `{0, 0.238, 0.461, 1.0}`) are a
  reconstruction as cited in the precursor's implementation report. msfa does
  not implement amplitude modulation.

## Reference-only sources (behavioral cross-checks; no expression imported)

- **Dexed** — behavioral cross-check for msfa-oriented DX7 behavior.
- **Russell Pinkston's DX7 emulation patches and the legacy Blue BlueX7
  orchestra lineage** (which itself credits Jeff Harrington's DX72SCO and the
  JSynthLib project) — the behavioral reference for the legacy renderer this
  module replaces. Those credits remain part of the legacy BlueX7 generation
  path; none of that expression is part of the modern module.

## Blue-maintained modifications

Modifications made after the baseline import are owned by the Blue project
(Steven Yi) and are licensed with the blue-electron repository under
GPL-2.0-or-later. Each modification is listed in `provenance.json`
(`blueModifications`) alongside the current source digest maintained by
`pnpm --filter @blue/data generate:blue-x7`.
