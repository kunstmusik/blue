<CsoundSynthesizer>
<CsInstruments>
sr=44100
ksmps=32
nchnls=2
0dbfs=1

#include "blue_fade.udo"

instr 1
ipch = cps2pch(p4,12)
iamp = ampdbfs(p5)
ifadeInType = p6
ifadeInTime = p7
ifadeOutType = p8
ifadeOutTime = p9
aenv = blue_fade(ifadeInTime, ifadeInType, ifadeOutTime, ifadeOutType)
aout = vco2:a(iamp, ipch)
aout = aout * aenv
aout = moogladder(aout, 2000, .3)
outs(aout, aout)
endin
</CsInstruments>
<CsScore>
;i1 0 2 8.00 -12 0 0 0 0
;i1 3 . 8.00 -12 0 .5 0 0
;i1 6 . 8.00 -12 0 0 0 .5 
;i1 9 . 8.00 -12 0 .5 0 .5 

i1 0 4 8.00 -12 2 1 2 1 
;i1 3 . 8.00 -12 0 .5 0 0
</CsScore>
</CsoundSynthesizer>
