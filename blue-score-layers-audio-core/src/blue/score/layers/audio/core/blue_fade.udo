/*
  blue_fade - Fade envelope for audio clips. Fade types and calculations based 
    on those found in Ardour.
    
  Author: Steven Yi
  Version: 0.1
  Date: 2016.07.09
    
  fade types:
    0 - linear
    1 - constant power
    2 - symmetric
    3 - fast (linear dB)
    4 - inverse fast 
    5 - slow (modified linear dB)
    6 - inverse slow 

  inverse curves are inverse power curves of the fast and slow 
  curves, generated using sum of squares 

*/
opcode blue_fade, a, iiii
ifadeInTime, ifadeInType, ifadeOutTime, ifadeOutType xin

#define GAIN_COEF_UNITY #1.0#
#define GAIN_COEF_SMALL #0.0000001# ; -140db
#define GAIN_COEF_ZERO #0.0#
#define INVERSE_POWER(a) #sqrt(1 - pow($a,2))#

;; setup times in samples
idur = abs(p3)
ifadeInSamps = int(ifadeInTime * sr)
ifadeOutSamps = int(ifadeOutTime * sr)
idurSamps = int(idur * sr)
ifadeOutStartSamps = idurSamps - ifadeOutSamps

;kfadeInType init ifadeInType
;kfadeOutType init ifadeOutType

;; STATES: 
;;   0 = no fades (outputs 1.0)
;;   1 = fade in
;;   2 = sustain
;;   3 = fade out
;;   4 = end (0.0)
kstate init (ifadeInTime == 0 && ifadeOutTime == 0) ? 0 : 1
asig init 1.0
kval init 0
kval2 init 0
kfadeStep init 0
ktime init 0
kinCoef init 0
koutCoef init 0

if (ifadeInType == 0) then
  kinCoef = (1.0 - $GAIN_COEF_SMALL) / ifadeInSamps
elseif (ifadeInType == 1) then ;; equal-power 
elseif (ifadeInType == 2) then ;; symmetric
elseif (ifadeInType < 5) then ;; fast (3 or 4)
  kinCoef init ampdb(60 / ifadeInSamps)
  kval init 0.001 ;; could use ampdb(-60) here... 
elseif (ifadeInType < 7) then ;; slow (5 or 6)
  kinCoef init ampdb(1 / ifadeInSamps)
  kinCoef2 init ampdb(80 / ifadeInSamps)
  kval init ampdb(-1)
  kval2 init ampdb(-80)
endif

if (ifadeOutType == 0) then ;; linear
  koutCoef = -(1.0 - $GAIN_COEF_SMALL) / ifadeOutSamps
elseif (ifadeOutType == 1) then ;; equal-power 
elseif (ifadeOutType == 2) then  ;; symmetric
elseif (ifadeOutType < 5) then  ;; fast (3 or 4)
  koutCoef init ampdb(-60 / ifadeOutSamps)
elseif (ifadeOutType < 7) then  ;; slow (5 or 6)
  koutCoef init ampdb(-1 / ifadeOutSamps)
  koutCoef2 init ampdb(-80 / ifadeOutSamps) 
endif

kcount = 0

until (kcount >= ksmps) do
  if (kstate == 0) then
    ;; pass
  elseif (kstate == 1) then
    ;; doing linear for now
    if(ktime >= ifadeInSamps) then
      kstate = 2
      kval = $GAIN_COEF_UNITY
    else
      if(ifadeInType == 0) then      ;; linear
        asig[kcount] = kval
        kval += kinCoef
      elseif (ifadeInType == 1) then ;; equal-power
        ; FIXME - should adjust values as in ardour
        asig[kcount] = sin((kfadeStep / ifadeInSamps) * $M_PI_2)
      elseif (ifadeInType == 2) then ;; symmetric
      
      elseif (ifadeInType < 5) then ;; fast (3 or 4)
        asig[kcount] = (ifadeInType == 3) ? kval : $INVERSE_POWER(kval)
        kval *= kinCoef

      elseif (ifadeInType < 7) then ;; slow (5 or 6)
        kpercent = kfadeStep / ifadeInSamps
        kv = dbamp(kval) * kpercent + dbamp(kval2) * (1 - kpercent)
        kv = ampdb(kv) 
        asig[kcount] = (ifadeInType == 5) ? kv : $INVERSE_POWER(kv) 
        kval *= kinCoef
        kval2 *= kinCoef2
      endif
      
      kcount += 1
      ktime += 1
      kfadeStep += 1
    endif
  elseif (kstate == 2) then
    if(ktime >= ifadeOutStartSamps) then
      kstate = 3
      kval = $GAIN_COEF_UNITY
      kval2 = $GAIN_COEF_UNITY
      kfadeStep = 0
    endif
    
    asig[kcount] = $GAIN_COEF_UNITY
    kcount += 1
    ktime += 1    
  elseif (kstate == 3) then
    if(ktime >= idurSamps) then
      kstate = 4
    else
      if (ifadeOutType == 0) then
        asig[kcount] = kval
        kval += koutCoef
      elseif (ifadeOutType == 1) then
        ; FIXME - should adjust values as in ardour
        asig[kcount] = cos((kfadeStep / ifadeOutSamps) * $M_PI_2)
      elseif (ifadeOutType == 2) then ;; symmetric
      elseif (ifadeOutType < 5) then ;; fast
        asig[kcount] = (ifadeOutType == 3) ? kval : $INVERSE_POWER(kval)
        kval *= koutCoef
      elseif (ifadeOutType < 7) then ;; slow
        kpercent = kfadeStep / ifadeOutSamps
        kv = dbamp(kval) * (1 - kpercent) + dbamp(kval2) * kpercent 
        kv = ampdb(kv)
        asig[kcount] = (ifadeOutType == 5) ? kv : $INVERSE_POWER(kv) 
        kval *= koutCoef
        kval2 *= koutCoef2
      endif
      
      kcount += 1
      ktime += 1 
      kfadeStep += 1
    endif
    
  elseif (kstate == 4) then
    asig[kcount] = $GAIN_COEF_ZERO
      kcount += 1
      ktime += 1 
  endif

od

xout asig

endop
