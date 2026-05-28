"""Bach ornamentations for notes (using English terms)"""

from orchestra import Note
from orchestra.ScoreUtilities import pchAdd
    
class AscendingTrill:
    def __init__(self, upperInterval = 1, lowerInterval = -2):
        self.upperInterval = upperInterval
        self.lowerInterval = lowerInterval
      
    def generateScore(self, note, instrumentNum, space):
        dur = float(note.duration)
        #print("Dur: " + str(dur))
        shortDur = dur / 8
        
        upperPch = pchAdd(note.pitch, self.upperInterval)
        lowerPch = pchAdd(note.pitch, self.lowerInterval)
        
        currentTime = note.startTime

        returnScore = ""
        
        notePitches = [lowerPch, note.pitch, upperPch, note.pitch, 
                       upperPch, note.pitch, upperPch, note.pitch]

        for pch in notePitches:
            tempPFields = [instrumentNum, currentTime, shortDur] 
            
            tempPFields += [pch, pch, note.amp, space, note.envType]
            tempPFields += note.extraPFields
        
            tempPFields = [str(i).ljust(15) for i in tempPFields]
        
            returnScore += "i " + " ".join(tempPFields) + "\n"
            
            currentTime += shortDur
                
        return returnScore