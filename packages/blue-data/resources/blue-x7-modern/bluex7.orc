; ============================================================
; bluex7.orc — BlueX7 modern synthesis module (Blue-maintained)
;
; Maintained by the blue-electron project. Adapted from the reviewed
; dx7-emulation precursor renderer (baseline sha256
; 2523caebbae4d28cba134a14b3a9f59d6647ebfaf3728d3dfba87de0f4732dda,
; recorded in provenance.json alongside Blue-owned modifications and
; applicable third-party notices; see also ATTRIBUTION.md).
;
; Incorporated source: reference lookup tables transcribed from the Google
; msfa sources (Apache-2.0; LICENSES/Apache-2.0.txt). Behavioral references
; only: Dexed, legacy Blue/Pinkston DX7 renderers.
;
; Public interface:
;   aOut = bluex7_voice(iMidiNote, iVelocity, iVoice[],
;                       iOperatorMask, iGateSeconds,
;                       kLiveVoice[], kLiveMask, kLiveDirty)
;
;   iMidiNote     MIDI note number; fractional values are supported
;   iVelocity     1..127 (values <= 0 retain the research engine's
;                 fallback velocity of 100)
;   iVoice        i-rate 155-slot unpacked DX7 voice captured by the
;                 instance-specialized host target
;   iOperatorMask bits 0..5 enable operators 1..6; 63 enables all
;                 (initial capture; live enables flow through kLiveMask)
;   iGateSeconds  positive gate duration of the containing note
;   kLiveVoice    k-rate 155-slot active-note projection refreshed by the
;                 host target only when one of its direct globals changes
;   kLiveMask     live operator-enable bits (active-note)
;   kLiveDirty    1 requests one active-note derivation pass; 0 skips it.
;
; The caller owns note-format conversion, output gain, panning/effects,
; mixer routing, and persistent preset state. The generated target supplies
; the 155-value voice directly as an i-rate array; no live transport table is
; needed. Slots 145..154 are reserved for standard voice-name bytes and are
; not read by the synthesis implementation.
;
; Preset layout (unpacked DX7/SysEx order):
;   0..125   six 21-value operator blocks, operator 6 through operator 1
;   126..129 pitch EG rates       130..133 pitch EG levels
;   134      algorithm, 0-based   135 feedback, 0..7
;   136      oscillator sync      137..142 LFO speed/delay/PMD/AMD/sync/wave
;   143      pitch modulation sensitivity
;   144      key transpose, 24 = no transpose
;   145..154 voice name bytes (not read by the synthesis implementation)
;
; Output calibration: giBlueX7OutputCalibration is the single corpus-wide
; gain applied at the module boundary. It is one fixed value for every
; voice; per-voice hidden gain is not used. Blue's host wrapper appends the
; project's post-processing code after this module returns `aout`.
;
; Release safety: the containing note is extended by the worst-case tail
; computed from each operator's release rate (capped at 15 seconds and
; floored at 0.1 s), and the note is turned off once all six envelopes
; freeze or the capped tail elapses, so a mutated release can neither clip
; a tail early nor leave a stuck note alive indefinitely.
;
; The module does not set sr, ksmps, nchnls, or 0dbfs. Reference validation
; uses Csound 7 at sr=44100 and ksmps=64. Behavioral divergences from hardware
; and msfa remain documented in docs/blue-x7-modern-renderer.md.
; ============================================================

; ============================================================
; dx7_tables.udo — DX7 reference lookup tables
; All values transcribed exactly from the msfa (Dexed "MODERN" engine)
; sources in tools/reference/msfa/. Provenance noted per table.
; Run from the repository root.
; ============================================================

; --- velocity curve, 64 entries (msfa dx7note.cc velocity_data).
; Index = velocity>>1; result in OL "units" before the <<4 microstep scale.
giDx7VelTab[] fillarray  \
      0,  70,  86,  97, 106, 114, 121, 126, 132, 138, 142, 148, \
    152, 156, 160, 163, 166, 170, 173, 174, 178, 181, 184, 186, \
    189, 190, 194, 196, 198, 200, 202, 205, 206, 209, 211, 214, \
    216, 218, 220, 222, 224, 225, 227, 229, 230, 232, 233, 235, \
    237, 238, 240, 241, 242, 243, 244, 246, 246, 248, 249, 250, \
    251, 252, 253, 254

; --- keyboard level scaling exponential curve, 33 entries
; (msfa dx7note.cc exp_scale_data); indexed by 3-semitone band.
giDx7ExpScale[] fillarray \
      0,   1,   2,   3,   4,   5,   6,   7,   8,   9,  11,  14, \
     16,  19,  23,  27,  33,  39,  47,  56,  66,  80,  94, 110, \
    126, 142, 158, 174, 190, 206, 222, 238, 250

; --- EG output-level LUT for EG levels 0..19 (msfa env.cc levellut).
; EG level >= 20 maps to 28 + level.
giDx7LevelLut[] fillarray \
      0,   5,   9,  13,  17,  20,  23,  25,  27,  29,  31,  33, \
     35,  37,  39,  41,  42,  43,  45,  46

; --- pitch EG rate table, 100 entries (msfa pitchenv.cc ratetab).
; Per 64-sample block: inc = ratetab[rate] * unit, unit = 2^24/(21.3*sr/ksmps).
giDx7PegRate[] fillarray \
      1,   2,   3,   3,   4,   4,   5,   5,   6,   6,   7,   7, \
      8,   8,   9,   9,  10,  10,  11,  11,  12,  12,  13,  13, \
     14,  14,  15,  16,  16,  17,  18,  18,  19,  20,  21,  22, \
     23,  24,  25,  26,  27,  28,  30,  31,  33,  34,  36,  37, \
     38,  39,  41,  42,  44,  46,  47,  49,  51,  53,  54,  56, \
     58,  60,  62,  64,  66,  68,  70,  72,  74,  76,  79,  82, \
     85,  88,  91,  94,  98, 102, 106, 110, 115, 120, 125, 130, \
    135, 141, 147, 153, 159, 165, 171, 178, 185, 193, 202, 211, \
    232, 243, 254, 255

; --- pitch EG level table, 100 entries (msfa pitchenv.cc pitchtab).
; Units of 1/32 octave: semitones = value * 0.375. Level 50 = no shift.
giDx7PegLevel[] fillarray \
   -128,-116,-104, -95, -85, -76, -68, -61, -56, -52, -49, -46, \
    -43, -41, -39, -37, -35, -33, -32, -31, -30, -29, -28, -27, \
    -26, -25, -24, -23, -22, -21, -20, -19, -18, -17, -16, -15, \
    -14, -13, -12, -11, -10,  -9,  -8,  -7,  -6,  -5,  -4,  -3, \
     -2,  -1,   0,   1,   2,   3,   4,   5,   6,   7,   8,   9, \
     10,  11,  12,  13,  14,  15,  16,  17,  18,  19,  20,  21, \
     22,  23,  24,  25,  26,  27,  28,  29,  30,  31,  32,  33, \
     34,  35,  38,  40,  43,  46,  49,  53,  58,  65,  73,  82, \
     92, 103, 115, 127

; --- pitch modulation sensitivity, 8 entries (msfa dx7note.cc
; pitchmodsenstab). Units of 1/256 octave at full PMD.
giDx7PmsTab[] fillarray 0, 10, 20, 33, 55, 92, 153, 255

; --- amplitude modulation sensitivity per-op scaling, 4 entries.
; RECONSTRUCTED: hether's measured table {0, 0.238, 0.461, 1.0} as cited in
; blue-electron/.tmp-research/BLUEX7_IMPLEMENTATION_REPORT.md (hether repo
; no longer available). msfa does not implement AM.
giDx7AmsTab[] fillarray 0, 0.238, 0.461, 1.0

; --- Blue corpus-wide output calibration ------------------------------------
; One fixed gain for every voice, established against the representative
; render corpus (see modern-render.integration.test.ts): the loudest observed
; uncalibrated corpus peak is 1.1892 at velocity 127, so 0.75 keeps every
; corpus render below the 0dbfs ceiling with headroom. Per-voice hidden gain
; is intentionally not used.
giBlueX7OutputCalibration init 0.75

; ============================================================
; Constants (documented here; used as literals in dx7_voice.udo)
; ============================================================
; Q24 = 2^24 = 16777216        one doubling of gain in EG level units
; EG gain:      g    = 2^(levelQ24/2^24 - 14)
;   where levelQ24 = composed microsteps << 16, composed =
;     (scaleOutLevel(EGlevel) >> 1) << 6 + OLmicro + velMicro - 4256, min 16
; feedback:     kfb  = fb == 0 ? 0 : 2^(fb - 8)      (on 2-tap average)
; op freq detune (ratio): 2^((det-7) * 12606 / 2^24)      ~0.9018 cent/step
; op freq detune (fixed): 2^((det-7) * 13457 / 2^24), det > 7 only
; ratio coarse: r = (coarse == 0 ? 0.5 : coarse) * (1 + fine / 100)
; fixed coarse: f = 10^((coarse & 3) + fine / 100) Hz
; KRS:  qratedelta = (sens * min(31, max(0, note/3 - 7))) >> 3   (per op)
; velocity:  delta = floor((sens * (velTab[vel>>1] - 239) + 7) / 8) << 4
; KLS:  offset = note - bp - 17; 3-semitone bands; linear (g*d*329)>>12,
;       exponential (expScale[min(g,32)]*d*329)>>15; curves 0,3 neg-lin/pos-lin
; LFO speed: sr16 = rate == 0 ? 1 : (165*rate) >> 6;
;            sr16 *= sr16 < 160 ? 11 : 11 + ((sr16-160)>>4);
;            Hz = sr16 * 25190424 / (2^32)   (msfa formula; tops out ~24 Hz;
;            hardware measured reaches ~47 Hz — known msfa divergence)
; LFO delay: a = 99 - delay; a = (16 + (a&15)) << (1 + (a>>4));
;            inc1 = a * unit32, inc2 = max(0x80, a & 0xff80) * unit32,
;            unit32 = 25190424 / (sr/ksmps)   [two-stage ramp 0..1]
; pitch mod: dev_oct = PMD*2.578125 * PmsTab[PMS] * delayEnv * lfo / 2^16
;            (lfo = centered wave, triangle full-scale +-1; sine +-0.5 etc.)

; ============================================================
; Runtime routing metadata
; Only carrier counts are required by the static topology implementation.
; ============================================================
giDx7Carriers[] fillarray 2, 1, 3, 0, 0, 0, 0,
  2, 1, 3, 0, 0, 0, 0,
  2, 1, 4, 0, 0, 0, 0,
  2, 1, 4, 0, 0, 0, 0,
  3, 1, 3, 5, 0, 0, 0,
  3, 1, 3, 5, 0, 0, 0,
  2, 1, 3, 0, 0, 0, 0,
  2, 1, 3, 0, 0, 0, 0,
  2, 1, 3, 0, 0, 0, 0,
  2, 1, 4, 0, 0, 0, 0,
  2, 1, 4, 0, 0, 0, 0,
  2, 1, 3, 0, 0, 0, 0,
  2, 1, 3, 0, 0, 0, 0,
  2, 1, 3, 0, 0, 0, 0,
  2, 1, 3, 0, 0, 0, 0,
  1, 1, 0, 0, 0, 0, 0,
  1, 1, 0, 0, 0, 0, 0,
  1, 1, 0, 0, 0, 0, 0,
  3, 1, 4, 5, 0, 0, 0,
  3, 1, 2, 4, 0, 0, 0,
  4, 1, 2, 4, 5, 0, 0,
  4, 1, 3, 4, 5, 0, 0,
  4, 1, 2, 4, 5, 0, 0,
  5, 1, 2, 3, 4, 5, 0,
  5, 1, 2, 3, 4, 5, 0,
  3, 1, 2, 4, 0, 0, 0,
  3, 1, 2, 4, 0, 0, 0,
  3, 1, 3, 6, 0, 0, 0,
  4, 1, 2, 3, 5, 0, 0,
  4, 1, 2, 3, 6, 0, 0,
  5, 1, 2, 3, 4, 5, 0,
  6, 1, 2, 3, 4, 5, 6

; ============================================================
; dx7_algorithms.udo — static DX7 audio-rate topology renderers
; GENERATED by tools/decode_algorithms.py — DO NOT EDIT BY HAND.
;
; Each UDO hides one fixed algorithm behind the same small interface.
; Normal operators use vectorized a-rate Csound processing. Only the
; feedback strongly connected component uses an explicit sample loop.
; ============================================================

/**
 * Render DX7 algorithm 1.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_01(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp5))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp4))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp3
endop

/**
 * Render DX7 algorithm 2.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_02(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aPh6 = phasor(kD6 * sr, iPh0[5])
  aOp6 = aG6 * sin(6.283185307179586 * (aPh6))
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp5))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp4))
  aOp2 init 0
  kPh2 init iPh0[1]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp2 = aG2[kindx] * sin(6.283185307179586 * (kPh2 + kFbIn))
    aOp2[kindx] = kOp2
    kPh2 += kD2
    kPh2 -= floor(kPh2)
    kFbD2 = kFbD1
    kFbD1 = kOp2
    kindx += 1
  od
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp3
endop

/**
 * Render DX7 algorithm 3.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_03(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp5))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2 + aOp3))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp4
endop

/**
 * Render DX7 algorithm 4.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_04(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  aOp5 init 0
  kPh5 init iPh0[4]
  aOp4 init 0
  kPh4 init iPh0[3]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kOp5 = aG5[kindx] * sin(6.283185307179586 * (kPh5 + kOp6))
    aOp5[kindx] = kOp5
    kPh5 += kD5
    kPh5 -= floor(kPh5)
    kOp4 = aG4[kindx] * sin(6.283185307179586 * (kPh4 + kOp5))
    aOp4[kindx] = kOp4
    kPh4 += kD4
    kPh4 -= floor(kPh4)
    kFbD2 = kFbD1
    kFbD1 = kOp4
    kindx += 1
  od
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2 + aOp3))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp4
endop

/**
 * Render DX7 algorithm 5.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_05(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp4))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp3 + aOp5
endop

/**
 * Render DX7 algorithm 6.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_06(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  aOp5 init 0
  kPh5 init iPh0[4]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kOp5 = aG5[kindx] * sin(6.283185307179586 * (kPh5 + kOp6))
    aOp5[kindx] = kOp5
    kPh5 += kD5
    kPh5 -= floor(kPh5)
    kFbD2 = kFbD1
    kFbD1 = kOp5
    kindx += 1
  od
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp4))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp3 + aOp5
endop

/**
 * Render DX7 algorithm 7.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_07(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp5 + aOp4))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp3
endop

/**
 * Render DX7 algorithm 8.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_08(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aPh6 = phasor(kD6 * sr, iPh0[5])
  aOp6 = aG6 * sin(6.283185307179586 * (aPh6))
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aOp4 init 0
  kPh4 init iPh0[3]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp4 = aG4[kindx] * sin(6.283185307179586 * (kPh4 + kFbIn))
    aOp4[kindx] = kOp4
    kPh4 += kD4
    kPh4 -= floor(kPh4)
    kFbD2 = kFbD1
    kFbD1 = kOp4
    kindx += 1
  od
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp5 + aOp4))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp3
endop

/**
 * Render DX7 algorithm 9.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_09(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aPh6 = phasor(kD6 * sr, iPh0[5])
  aOp6 = aG6 * sin(6.283185307179586 * (aPh6))
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp5 + aOp4))
  aOp2 init 0
  kPh2 init iPh0[1]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp2 = aG2[kindx] * sin(6.283185307179586 * (kPh2 + kFbIn))
    aOp2[kindx] = kOp2
    kPh2 += kD2
    kPh2 -= floor(kPh2)
    kFbD2 = kFbD1
    kFbD1 = kOp2
    kindx += 1
  od
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp3
endop

/**
 * Render DX7 algorithm 10.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_10(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aPh6 = phasor(kD6 * sr, iPh0[5])
  aOp6 = aG6 * sin(6.283185307179586 * (aPh6))
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp6 + aOp5))
  aOp3 init 0
  kPh3 init iPh0[2]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp3 = aG3[kindx] * sin(6.283185307179586 * (kPh3 + kFbIn))
    aOp3[kindx] = kOp3
    kPh3 += kD3
    kPh3 -= floor(kPh3)
    kFbD2 = kFbD1
    kFbD1 = kOp3
    kindx += 1
  od
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2 + aOp3))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp4
endop

/**
 * Render DX7 algorithm 11.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_11(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp6 + aOp5))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2 + aOp3))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp4
endop

/**
 * Render DX7 algorithm 12.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_12(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aPh6 = phasor(kD6 * sr, iPh0[5])
  aOp6 = aG6 * sin(6.283185307179586 * (aPh6))
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp6 + aOp5 + aOp4))
  aOp2 init 0
  kPh2 init iPh0[1]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp2 = aG2[kindx] * sin(6.283185307179586 * (kPh2 + kFbIn))
    aOp2[kindx] = kOp2
    kPh2 += kD2
    kPh2 -= floor(kPh2)
    kFbD2 = kFbD1
    kFbD1 = kOp2
    kindx += 1
  od
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp3
endop

/**
 * Render DX7 algorithm 13.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_13(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp6 + aOp5 + aOp4))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp3
endop

/**
 * Render DX7 algorithm 14.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_14(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp6 + aOp5))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp4))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp3
endop

/**
 * Render DX7 algorithm 15.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_15(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aPh6 = phasor(kD6 * sr, iPh0[5])
  aOp6 = aG6 * sin(6.283185307179586 * (aPh6))
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp6 + aOp5))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp4))
  aOp2 init 0
  kPh2 init iPh0[1]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp2 = aG2[kindx] * sin(6.283185307179586 * (kPh2 + kFbIn))
    aOp2[kindx] = kOp2
    kPh2 += kD2
    kPh2 -= floor(kPh2)
    kFbD2 = kFbD1
    kFbD1 = kOp2
    kindx += 1
  od
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp3
endop

/**
 * Render DX7 algorithm 16.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_16(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp4))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp5 + aOp3 + aOp2))
  xout aOp1
endop

/**
 * Render DX7 algorithm 17.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_17(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aPh6 = phasor(kD6 * sr, iPh0[5])
  aOp6 = aG6 * sin(6.283185307179586 * (aPh6))
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp4))
  aOp2 init 0
  kPh2 init iPh0[1]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp2 = aG2[kindx] * sin(6.283185307179586 * (kPh2 + kFbIn))
    aOp2[kindx] = kOp2
    kPh2 += kD2
    kPh2 -= floor(kPh2)
    kFbD2 = kFbD1
    kFbD1 = kOp2
    kindx += 1
  od
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp5 + aOp3 + aOp2))
  xout aOp1
endop

/**
 * Render DX7 algorithm 18.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_18(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aPh6 = phasor(kD6 * sr, iPh0[5])
  aOp6 = aG6 * sin(6.283185307179586 * (aPh6))
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp5))
  aOp3 init 0
  kPh3 init iPh0[2]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp3 = aG3[kindx] * sin(6.283185307179586 * (kPh3 + kFbIn))
    aOp3[kindx] = kOp3
    kPh3 += kD3
    kPh3 -= floor(kPh3)
    kFbD2 = kFbD1
    kFbD1 = kOp3
    kindx += 1
  od
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp4 + aOp3 + aOp2))
  xout aOp1
endop

/**
 * Render DX7 algorithm 19.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_19(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp6))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2 + aOp3))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp4 + aOp5
endop

/**
 * Render DX7 algorithm 20.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_20(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aPh6 = phasor(kD6 * sr, iPh0[5])
  aOp6 = aG6 * sin(6.283185307179586 * (aPh6))
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp6 + aOp5))
  aOp3 init 0
  kPh3 init iPh0[2]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp3 = aG3[kindx] * sin(6.283185307179586 * (kPh3 + kFbIn))
    aOp3[kindx] = kOp3
    kPh3 += kD3
    kPh3 -= floor(kPh3)
    kFbD2 = kFbD1
    kFbD1 = kOp3
    kindx += 1
  od
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2 + aOp3))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp3))
  xout aOp1 + aOp2 + aOp4
endop

/**
 * Render DX7 algorithm 21.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_21(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aPh6 = phasor(kD6 * sr, iPh0[5])
  aOp6 = aG6 * sin(6.283185307179586 * (aPh6))
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp6))
  aOp3 init 0
  kPh3 init iPh0[2]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp3 = aG3[kindx] * sin(6.283185307179586 * (kPh3 + kFbIn))
    aOp3[kindx] = kOp3
    kPh3 += kD3
    kPh3 -= floor(kPh3)
    kFbD2 = kFbD1
    kFbD1 = kOp3
    kindx += 1
  od
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2 + aOp3))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp3))
  xout aOp1 + aOp2 + aOp4 + aOp5
endop

/**
 * Render DX7 algorithm 22.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_22(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp6))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp6))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp3 + aOp4 + aOp5
endop

/**
 * Render DX7 algorithm 23.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_23(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp6))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2 + aOp3))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1))
  xout aOp1 + aOp2 + aOp4 + aOp5
endop

/**
 * Render DX7 algorithm 24.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_24(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp6))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp6))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1))
  xout aOp1 + aOp2 + aOp3 + aOp4 + aOp5
endop

/**
 * Render DX7 algorithm 25.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_25(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp6))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1))
  xout aOp1 + aOp2 + aOp3 + aOp4 + aOp5
endop

/**
 * Render DX7 algorithm 26.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_26(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp6 + aOp5))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2 + aOp3))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1))
  xout aOp1 + aOp2 + aOp4
endop

/**
 * Render DX7 algorithm 27.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_27(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aPh6 = phasor(kD6 * sr, iPh0[5])
  aOp6 = aG6 * sin(6.283185307179586 * (aPh6))
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp6 + aOp5))
  aOp3 init 0
  kPh3 init iPh0[2]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp3 = aG3[kindx] * sin(6.283185307179586 * (kPh3 + kFbIn))
    aOp3[kindx] = kOp3
    kPh3 += kD3
    kPh3 -= floor(kPh3)
    kFbD2 = kFbD1
    kFbD1 = kOp3
    kindx += 1
  od
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2 + aOp3))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1))
  xout aOp1 + aOp2 + aOp4
endop

/**
 * Render DX7 algorithm 28.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_28(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aPh6 = phasor(kD6 * sr, iPh0[5])
  aOp6 = aG6 * sin(6.283185307179586 * (aPh6))
  aOp5 init 0
  kPh5 init iPh0[4]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp5 = aG5[kindx] * sin(6.283185307179586 * (kPh5 + kFbIn))
    aOp5[kindx] = kOp5
    kPh5 += kD5
    kPh5 -= floor(kPh5)
    kFbD2 = kFbD1
    kFbD1 = kOp5
    kindx += 1
  od
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp5))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp4))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1 + aOp2))
  xout aOp1 + aOp3 + aOp6
endop

/**
 * Render DX7 algorithm 29.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_29(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp4))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1))
  xout aOp1 + aOp2 + aOp3 + aOp5
endop

/**
 * Render DX7 algorithm 30.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_30(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aPh6 = phasor(kD6 * sr, iPh0[5])
  aOp6 = aG6 * sin(6.283185307179586 * (aPh6))
  aOp5 init 0
  kPh5 init iPh0[4]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp5 = aG5[kindx] * sin(6.283185307179586 * (kPh5 + kFbIn))
    aOp5[kindx] = kOp5
    kPh5 += kD5
    kPh5 -= floor(kPh5)
    kFbD2 = kFbD1
    kFbD1 = kOp5
    kindx += 1
  od
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4 + aOp5))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3 + aOp4))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1))
  xout aOp1 + aOp2 + aOp3 + aOp6
endop

/**
 * Render DX7 algorithm 31.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_31(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5 + aOp6))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1))
  xout aOp1 + aOp2 + aOp3 + aOp4 + aOp5
endop

/**
 * Render DX7 algorithm 32.
 *
 * Uses native a-rate processing outside the feedback cycle and an
 * explicit sample loop only where one-sample feedback requires it.
 *
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_algo_32(kGain[], kDph[], iPh0[], kFbAmt):a
  ; Match msfa gain[0]/gain[1] behavior by interpolating each operator
  ; gain across the current audio block. Feedback loops index the ramp at
  ; the current sample; vectorized operators consume it directly.
  aG1 interp kGain[0]
  aG2 interp kGain[1]
  aG3 interp kGain[2]
  aG4 interp kGain[3]
  aG5 interp kGain[4]
  aG6 interp kGain[5]
  kD1 = kDph[0]
  kD2 = kDph[1]
  kD3 = kDph[2]
  kD4 = kDph[3]
  kD5 = kDph[4]
  kD6 = kDph[5]
  aOp6 init 0
  kPh6 init iPh0[5]
  kFbD1 init 0
  kFbD2 init 0
  kindx = 0
  while kindx < ksmps do
    kFbIn = kFbAmt * (kFbD1 + kFbD2) * 0.5
    kOp6 = aG6[kindx] * sin(6.283185307179586 * (kPh6 + kFbIn))
    aOp6[kindx] = kOp6
    kPh6 += kD6
    kPh6 -= floor(kPh6)
    kFbD2 = kFbD1
    kFbD1 = kOp6
    kindx += 1
  od
  aPh5 = phasor(kD5 * sr, iPh0[4])
  aOp5 = aG5 * sin(6.283185307179586 * (aPh5))
  aPh4 = phasor(kD4 * sr, iPh0[3])
  aOp4 = aG4 * sin(6.283185307179586 * (aPh4))
  aPh3 = phasor(kD3 * sr, iPh0[2])
  aOp3 = aG3 * sin(6.283185307179586 * (aPh3))
  aPh2 = phasor(kD2 * sr, iPh0[1])
  aOp2 = aG2 * sin(6.283185307179586 * (aPh2))
  aPh1 = phasor(kD1 * sr, iPh0[0])
  aOp1 = aG1 * sin(6.283185307179586 * (aPh1))
  xout aOp1 + aOp2 + aOp3 + aOp4 + aOp5 + aOp6
endop

/**
 * Render one of the 32 DX7 algorithms selected at note initialization.
 *
 * This is the topology module's sole interface used by bluex7_voice.
 * Only the selected static renderer is initialized and performed.
 *
 * @param iAlgo Zero-based DX7 algorithm index
 * @param kGain Per-operator linear gains, op1 through op6
 * @param kDph Per-operator phase increments in cycles per sample
 * @param iPh0 Per-operator initial phases in cycles
 * @param kFbAmt Feedback amount applied to the two-sample average
 * @return Unnormalized sum of carrier outputs
 */
opcode dx7_render_algorithm(iAlgo, kGain[], kDph[], iPh0[], kFbAmt):a
  aOut init 0
  if iAlgo == 0 then
    aOut = dx7_algo_01(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 1 then
    aOut = dx7_algo_02(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 2 then
    aOut = dx7_algo_03(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 3 then
    aOut = dx7_algo_04(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 4 then
    aOut = dx7_algo_05(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 5 then
    aOut = dx7_algo_06(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 6 then
    aOut = dx7_algo_07(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 7 then
    aOut = dx7_algo_08(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 8 then
    aOut = dx7_algo_09(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 9 then
    aOut = dx7_algo_10(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 10 then
    aOut = dx7_algo_11(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 11 then
    aOut = dx7_algo_12(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 12 then
    aOut = dx7_algo_13(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 13 then
    aOut = dx7_algo_14(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 14 then
    aOut = dx7_algo_15(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 15 then
    aOut = dx7_algo_16(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 16 then
    aOut = dx7_algo_17(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 17 then
    aOut = dx7_algo_18(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 18 then
    aOut = dx7_algo_19(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 19 then
    aOut = dx7_algo_20(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 20 then
    aOut = dx7_algo_21(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 21 then
    aOut = dx7_algo_22(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 22 then
    aOut = dx7_algo_23(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 23 then
    aOut = dx7_algo_24(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 24 then
    aOut = dx7_algo_25(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 25 then
    aOut = dx7_algo_26(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 26 then
    aOut = dx7_algo_27(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 27 then
    aOut = dx7_algo_28(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 28 then
    aOut = dx7_algo_29(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 29 then
    aOut = dx7_algo_30(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 30 then
    aOut = dx7_algo_31(kGain, kDph, iPh0, kFbAmt)
  elseif iAlgo == 31 then
    aOut = dx7_algo_32(kGain, kDph, iPh0, kFbAmt)
  endif
  xout aOut
endop

/**
 * Render one BlueX7 note from a direct i-rate DX7-layout voice with live
 * active-note adaptation (Blue Spec 092).
 *
 * A compatibility host wrapper may refresh kLiveVoice from direct parameter
 * globals only when a domain-local change guard fires. When kLiveDirty is 1,
 * this UDO re-derives the active fields supplied by that wrapper without
 * replaying completed envelope stages. The production generated inline target
 * uses a smaller scalar active set (feedback, LFO depths, output levels, and
 * enables) and keeps all other catalog fields as note-start snapshots; this
 * UDO remains the shared comparison/fallback implementation for broader live
 * descriptor sets.
 *
 * A static wrapper leaves kLiveDirty at 0, which reproduces the original
 * init-time-only behavior exactly.
 *
 * This UDO extends the containing note for the preset's release tail and may
 * turn that note off after all six envelopes freeze. The containing
 * instrument duration must describe the same gate interval as iGateSeconds.
 */
opcode bluex7_voice(iMidiNote, iVelocity, iVoice[], iOperatorMask, iGateSeconds, kLiveVoice[], kLiveMask, kLiveDirty):a
  iNote = iMidiNote
  iVel = (iVelocity <= 0 ? 100 : min:i(iVelocity, 127))
  iOpMask = int(iOperatorMask)
  iOpMask = (iOpMask < 0 ? 0 : (iOpMask > 63 ? 63 : iOpMask))
  iDuration = abs(iGateSeconds)

  ; ---------------- common voice parameters ----------------------
  iAlgo    = iVoice[134]
  iFbRaw   = iVoice[135]
  iLfoSpd  = iVoice[137]
  iLfoDly  = iVoice[138]
  iPmd     = iVoice[139]
  iAmd      = iVoice[140]
  iLfoSync = iVoice[141]
  iLfoWave = iVoice[142]
  iPms     = iVoice[143]
  iKt      = iVoice[144] - 24          ; key transpose, semitones
  iNoteT   = iNote + iKt                    ; transposed note drives
                                            ; frequency, KLS and KRS

  ; velocity contribution in OL units (dx7note.cc ScaleVelocity)
  iVelVal  = giDx7VelTab[int(iVel / 2)] - 239

  ; ---------------- k-rate mirrors of i-rate globals -------------
  ; The state machines need k-indexable lookup tables. The gi tables are
  ; constant for the whole performance, so the copies run once per note;
  ; re-copying six arrays every k-cycle is measurable interpreter work.
  kMirrorInit init 0
  if kMirrorInit == 0 then
    kLevLut[] = giDx7LevelLut
    kPegLvlT[] = giDx7PegLevel
    kPegRateT[] = giDx7PegRate
    kExpScale[] = giDx7ExpScale
    kPmsTab[] = giDx7PmsTab
    kAmsTab[] = giDx7AmsTab
    kMirrorInit = 1
  endif

  ; ---------------- per-op parameters ----------------------------
  ; read at i-rate into i-arrays, then mirrored to k-arrays for the
  ; k-rate state machines and the sample loop.
  iModeA[]  init 6
  iFbaseA[] init 6        ; base frequency Hz (before detune/PEG/LFO)
  iDetFA[]  init 6        ; detune multiplier
  iOlmA[]   init 6        ; composed OL microsteps (OL + KLS + velocity)
  iOlmVelA[] init 6       ; velocity contribution to composed OL
  iOlmScaleA[] init 6     ; keyboard-level-scaling contribution in OL units
  iQrsA[]   init 6        ; KRS delta in qrate units
  iAmsIA[]  init 6
  iEnabledA[] init 6
  kMode[]   init 6
  kFbase[]  init 6
  kDetF[]   init 6
  kOlm[]    init 6
  kQrs[]    init 6
  kAmsI[]   init 6
  kEnabled[] init 6
  ipmsi     = (iPms > 7 ? 7 : iPms)
  iPmsVal   = giDx7PmsTab[ipmsi]
  iAmdPeak  = 52.75 * (exp(0.0429 * iAmd) - 1) / (exp(0.0429 * 99) - 1)
  ; live mirrors of the i-rate LFO/modulation values (identical until the
  ; wrapper publishes new channel values)
  kPmsVal   = iPmsVal
  kAmdPeak  = iAmdPeak

  iop = 0
  while iop < 6 do
    io = 105 - iop * 21              ; op1 block lives at 105..125
    imode   = iVoice[io + 17]
    icoarse = iVoice[io + 18]
    ifine   = iVoice[io + 19]
    idet    = iVoice[io + 20]             ; raw 0..14, 7 = center
    ; base frequency (dx7note.cc osc_freq, converted to Hz)
    if imode == 0 then
      iratio = (icoarse == 0 ? 0.5 : icoarse) * (1 + ifine / 100)
      iFbaseA[iop] = cpsmidinn(iNoteT) * iratio
      iDetFA[iop]  = 2 ^ ((idet - 7) * 12606 / 16777216.0)
    else
      iFbaseA[iop] = 10 ^ ((icoarse % 4) + ifine / 100)
      iDetFA[iop]  = (idet > 7 ? 2 ^ ((idet - 7) * 13457 / 16777216.0) : 1)
    endif
    ; keyboard level scaling (dx7note.cc ScaleLevel/ScaleCurve)
    ibp    = iVoice[io + 8]
    idl    = iVoice[io + 9]
    idr    = iVoice[io + 10]
    icl    = iVoice[io + 11]
    icr    = iVoice[io + 12]
    ioff   = iNoteT - ibp - 17
    igroup = (ioff >= 0 ? int(ioff / 3) : int(-ioff / 3))
    idepth = (ioff >= 0 ? idr : idl)
    icurve = (ioff >= 0 ? icr : icl)
    if icurve == 0 || icurve == 3 then
      iscale = int(igroup * idepth * 329 / 4096)
    else
      igc    = (igroup > 32 ? 32 : igroup)
      iscale = int(giDx7ExpScale[igc] * idepth * 329 / 32768)
    endif
    iscale = (icurve < 2 ? -iscale : iscale)
    ; composed output level in microsteps (dx7note.cc init)
    isol  = iVoice[io + 16]
    isol  = (isol >= 20 ? 28 + isol : giDx7LevelLut[isol])
    iol   = isol + iscale
    iol   = (iol > 127 ? 127 : iol)
    iol   = iol * 32
    ikvs  = iVoice[io + 15]
    ivelm = floor((ikvs * iVelVal + 7) / 8) * 16
    iOlmVelA[iop] = ivelm
    ivelm += iol
    iOlmScaleA[iop] = iscale
    iOlmA[iop] = (ivelm < 0 ? 0 : ivelm)
    iamsx = iVoice[io + 14]
    iamsx = (iamsx > 3 ? 3 : iamsx)
    iAmsIA[iop] = giDx7AmsTab[iamsx]
    ; keyboard rate scaling (dx7note.cc ScaleRate)
    ikrs_s = iVoice[io + 13]
    ixr    = int(iNoteT / 3) - 7
    ixr    = (ixr < 0 ? 0 : ixr)
    ixr    = (ixr > 31 ? 31 : ixr)
    iQrsA[iop] = int(ikrs_s * ixr / 8)
    iModeA[iop] = imode
    iEnabledA[iop] = int(iOpMask / (2 ^ iop)) % 2
    iop += 1
  od
  kMode  = iModeA
  kFbase = iFbaseA
  kDetF  = iDetFA
  kOlm   = iOlmA
  kQrs   = iQrsA
  kAmsI  = iAmsIA
  kEnabled = iEnabledA

  ; ---------------- routing metadata -----------------------------
  iCb      = iAlgo * 7
  kFbAmt   = (iFbRaw == 0 ? 0 : 2 ^ (iFbRaw - 8))
  iNcar     = giDx7Carriers[iCb]
  iNcar     = (iNcar < 1 ? 1 : iNcar)
  iOutScale = 0.5 / iNcar

  ; ---------------- amp EG state (per op; msfa env.cc) -----------
  ; kEgLevel in Q16 microsteps (<<16), exactly like msfa.
  iEgLevelA[] init 6
  iEgTargetA[] init 6
  iEgIncA[]   init 6
  iEgRisA[]   init 6
  kEgLevel[]  init 6
  kEgTarget[] init 6
  kEgInc[]    init 6
  kEgIx[]     init 6
  kEgRis[]    init 6
  iEgLA[]     init 24
  iEgRA[]     init 24
  kEgL[]      init 24
  kEgR[]      init 24
  iTailA[]    init 6
  iop = 0
  while iop < 6 do
    io = 105 - iop * 21
    iseg = 0
    while iseg < 4 do
      iEgLA[iop * 4 + iseg] = iVoice[io + 4 + iseg]
      iEgRA[iop * 4 + iseg] = iVoice[io + iseg]
      iseg += 1
    od
    ; hardware truth: EG starts at the composed L4 level (see header)
    il4   = iEgLA[iop * 4 + 3]
    isol4 = (il4 >= 20 ? 28 + il4 : giDx7LevelLut[il4])
    icomp = int(isol4 / 2) * 64 + iOlmA[iop] - 4256
    icomp = (icomp < 16 ? 16 : icomp)
    iEgLevelA[iop] = icomp * 65536
    il1   = iEgLA[iop * 4]
    isol1 = (il1 >= 20 ? 28 + il1 : giDx7LevelLut[il1])
    icomp = int(isol1 / 2) * 64 + iOlmA[iop] - 4256
    icomp = (icomp < 16 ? 16 : icomp)
    iEgTargetA[iop] = icomp * 65536
    iEgRisA[iop]    = (iEgTargetA[iop] > iEgLevelA[iop] ? 1 : 0)
    iqr  = int(iEgRA[iop * 4] * 41 / 64) + iQrsA[iop]
    iqr  = (iqr > 63 ? 63 : iqr)
    iEgIncA[iop] = (4 + (iqr % 4)) * 2 ^ (8 + int(iqr / 4))
    ; worst-case tail after key-off: full-scale fall at R4 (+KRS)
    iqr4  = int(iEgRA[iop * 4 + 3] * 41 / 64) + iQrsA[iop]
    iqr4  = (iqr4 > 63 ? 63 : iqr4)
    iinc4 = (4 + (iqr4 % 4)) * 2 ^ (8 + int(iqr4 / 4))
    iTailA[iop] = (17 * 16777216 / iinc4) * ksmps / sr
    iop += 1
  od
  kEgL = iEgLA
  kEgR = iEgRA
  iTailCap = 0.1
  iop = 0
  while iop < 6 do
    iTailCap = (iTailA[iop] > iTailCap ? iTailA[iop] : iTailCap)
    iop += 1
  od
  iTailCap = (iTailCap > 15 ? 15 : iTailCap)
  xtratim iTailCap + 0.05   ; extend the containing note for release

  ; ---------------- pitch EG state (pitchenv.cc) -----------------
  iPegL4    = giDx7PegLevel[iVoice[133]]
  iPegR4    = giDx7PegRate[iVoice[129]]
  iPegL0   = iPegL4 * 524288
  iPegT0   = giDx7PegLevel[iVoice[130]] * 524288
  kPegLevel init iPegL0                                ; start at L4
  kPegIx    init 0
  kPegTgt   init iPegT0
  kPegRis   init (iPegT0 > iPegL0 ? 1 : 0)
  kPegInc   init giDx7PegRate[iVoice[126]] * ksmps * 16777216 / (21.3 * sr)
  kPegAdvance init 0
  kPegL4Live  = iPegL4
  kPegR4Live  = iPegR4

  ; ---------------- LFO state (per-note; lfo.cc port) ------------
  isr16  = (iLfoSpd == 0 ? 1 : int(iLfoSpd * 165 / 64))
  isr16  = (isr16 < 160 ? isr16 * 11 : isr16 * (11 + int((isr16 - 160) / 16)))
  iLfoHz = isr16 * 25190424 / 4294967296.0
  iPh0     = frac(timek:i() * iLfoHz / kr)
  kLfoPh init (iLfoSync == 1 ? 0.5 - 0.0000001 : iPh0)
  kDlyState init 0
  kDelayEnv init (iLfoDly == 0 ? 1 : 0)
  ia      = 99 - iLfoDly
  ia      = (16 + (ia % 16)) * 2 ^ (1 + int(ia / 16))
  iUnit32 = ksmps * 25190424 / sr
  ia2     = ia - (ia % 128)
  ia2     = (ia2 < 128 ? 128 : ia2)
  iDInc1  = ia * iUnit32
  iDInc2  = ia2 * iUnit32
  kDInc   = iDInc1
  kSAndH  init 0
  kLfoHz    = iLfoHz
  kLfoWave  = iLfoWave
  kPmd      = iPmd
  kDlyInc1  = iDInc1
  kDlyInc2  = iDInc2

  ; ---------------- oscillator initial phase ----------------------
  iPh0A[] init 6
  iop = 0
  while iop < 6 do
    ; Per-note Csound instances have historically started at phase zero.
    ; Preserve that approximation for both key-sync settings.
    iPh0A[iop] = 0
    iop += 1
  od

  ; ---------------- k-rate working state --------------------------
  kGain[]   init 6
  kPreviousGain[] init 6
  kDph[]    init 6
  kGate     init 1
  kReleased init 0
  kDidInit  init 0
  kAudioActive init 1


  ; ================================================================
  ; per-k-cycle update
  ; ================================================================
  ; one-time k-state initialization (k-guarded: whole-array copies of
  ; mutable state must not re-run every pass)
  if kDidInit == 0 then
    kEgLevel  = iEgLevelA
    kEgTarget = iEgTargetA
    kEgInc    = iEgIncA
    kEgRis    = iEgRisA
    kDidInit  = 1
  endif

  ; ----------------------------------------------------------------
  ; live active-note adaptation (kLiveDirty == 1)
  ;
  ; Re-derives the compatibility target's active-note state from kLiveVoice
  ; without replaying completed envelope stages. Next-note fields are
  ; intentionally not read here: notes captured them at initialization from
  ; the direct i-rate voice.
  ; ----------------------------------------------------------------
  if kLiveDirty == 1 then
    kNoteT = iNote + (kLiveVoice[144] - 24)

    kfbr = kLiveVoice[135]
    kFbAmt = (kfbr == 0 ? 0 : 2 ^ (kfbr - 8))

    klsp = kLiveVoice[137]
    kisr16 = (klsp == 0 ? 1 : int(klsp * 165 / 64))
    kisr16 = (kisr16 < 160 ? kisr16 * 11 : kisr16 * (11 + int((kisr16 - 160) / 16)))
    kLfoHz = kisr16 * 25190424 / 4294967296.0
    kld = kLiveVoice[138]
    kia = 99 - kld
    kia = (16 + (kia % 16)) * 2 ^ (1 + int(kia / 16))
    kia2 = kia - (kia % 128)
    kia2 = (kia2 < 128 ? 128 : kia2)
    kDlyInc1 = kia * iUnit32
    kDlyInc2 = kia2 * iUnit32
    kPmd = kLiveVoice[139]
    kamdv = kLiveVoice[140]
    kAmdPeak = 52.75 * (exp(0.0429 * kamdv) - 1) / (exp(0.0429 * 99) - 1)
    kLfoWave = kLiveVoice[142]
    kpms = kLiveVoice[143]
    kpms = (kpms > 7 ? 7 : kpms)
    kPmsVal = kPmsTab[kpms]
    kPegL4Live = kPegLvlT[kLiveVoice[133]]
    kPegR4Live = kPegRateT[kLiveVoice[129]]

    kop = 0
    while kop < 6 do
      kio = 105 - kop * 21
      ; operator envelope rates/levels for current and future stages
      kseg = 0
      while kseg < 4 do
        kEgR[kop * 4 + kseg] = kLiveVoice[kio + kseg]
        kEgL[kop * 4 + kseg] = kLiveVoice[kio + 4 + kseg]
        kseg += 1
      od
      ; oscillator mode, frequency, detune
      kmodeL = kLiveVoice[kio + 17]
      kcoarse = kLiveVoice[kio + 18]
      kfine = kLiveVoice[kio + 19]
      kdet = kLiveVoice[kio + 20]
      if kmodeL == 0 then
        kratio = (kcoarse == 0 ? 0.5 : kcoarse) * (1 + kfine / 100)
        kFbase[kop] = cpsmidinn(kNoteT) * kratio
        kDetF[kop] = 2 ^ ((kdet - 7) * 12606 / 16777216.0)
      else
        kFbase[kop] = 10 ^ ((kcoarse % 4) + kfine / 100)
        kDetF[kop] = (kdet > 7 ? 2 ^ ((kdet - 7) * 13457 / 16777216.0) : 1)
      endif
      kMode[kop] = kmodeL
      ; keyboard level scaling into the composed output level
      kbp = kLiveVoice[kio + 8]
      kdl = kLiveVoice[kio + 9]
      kdr = kLiveVoice[kio + 10]
      kcl = kLiveVoice[kio + 11]
      kcr = kLiveVoice[kio + 12]
      koff = kNoteT - kbp - 17
      kgroup = (koff >= 0 ? int(koff / 3) : int(-koff / 3))
      kdepth = (koff >= 0 ? kdr : kdl)
      kcurve = (koff >= 0 ? kcr : kcl)
      if kcurve == 0 || kcurve == 3 then
        kscaleL = int(kgroup * kdepth * 329 / 4096)
      else
        kgc = (kgroup > 32 ? 32 : kgroup)
        kscaleL = int(kExpScale[kgc] * kdepth * 329 / 32768)
      endif
      kscaleL = (kcurve < 2 ? -kscaleL : kscaleL)
      kol = kLiveVoice[kio + 16]
      ksol = (kol >= 20 ? 28 + kol : kLevLut[kol])
      kiol = ksol + kscaleL
      kiol = (kiol > 127 ? 127 : kiol)
      kiol = kiol * 32
      kvs = kLiveVoice[kio + 15]
      kvelm = floor((kvs * iVelVal + 7) / 8) * 16
      kvelm += kiol
       ; Preserve the envelope's relative stage progress while moving the
       ; composed output level. kEgLevel is stored in the same 16-bit
       ; fractional units as kOlm, so shifting it here makes an active
       ; output-level edit audible immediately instead of waiting for the
       ; next envelope target to converge.
       kOldOlm = kOlm[kop]
       kOlm[kop] = (kvelm < 0 ? 0 : kvelm)
       kEgLevel[kop] += (kOlm[kop] - kOldOlm) * 65536
       kEgLevel[kop] = (kEgLevel[kop] < 16 * 65536 ? 16 * 65536 : kEgLevel[kop])
       kEgLevel[kop] = (kEgLevel[kop] > 285212672 ? 285212672 : kEgLevel[kop])
      ; amplitude modulation sensitivity
      kamsx = kLiveVoice[kio + 14]
      kamsx = (kamsx > 3 ? 3 : kamsx)
      kAmsI[kop] = kAmsTab[kamsx]
      ; keyboard rate scaling
      kkrs = kLiveVoice[kio + 13]
      kxr = int(kNoteT / 3) - 7
      kxr = (kxr < 0 ? 0 : kxr)
      kxr = (kxr > 31 ? 31 : kxr)
      kQrs[kop] = int(kkrs * kxr / 8)
      ; operator enable bit
      kEnabled[kop] = int(kLiveMask / (2 ^ kop)) % 2
      ; refresh the current stage's target and rate without replaying
      ; completed stages (kEgIx untouched)
      if kEgIx[kop] < 4 then
        kstage = kEgIx[kop]
        klv = kEgL[kop * 4 + kstage]
        ksolS = (klv >= 20 ? 28 + klv : kLevLut[klv])
        kcompS = int(ksolS / 2) * 64 + kOlm[kop] - 4256
        kcompS = (kcompS < 16 ? 16 : kcompS)
        kEgTarget[kop] = kcompS * 65536
        kEgRis[kop] = (kEgTarget[kop] > kEgLevel[kop] ? 1 : 0)
        kqrS = int(kEgR[kop * 4 + kstage] * 41 / 64) + kQrs[kop]
        kqrS = (kqrS > 63 ? 63 : kqrS)
        kEgInc[kop] = (4 + (kqrS % 4)) * 2 ^ (8 + int(kqrS / 4))
      endif
      kop += 1
    od

    ; pitch EG current stage target/rate without stage replay
    if kPegIx < 4 then
      kPegTgt = kPegLvlT[kLiveVoice[130 + kPegIx]] * 524288
      kPegRis = (kPegTgt > kPegLevel ? 1 : 0)
      kPegInc = kPegRateT[kLiveVoice[126 + kPegIx]] * ksmps * 16777216 / (21.3 * sr)
    endif
  endif

  kRel = release:k()        ; 1 once the containing note enters release
  if kGate == 1 && kRel == 1 then
    kGate = 0
  endif

  if kGate == 0 && kReleased == 0 then
    kReleased = 1
    kop = 0
    while kop < 6 do
      kEgIx[kop] = 3
      kl4   = kEgL[kop * 4 + 3]
      ksol4 = (kl4 >= 20 ? 28 + kl4 : kLevLut[kl4])
      kcomp = int(ksol4 / 2) * 64 + kOlm[kop] - 4256
      kcomp = (kcomp < 16 ? 16 : kcomp)
      kEgTarget[kop] = kcomp * 65536
      kEgRis[kop] = (kEgTarget[kop] > kEgLevel[kop] ? 1 : 0)
      kqr  = int(kEgR[kop * 4 + 3] * 41 / 64) + kQrs[kop]
      kqr  = (kqr > 63 ? 63 : kqr)
      kEgInc[kop] = (4 + (kqr % 4)) * 2 ^ (8 + int(kqr / 4))
      kop += 1
    od
    kPegIx   = 3
    kPegTgt  = kPegL4Live * 524288
    kPegRis  = (kPegTgt > kPegLevel ? 1 : 0)
    kPegInc  = kPegR4Live * ksmps * 16777216 / (21.3 * sr)
  endif

  ; --- LFO wave + delay ramp (updated per block, like msfa) ------
  kWrapped = (kLfoPh + kLfoHz / kr >= 1 ? 1 : 0)
  kLfoPh  += kLfoHz / kr
  kLfoPh  -= floor(kLfoPh)
  if kLfoWave == 0 then
    kLfoN = (kLfoPh < 0.5 ? 4 * kLfoPh - 1 : 3 - 4 * kLfoPh)
  elseif kLfoWave == 1 then
    kLfoN = 0.5 - kLfoPh
  elseif kLfoWave == 2 then
    kLfoN = kLfoPh - 0.5
  elseif kLfoWave == 3 then
    kLfoN = (kLfoPh < 0.5 ? -0.5 : 0.5)
  elseif kLfoWave == 4 then
    kLfoN = 0.5 * sin(6.283185307179586 * kLfoPh)
  else
    kSAndH = (kWrapped == 1 ? (kSAndH * 179 + 17) % 256 : kSAndH)
    kXor   = (kSAndH >= 128 ? kSAndH - 128 : kSAndH + 128)   ; ^ 0x80
    kLfoN  = (kXor + 1) / 256 - 0.5
  endif
  if kDelayEnv < 1 then
    kDInc = (kDlyState < 2147483648 ? kDlyInc1 : kDlyInc2)
    kDlyState += kDInc
    kDelayEnv = (kDlyState >= 4294967296 ? 1 : \
                 (kDlyState < 2147483648 ? 0 : \
                  (kDlyState - 2147483648) / 2147483648))
  endif

  ; --- pitch amounts ---------------------------------------------
  kPegSemis = kPegLevel * 0.375 / 524288
  kLfoOct   = kPmd * 2.578125 * kPmsVal * kDelayEnv * kLfoN / 65536
  ; per-k-cycle invariants shared by all six operators
  kPegLfo   = kPegSemis / 12 + kLfoOct
  kAmdScale = kAmdPeak * 32 * kDelayEnv * max:k(0, kLfoN)

  ; --- amp EG per-op update (env.cc getsample, once per block) ---
  kAllFrozen = 0
  kop = 0
  while kop < 6 do
    if kEgIx[kop] < 3 || (kEgIx[kop] < 4 && kGate == 0) then
      if kEgRis[kop] == 1 then
        if kEgLevel[kop] < 112457728 then
          kEgLevel[kop] = 112457728              ; 1716 << 16 jump floor
        endif
        kEgLevel[kop] += (285212672 - kEgLevel[kop]) / 16777216 * kEgInc[kop]
        if kEgLevel[kop] >= kEgTarget[kop] then
          kEgLevel[kop] = kEgTarget[kop]
          kEgIx[kop] += 1
          if kEgIx[kop] < 4 then
            klv   = kEgL[kop * 4 + kEgIx[kop]]
            ksol  = (klv >= 20 ? 28 + klv : kLevLut[klv])
            kcomp = int(ksol / 2) * 64 + kOlm[kop] - 4256
            kcomp = (kcomp < 16 ? 16 : kcomp)
            kEgTarget[kop] = kcomp * 65536
            kEgRis[kop] = (kEgTarget[kop] > kEgLevel[kop] ? 1 : 0)
            kqr  = int(kEgR[kop * 4 + kEgIx[kop]] * 41 / 64) + kQrs[kop]
            kqr  = (kqr > 63 ? 63 : kqr)
            kEgInc[kop] = (4 + (kqr % 4)) * 2 ^ (8 + int(kqr / 4))
          endif
        endif
      else
        kEgLevel[kop] -= kEgInc[kop]
        if kEgLevel[kop] <= kEgTarget[kop] then
          kEgLevel[kop] = kEgTarget[kop]
          kEgIx[kop] += 1
          if kEgIx[kop] < 4 then
            klv   = kEgL[kop * 4 + kEgIx[kop]]
            ksol  = (klv >= 20 ? 28 + klv : kLevLut[klv])
            kcomp = int(ksol / 2) * 64 + kOlm[kop] - 4256
            kcomp = (kcomp < 16 ? 16 : kcomp)
            kEgTarget[kop] = kcomp * 65536
            kEgRis[kop] = (kEgTarget[kop] > kEgLevel[kop] ? 1 : 0)
            kqr  = int(kEgR[kop * 4 + kEgIx[kop]] * 41 / 64) + kQrs[kop]
            kqr  = (kqr > 63 ? 63 : kqr)
            kEgInc[kop] = (4 + (kqr % 4)) * 2 ^ (8 + int(kqr / 4))
          endif
        endif
      endif
    endif
    ; amplitude modulation: transient OL reduction (approximate);
    ; kAmdScale keeps the original left-to-right factor association
    kAmdRedL = kAmdScale * kAmsI[kop]
    ; Retain both block endpoints exactly as msfa does. The selected
    ; algorithm interpolates from kPreviousGain to kGain sample-by-sample.
    kPreviousGain[kop] = kGain[kop]
    ; op gain from the composed level, log2 domain
    kGain[kop] = kEnabled[kop] * 2 ^ ((kEgLevel[kop] - kAmdRedL * 65536) / 16777216 - 14)
    kAllFrozen += (kEgIx[kop] >= 4 ? 1 : 0)
    kop += 1
  od

  ; ---------------- inaudible-release fast path ------------------
  ; Continue the envelope/liveness state machine for every release note,
  ; but avoid the six-operator audio topology once every enabled carrier is
  ; below the audibility bound. FM/modulation operators cannot increase a
  ; carrier's bounded amplitude, and the composed envelope floor itself is
  ; 2^(16*65536/2^24 - 14) = 2^-13.9375 ~= 6.4e-5 per carrier, so the bound
  ; must sit ABOVE that floor or fully-released notes never trip this path
  ; and burn full DSP until the capped tail ends. With the 1e-4 bound the
  ; worst skipped output is ncar * 1e-4 * (0.5/ncar) * 0.75 ~= -88 dBFS.
  ; Render the transition block while either endpoint remains audible, just
  ; like msfa's gain1/gain2 threshold check. A live edit that raises a carrier
  ; above the bound automatically resumes the topology on this same block.
  kCarrierAudible = 0
  kcarrier = 0
  while kcarrier < iNcar do
    kCarrierOp = giDx7Carriers[iCb + 1 + kcarrier] - 1
    if kCarrierOp >= 0 && (kGain[kCarrierOp] > 0.0001 || kPreviousGain[kCarrierOp] > 0.0001) then
      kCarrierAudible = 1
    endif
    kcarrier += 1
  od
  kAudioActive = kCarrierAudible
  if kAudioActive == 1 then
    ; Park frequency derivation with the topology. A carrier gain edit that
    ; resumes audio computes current phase increments on this same block.
    kPitchMul = 2 ^ kPegLfo
    kop = 0
    while kop < 6 do
      if kMode[kop] == 0 then
        kF = kFbase[kop] * kDetF[kop] * kPitchMul
      else
        kF = kFbase[kop] * kDetF[kop]
      endif
      kDph[kop] = kF / sr
      kop += 1
    od
  endif

  ; --- pitch EG update (pitchenv.cc, linear in pitchtab units) ---
  if kPegIx < 3 || (kPegIx < 4 && kGate == 0) then
    if kPegRis == 1 then
      kPegLevel += kPegInc
      if kPegLevel >= kPegTgt then
        kPegLevel = kPegTgt
        kPegAdvance = 1
      endif
    else
      kPegLevel -= kPegInc
      if kPegLevel <= kPegTgt then
        kPegLevel = kPegTgt
        kPegAdvance = 1
      endif
    endif
  endif
  if kPegAdvance == 1 && kPegIx < 4 then
    kPegIx += 1
    if kPegIx < 4 then
      kPegTgt = kPegLvlT[kLiveVoice[130 + kPegIx]] * 524288
      kPegRis = (kPegTgt > kPegLevel ? 1 : 0)
      kPegInc = kPegRateT[kLiveVoice[126 + kPegIx]] * ksmps * 16777216 / (21.3 * sr)
    endif
    kPegAdvance = 0
  endif

  ; ================================================================
  ; static, vectorized algorithm topology
  ; ================================================================
  if kAudioActive == 1 then
    aOut = dx7_render_algorithm(iAlgo, kGain, kDph, iPh0A, kFbAmt)
  else
    aOut = 0
  endif
  aOut *= iOutScale
  aOut *= giBlueX7OutputCalibration

  ; ---------------- note lifetime --------------------------------
  kElapsed = timeinsts()
  if kElapsed > iDuration && (kAllFrozen == 6 || kElapsed > iDuration + iTailCap) then
    turnoff
  endif

  xout aOut
endop
