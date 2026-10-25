"""T057: direct Csound 7 utility probe; imports no Blue code.

Run: python3 native-utility-repro.py CSOUND_LIBRARY AUDIO_FILE
The result records a runtime utility outcome, never mixer acceptance.
"""
import ctypes as c
import hashlib
import json
import os
from pathlib import Path
import sys

library, audio = map(Path, sys.argv[1:3])
api = c.CDLL(str(library))
api.csoundCreate.argtypes = [c.c_void_p, c.c_char_p]
api.csoundCreate.restype = c.c_void_p
api.csoundDestroy.argtypes = [c.c_void_p]
api.csoundListUtilities.argtypes = [c.c_void_p]
api.csoundListUtilities.restype = c.POINTER(c.c_char_p)
api.csoundDeleteUtilityList.argtypes = [c.c_void_p, c.POINTER(c.c_char_p)]
api.csoundRunUtility.argtypes = [c.c_void_p, c.c_char_p, c.c_int32, c.POINTER(c.c_char_p)]
api.csoundRunUtility.restype = c.c_int32
instance = api.csoundCreate(None, None)
if not instance:
    raise RuntimeError("csoundCreate failed")
try:
    utilities = api.csoundListUtilities(instance)
    names = []
    if utilities:
        index = 0
        while utilities[index]:
            names.append(utilities[index].decode())
            index += 1
        api.csoundDeleteUtilityList(instance, utilities)
    arguments = (c.c_char_p * 2)(b"sndinfo", os.fsencode(audio))
    result = api.csoundRunUtility(instance, b"sndinfo", 2, arguments)
    print(json.dumps({
        "library": str(library.resolve()),
        "librarySha256": hashlib.sha256(library.read_bytes()).hexdigest(),
        "version": api.csoundGetVersion(),
        "sampleBytes": api.csoundGetSizeOfMYFLT(),
        "audio": str(audio.resolve()),
        "audioSha256": hashlib.sha256(audio.read_bytes()).hexdigest(),
        "listedUtilities": names,
        "sndinfoAvailable": "sndinfo" in names,
        "sndinfoResult": result,
        "blueCodeLoaded": False,
    }, indent=2))
finally:
    api.csoundDestroy(instance)
