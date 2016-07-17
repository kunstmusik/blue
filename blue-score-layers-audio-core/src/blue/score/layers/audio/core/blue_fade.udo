
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

;; Caching symmetric curve points and coefs here because
;; Csound complains about perf-statements in instr0...


i_symmetric_fade_dec[] = get_symmetric_curve_points()
i_symmetric_fade_inc[] = reverse_curve(i_symmetric_fade_dec)

;; setup times in samples
idur = abs(p3)
ifadeInSamps = int(ifadeInTime * sr)
ifadeOutSamps = int(ifadeOutTime * sr)
idurSamps = int(idur * sr)
ifadeOutStartSamps = idurSamps - ifadeOutSamps

;; STATES: 
;;   0 = no fades (outputs 1.0)
;;   1 = fade in
;;   2 = sustain
;;   3 = fade out
;;   4 = end (0.0)

kstate init (ifadeInTime == 0 && ifadeOutTime == 0) ? 0 : (ifadeInTime <= 0) ? 2 : 1  

asig init 1.0
kval init 0
kval2 init 0
kfadeStep init 0
ktime init 0
kinCoef init 0
koutCoef init 0

if (ifadeInTime > 0) then
  if (ifadeInType == 0) then
    kinCoef = (1.0 - $GAIN_COEF_SMALL) / ifadeInSamps
  elseif (ifadeInType == 1) then ;; equal-power 
  elseif (ifadeInType == 2) then ;; symmetric
    iSymInPoints[] = i_symmetric_fade_inc
    iSymInCoefs[] = calc_cubic_coefficients(iSymInPoints) 
  elseif (ifadeInType < 5) then ;; fast (3 or 4)
    kinCoef init ampdb(60 / ifadeInSamps)
    kval init 0.001 ;; could use ampdb(-60) here... 
  elseif (ifadeInType < 7) then ;; slow (5 or 6)
    kinCoef init ampdb(1 / ifadeInSamps)
    kinCoef2 init ampdb(80 / ifadeInSamps)
    kval init ampdb(-1)
    kval2 init ampdb(-80)
  endif
endif

if (ifadeOutTime > 0) then
  if (ifadeOutType == 0) then ;; linear
    koutCoef = -(1.0 - $GAIN_COEF_SMALL) / ifadeOutSamps
  elseif (ifadeOutType == 1) then ;; equal-power 
  elseif (ifadeOutType == 2) then  ;; symmetric
    iSymOutPoints[] = i_symmetric_fade_dec
    iSymOutCoefs[] = calc_cubic_coefficients(iSymOutPoints) 
  elseif (ifadeOutType < 5) then  ;; fast (3 or 4)
    koutCoef init ampdb(-60 / ifadeOutSamps)
  elseif (ifadeOutType < 7) then  ;; slow (5 or 6)
    koutCoef init ampdb(-1 / ifadeOutSamps)
    koutCoef2 init ampdb(-80 / ifadeOutSamps) 
  endif
endif

kcount = 0

until (kcount >= ksmps) do
  if (kstate == 0) then
    ;; pass
    kcount += 1
    ktime += 1 
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
        asig[kcount] = calc_symmetric(kfadeStep, ifadeInSamps, iSymInPoints, iSymInCoefs)

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
      kstate = (ifadeOutTime > 0) ? 3 : 4
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
        asig[kcount] = calc_symmetric(kfadeStep, ifadeOutSamps, iSymOutPoints, iSymOutCoefs)

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
