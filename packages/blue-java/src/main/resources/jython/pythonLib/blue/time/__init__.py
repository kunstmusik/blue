"""Compatibility shim for historical Jython imports.

Older Blue scripts could import Java classes with ``from blue.time import
TempoMap``.  The helper runtime now provides a pure-Python implementation, but
keeps this package path so existing projects do not need edits.
"""

from orchestra.tempo import TempoMap

__all__ = ["TempoMap"]

