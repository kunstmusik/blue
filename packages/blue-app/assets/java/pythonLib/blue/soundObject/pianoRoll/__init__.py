"""Compatibility shim for historical Jython imports.

Java Blue exposed ``blue.soundObject.pianoRoll.Scale`` to bundled Python code.
This shim preserves that import path while delegating to the portable
``orchestra.scale`` implementation.
"""

from orchestra.scale import Scale

__all__ = ["Scale"]

