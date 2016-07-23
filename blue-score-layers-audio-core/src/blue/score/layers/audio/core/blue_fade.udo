
/* Returns array of points with x-values reversed in time */
opcode reverse_curve, i[], i[]

  ipoints[] xin

  ilen = lenarray(ipoints)
  irev[] init ilen
  idur = ipoints[ilen - 2] 
  indx = 0

  while (indx < ilen) do
    iInIndex = ilen - indx - 2
    irev[indx] = idur - ipoints[iInIndex]
    irev[indx + 1] = ipoints[iInIndex + 1]
    indx += 2
  od

  xout irev

endop

/* Pre-calculate points for use with symmetric curve */
opcode get_symmetric_curve_points, i[], 0

  ipoints[] init 20
  ipoints[0] = 0.0
  ipoints[1] = 1.0
  ipoints[2] = 0.5
  ipoints[3] = 0.6

  indx = 2
  while (indx < 9) do
    icoef = 0.3 * pow(0.5, indx)
    ix = (0.7 + (0.3 * (indx / 9)))
    indx2 = indx * 2
    ipoints[indx2] = ix
    ipoints[indx2 + 1] = icoef
    indx += 1
  od

  ipoints[18] = 1.0
  ipoints[19] = 0.0000001 

  xout ipoints

endop

/* Based on code from Curve.cpp from Evoral library,
   included with Ardour, by David Robbillard and Paul Davis.
   Calculates coefficients to use for "Constrained Cubic
   Spline Interpolation" by CJC Kruger
   (www.korf.co.uk/spline.pdf) */

opcode calc_cubic_coefficients, i[],i[]

  ipoints[] xin 
  inumpoints = lenarray(ipoints) / 2
  icoefs[] init ((inumpoints - 1) * 4)

  ifplast init 0
  indx = 0
  icoefindx = 0

  while (indx != inumpoints) do
    
    if (indx == 0) then
      ilp0 = (ipoints[2] - ipoints[0]) / (ipoints[3] - ipoints[1])
      ilp1 = (ipoints[4] - ipoints[2]) / (ipoints[5] - ipoints[3])
      ifpone = ((ilp0 * ilp1) < 0) ? 0 : (2 / (ilp1 + ilp0))

      ifplast = ((3 * (ipoints[3] - ipoints[1]) / 
                    (2 * (ipoints[2] - ipoints[0]))) - 
                    (ifpone * 0.5))
    else
      indx2 = indx * 2
      ixdelta = ipoints[indx2] - ipoints[indx2-2];
      ixdelta2 = ixdelta * ixdelta;
      iydelta = ipoints[indx2 + 1] - ipoints[indx2-1];

      if (indx == inumpoints - 1)  then
        ifpi = ((3 * iydelta) / (2 * ixdelta)) - (ifplast * 0.5)
      else
        islope_before = ((ipoints[indx2+2] - ipoints[indx2]) / 
                         (ipoints[indx2+3] - ipoints[indx2 + 1]))
        islope_after = (ixdelta / iydelta);

        ifpi = ((islope_after * islope_before) < 0.0) ? 0.0 : 2 / (islope_after + islope_before)
      endif

      /* compute second derivative for either side of control point `i' */

      ifppL = (((-2 * (ifpi + (2 * ifplast))) / (ixdelta))) +
        ((6 * iydelta) / ixdelta2);

      ifppR = (2 * ((2 * ifpi) + ifplast) / ixdelta) -
        ((6 * iydelta) / ixdelta2);


      id = (ifppR - ifppL) / (6 * ixdelta);
      ic = ((ipoints[indx2] * ifppL) - (ipoints[indx2-2] * ifppR))/(2 * ixdelta)

      ixim1 = ipoints[indx2-2]
      ixi = ipoints[indx2]
      iyim1 = ipoints[indx2 -1]
      ixim12 = ixim1 * ixim1  /* "x[i-1] squared" */
      ixim13 = ixim12 * ixim1   /* "x[i-1] cubed" */
      ixi2 = ixi * ixi        /* "x[i] squared" */
      ixi3 = ixi2 * ixi;         /* "x[i] cubed" */

      ib = (iydelta - (ic * (ixi2 - ixim12)) - (id * (ixi3 - ixim13))) / ixdelta

      icoefs[icoefindx] = iyim1 - (ib * ixim1) - (ic * ixim12) - (id * ixim13)
      icoefs[icoefindx + 1] = ib
      icoefs[icoefindx + 2] = ic
      icoefs[icoefindx + 3] = id
      ifplast = ifpi
      icoefindx += 4
    endif
    indx += 1
  od

  xout icoefs

endop

/* Single-sample generation of symmetric curve */
opcode calc_symmetric, k, kii[]i[]
  kcounter, ilen, ipoints[], icoefs[] xin

  kout init 0

  if(lenarray:i(ipoints) <= 0 || lenarray:i(icoefs) <= 0) goto skip

  kpointsIndx init 2
  kcoefIndx init 0 
  
  ka init icoefs[0]
  kb init icoefs[1]
  kc init icoefs[2]
  kd init icoefs[3]

  ktime = kcounter / ilen

  until (ktime <= ipoints[kpointsIndx]) do
    kpointsIndx += 2
    kcoefIndx += 4 
    ka = icoefs[kcoefIndx]
    kb = icoefs[kcoefIndx + 1]
    kc = icoefs[kcoefIndx + 2]
    kd = icoefs[kcoefIndx + 3]
  od

  ktime2 = ktime * ktime
  ktime3 = ktime2 * ktime
  kout = ka + (ktime * kb) + (ktime2 * kc) + (ktime3 * kd)

skip:
  xout kout

endop


;; Removing for now, will need to revisit later
;; gi_symmetric_fade_dec[] = get_symmetric_curve_points()
;; gi_symmetric_fade_inc[] = reverse_curve(gi_symmetric_fade_dec)
;; gi_symmetric_fade_dec_coefs[] = calc_cubic_coefficients(gi_symmetric_fade_dec)
;; gi_symmetric_fade_inc_coefs[] = calc_cubic_coefficients(gi_symmetric_fade_inc)

/*
  blue_fade - Fade envelope for audio clips. Fade types and calculations based 
    on code in Ardour (http://ardour.org).
    
  Original C++ Code: Paul Davis, Dave Robillard, et al.
  Csound UDO Code: Steven Yi
    
  fade types:
    0 - linear
    1 - constant power
    2 - symmetric
    3 - fast (linear dB)
    4 - slow (modified linear dB)

  inverse curves are inverse power curves of the fast and slow 
  curves, generated using sum of squares 

*/
opcode blue_fade, aa, iiiiii
ioffset, iclipDur, ifadeInTime, ifadeInType, \
         ifadeOutTime, ifadeOutType xin

#define GAIN_COEF_UNITY #1.0#
#define GAIN_COEF_SMALL #0.0000001# ; -140db
#define GAIN_COEF_ZERO #0.0#
#define INVERSE_POWER(a) #sqrt(1 - pow($a,2))#

;; setup times in samples
idur = iclipDur 
ifadeInSamps = int(ifadeInTime * sr)
ifadeOutSamps = int(ifadeOutTime * sr)
idurSamps = int(idur * sr)
ifadeOutStartSamps = idurSamps - ifadeOutSamps
initDone = 0

;; STATES: 
;;   0 = no fades (outputs 1.0)
;;   1 = fade in
;;   2 = sustain
;;   3 = fade out
;;   4 = end (0.0)
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

;; Caching symmetric curve points and coefs here because
;; Csound complains about perf-statements in instr0...
i_symmetric_fade_dec[] = get_symmetric_curve_points()
i_symmetric_fade_inc[] = reverse_curve(i_symmetric_fade_dec)

if (istate == 1) then
  kfadeStep init itime 
  if (ifadeInType == 0) then
    iinCoef init (1.0 - $GAIN_COEF_SMALL) / ifadeInSamps
    kval init (1.0 - $GAIN_COEF_SMALL) * (ioffset / ifadeInTime)
  elseif (ifadeInType == 1) then ;; equal-power 
  elseif (ifadeInType == 2) then ;; symmetric
    iSymInCoefs[] = calc_cubic_coefficients(i_symmetric_fade_inc) 
    iSymInInvCoefs[] = calc_cubic_coefficients(i_symmetric_fade_dec) 
  elseif (ifadeInType == 3) then ;; fast 
    iinCoef init ampdb(60 / ifadeInSamps)
    kval init 0.001 * pow(iinCoef, itime) 
  elseif (ifadeInType == 4) then ;; slow 
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
  
  if (ifadeOutType == 0) then ;; linear
    ioutCoef init -(1.0 - $GAIN_COEF_SMALL) / ifadeOutSamps
    if(imidStart == 1) then
      kval init (1.0 - $GAIN_COEF_SMALL) * (ifadeStep / ifadeOutSamps)
    endif
  elseif (ifadeOutType == 1) then ;; equal-power 
  elseif (ifadeOutType == 2) then  ;; symmetric
    iSymOutCoefs[] = calc_cubic_coefficients(i_symmetric_fade_dec) 
    iSymOutInvCoefs[] = calc_cubic_coefficients(i_symmetric_fade_inc) 
  elseif (ifadeOutType == 3) then  ;; fast 
    ioutCoef init ampdb(-60 / ifadeOutSamps)
    if(imidStart == 1) then
      kval init pow(ioutCoef, ifadeStep) 
    endif
  elseif (ifadeOutType == 4) then  ;; slow 
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

while (kcount < ksmps) do
  if (kstate == 0) then
    ;; pass
    kcount += 1
    ktime += 1 

  elseif (kstate == 1) then
    if(ktime >= ifadeInSamps) then
      kstate = 2
      kval = $GAIN_COEF_UNITY

    else
      if(ifadeInType == 0) then      ;; linear
        asig[kcount] = kval
        ainverse[kcount] = 1 - kval
        kval += iinCoef

      elseif (ifadeInType == 1) then ;; equal-power
        karg = (kfadeStep / ifadeInSamps) * $M_PI_2
        asig[kcount] = sin(karg)
        ainverse[kcount] = cos(karg)

      elseif (ifadeInType == 2) then ;; symmetric
        asig[kcount] = calc_symmetric(kfadeStep, ifadeInSamps, i_symmetric_fade_inc, iSymInCoefs)
        ainverse[kcount] = calc_symmetric(kfadeStep, ifadeInSamps, i_symmetric_fade_dec, iSymInInvCoefs)

      elseif (ifadeInType == 3) then ;; fast
        asig[kcount] =  kval 
        ainverse[kcount] = $INVERSE_POWER(kval)
        kval *= iinCoef

      elseif (ifadeInType == 4) then ;; slow 
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
        ; FIXME - should adjust values as in ardour
        karg = (kfadeStep / ifadeOutSamps) * $M_PI_2
        asig[kcount] = cos(karg)
        ainverse[kcount] = sin(karg)

      elseif (ifadeOutType == 2) then ;; symmetric
        asig[kcount] = calc_symmetric(kfadeStep, ifadeOutSamps, i_symmetric_fade_dec, iSymOutCoefs)
        ainverse[kcount] = calc_symmetric(kfadeStep, ifadeOutSamps, i_symmetric_fade_inc, iSymOutInvCoefs)

      elseif (ifadeOutType == 3) then ;; fast
        asig[kcount] =  kval 
        ainverse[kcount] = $INVERSE_POWER(kval)
        kval *= ioutCoef

      elseif (ifadeOutType == 4) then ;; slow
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
