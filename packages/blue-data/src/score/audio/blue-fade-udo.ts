/** Blue fade envelope for Csound audio clips. */
export const BLUE_FADE_UDO = `/*
  blue_fade - Fade envelope for audio clips.

  fade types:
    0 - linear
    1 - constant power
    2 - S-Curve (raised cosine)
    3 - fast (linear dB)
    4 - slow (modified linear dB)
*/
opcode blue_fade, aa, iiiiii
ioffset, iclipDur, ifadeInTime, ifadeInType, \\
         ifadeOutTime, ifadeOutType xin

#define GAIN_COEF_UNITY #1.0#
#define GAIN_COEF_SMALL #0.0000001#
#define GAIN_COEF_ZERO #0.0#
#define INVERSE_POWER(a) #sqrt(1 - pow($a,2))#

idur = iclipDur
ifadeInSamps = int(ifadeInTime * sr)
ifadeOutSamps = int(ifadeOutTime * sr)
idurSamps = int(idur * sr)
ifadeOutStartSamps = idurSamps - ifadeOutSamps
initDone = 0

itime       init (ioffset * sr)
asig        init 1.0
ainverse    init 0.0
kval        init 0
kval2       init 0
kfadeStep   init 0
ktime       init itime

istate = 0
if (ifadeInTime == 0 && ifadeOutTime == 0) then
  ;; pass
elseif (ifadeInTime > 0 && itime < ifadeInSamps) then
  istate init 1
elseif (itime < ifadeOutStartSamps) then
  istate init 2
else
  istate init 3
  kval init 1
  kval2 init 1
endif

kstate init istate

if (initDone == 1) goto afterInit
initDone = 1

if (istate == 1) then
  kfadeStep init itime
  if (ifadeInType == 0) then
    iinCoef init (1.0 - $GAIN_COEF_SMALL) / ifadeInSamps
    kval init (1.0 - $GAIN_COEF_SMALL) * (ioffset / ifadeInTime)
  elseif (ifadeInType == 1) then
  elseif (ifadeInType == 3) then
    iinCoef init ampdb(60 / ifadeInSamps)
    kval init 0.001 * pow(iinCoef, itime)
  elseif (ifadeInType == 4) then
    iinCoef init ampdb(1 / ifadeInSamps)
    iinCoef2 init ampdb(80 / ifadeInSamps)
    kval init ampdb(-1) * pow(iinCoef, itime)
    kval2 init ampdb(-80) * pow(iinCoef2, itime)
  endif
endif

if (ifadeOutTime > 0) then
  imidStart = 0
  if(itime > ifadeOutStartSamps) then
    ifadeStep init (itime - ifadeOutStartSamps)
    kfadeStep init ifadeStep
    imidStart = 1
  endif

  if (ifadeOutType == 0) then
    ioutCoef init -(1.0 - $GAIN_COEF_SMALL) / ifadeOutSamps
    if(imidStart == 1) then
      kval init (1.0 - $GAIN_COEF_SMALL) * (ifadeStep / ifadeOutSamps)
    endif
  elseif (ifadeOutType == 1) then
  elseif (ifadeOutType == 3) then
    ioutCoef init ampdb(-60 / ifadeOutSamps)
    if(imidStart == 1) then
      kval init pow(ioutCoef, ifadeStep)
    endif
  elseif (ifadeOutType == 4) then
    ioutCoef init ampdb(-1 / ifadeOutSamps)
    ioutCoef2 init ampdb(-80 / ifadeOutSamps)
    if (imidStart == 1) then
      kval  init pow(ioutCoef, ifadeStep)
      kval2 init pow(ioutCoef2, ifadeStep)
    endif
  endif
endif

afterInit:

kcount = 0

until (kcount >= ksmps) do
  if (kstate == 0) then
    kcount += 1
    ktime += 1

  elseif (kstate == 1) then
    if(ktime >= ifadeInSamps) then
      kstate = 2
      kval = $GAIN_COEF_UNITY

    else
      if(ifadeInType == 0) then
        asig[kcount] = kval
        ainverse[kcount] = 1 - kval
        kval += iinCoef

      elseif (ifadeInType == 1) then
        karg = (kfadeStep / ifadeInSamps) * $M_PI_2
        asig[kcount] = sin(karg)
        ainverse[kcount] = cos(karg)

      elseif (ifadeInType == 2) then
        karg = (kfadeStep / ifadeInSamps) * (2 * $M_PI_2)
        asig[kcount] = (1 - cos(karg)) * 0.5
        ainverse[kcount] = (1 + cos(karg)) * 0.5

      elseif (ifadeInType == 3) then
        asig[kcount] =  kval
        ainverse[kcount] = $INVERSE_POWER(kval)
        kval *= iinCoef

      elseif (ifadeInType == 4) then
        kpercent = kfadeStep / ifadeInSamps
        kv = dbamp(kval) * kpercent + dbamp(kval2) * (1 - kpercent)
        kv = ampdb(kv)
        asig[kcount] = kv
        ainverse[kcount] = $INVERSE_POWER(kv)
        kval *= iinCoef
        kval2 *= iinCoef2
      endif

      kcount += 1
      ktime += 1
      kfadeStep += 1
    endif

  elseif (kstate == 2) then
    if(ktime >= ifadeOutStartSamps) then
      kstate = (ifadeOutTime > 0) ? 3 : 4
      kval = $GAIN_COEF_UNITY
      kval2 = $GAIN_COEF_UNITY
      kfadeStep = 0
    endif

    asig[kcount] = $GAIN_COEF_UNITY
    ainverse[kcount] = $GAIN_COEF_ZERO
    kcount += 1
    ktime += 1

  elseif (kstate == 3) then
    if(ktime >= idurSamps) then
      kstate = 4

    else
      if (ifadeOutType == 0) then
        asig[kcount] = kval
        ainverse[kcount] = 1 - kval
        kval += ioutCoef

      elseif (ifadeOutType == 1) then
        karg = (kfadeStep / ifadeOutSamps) * $M_PI_2
        asig[kcount] = cos(karg)
        ainverse[kcount] = sin(karg)

      elseif (ifadeOutType == 2) then
        karg = (kfadeStep / ifadeOutSamps) * (2 * $M_PI_2)
        asig[kcount] = (1 + cos(karg)) * 0.5
        ainverse[kcount] = (1 - cos(karg)) * 0.5

      elseif (ifadeOutType == 3) then
        asig[kcount] =  kval
        ainverse[kcount] = $INVERSE_POWER(kval)
        kval *= ioutCoef

      elseif (ifadeOutType == 4) then
        kpercent = kfadeStep / ifadeOutSamps
        kv = dbamp(kval) * (1 - kpercent) + dbamp(kval2) * kpercent
        kv = ampdb(kv)
        asig[kcount] = kv
        ainverse[kcount] = $INVERSE_POWER(kv)
        kval *= ioutCoef
        kval2 *= ioutCoef2
      endif

      kcount += 1
      ktime += 1
      kfadeStep += 1
    endif

  elseif (kstate == 4) then
    asig[kcount] = $GAIN_COEF_ZERO
    ainverse[kcount] = $GAIN_COEF_UNITY
    kcount += 1
    ktime += 1
  endif

od

xout asig, ainverse

endop
`;
