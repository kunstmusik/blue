"""Compatibility shim for historical Jython dialog imports.

Java Blue used ``blue.gui.InfoDialog`` for Swing dialogs.  The Electron helper
is headless, so these methods write to stdout where JythonSession captures the
messages for the caller.
"""


class InfoDialog(object):
    @staticmethod
    def showInformationDialog(parent, text, title):
        _print_message(title, text)

    @staticmethod
    def showInformationDialogTabs(text, title):
        _print_message(title, text)


def _print_message(title, text):
    if title:
        print("%s: %s" % (title, text))
    else:
        print(str(text))


__all__ = ["InfoDialog"]

