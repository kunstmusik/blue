"""Bach ornamentations for notes (using English terms)"""

from orchestra import Note
from orchestra.ScoreUtilities import pchAdd
        
class AppoggiaturaAndMordent:
    def __init__(self, interval = -1):
        self.interval = interval
      
    def generateScore(self, note, instrumentNum, space):
        dur = float(note.duration)
        #print("Dur: " + str(dur))
        
        lowerPch = pchAdd(note.pitch, self.interval)
        
        currentTime = note.startTime

        returnScore = ""
        
        notePitches = [lowerPch, note.pitch, lowerPch, note.pitch]
        durations = [ dur / 2, dur / 8, dur /8, dur / 4]

        for i in range(4):
            tempPFields = [instrumentNum, currentTime, durations[i]] 
            
            tempPFields += [notePitches[i], notePitches[i], note.amp, space, note.envType]
            tempPFields += note.extraPFields
        
            tempPFields = [str(j).ljust(15) for j in tempPFields]
        
            returnScore += "i " + " ".join(tempPFields) + "\n"
            
            currentTime += durations[i]
                
        return returnScore
