# Instrument.py

# ========================================
# Instrument class
# ========================================


class Instrument:
    """Class to quickly build Csound Instruments that comply with Orchestra
    Library
    
    p4	- start frequency, can be either hertz or pch notation 
    p5	- end frequency, can be either hertz or pch notation
    p6	- amplitude, expressed in decibels
    p7	- panning, from range -1 to 1
    p8	- amplitude envelope type, 0 = adsr, 1 = pyramid, 2 = ramp
    
    """

    OUTPUT_NORMAL = 0
    OUTPUT_GLOBAL = 1
    
    
    def __init__(self):
        self.headerText = """
ipch 	= p4
ipch2	= p5
iamp 	= ampdb(p6)
iSpace	= p7
ienvType	= p8

ipch 	= (ipch < 15 ? cpspch(ipch) : ipch)
ipch2 	= (ipch2 < 15 ? cpspch(ipch2) : ipch2)

kpchline 	line ipch, p3, ipch2
"""

        self.envelopeText = """
kenv 	init 	0

if ienvType == 0 kgoto env0  ; adsr
if ienvType == 1 kgoto env1  ; pyramid
if ienvType == 2 kgoto env2  ; ramp

env0:

	kenv	adsr	.3, .2, .9, .5

	kgoto endEnvelope

env1:
	
	kenv 	linseg	0, p3 * .5, 1, p3 * .5, 0

	kgoto endEnvelope

env2:
	
	kenv	linseg 	0, p3 - .1, 1, .1, 0	

	kgoto endEnvelope

endEnvelope:

"""
        self.soundGeneratorCode = """
aout	vco2	iamp * kenv, kpchline, 12

kCut	= (kpchline * 2 * kenv) + kpchline
kCut    	limit kCut, sr * 0.0002, sr * 0.48

aout 	butterlp aout, kCut
    """


        self.panningCode = """
krtl     	= sqrt(2) / 2 * cos(iSpace) + sin(iSpace) ; CONSTANT POWER PANNING
krtr     	= sqrt(2) / 2 * cos(iSpace) - sin(iSpace)	; FROM C.ROADS "CM TUTORIAL" pp460

aLeft 	=	aout * krtl
aRight	=	aout * krtr
"""

        self.outNormal = """
    outs aLeft, aRight
    """

        self.outGlobal = """
ga1 = ga1 + aLeft
ga2 = ga2 + aRight
    """
        self.outputType = self.OUTPUT_NORMAL
    
    def __str__(self):
        iText = self.headerText + "\n"
        iText += self.envelopeText + "\n"
        iText += self.soundGeneratorCode + "\n"
        iText += self.panningCode + "\n"

        if(self.outputType == self.OUTPUT_NORMAL):
            iText += self.outNormal
        elif(self.outputType == self.OUTPUT_GLOBAL):
            iText += self.outGlobal

        return iText
