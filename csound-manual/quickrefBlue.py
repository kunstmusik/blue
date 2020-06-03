# This script generates opcodes.xml for blue
# by Steven Yi July 2006
# based on quickref.py by Andres Cabrera June 2006

from xml.dom import minidom
import glob
import re
import sys

# categories holds the list of valid categories for opcodes
from categories import categories

if len(sys.argv) != 3:
    print("Error: Script must be called with 2 arguments")
    print("Usage: quickrefBlue.py manualRoot fileOutName.xml")
    sys.exit(1)

manualRoot = sys.argv[1]
fileOutName = sys.argv[2]

#print manualRoot, " : ", fileOutName

#sys.exit(0)

class OpcodeGroup:
    def __init__(self):
        self.subCategories = []
        self.opcodes = []
        self.name = "Opcode Group"

    def toxml(self, indent=0):
        indentSpace = '  ' * indent
        retVal = '%s<opcodeGroup name="%s">\n'%(indentSpace, self.name)

        for cat in self.subCategories:
            retVal += cat.toxml(indent + 1)

        for op in self.opcodes:
            retVal += op.toxml(indent + 1)

        retVal += '%s</opcodeGroup>\n'%(indentSpace)

        return retVal



class RootNode(OpcodeGroup):
    def __init__(self):
        OpcodeGroup.__init__(self)
        self.name = "root"

    def toxml(self, indent=0):
        retVal = '<CsoundOpcodes>\n'

        for cat in self.subCategories:
            retVal += cat.toxml(indent + 1)

        retVal += '</CsoundOpcodes>\n'

        return retVal

class Opcode:
    cleaner = match = re.compile("<[a-zA-Z/]*>")

    def __init__(self):
        self.name = "opcode"
        self.signature = "opcode"

    def toxml(self, indent=0):
        indent1 = '  ' * indent
        indent2 = '  ' * (indent + 1)
        retVal = "%s<opcode>\n%s<name>%s</name>\n%s<signature>%s</signature>\n%s</opcode>\n"
        retVal = retVal%(indent1, indent2, self.name, indent2, self.signature, indent1)

        return retVal

def createOpcode(opname, txt):
    entryText = txt.replace('&num;', '#')
    entryText = entryText.replace('&plus;', '+')
    entryText = entryText.replace('&dollar;', '$')
    entryText = entryText.replace('&minus;', '-')
    entryText = entryText.replace('&sol;', '/')
    entryText = entryText.replace('&percnt;', '%')
    entryText = entryText.replace('&ast;', '*')
    entryText = entryText.replace('&verbar;', '|')
    entryText = entryText.replace('&circ;', '^')
#    entryText = entryText.replace('&quot;', '"')
#    entryText = entryText.replace('&apos;', '\'')

    #if(entryText.find("&") >= 0):
    #    print ">> " + entryText

    name = entryText[entryText.find('<command>') + 9 : entryText.find('</command>')]

    if len(name) == 0:
        print(">> COULD NOT CREATE OPCODE <<\n", entryText)
        return None

    retVal = Opcode()
    retVal.name =  name
    #retVal.name = opname
    parts = Opcode.cleaner.split(entryText)

    sig = ""

    for i in parts:
        if len(i) == 0 or i == "\n":
            continue

        if len(sig) != 0:
            sig += "\t"

        sig += i

    retVal.signature = sig

    return retVal

rootNode = RootNode()

def findCat(rootNode, catName):

    parts = catName.split(':')

    currentNode = rootNode

    count = 0

    returnNode = None

    while count < len(parts):
        found = False

        for cat in currentNode.subCategories:
            if(cat.name == parts[count]):
                currentNode = cat
                found = True
                break

        # none found, create

        if not found:
            node = OpcodeGroup()
            node.name = parts[count]
            currentNode.subCategories.append(node)
            currentNode = node

        count += 1



    return currentNode

entries = []

for cat in categories:
    findCat(rootNode, cat)
    entries.append([])

manual = open(manualRoot + '/manual.xml', 'r')
text = manual.read()

files = glob.glob(manualRoot + '/opcodes/*.xml')
files[len(files):]=glob.glob(manualRoot + '/opcodes/*/*.xml')
files[len(files):]=glob.glob(manualRoot + '/vectorial/*.xml')
files[len(files):]=glob.glob(manualRoot + '/utility/*.xml')
files.sort()

headerText = text[0:text.find('<book id="index"')]

for i,filename in enumerate(files):
    entry = ''
    #print file
    source = open(filename, 'r')
    newfile = source.read()
    source.close()
    
    refStart = newfile.find("<refentry")

    if(refStart < 0):
        continue
    elif(refStart > 0):
#        print 'Trimming file: ', filename, ' ', refStart
        newfile = newfile[refStart:]
    
    # Necessary to define entities
    newfile = headerText + newfile

    #print text
    try:
        xmldoc = minidom.parseString(newfile)
    except:
        print('>>> Failed to parse:', filename)
        continue

    xmldocId = xmldoc.documentElement.getAttribute('id')
    opcodeName = newfile[newfile.find('<refname>') + 9: newfile.find('</refname>')]

    #print opcodeName


    # Some files need special treatment (adds, dollar, divides, modulus, multiplies,
    # opbitor, opor, raises, subtracts, assign, ifdef, ifndef, define, include, undef)
    # There must be a better way to avoid loosing the entities when parsing the XML
    # file. Anyone???
    if filename.endswith('adds.xml'):
        entry = '<synopsis>a <command>>'+'&plus;</command> b  (no rate restriction)</synopsis>\n<para/>'
    elif filename.endswith('dollar.xml'):
        entry = '<synopsis><command>>'+'&dollar;NAME</command></synopsis>\n<para/>'
    elif filename.endswith('divides.xml'):
        entry = '<synopsis>a <command>>'+'&sol;</command> b  (no rate restriction)</synopsis>\n<para/>'
    elif filename.endswith('modulus.xml'):
        entry = '<synopsis>a <command>>'+'&percnt;</command> b  (no rate restriction)</synopsis>\n<para/>'
    elif filename.endswith('multiplies.xml'):
        entry = '<synopsis>a <command>>'+'&ast;</command> b  (no rate restriction)</synopsis>\n<para/>'
    elif filename.endswith('opbitor.xml'):
        entry = '<synopsis>a <command>>'+'&verbar;</command> b  (bitwise OR)</synopsis>\n<para/>'
    elif filename.endswith('opor.xml'):
        entry = '<synopsis>a <command>>'+'&verbar;&verbar;</command> b  (logical OR; not audio-rate)</synopsis>\n<para/>'
    elif filename.endswith('raises.xml'):
        entry = '<synopsis>a <command>>'+'&circ;</command> b  (b not audio-rate)</synopsis>\n<para/>'
    elif filename.endswith('subtracts.xml'):
        entry = '<synopsis>a <command>>'+'&minus;</command> b (no rate restriction)</synopsis>\n<para/>'
#    elif (filename.endswith('assign.xml'):
#        entry = '''<synopsis> <command>>'+'&minus;</command>a  (no rate restriction)</synopsis>
#        <synopsis> <command>>'+'&plus;</command>a  (no rate restriction)</synopsis>\n'''
    elif filename.endswith('ifdef.xml'):
          entry = '<synopsis><command>>'+'&num;ifdef</command> NAME</synopsis><synopsis>  ....</synopsis>' + \
                  '<synopsis><command>>'+'&num;else</command></synopsis><synopsis>  ....</synopsis>' + \
                  '<synopsis><command>>'+'&num;end</command></synopsis>\n<para/>'
    elif filename.endswith('ifndef.xml'):
              entry='<synopsis><command>>'+'&num;ifndef</command> NAME</synopsis><synopsis>  ....</synopsis>' + \
                '<synopsis><command>>'+'&num;else</command></synopsis><synopsis>  ....</synopsis>' + \
                '<synopsis><command>>'+'&num;end</command></synopsis>\n<para/>'
    elif filename.endswith('define.xml'):
          entry='<synopsis><command>>'+'&num;define</command> NAME &num; replacement text &num;</synopsis><para/>\n' + \
    '<synopsis><command>>'+'&num;define</command> NAME(a&apos; b&apos; c&apos;) &num; replacement text &num;</synopsis>\n<para/>'
    elif filename.endswith('include.xml'):
          entry='<synopsis><command>>'+'&num;include</command> &quot;filename&quot;</synopsis>\n<para/>'
    elif filename.endswith('undef.xml'):
          entry='<synopsis><command>>'+'&num;undef</command> NAME</synopsis>\n<para/>'
    else:
        synopsis = xmldoc.getElementsByTagName('synopsis')
        if (len(synopsis) != 0):
            # There can be more than 1 synopsis per file
            entry = []
            for num in range(len(synopsis)):
                entry.append(synopsis[num].toxml())
        else:
            print("no synopsis tag for file: " + filename)
            entry = ''
    #print entry

    info = xmldoc.getElementsByTagName('refentryinfo')

    if (len(info)!=0):
        category = info[0].toxml()
        category = category[21:-23]
        if category == "Utilities" :
            print("Skipping utility")
            continue
    else:
        #print "no info tag for file" + file
        category = "Miscellaneous"
        if (entry!=''):
            print(file + " sent to Miscellaneous")


    if type(entry) == list:
        for i in entry:
            op = createOpcode(opcodeName, i)
            if(op != None):
                cat = findCat(rootNode, category)
                cat.opcodes.append(op)
    else:
        op = createOpcode(opcodeName, entry)
        if(op != None):
                cat = findCat(rootNode, category)
                cat.opcodes.append(op)

rootNode.subCategories.pop(0)
rootNode.subCategories.pop(len(rootNode.subCategories) - 1)

quickref = open(fileOutName,'w')
quickref.write("\n<!-- Don't modify this file. It is generated automatically by quickrefBlue.py-->\n")
quickref.write(rootNode.toxml())
quickref.flush()
quickref.close()
