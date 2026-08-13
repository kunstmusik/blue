<CsoundSynthesizer>
<CsOptions>
-n -d
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 1
instr 1
  a1 oscili 0.0, 440
  outs a1, a1
endin
</CsInstruments>
<CsScore>
i1 0 0.02
e
</CsScore>
</CsoundSynthesizer>
