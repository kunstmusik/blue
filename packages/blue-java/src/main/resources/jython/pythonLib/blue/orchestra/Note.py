# Note.py

# ========================================
# note classes
# ========================================

class Note:
    """Note class corresponds to Csound orchestra instrument template"""
    
    def __init__(self, startTime, duration, pitch, pitch2, amp, envType, *args, **keywords):
        """Accepts arbitrary extra values (pFields) starting from p9"""
        self.startTime = startTime
        self.duration = duration
        self.isTied = 0
                
        self.pitch = pitch
        self.pitch2 = pitch2
        self.amp = amp
        self.envType = envType
        self.extraPFields = list(args)
        
        
                
        self.modifier = None
        
        if keywords.has_key("previousNote"):
            previousNote = keywords["previousNote"]
            
            if self.startTime == "+":
                self.startTime = float(previousNote.startTime) + float(previousNote.duration)
            
            if self.duration == ".":
                self.duration = previousNote.duration
                self.isTied = previousNote.isTied
                
            if self.startTime == ".":
                self.startTime = previousNote.startTime
                
            if self.pitch == ".":
                self.pitch = previousNote.pitch
                
            if self.pitch2 == ".":
                self.pitch2 = previousNote.pitch2
                
            if self.amp == ".":
                self.amp = previousNote.amp
                
            if self.envType == ".":
                self.envType = previousNote.envType
                
            for i in range(len(self.extraPFields)):
                if self.extraPFields[i] == ".":
                    self.extraPFields[i] = previousNote.extraPFields[i]
                    
        self.startTime = float(self.startTime)
    
        self.duration = float(self.duration)
        
        if self.duration < 0:
            self.duration = float(self.duration) * -1
            self.isTied = 1        
        
        self.amp = float(self.amp)
        self.envType = int(self.envType)
                       
    def setModifier(self, modifier):
        self.modifier = modifier
        
    def getEndTime(self):
        return self.startTime + self.duration
    
    def getNote(self, instrumentNum, space):
        """Generates a Csound noteString.  startTime and space should be passed
        in from Performer"""
        
        if self.modifier != None:
            return self.modifier.generateScore(self, instrumentNum, space)

        p3field = self.duration
        
        if self.isTied:
            p3field = self.duration * -1

        tempPFields = [instrumentNum, self.startTime, p3field] 
        tempPFields += [self.pitch, self.pitch2, self.amp, space, self.envType]
        tempPFields += self.extraPFields
        
        tempPFields = [str(i).ljust(15) for i in tempPFields]

        #return "i " + " ".join(map(str,tempPFields))
        return "i " + " ".join(tempPFields)


class Rest:
    """Rest class produces no noteText but is useful for putting in space in
    music lines"""
    
    def __init__(self, startTime, duration):
        self.startTime = startTime
        self.duration = duration
        self.hasFermata = 0
        self.pitch = 0
        self.pitch2 = 0
        self.amp = 0
        self.envType = 0
        self.extraPFields = []
        
    def setModifier(self, modifier):
        pass

    def getEndTime(self):
        return self.startTime + self.duration
        
    def getNote(self, instrumentNum, space):
        return ""

        
def createNote(str, **keywords):
    fields = str.split()

    n = apply(Note, fields, keywords)
        
    return n