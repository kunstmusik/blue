# BlueX7 Modern Renderer

BlueX7 renders through Blue's maintained modern six-operator FM module.
Preserve supported project voice data across edits and saves. Use the modern
module's synthesis contract and fixtures for audio comparisons.

## Project compatibility

Load supported Java-created voices under the
[XML compatibility contract](../specs/116-xml-compatibility-contracts/contracts/xml-loading.md).
The loader requires a complete voice and rejects unknown attributes, unknown
nodes, and extra envelope points. Saving writes a `parameterList` containing
151 stable automation parameters. Java Blue omits this metadata on save, so a
Java round trip loses Blue 3 parameter IDs, curves, colors, enabled states, and
Track automation assignments.

Copy, paste, library insertion, and Track assignment create a new ownership
boundary and therefore regenerate Parameter IDs while retaining eligible
automation content. Save/reopen within the same owner retains the IDs. SysEx
and whole-voice replacement update the complete modeled voice and fixed
Parameter values as one project mutation; Parameter IDs and automation
metadata remain attached to the owner.

## Synthesis behavior

The renderer uses all 32 DX7 algorithms, six per-operator enable bits, Blue's
p4 pitch and p5 velocity conventions, the note gate derived from p3, saved
post-code, and normal mixer routing. Algorithms 6 and 20 use their corrected
three-carrier topologies. One shared module is emitted per render, while each
arrangement or Track instance receives owner-qualified `chnexport` globals and
an instance-specialized target. Live inline targets capture 136 next-note
controls with `i(gk_...)` at note start. The 15 active controls—feedback, LFO
pitch/amplitude depth, six operator output levels, and six operator enables—are
read directly only on a dirty epoch. The generated target keeps eight
pitch-envelope index/rate snapshots and six output-level baselines as note-local
state; it does not allocate a 126-slot live operator projection. No live
ftable/table publication or Parameter `chnget` path is used.

Output uses the fixed calibration factor
`giBlueX7OutputCalibration = 0.75`. Keep calibration global. The algorithm
corpus must remain finite and below the 0.9 target peak.

The following differences from the legacy implementation are accepted and
documented rather than treated as regressions:

- oscillator and LFO sync take effect at note start;
- LFO state is per note rather than one globally shared oscillator;
- amplitude-modulation sensitivity is an approximation of the hardware path;
- PCM/table behavior is provided by the maintained modern module, not the
  legacy Pinkston tables.

Controls are classified truthfully in the editor. The small active-note set can
affect sounding notes; the remaining next-note controls affect newly started
notes. The binding report does not describe modern synthesized fields as dormant
or stored-only.

## Source and attribution

The maintained source, baseline and current hashes, modification notices, and
source-role classifications are recorded in
`packages/blue-data/resources/blue-x7-modern/provenance.json` and
`ATTRIBUTION.md`. Applicable license text is stored beside them in `LICENSES/`.
ROMs, demo assets, rendered audio, and transient precursor checkout paths are
not distributed with Blue.
