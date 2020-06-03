# Tuning.py

# ========================================
# Tuning class 
# ========================================

from math import pow
from orchestra import Note, NoteList
from blue.soundObject.pianoRoll import Scale
from java.io import File
import copy

class Tuning:
    """Tuning class uses Scala file to modify p4/p5 values in orchestra notes.
    
       NOTE: note.pch1 and note.pch2 values should be strings for use with this
       tuning processor.  This is due to that in python, if using floats, a 
       value of 8.10 on input will be truncated to 8.1, and to the Tuning class
       these should be different.  Using strings ensures that the Tuning class
       will properly read "8.10" as "Octave 8, scale degree 10"
    """
    
    baseTuningDir = ""
    
    def __init__(self, fileName, baseFreq = 261.625565):
        filepath = fileName
        
        if Tuning.baseTuningDir != "":
            filepath = Tuning.baseTuningDir + "/" + fileName
        
        self.scale = Scale.loadScale(File(filepath))
        self.scale.setBaseFrequency(baseFreq)
        
        
    def applyTuning(self, notes):
        """Converts a NoteList or sequence of notes"""
        
        for note in notes:
            self.convertNote(note)
        
    def convertNote(self, note):
        """Converts an individual note"""
        
        note.pitch = self.convert(note.pitch)
        note.pitch2 = self.convert(note.pitch2)
        
    def convert(self, notePch):
        """Converts a notePch value to it's frequency, depending on values from
        the set Scala file. Note: Currently assumes scale has less than 100 
        scale degrees."""
        
        intervalCount = self.scale.getNumScaleDegrees()
                
        parts = str(notePch).split('.')
            
        oct = int(parts[0])
        pch = int(parts[1])
        
        return self.scale.getFrequency(oct, pch)

############################################################

class TwelveTET(Tuning):
    def __init__(self):
        self.scale = Scale.TwelveTET

############################################################

if __name__ == '__main__':
    Tuning.baseTuningDir = 'c:\\Document and Settings\\syi\\.blue\\scl'
    
    notes = NoteList()
    
    for i in range(25):
        pch = "8.%i"%i
        notes.append( Note(i, 1, pch, pch, 80, 1) )

    print notes
    
    t = Tuning('ji_12.scl')
    
    n = copy.deepcopy(notes)
    t.applyTuning(n)
    print n
    
    
    t = Tuning('thomas.scl')
    n = copy.deepcopy(notes)
    t.applyTuning(n)
    print n    