import string
import copy
import math

#Java classes
from blue.noteProcessor import TempoMapper

"""Utility functions for score related operations"""

def getBaseTen(pch):
    """Given a pch notation string, return value in base 10"""
    pchParts = string.split(str(pch), ".")
    octave  = int(pchParts[0])

    if len(pchParts) == 1:
        return octave * 12

    pitch   = float("." + pchParts[1])
    pitch   = 100 * pitch

    baseTen = (octave * 12) + pitch

    return baseTen

def getPch(baseTen):
    octave  = int(baseTen / 12)
    pitch   = float(baseTen % 12) / 100

    return octave + pitch

def cpspch(pch, et=12):
    val = getBaseTen(pch)
    oct = int(val / 12)
    pitch = float(val %12) / 100

    fract = math.pow(2.0, oct + (100.0*pitch)/et)
    return fract * 1.02197503906 # Refer to base frequency 

def pchAdd(pch, addValue):
    """given a pch, add interval to that pch

    example:

    pchAdd(7.11, 2)

    will return 8.01

    """

    baseTen = getBaseTen(pch)
    baseTen += float(addValue)

    return getPch(baseTen)

def pchDiff(pch1, pch2):
    """Returns the number of steps between two pch's"""

    baseTen1    = getBaseTen(pch1)
    baseTen2    = getBaseTen(pch2)

    diff    = baseTen2 - baseTen1

    return diff

def makePchSet(startPch, intervalList):
    """Given a starting pch and a list of intervals,
    returns a list of pch's"""

    retVal = [startPch]

    currentPch = startPch

    for interval in intervalList:
        currentPch = pchAdd(currentPch, interval)
        retVal.append(currentPch)

    return retVal


def makeMirror(intervalList):
    """Given an intervalList, creates a mirror of that list"""
    mirror = copy.deepcopy(intervalList)
    for i in range(len(intervalList)):
        mirror.append(-intervalList[-i -1])

    return mirror


def timeWarp(noteList, tempoString):
    """Applies TimeWarp to notes in a notelist, given a string with
    beat-tempo pairs of values"""
    tm = TempoMapper.createTempoMapper(tempoString)
    assert tm != None

    for note in noteList:
        newStart = tm.beatsToSeconds(note.startTime)
        newEnd = tm.beatsToSeconds(note.startTime + note.duration)

        note.startTime = newStart
        note.duration = newEnd - newStart


# BLUE PCH FUNCTIONS

def getBluePchBaseTen(pch, numScaleDegrees):
    """Given a bluePch notation string, return value in base 10"""
    pchParts = string.split(str(pch), ".")
    octave  = int(pchParts[0])

    if len(pchParts) == 1:
        return octave * numScaleDegrees

    pitch   = int(pchParts[1])

    baseTen = (octave * numScaleDegrees) + pitch

    return baseTen

def getBluePch(baseTen, numScaleDegrees):
    octave  = int(baseTen / numScaleDegrees)
    pitch   = baseTen % numScaleDegrees

    return "%i.%i"%(octave, pitch)

def bluePchAdd(pch, addValue, numScaleDegrees):
    """given a bluePch, add interval to that pch

    example:

    pchAdd(7.11, 2, 13)

    will return 8.0

    """

    baseTen = getBluePchBaseTen(pch, numScaleDegrees)
    baseTen += int(addValue)

    return getBluePch(baseTen, numScaleDegrees)

def bluePchDiff(pch1, pch2, numScaleDegrees):
    """Returns the number of steps between two bluePch's"""

    baseTen1    = getBluePchBaseTen(pch1, numScaleDegrees)
    baseTen2    = getBluePchBaseTen(pch2, numScaleDegrees)

    diff    = baseTen2 - baseTen1

    return diff

def makeBluePchSet(startPch, intervalList, numScaleDegrees):
    """Given a starting bluePch and a list of intervals,
    returns a list of bluePch's"""

    retVal = [startPch]

    currentPch = startPch

    for interval in intervalList:
        currentPch = bluePchAdd(currentPch, interval, numScaleDegrees)
        retVal.append(currentPch)

    return retVal