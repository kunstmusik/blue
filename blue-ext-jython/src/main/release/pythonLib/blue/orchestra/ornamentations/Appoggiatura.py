"""Bach ornamentations for notes (using English terms)"""

from orchestra import Note
from orchestra.ScoreUtilities import pchAdd
    
class Appoggiatura:
    def __init__(self, interval = 2):
        self.interval = interval
      
    def generateScore(self, note, instrumentNum, space):
        dur = float(note.duration)
        #print("Dur: " + str(dur))
        shortDur = dur / 2
        
        appoggiaturaPch = pchAdd(note.pitch, self.interval)
        
        currentTime = note.startTime

        returnScore = ""
        
        notePitches = [appoggiaturaPch, note.pitch]

        for pch in notePitches:
            tempPFields = [instrumentNum, currentTime, shortDur] 
            
            tempPFields += [pch, pch, note.amp, space, note.envType]
            tempPFields += note.extraPFields
        
            tempPFields = [str(i).ljust(15) for i in tempPFields]
        
            returnScore += "i " + " ".join(tempPFields) + "\n"
            
            currentTime += shortDur
                
        return returnScore
