# Make sure Locales are in sync

import string

keyFile = "SystemMessages_en.properties"

langFiles = [ "SystemMessages.properties",
              "SystemMessages_ko.properties",
              "SystemMessages_es.properties",
              "SystemMessages_ca.properties"
              ]

def getMap(fileObj):
    mapObj = {}
    for line in fileObj:
        if(line.find("=") > -1):
            parts = string.split(line,"=")
            mapObj[parts[0]] = parts[1]
            
    return mapObj
              
def compare(targetFile, keyFile):
    targetF = open(targetFile, "r")
    keyF = open(keyFile,"r")
    
    print "[ Target File: %s ]"%targetFile
    
    targetMap = getMap(targetF)
    keyMap = getMap(keyF)
    
    for key in keyMap.keys():
        try:
            targetMap[key]
        except(KeyError):
            print key
            
    keyF.close()
    targetF.close()
        
    print "\n"
    

    
for f in langFiles:
    compare(f, keyFile)
