import copy

from UserList import UserList
from orchestra.ScoreUtilities import pchAdd
from Note import createNote

class NoteList(UserList):
    """List of notes, used by Performer and PerformerGroups"""

    def scale(self, scaleVal):
        """scales the noteList by given value"""
        for note in self:
            note.startTime = note.startTime * scaleVal
            note.duration = note.duration * scaleVal
        
    def translate(self, transVal):
        """translates the noteList over by give value"""
        for note in self:
            note.startTime = note.startTime + transVal
    
    def getDuration(self):
        """Returns the duration of the NoteList,
        
        currently assumes first note starts at time 0,
        maybe should give absolute value of the line(?)
        
        """
        if len(self) == 0:
            return 0 
            
        lastNote = self[0]              

        for note in self:
            if note.getEndTime() > lastNote.getEndTime():            
                lastNote = note
                    
        return lastNote.getEndTime()

    def retrograde(self):
        """Returns a retrograde copy of this NoteList"""
        
        if len(self) == 0:
            return NoteList()
            
        dur = self.getDuration()
        
        temp = copy.deepcopy(self)
        
        for note in temp:
            note.startTime = dur - note.startTime - note.duration
           
        return temp
        
    def transpose(self, interval):
        """Returns a transposed copy of this NoteList"""
        
        if len(self) == 0:
            return NoteList()
            
        temp = copy.deepcopy(self)
        
        for note in temp:
            note.pitch = pchAdd(note.pitch, interval)
            note.pitch2 = pchAdd(note.pitch2, interval)
            
        return temp

    def __str__(self):
        retVal = ""
        for i in self:
            retVal = retVal + i.getNote("x", 0) + "\n"
            
        return retVal

def createNoteList(str):
    """Convenience method to generate NoteList from string input"""
    notes = NoteList()
    
    lines = str.split("\n")
    
    pNote = None
    
    for line in lines:
        l = line.split(";")[0] # strip any csound comments
        if len(l.strip()) > 0:
            n = createNote(l, previousNote = pNote)
            notes.append(n)
            pNote = n
        
    return notes        
