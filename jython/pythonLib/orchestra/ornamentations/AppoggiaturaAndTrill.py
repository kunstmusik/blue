"""Bach ornamentations for notes (using English terms)"""

from orchestra import Note
from orchestra.ScoreUtilities import pchAdd
    
class AppoggiaturaAndTrill:
    def __init__(self, interval = 2):
        self.interval = interval
      
    def generateScore(self, note, instrumentNum, space):
        dur = float(note.duration)
        #print("Dur: " + str(dur))
        
        upperPch = pchAdd(note.pitch, self.interval)
        
        currentTime = note.startTime

        returnScore = ""
        
        notePitches = [upperPch, note.pitch, upperPch, note.pitch,
                       upperPch, note.pitch]
        durations = [ dur / 2, dur / 16, dur /16, dur / 16, dur /16, dur / 4]

        for i in range(6):
            tempPFields = [instrumentNum, currentTime, durations[i]] 
            
            tempPFields += [notePitches[i], notePitches[i], note.amp, space, note.envType]
            tempPFields += note.extraPFields
        
            tempPFields = [str(j).ljust(15) for j in tempPFields]
        
            returnScore += "i " + " ".join(tempPFields) + "\n"
            
            currentTime += durations[i]
                
        return returnScore
