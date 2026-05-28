def alert(txt):
    """Shows message like JavaScript Alert.

    Java Blue displayed this with Swing.  The Electron helper is headless, so
    messages are printed and captured in the Jython response stdout.
    """
    _print_message("Alert", txt)

def info(txt):
    """Show Text in Scrollable Text Area"""
    _print_message("Information", txt)

def infoTabs(txt, title):
    """Show Text in Scrollable Text Area in dialog that will add tabs for each new item"""
    _print_message(title, txt)

def objectInfo(obj):
    """Uses Python Dir to list all methods and properties of object"""
    str = ""
    for i in dir(obj):
        str += i + "\n"
    info(str)

def _print_message(title, txt):
    if title:
        print("%s: %s" % (title, txt))
    else:
        print(str(txt))
