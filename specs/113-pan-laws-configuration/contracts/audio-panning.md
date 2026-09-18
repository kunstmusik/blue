# Audio Panning Contract

This contract extends Spec 112's [audio routing contract](../../112-mono-clip-panning/contracts/audio-routing.md). It applies only when score panning is enabled and output has two channels. Disabled, mono-output, clip-adaptation, sends, mute/solo, meter, and unsupported-layout rules remain as specified there.

## Gain function

For a single source leg positioned at `p∈[0,1]`, output gains are `(f(1−p), f(p))`. Define `E(q)=sin(πq/2)`, `G(q)=q`, `B(q)=min(1,2q)`, and `t=(1/√2−10^(−4.5/20))/(1/√2−1/2)`:

- 0 dB: `f=B`
- −3 dB: `f=E`, exactly preserving Spec 112's equal-power position curve
- −4.5 dB: `f=(1−t)E+tG`
- −6 dB: `f=G`

When Off-center boost is on, multiply both gains for each source leg by `1+(10^(|lawDb|/20)−1)·2|p−0.5|`. At center, boost has no effect. At a hard endpoint, the selected gain is `10^(|lawDb|/20)`; 0 dB boost is a no-op. Validate the law and every position before generating or applying values. Generated gains must remain finite.

## Mono Pan

Verified all-mono material arrives as Spec 112's two-bus `(x/√2,x/√2)`. Use the **left bus** as the source representation and multiply its two output gains by `√2`; do not sum the buses. The result is `(x f(1−p), x f(p))` before optional boost. For the default −3 dB/off, retain exactly the existing CSD cosine/sine curve and default fixture levels. The source-format classification rule is unchanged.

## Balance

For stereo/mixed/unknown material with mode Balance, keep Spec 112's `Lout=L·min(1,2(1−p))` and `Rout=R·min(1,2p)`. No crossfeed occurs. The selected law/boost has no effect. This is the default and compatibility path.

## Stereo Pan

With shared position `c` and saved width `w`, let `d=w·min(c,1−c)`, `pL=c−d`, and `pR=c+d`. Pan the original left input at `pL` and right input at `pR`. The effective spread narrows toward endpoints without overwriting `w`.

## Dual Pan

Pan the original left input at `pL=dualPanLeft` and right input at `pR=dualPanRight`. Both can coincide or cross. Editing one stored position does not move the other.

## True-stereo matrix

For Stereo Pan and Dual Pan, obtain source-leg gains `(aL,bL)` at `pL` and `(aR,bR)` at `pR`, including optional boost. Then:

```text
Left output  = aL·left input + aR·right input
Right output = bL·left input + bR·right input
```

At `(c,w)=(0.5,1)` or Dual defaults `(pL,pR)=(0,1)`, boost off, this is identity for every law. Stereo Pan at `w=0` co-locates both legs at `c`; at `c=0` or `1`, both legs reach that endpoint. No automatic normalization or limiting occurs. A Spec 112 mixed track's upmixed mono component can rise about 3 dB when both buses fold to one speaker; correlated stereo can rise further depending on content.

## Verification examples

- Left-only and right-only impulses distinguish true pan from Balance; test mirrored positions.
- Center/full-width and default Dual Pan are identity with boost off.
- Zero Width, endpoint Position, coincident Dual Pan, and crossed Dual Pan obey the matrix.
- Every law/boost pair is checked at `p=0,0.25,0.5,0.75,1`; default −3/off matches Spec 112's mono curve and Balance path numerically and in rendered float audio.
- Static, automated, timeline, BlueLive, and disk generation use equivalent coefficients. Changes must not introduce a click from a discontinuous coefficient jump; use the existing runtime update smoothing/fencing behavior or document the required minimal smoothing in implementation.
