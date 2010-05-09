import random
import math
import copy
import string

from UserList import UserList

from orchestra import Performer
from orchestra import Note
from orchestra.ScoreUtilities import pchDiff, pchAdd

class PerformerGroup(UserList):
    """A collection of Performers, that can accept musical data for
    performance.  Some techniques are techniques that each performer
    performs, some are group compositional techniques that each performer
    plays a different part in."""

    def setTuning(self, tuning):
        """Set tuning for all Performers in the PerformerGroup"""
        for p in self:
            p.setTuning(tuning)

    def __str__(self):
        returnText = "[" + self.groupName + "]\n"

        for p in self:
            returnText += str(p) + "\n"

        return returnText + "\n"

    def perform(self, noteList, timeCounter = 0):
        """Each performer in the group perform()'s musicLine"""

        returnScore = ""

        for p in self:
            returnScore += p.perform(noteList)

        return returnScore


    def performAleatorically(self, noteList, timeVariance, ampVariance, pitchVariance, durationOfSection, randStartOffset=0, timeString=None):
        """Each performer in the group performAleatorically()'s noteList"""
        returnScore = ""

        for p in self:
            start = random.random() * randStartOffset
            returnScore += p.performAleatorically(noteList, timeVariance, ampVariance, pitchVariance, durationOfSection, start, timeString)

        return returnScore

    def performSurface(self, amp, envType, time1a, pch1a, time1b, pch1b, time2a, pch2a, time2b, pch2b):
        """ using y = mx + b to calculate the start and end points of the two surface edges
        y maps to pch, x maps to time

        note: currently does not check if the second set of point starts before the first
        and may cause unwanted results"""

        returnScore = ""

        line1Dur = float(time1b) - time1a
        line2Dur = float(time2b) - time2a

        m1 = pchDiff(pch1a, pch1b) / float(len(self) - 1)
        m2 = pchDiff(pch2a, pch2b) / float(len(self) - 1)
        b1 = pch1a
        b2 = pch2a

        for i in range(len(self)):
            x = i / float(len(self) - 1)
            startTime   = float(x * line1Dur) + time1a

            endTime     = float(x * line2Dur) + time2a
            duration    = endTime - startTime
            pch1    = pchAdd(pch1a, m1 * i)
            pch2    = pchAdd(pch2a, m2 * i)

            tempNoteList = [Note(startTime, duration, pch1,  pch2, amp, envType)]
            returnScore += self[i].perform(tempNoteList)

        return returnScore