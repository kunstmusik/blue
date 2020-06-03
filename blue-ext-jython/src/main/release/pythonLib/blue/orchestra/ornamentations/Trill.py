"""Bach ornamentations for notes (using English terms)"""

from orchestra import Note
from orchestra.ScoreUtilities import pchAdd
   
class Trill:
    def __init__(self, interval = 1):
        self.interval = interval
      
    def generateScore(self, note, instrumentNum, space):
        dur = float(note.duration)
        #print("Dur: " + str(dur))
        shortDur = dur / 8
        longDur = dur - (5 * shortDur)
        trillPch = pchAdd(note.pitch, self.interval)
        
        currentTime = note.startTime

        returnScore = ""

        for i in range(5):
            tempPFields = [instrumentNum, currentTime, shortDur] 
            
            if (i % 2) == 1 :
                tempPFields += [note.pitch, note.pitch2, note.amp, space, note.envType]
            else:
                tempPFields += [trillPch, trillPch, note.amp, space, note.envType]
            tempPFields += note.extraPFields
        
            tempPFields = [str(i).ljust(15) for i in tempPFields]
        
            returnScore += "i " + " ".join(tempPFields) + "\n"
            
            currentTime += shortDur
        
        tempPFields = [instrumentNum, currentTime, longDur] 
        tempPFields += [note.pitch, note.pitch2, note.amp, space, note.envType]
        tempPFields += note.extraPFields
        
        tempPFields = [str(i).ljust(15) for i in tempPFields]
        
        returnScore += "i " + " ".join(tempPFields) + "\n"
        
        return returnScore