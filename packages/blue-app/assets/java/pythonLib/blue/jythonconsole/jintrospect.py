"""Portable introspection compatibility wrapper.

Java Blue's Jython console used this module to add Java reflection call tips.
The Electron helper bundles the Python library without Java class imports so it
can also be imported by regular Python; Java-specific objects therefore fall
back to the plain Python introspection helpers.
"""

import sys

from introspect import *


def completePackageName(target):
    targetComponents = target.split(".")
    baseModule = __import__(targetComponents[0], globals(), locals())
    module = baseModule

    for component in targetComponents[1:]:
        module = getattr(module, component)

    names = dir(module)
    if "__name__" in names:
        names.remove("__name__")
    names.append("*")
    return names


def getAutoCompleteList(command="", locals=None, includeMagic=1, includeSingle=1, includeDouble=1):
    command += "."
    attributes = []
    root = getRoot(command, terminator=".")

    if command.startswith("import ") or command.startswith("from "):
        try:
            return completePackageName(getPackageName(command))
        except Exception:
            return attributes

    try:
        if locals is not None:
            target = eval(root, locals)
        else:
            target = eval(root)
    except Exception:
        return attributes

    return getAttributeNames(target, includeMagic, includeSingle, includeDouble)


def getPackageName(command):
    parts = command.replace("import", " ").replace("from", " ").split()
    if len(parts) == 0:
        return ""
    return parts[0].rstrip(".")


def getCallTipJava(command="", locals=None):
    return getCallTip(command, locals)


def ispython21(target):
    return 1


def ispython22(target):
    return True


def ispython25(target):
    return True


ispython = ispython22


def debug(name, value=None):
    if value is None:
        sys.stderr.write("%s\n" % name)
    else:
        sys.stderr.write("%s = %s\n" % (name, value))

