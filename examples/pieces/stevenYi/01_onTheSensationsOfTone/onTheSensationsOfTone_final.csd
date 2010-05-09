<CsoundSynthesizer>

<CsOptions>
-d -o onTheSensationsOfTone.wav
</CsOptions>

<CsInstruments>
/* On the Sensations of Tone
   by Steven Yi
  
   http://www.kunstmusik.com

   Copyright 2004 Steven Yi - All Rights Reserved

   Completed: October 19th, 2004

   Premiered: November 10th, 2004
              University of Georgia Alumni Concert Series

*/

sr=44100
kr=44100
ksmps=1
nchnls=2

ga1	init 	0
ga2	init	0



gi_scanned_initPos		ftgen 0, 0, 128, 7, 0, 128, 0		; initpos
gi_scanned_masses		ftgen 0, 0, 128, -7, 1, 128, 1		; masses
gi_scanned_centeringForce	ftgen 0, 0, 128, -7, 0, 128, 2		; centering force
gi_scanned_damping		ftgen 0, 0, 128, -7, 1, 128, 1		; damping
gi_scanned_initVelocity	ftgen 0, 0, 128, -7, -.0, 128, 0	; init velocity
gi_scanned_trajectory	ftgen 0, 0, 128, -7, 0, 128, 128	; trajectory

gi_scanned_matrix_string128		ftgen 0, 0, 16384, -23, "string-128"

gi_square		ftgen 0, 0, 65537, 10, 1, 0, 0.111111, 0, 0.4, 0, .020408163, 0, .012345679, 0, .008264463



	opcode yiEnvelope, k, i
kout	init 0

ienvType	xin

if ienvType == 0 kgoto env0  ; adsr
if ienvType == 1 kgoto env1  ; pyramid
if ienvType == 2 kgoto env2  ; ramp

env0:

	kenv	adsr	.3, .2, .9, .5

	kgoto endEnvelope

env1:
	
	kenv 	linseg	0, p3 * .5, 1, p3 * .5, 0
;	kenv	oscil3	1, .5 / p3 , gi_sine

	kgoto endEnvelope

env2:
	
	kenv	linseg 	0, p3 - .1, 1, .1, 0	

	kgoto endEnvelope

endEnvelope:

	xout 	kenv
	endop

	opcode declick, a, a

ain     	xin
aenv    	linseg 0, 0.02, 1, p3 - 0.05, 1, 0.02, 0, 0.01, 0
        	xout ain * aenv         ; apply envelope and write output

        	endop



	instr 1	;feedback scanned - string128
ipch 	= p4
ipch2	= p5

ipch 	= (ipch < 15 ? cpspch(ipch) : ipch)
ipch2 	= (ipch2 < 15 ? cpspch(ipch2) : ipch2)

kpchline 	line ipch, p3, ipch2

iamp 	= ampdb(p6)
iSpace	= p7
ienvType	= p8

kenv	yiEnvelope ienvType


;iforce	= p5 * .0004
;iforce = iamp * .0004
iforce = (iamp / 0dbfs) * .5

;ain	linseg 0, p3 * .5, iforce, p3 *.5, 0

ain 	init 0

;aforce	= kenv * iforce 
aforce	= iforce

ain	= ain + aforce



ifnmatrix	 = gi_scanned_matrix_string128


iscantable	 = gi_scanned_trajectory

; PARAMETERS FOR SCANU
iInit	= gi_scanned_initPos
irate	= .02

ifnvel	= gi_scanned_initVelocity
ifnmass	= gi_scanned_masses
ifncenter	= gi_scanned_centeringForce
ifndamp	= gi_scanned_damping

kmass	= 2
kstiff	= .05
kcenter	= .1
kdamp 	= -.4

ileft	= .1
iright	= .3
kpos	= .2
kstrength	= 0

idisp	= 0
id	= 2


	scanu	iInit,irate,ifnvel,ifnmass,ifnmatrix,ifncenter,ifndamp,kmass,kstiff,kcenter,kdamp,ileft,iright,kpos,kstrength,ain,idisp,id

a1	scans	1, kpchline, iscantable, id

ain	= a1 * .0002

a1 	dcblock a1

aout	= a1

aout	butterlp	aout, kpchline * 8 * kenv
aout	butterlp	aout, kpchline * 8 * kenv

;aout	nreverb	aout, .1, .2
aout	nreverb	aout, .05, .2

;aout	balance	aout, a1

;aout	= aout * kenv * iamp
;aout	= aout * iamp * .9
aout	= aout * iamp

aout	declick aout
aout	= aout * kenv

iSpace	= iSpace * 3.14159265359 * .5
krtl     	= sqrt(2) / 2 * (cos(iSpace) + sin(iSpace)) ; CONSTANT POWER PANNING
krtr     	= sqrt(2) / 2 * (cos(iSpace) - sin(iSpace)) ; FROM C.ROADS "CM TUTORIAL" pp460

aLeft 	=	aout * krtl
aRight	=	aout * krtr

;	outs aLeft, aRight

ga1 = ga1 + aLeft
ga2 = ga2 + aRight 

	endin

	instr 2	;design1 - string128
ipch 	= p4
ipch2	= p5

ipch 	= (ipch < 15 ? cpspch(ipch) : ipch)
ipch2 	= (ipch2 < 15 ? cpspch(ipch2) : ipch2)

kpchline 	line ipch, p3, ipch2

iamp 	= ampdb(p6)
iSpace	= p7
ienvType	= p8

kenv	yiEnvelope ienvType


;iforce	= p5 * .0004
;iforce = iamp * .0004
iforce = iamp / 0dbfs

;ain	linseg 0, p3 * .5, iforce, p3 *.5, 0

;ain	= kenv * iforce
ain	= iforce

ifnmatrix	 = gi_scanned_matrix_string128

iscantable	 = gi_scanned_trajectory

; PARAMETERS FOR SCANU
iInit	= gi_scanned_initPos
irate	= .02

ifnvel	= gi_scanned_initVelocity
ifnmass	= gi_scanned_masses
ifncenter	= gi_scanned_centeringForce
ifndamp	= gi_scanned_damping

kmass	= 2
kstiff	= .05
kcenter	= .1
kdamp 	= -.4

ileft	= .1
iright	= .3
kpos	= .2
kstrength	= 0

idisp	= 0
id	= 2


	scanu	iInit,irate,ifnvel,ifnmass,ifnmatrix,ifncenter,ifndamp,kmass,kstiff,kcenter,kdamp,ileft,iright,kpos,kstrength,ain,idisp,id

a1	scans	1, kpchline, iscantable, id

a1 	dcblock a1	

aout	= a1

aout	butterlp	aout, (kpchline * 6 * kenv) + kpchline 
aout	butterlp	aout, (kpchline * 6 * kenv) + kpchline 

;aout	nreverb	aout, .1, .2
aout	nreverb	aout, .05, .2

aout	declick aout

;aout	= aout * kenv * iamp
;aout	= aout * iamp * .9
aout	= aout * iamp * kenv

iSpace	= iSpace * 3.14159265359 * .5
krtl     	= sqrt(2) / 2 * (cos(iSpace) + sin(iSpace)) ; CONSTANT POWER PANNING
krtr     	= sqrt(2) / 2 * (cos(iSpace) - sin(iSpace)) ; FROM C.ROADS "CM TUTORIAL" pp460

aLeft 	=	aout * krtl
aRight	=	aout * krtr

;	outs aLeft, aRight

ga1 = ga1 + aLeft
ga2 = ga2 + aRight 

	endin

	instr 3	;feedback scanned - string128
ipch 	= p4
ipch2	= p5

ipch 	= (ipch < 15 ? cpspch(ipch) : ipch)
ipch2 	= (ipch2 < 15 ? cpspch(ipch2) : ipch2)

kpchline 	line ipch, p3, ipch2

iamp 	= ampdb(p6)
iSpace	= p7
ienvType	= p8

kenv	yiEnvelope ienvType


;iforce	= p5 * .0004
;iforce = iamp * .0004
iforce = (iamp / 0dbfs) * .5

;ain	linseg 0, p3 * .5, iforce, p3 *.5, 0

ain 	init 0

;aforce	= kenv * iforce 
aforce	= iforce

ain	= ain + aforce



ifnmatrix	 = gi_scanned_matrix_string128


iscantable	 = gi_scanned_trajectory

; PARAMETERS FOR SCANU
iInit	= gi_scanned_initPos
irate	= .02

ifnvel	= gi_scanned_initVelocity
ifnmass	= gi_scanned_masses
ifncenter	= gi_scanned_centeringForce
ifndamp	= gi_scanned_damping

kmass	= 2
kstiff	= .05
kcenter	= .1
kdamp 	= -.4

ileft	= .1
iright	= .3
kpos	= .2
kstrength	= 0

idisp	= 0
id	= 2


	scanu	iInit,irate,ifnvel,ifnmass,ifnmatrix,ifncenter,ifndamp,kmass,kstiff,kcenter,kdamp,ileft,iright,kpos,kstrength,ain,idisp,id

a1	scans	1, kpchline, iscantable, id

ain	= a1 * .0002

a1 	dcblock a1

aout	= a1

aout	butterlp	aout, kpchline * 8 * kenv
aout	butterlp	aout, kpchline * 8 * kenv

;aout	nreverb	aout, .1, .2
aout	nreverb	aout, .05, .2

;aout	balance	aout, a1

;aout	= aout * kenv * iamp
;aout	= aout * iamp * .9
aout	= aout * iamp

aout	declick aout
aout	= aout * kenv

iSpace	= iSpace * 3.14159265359 * .5
krtl     	= sqrt(2) / 2 * (cos(iSpace) + sin(iSpace)) ; CONSTANT POWER PANNING
krtr     	= sqrt(2) / 2 * (cos(iSpace) - sin(iSpace)) ; FROM C.ROADS "CM TUTORIAL" pp460

aLeft 	=	aout * krtl
aRight	=	aout * krtr

;	outs aLeft, aRight

ga1 = ga1 + aLeft
ga2 = ga2 + aRight 

	endin

	instr 4	;design1 - string128
ipch 	= p4
ipch2	= p5

ipch 	= (ipch < 15 ? cpspch(ipch) : ipch)
ipch2 	= (ipch2 < 15 ? cpspch(ipch2) : ipch2)

kpchline 	line ipch, p3, ipch2

iamp 	= ampdb(p6)
iSpace	= p7
ienvType	= p8

kenv	yiEnvelope ienvType


;iforce	= p5 * .0004
;iforce = iamp * .0004
iforce = iamp / 0dbfs

;ain	linseg 0, p3 * .5, iforce, p3 *.5, 0

;ain	= kenv * iforce
ain	= iforce

ifnmatrix	 = gi_scanned_matrix_string128

iscantable	 = gi_scanned_trajectory

; PARAMETERS FOR SCANU
iInit	= gi_scanned_initPos
irate	= .02

ifnvel	= gi_scanned_initVelocity
ifnmass	= gi_scanned_masses
ifncenter	= gi_scanned_centeringForce
ifndamp	= gi_scanned_damping

kmass	= 2
kstiff	= .05
kcenter	= .1
kdamp 	= -.4

ileft	= .1
iright	= .3
kpos	= .2
kstrength	= 0

idisp	= 0
id	= 2


	scanu	iInit,irate,ifnvel,ifnmass,ifnmatrix,ifncenter,ifndamp,kmass,kstiff,kcenter,kdamp,ileft,iright,kpos,kstrength,ain,idisp,id

a1	scans	1, kpchline, iscantable, id

a1 	dcblock a1	

aout	= a1

aout	butterlp	aout, (kpchline * 6 * kenv) + kpchline 
aout	butterlp	aout, (kpchline * 6 * kenv) + kpchline 

;aout	nreverb	aout, .1, .2
aout	nreverb	aout, .05, .2

aout	declick aout

;aout	= aout * kenv * iamp
;aout	= aout * iamp * .9
aout	= aout * iamp * kenv

iSpace	= iSpace * 3.14159265359 * .5
krtl     	= sqrt(2) / 2 * (cos(iSpace) + sin(iSpace)) ; CONSTANT POWER PANNING
krtr     	= sqrt(2) / 2 * (cos(iSpace) - sin(iSpace)) ; FROM C.ROADS "CM TUTORIAL" pp460

aLeft 	=	aout * krtl
aRight	=	aout * krtr

;	outs aLeft, aRight

ga1 = ga1 + aLeft
ga2 = ga2 + aRight 

	endin

	instr 5	;feedback scanned - string128
ipch 	= p4
ipch2	= p5

ipch 	= (ipch < 15 ? cpspch(ipch) : ipch)
ipch2 	= (ipch2 < 15 ? cpspch(ipch2) : ipch2)

kpchline 	line ipch, p3, ipch2

iamp 	= ampdb(p6)
iSpace	= p7
ienvType	= p8

kenv	yiEnvelope ienvType


;iforce	= p5 * .0004
;iforce = iamp * .0004
iforce = (iamp / 0dbfs) * .5

;ain	linseg 0, p3 * .5, iforce, p3 *.5, 0

ain 	init 0

;aforce	= kenv * iforce 
aforce	= iforce

ain	= ain + aforce



ifnmatrix	 = gi_scanned_matrix_string128


iscantable	 = gi_scanned_trajectory

; PARAMETERS FOR SCANU
iInit	= gi_scanned_initPos
irate	= .02

ifnvel	= gi_scanned_initVelocity
ifnmass	= gi_scanned_masses
ifncenter	= gi_scanned_centeringForce
ifndamp	= gi_scanned_damping

kmass	= 2
kstiff	= .05
kcenter	= .1
kdamp 	= -.4

ileft	= .1
iright	= .3
kpos	= .2
kstrength	= 0

idisp	= 0
id	= 2


	scanu	iInit,irate,ifnvel,ifnmass,ifnmatrix,ifncenter,ifndamp,kmass,kstiff,kcenter,kdamp,ileft,iright,kpos,kstrength,ain,idisp,id

a1	scans	1, kpchline, iscantable, id

ain	= a1 * .0002

a1 	dcblock a1

aout	= a1

aout	butterlp	aout, kpchline * 8 * kenv
aout	butterlp	aout, kpchline * 8 * kenv

;aout	nreverb	aout, .1, .2
aout	nreverb	aout, .05, .2

;aout	balance	aout, a1

;aout	= aout * kenv * iamp
;aout	= aout * iamp * .9
aout	= aout * iamp

aout	declick aout
aout	= aout * kenv

iSpace	= iSpace * 3.14159265359 * .5
krtl     	= sqrt(2) / 2 * (cos(iSpace) + sin(iSpace)) ; CONSTANT POWER PANNING
krtr     	= sqrt(2) / 2 * (cos(iSpace) - sin(iSpace)) ; FROM C.ROADS "CM TUTORIAL" pp460

aLeft 	=	aout * krtl
aRight	=	aout * krtr

;	outs aLeft, aRight

ga1 = ga1 + aLeft
ga2 = ga2 + aRight 

	endin

	instr 6	;triangle
ipch 	= p4
ipch2	= p5

ipch 	= (ipch < 15 ? cpspch(ipch) : ipch)
ipch2 	= (ipch2 < 15 ? cpspch(ipch2) : ipch2)

kpchline 	line ipch, p3, ipch2

;print ipch, ipch2

iamp 	= ampdb(p6)
iSpace	= p7
ienvType	= p8

itable	= gi_square

kenv	yiEnvelope ienvType

;aout	oscili iamp * kenv, kpchline, itable
;aout	vco 	iamp * kenv, ipch, 3, .5

aout	vco2	1, kpchline, 12
aout2	vco2	1, kpchline + .0009, 12
aout3	vco2	1, kpchline + .0007, 12

aout	sum aout, aout2, aout3
aout	= aout * .333

kCut	= (kpchline * 4 * kenv) + kpchline

kCut    	limit kCut, sr * 0.0002, sr * 0.48

;if kCut < 20000 kgoto kCutPass
;  kCut = 20000
;kCutPass:
;printk2 kCut

aout 	butterlp aout, kCut

aout	= aout * iamp * kenv

iSpace	= iSpace * 3.14159265359 * .5
krtl     	= sqrt(2) / 2 * (cos(iSpace) + sin(iSpace)) ; CONSTANT POWER PANNING
krtr     	= sqrt(2) / 2 * (cos(iSpace) - sin(iSpace)) ; FROM C.ROADS "CM TUTORIAL" pp460

aLeft 	=	aout * krtl
aRight	=	aout * krtr

	outs aLeft, aRight

;ga1 = ga1 + aLeft
;ga2 = ga2 + aRight 
	endin

	instr 1001	;Pass Through
ga1 = ga1 * .3
ga2 = ga2 * .3

outs	ga1, ga2

ga1 = 0
ga2 = 0

	endin


</CsInstruments>

<CsScore>










i 1001 0 [359.33334 + 1]


i3	92.5	21.333334	8.0	8.0	62.0	-0.2	1	
i1	92.624756	21.08382	8.02	8.02	64.0	0.2	1	
i5	92.624756	21.08382	7.07	7.07	61.0	0	1	
i2	93.14458	20.044184	8.09	8.09	65.0	0.1	1	
i4	93.248535	19.836258	9.0	9.0	66.0	-0.1	1	
i3	136.16667	21.333334	8.0	8.0	62.0	-0.2	1	
i1	136.29143	21.08382	8.02	8.02	64.0	0.2	1	
i5	136.29143	21.08382	7.07	7.07	61.0	0	1	
i2	136.81125	20.044184	8.09	8.09	65.0	0.1	1	
i4	136.9152	19.836258	9.0	9.0	66.0	-0.1	1	
i3	74.666664	21.333334	7.1	7.1	62.0	-0.2	1	
i1	74.79142	21.08382	8.0	8.0	64.0	0.2	1	
i5	74.79142	21.08382	7.05	7.05	61.0	0	1	
i2	75.31124	20.044184	8.07	8.07	65.0	0.1	1	
i4	75.4152	19.836258	8.1	8.1	66.0	-0.1	1	
i3	114.333336	21.333334	7.1	7.1	62.0	-0.2	1	
i1	114.45809	21.08382	8.0	8.0	64.0	0.2	1	
i5	114.45809	21.08382	7.05	7.05	61.0	0	1	
i2	114.97791	20.044184	8.07	8.07	65.0	0.1	1	
i4	115.08187	19.836258	8.1	8.1	66.0	-0.1	1	
i6	37.333332	10.993614	8.09	8.09	78	0	1	
i6	48.368855	10.964477	8.07	8.07	78	0	1	
i6	102.32203	11.011305	8.09	8.09	78	0	1	
i6	91.333336	10.9530325	8.07	8.07	78	0	1	
i6	135.80705	11.526282	8.09	8.09	78	0	1	
i6	124.333336	11.449415	8.07	8.07	78	0	1	
i6	64.166664	10.93122	8.09	8.09	78	0	1	
i6	75.19502	10.971645	8.07	8.07	78	0	1	
i6	154.5	12.0	8.09	8.09	78	0	1	
i6	173.0	13.0	8.07	8.07	78	0	1	
i3	25.5	14.000001	7.02	7.02	66	-0.2	1	
i1	25.581871	13.836257	7.0	7.0	68	0.2	1	
i5	25.581871	13.836257	7.07	7.07	65	0	1	
i2	25.923002	13.153996	6.05	6.05	69	0.1	1	
i4	25.991228	13.017545	6.02	6.02	70	-0.1	1	
i3	49.166668	14.166667	7.02	7.02	66	-0.2	1	
i1	49.249516	14.000975	7.0	7.0	68	0.2	1	
i5	49.249516	14.000975	7.07	7.07	65	0	1	
i2	49.594707	13.310591	6.05	6.05	69	0.1	1	
i4	49.663742	13.172515	6.02	6.02	70	-0.1	1	
i3	0.0	15.0	7.02	7.02	66	-0.25	1	
i1	0.08771929	14.82456	7.0	7.0	68	0.15	1	
i5	0.08771929	14.82456	7.07	7.07	65	-0.05	1	
i2	0.45321637	14.093566	6.05	6.05	69	0.05	1	
i4	0.5263158	13.947368	6.02	6.02	70	-0.15	1	
i3	71.833336	18.0	7.02	7.02	66	-0.2	1	
i1	71.9386	17.789473	7.0	7.0	68	0.2	1	
i5	71.9386	17.789473	7.07	7.07	65	0	1	
i2	72.3772	16.91228	6.05	6.05	69	0.1	1	
i4	72.46491	16.736841	6.02	6.02	70	-0.1	1	
i3	140.0	18.0	7.02	7.02	66	-0.2	1	
i1	140.10527	17.789473	7.0	7.0	68	0.2	1	
i5	140.10527	17.789473	7.07	7.07	65	0	1	
i2	140.54385	16.91228	6.05	6.05	69	0.1	1	
i4	140.63158	16.736841	6.02	6.02	70	-0.1	1	
i3	111.166664	18.0	7.02	7.02	66	-0.2	1	
i1	111.27193	17.789473	7.0	7.0	68	0.2	1	
i5	111.27193	17.789473	7.07	7.07	65	0	1	
i2	111.710526	16.91228	6.05	6.05	69	0.1	1	
i4	111.79824	16.736841	6.02	6.02	70	-0.1	1	
i3	344.27997	15.053362	7.02	7.02	66	-0.25	1	
i1	344.368	14.877297	7.0	7.0	68	0.15	1	
i5	344.368	14.877297	7.07	7.07	65	-0.05	1	
i2	344.7348	14.143703	6.05	6.05	69	0.05	1	
i4	344.80817	13.9969845	6.02	6.02	70	-0.15	1	
i3	332.40454	14.551582	7.0	7.0	66	-0.15	1	
i1	332.48962	14.381388	6.1	6.1	68	0.25	1	
i5	332.48962	14.381388	7.05	7.05	65	0.05	1	
i2	332.84424	13.672246	6.03	6.03	69	0.15	1	
i4	332.91513	13.530418	6.0	6.0	70	-0.05	1	
i3	319.6928	14.049806	7.02	7.02	66	-0.2	1	
i1	319.775	13.885479	7.0	7.0	68	0.2	1	
i5	319.775	13.885479	7.07	7.07	65	0	1	
i2	320.1173	13.200791	6.05	6.05	69	0.1	1	
i4	320.1858	13.063854	6.02	6.02	70	-0.1	1	
i3	307.98465	15.053362	7.0	7.0	66	-0.2	1	
i1	308.0727	14.877297	6.1	6.1	68	0.2	1	
i5	308.0727	14.877297	7.05	7.05	65	0	1	
i2	308.43948	14.143703	6.03	6.03	69	0.1	1	
i4	308.51285	13.9969845	6.0	6.0	70	-0.1	1	
i6	310.8401	11.027096	8.09	8.09	78	0	1	
i6	299.78894	11.032401	8.07	8.07	78	0	1	
i3	295.7747	14.217064	7.02	7.02	66	-0.2	1	
i1	295.85785	14.050782	7.0	7.0	68	0.2	1	
i5	295.85785	14.050782	7.07	7.07	65	0	1	
i2	296.20425	13.357943	6.05	6.05	69	0.1	1	
i4	296.27356	13.219376	6.02	6.02	70	-0.1	1	
i3	283.73203	16.05692	7.0	7.0	66	-0.2	1	
i1	283.82593	15.869119	6.1	6.1	68	0.2	1	
i5	283.82593	15.869119	7.05	7.05	65	0	1	
i2	284.21716	15.086617	6.03	6.03	69	0.1	1	
i4	284.2954	14.930119	6.0	6.0	70	-0.1	1	
i6	283.95883	10.979562	8.09	8.09	78	0	1	
i3	269.18042	18.064034	7.02	7.02	66	-0.2	1	
i1	269.28607	17.852758	7.0	7.0	68	0.2	1	
i5	269.28607	17.852758	7.07	7.07	65	0	1	
i2	269.72623	16.972445	6.05	6.05	69	0.1	1	
i4	269.81427	16.796381	6.02	6.02	70	-0.1	1	
i3	262.99182	21.409225	7.1	7.1	62.0	-0.2	1	
i1	263.117	21.158825	8.0	8.0	64.0	0.2	1	
i5	263.117	21.158825	7.05	7.05	61.0	0	1	
i6	272.86014	11.027891	8.07	8.07	78	0	1	
i2	263.6387	20.11549	8.07	8.07	65.0	0.1	1	
i4	263.74304	19.906824	8.1	8.1	66.0	-0.1	1	
i6	256.66196	11.013136	8.07	8.07	78	0	1	
i3	245.09505	21.409225	8.0	8.0	62.0	-0.2	1	
i1	245.22025	21.158825	8.02	8.02	64.0	0.2	1	
i5	245.22025	21.158825	7.07	7.07	61.0	0	1	
i2	245.74191	20.11549	8.09	8.09	65.0	0.1	1	
i4	245.84625	19.906824	9.0	9.0	66.0	-0.1	1	
i3	245.42957	16.05692	7.0	7.0	66	-0.2	1	
i1	245.52347	15.869119	6.1	6.1	68	0.2	1	
i5	245.52347	15.869119	7.05	7.05	65	0	1	
i2	245.91472	15.086617	6.03	6.03	69	0.1	1	
i4	245.99297	14.930119	6.0	6.0	70	-0.1	1	
i6	245.59683	10.984011	8.09	8.09	78	0	1	
i3	229.70718	18.064034	7.02	7.02	66	-0.2	1	
i1	229.8128	17.852758	7.0	7.0	68	0.2	1	
i5	229.8128	17.852758	7.07	7.07	65	0	1	
i2	230.25296	16.972445	6.05	6.05	69	0.1	1	
i4	230.341	16.796381	6.02	6.02	70	-0.1	1	
i3	223.18404	21.409225	7.1	7.1	62.0	-0.2	1	
i1	223.30923	21.158825	8.0	8.0	64.0	0.2	1	
i5	223.30923	21.158825	7.05	7.05	61.0	0	1	
i2	223.8309	20.11549	8.07	8.07	65.0	0.1	1	
i4	223.93526	19.906824	8.1	8.1	66.0	-0.1	1	
i6	223.03973	11.517962	8.07	8.07	78	0	1	
i6	211.47588	11.463279	8.09	8.09	78	0	1	
i3	201.27304	21.409225	8.0	8.0	62.0	-0.2	1	
i1	201.39824	21.158825	8.02	8.02	64.0	0.2	1	
i5	201.39824	21.158825	7.07	7.07	61.0	0	1	
i2	201.91989	20.11549	8.09	8.09	65.0	0.1	1	
i4	202.02423	19.906824	9.0	9.0	66.0	-0.1	1	
i3	200.77126	18.064034	7.02	7.02	66	-0.2	1	
i1	200.87689	17.852758	7.0	7.0	68	0.2	1	
i5	200.87689	17.852758	7.07	7.07	65	0	1	
i2	201.31706	16.972445	6.05	6.05	69	0.1	1	
i4	201.40509	16.796381	6.02	6.02	70	-0.1	1	
i6	192.24103	12.042689	8.09	8.09	78	0	1	
i3	180.53285	18.064034	7.0	7.0	66	-0.2	1	
i1	180.63847	17.852758	6.1	6.1	68	0.2	1	
i5	180.63847	17.852758	7.05	7.05	65	0	1	
i2	181.07866	16.972445	6.03	6.03	69	0.1	1	
i4	181.16667	16.796381	6.0	6.0	70	-0.1	1	
i3	36.166668	15.0	7.0	7.0	66	-0.2	1	
i1	36.254387	14.82456	6.1	6.1	68	0.2	1	
i5	36.254387	14.82456	7.05	7.05	65	0	1	
i2	36.619884	14.093566	6.03	6.03	69	0.1	1	
i4	36.692986	13.947368	6.0	6.0	70	-0.1	1	
i3	59.333332	16.0	7.0	7.0	66	-0.2	1	
i1	59.4269	15.812865	6.1	6.1	68	0.2	1	
i5	59.4269	15.812865	7.05	7.05	65	0	1	
i2	59.81676	15.033138	6.03	6.03	69	0.1	1	
i4	59.894737	14.877193	6.0	6.0	70	-0.1	1	
i3	12.333333	14.499999	7.0	7.0	66	-0.15	1	
i1	12.418128	14.330408	6.1	6.1	68	0.25	1	
i5	12.418128	14.330408	7.05	7.05	65	0.05	1	
i2	12.771442	13.62378	6.03	6.03	69	0.15	1	
i4	12.842105	13.482455	6.0	6.0	70	-0.05	1	
i3	97.5	16.0	7.0	7.0	66	-0.2	1	
i1	97.59357	15.812865	6.1	6.1	68	0.2	1	
i5	97.59357	15.812865	7.05	7.05	65	0	1	
i2	97.98343	15.033138	6.03	6.03	69	0.1	1	
i4	98.0614	14.877193	6.0	6.0	70	-0.1	1	
i3	160.16667	18.0	7.0	7.0	66	-0.2	1	
i1	160.27194	17.789473	6.1	6.1	68	0.2	1	
i5	160.27194	17.789473	7.05	7.05	65	0	1	
i2	160.71053	16.91228	6.03	6.03	69	0.1	1	
i4	160.79825	16.736841	6.0	6.0	70	-0.1	1	
e

</CsScore>

</CsoundSynthesizer>
