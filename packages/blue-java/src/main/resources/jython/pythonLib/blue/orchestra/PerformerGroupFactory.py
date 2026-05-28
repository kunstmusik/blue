"""Factory methods for building PerformerGroups"""

from orchestra import Performer
from orchestra import PerformerGroup

def createArcGroup(groupName, numOfPerformers, iNum, spaceLow, spaceHigh):     
    """Creates a PerformerGroup formed spatially in a slight arc"""
    
    pg = PerformerGroup()       
    pg.groupName = groupName

    half = int(numOfPerformers / 2)

    spaceAdd = (abs(spaceLow - spaceHigh)) / (numOfPerformers - 1)

    for i in range(numOfPerformers):

        amp = 0
        space = spaceLow + (i * spaceAdd)
        breath = 0
        if i < half:
            amp = 1 - (i * .01)
        else :
            amp = 1 - ((numOfPerformers - i) * .01) + .01
            
        temp = Performer(iNum, amp, space, breath)
        temp.name = groupName + " " + str(i + 1)
        pg.append(temp)
        
    return pg