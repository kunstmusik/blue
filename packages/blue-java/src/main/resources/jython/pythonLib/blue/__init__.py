"""Blue Python compatibility package.

Java Blue exposed some helper classes to Jython through Java packages such as
``blue.time`` and ``blue.soundObject.pianoRoll``.  The Electron helper keeps
those import paths as small Python shims so older scripts continue to import,
while the actual implementations remain in the portable top-level modules.
"""

