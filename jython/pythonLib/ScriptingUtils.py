from javax.swing import JOptionPane
from blue.gui import InfoDialog


def alert(txt):
    """Shows message like JavaScript Alert"""
    JOptionPane.showMessageDialog(None, txt)

def info(txt):
    """Show Text in Scrollable Text Area"""
    InfoDialog.showInformationDialog(None, txt, "Information")

def infoTabs(txt, title):
    """Show Text in Scrollable Text Area in dialog that will add tabs for each new item"""
    InfoDialog.showInformationDialogTabs(txt, title)

def objectInfo(obj):
    """Uses Python Dir to list all methods and properties of object"""
    str = ""
    for i in dir(obj):
        str += i + "\n"
    info(str)

