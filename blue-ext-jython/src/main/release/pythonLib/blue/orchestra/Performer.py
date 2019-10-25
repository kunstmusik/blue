# Performer.py

import random
import copy
from ScoreUtilities import timeWarp

# ========================================
# performer class
# ========================================



class Performer:
    """Performers, given musical data, output musical data via performance functions
    They have parameters that define their character"""

    def __init__(self, iNum, baseAmp, space, name = "performer", breath = 1):
        self.iNum = iNum
        self.breath = breath
        self.currentBreath = breath
        self.baseAmp = baseAmp
        self.space = space
        self.name = name
        self.breath = breath
        self.tuning = None

    def setTuning(self, tuning):
        """Sets Tuning of the Performer"""
        self.tuning = tuning

    def __str__(self):
        return "[P: " + self.name + "] instrument: " + str(self.iNum) + \
                " breath: " + str(self.breath) + \
               " baseAmp: " + str(self.baseAmp) + " space: " + str(self.space)

    def perform(self, noteList):
        """ Straight performance of the music line, applying performer character properties """
        score = ""
        start = 0

        tempNoteList = copy.deepcopy(noteList)

        for note in tempNoteList:
            # adjust note start by up to .01
            timeVariance = random.random() * .01

            # adjust time of note to keep the note starts the same
            note.duration = note.duration - timeVariance
            note.amp = note.amp * self.baseAmp

            start += timeVariance + note.duration

        # apply tuning if set
        if self.tuning != None:
            self.tuning.applyTuning(tempNoteList)

        for note in tempNoteList:
            score += note.getNote(self.iNum, self.space) + "\n"

        return score

    def performAleatorically(self, noteList, timeVariance, ampVariance, pitchVariance, durationOfSection, startOffset=0, tempoString=None):
        timeCounter = startOffset
        score = ""

        listCopy = copy.deepcopy(noteList)

        # apply tuning if set
        if self.tuning != None:
            self.tuning.applyTuning(listCopy)

        while timeCounter < durationOfSection:
            tempNoteList = copy.deepcopy(listCopy)

            if(tempoString != None):
                timeWarp(tempNoteList, tempoString)

            tempNoteList.translate(timeCounter)

            timeAdj = 1 + (random.gauss(.5, .5) * timeVariance )
            ampAdj  = self.baseAmp - (random.gauss(.5, .5) * ampVariance)



            #time and amp should be linked

            #print "time: " + str(timeAdj) + " amp:" + str(ampAdj)

            tempNoteList.scale(timeAdj)



            for note in tempNoteList:
                note.amp = note.amp * ampAdj

                score += note.getNote(self.iNum, self.space) + "\n"
                timeCounter += note.duration

        return score

    def performLutoslawskiAleatory(self, notelist, timeVariance, ampVariance, durationOfSection):
        pass

    def performRandomOrder(self, musicalIdeas, pauseTimeMin, pauseTimeMax):
        tempIdeas = copy.deepcopy(musicalIdeas)
        random.shuffle(tempIdeas)

        pauseRange = pauseTimeMax - pauseTimeMin

        timeCounter = 0
        score = ""

        for musicalIdea in tempIdeas:
            pauseTime = (random.random() * pauseRange) + pauseTimeMin
            duration = musicalIdea.getDuration()

            musicalIdea.translate(timeCounter)
            score = score + self.perform(musicalIdea)

            timeCounter = timeCounter + duration + pauseTime
            print timeCounter, duration, pauseTime

        return score

