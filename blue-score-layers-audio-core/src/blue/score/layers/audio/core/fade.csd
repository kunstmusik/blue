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
ioffset = p6
iclipDur = p7
ifadeInType = p8
ifadeInTime = p9
ifadeOutType = p10
ifadeOutTime = p11
aenv, ainv blue_fade ioffset, iclipDur, ifadeInTime, \
                 ifadeInType, ifadeOutTime, ifadeOutType
/*aout = vco2:a(iamp, ipch)*/
/*aout = aout * aenv*/
/*aout = moogladder(aout, 2000, .3)*/
/*aout = aenv*/
outc(aenv, ainv)
endin


instr 2
ipch = cps2pch(p4,12)
iamp = ampdbfs(p5)
ioffset = p6
iclipDur = p7
ifadeInType = p8
ifadeInTime = p9
ifadeOutType = p10
ifadeOutTime = p11
ichan = p12
aenv, ainv blue_fade ioffset, iclipDur, ifadeInTime, \
                 ifadeInType, ifadeOutTime, ifadeOutType

adummy init 0
if(ichan == 0) then
  outc(anv)
else
  outc(adummy, aenv)
endif
endin

</CsInstruments>
<CsScore>
;i1 0 2 8.00 -12 0 2 0 0 0 0
;i1 3 . 8.00 -12 0 2 0 1 0 0
;i1 6 . 8.00 -12 0 2 0 0 0 1 
;i1 9 . 8.00 -12 0 2 0 1 0 1 

;i1 0 4 8.00 -12 0 4 2 1 2 1 

/*i1 0 3.00 8.00 -12 0.00 3 0 1 2 1 */
/*i1 4 2.50 8.00 -12 0.50 3 0 1 2 1 */
/*i1 8 2.75 8.00 -12 0.25 3 0 1 2 1 */


;i1 0 1.00 8.00 -12 0.50 2 0 1 2 1 
;i1 2 1.00 8.00 -12 0.50 2 0 1 2 1 
;i1 4 1.00 8.00 -12 0.50 2 0 1 2 1 
;i1 6 1.00 8.00 -12 0.50 2 0 1 2 1 
;i1 8 1.00 8.00 -12 0.50 2 0 1 2 1 

/*i1 0 0.5 8.00 -12 1.50 2 0 1 2 1 */
/*i1 2 0.5 8.00 -12 1.50 2 0 1 2 1 */
/*i1 4 0.5 8.00 -12 1.50 2 0 1 2 1 */
/*i1 6 0.5 8.00 -12 1.50 2 0 1 2 1 */
/*i1 8 0.5 8.00 -12 1.50 2 0 1 2 1 */

#define score_test(a) #

i1 0   4 8.00 -12 0.0 4 $a 0 $a 0  
i1 ^+5 . 8.00 -12 0.0 4 $a 1 $a 0 
i1 ^+5 . 8.00 -12 0.0 4 $a 0 $a 1 
i1 ^+5 . 8.00 -12 0.0 4 $a 1 $a 1 
i1 ^+5   3.5 8.00 -12 0.5 4.0 $a 1 $a 1 
i1 ^+4.5 3.0 8.00 -12 1.0 4.0 $a 1 $a 1 
i1 ^+4.0 1.5 8.00 -12 2.5 4.0 $a 1 $a 1 
i1 ^+2.5 1.0 8.00 -12 3.0 4.0 $a 1 $a 1 
i1 ^+2.0 0.5 8.00 -12 3.5 4.0 $a 1 $a 1 

#

/*$score_test(0)*/
/*s 40 */
/*$score_test(1)*/
/*s 40*/
/*$score_test(2)*/
/*s 40*/
/*$score_test(3)*/
/*s 40*/
/*$score_test(4)*/
/*s 40*/


i2 0.00 4    8.00 -12 0.0 4.0 3 1 3 1 0
i2 0.75 3.25 8.00 -12 .75 4.0 3 1 3 1 1 

s

i2 0.00 4    8.00 -12 0.0 4.0 4 1 4 1 0
i2 0.75 3.25 8.00 -12 .75 4.0 4 1 4 1 1

s

i2 0.00 1    8.00 -12 3.0  4.0 3 1 3 1 0
i2 0.25 0.75 8.00 -12 3.25 4.0 3 1 3 1 1

s

i2 0.00 1    8.00 -12 3.0  4.0 4 1 4 1 0
i2 0.25 0.75 8.00 -12 3.25 4.0 4 1 4 1 1

</CsScore>
</CsoundSynthesizer>
