# pitch.py

# PMask, a Python implementation of CMask
# Copyright (C) 2000 by Maurizio Umberto Puxeddu

# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 2 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

import cPickle, sys, os.path
from types import ListType, IntType, TupleType, FloatType
from math import pow, sqrt
from pmask.exception import *

class Pitch:
    def __init__(self, number, octave = 3):
        self.number = number
        self.octave = octave

class PitchConverter:
    def __init__(self):
        pass

    def __call__(self, *args):
        if len(args) == 1:
            arg,  = args
        else:
            arg = []
            arg.extend(args)
            
        if isinstance(arg, Pitch):
            return self.pitch2freq(arg)

        if type(arg) is FloatType or type(arg) is IntType:
            return self.pitch2freq(Pitch(arg))

        if type(arg) is ListType:
            freq = []
            for item in arg:
                if isinstance(item, Pitch):
                    freq.append(self.pitch2freq(item))
                elif type(item) == IntType:
                    freq.append(self.pitch2freq(Pitch(item)))
                elif type(item) == FloatType:
                    freq.append(self.pitch2freq(Pitch(int(item))))
                elif type(item) == TupleType and len(item) == 2:
                    number, octave = item
                    freq.append(self.pitch2freq(Pitch(number, octave)))
                else:
                    raise BadArgument
            return freq

    def normalize(self, modulo, pitch):
        number = pitch.number
        octave = pitch.octave
        while number > modulo-1:
            number -= modulo
            octave += 1
        while number < 0:
            number += modulo
            octave -= 1
        return number, octave

class TET12(PitchConverter):
    root12of2 = pow(2.0, 1.0 / 12.0)
    def __init__(self, central_A_freq = 442.0):
        PitchConverter.__init__(self)
        self.central_A_freq = central_A_freq
    
    def pitch2freq(self, pitch):
        htn = pitch.number - 9 + (pitch.octave - 3) * 12
        return self.central_A_freq * pow(self.root12of2, htn)

tet12 = TET12()

class Scale:
    def __init__(self, name, info, ratioList):
        self.name = name
        self.info = info
        self.ratioList = ratioList

name = os.path.join(sys.prefix, 'share', 'pmask', 'scales')
try:
    file = open(name, 'rb')
    u = cPickle.Unpickler(file)
    scaleList = u.load()
    file.close()
except:
    pass

class GenericPitchConverter(PitchConverter):
    ratio = None
    
    def __init__(self, central_A_freq = tet12(0), number = 0, name = None):        
        PitchConverter.__init__(self)
        self.central_C_freq = central_A_freq / self.ratio[number]
    
    def pitch2freq(self, pitch):
        number, octave = self.normalize(len(self.ratio), pitch)
        return self.central_C_freq * self.ratio[number] * pow(2.0, octave - 3)

class Pythagorean(GenericPitchConverter):
    ratio = [1.0 / 1.0,
             256.0 / 253.0,
             9.0 / 8.0,
             32.0 / 27.0,
             81.0 / 64.0,
             4.0 / 3.0,
             729.0 / 512.0,
             3.0 / 2.0,
             128.0 / 81.0,
             27.0 / 16.0,
             16.0 / 9.0,
             243.0 / 128.0]

pythagoran = Pythagorean()

class Ptolemy(GenericPitchConverter):
    ratio = [1.0 / 1.0,
             16.0 / 15.0,
             9.0 / 8.0,
             6.0 / 5.0,
             5.0 / 4.0,
             4.0 / 3.0,
             45.0 / 32.0,
             3.0 / 2.0,
             8.0 / 5.0,
             5.0 / 3.0,
             9.0 / 5.0,
             15.0 / 8.0]
    
ptolemy = Ptolemy()

class NoSuchScale:
    pass

class NamedPitchConverter(GenericPitchConverter):
    def __init__(self, name = None, central_A_freq = tet12(0), number = 0):
        self.ratio = None
        for scale in scaleList:
            if scale.name == name:
                self.ratio = scale.ratioList
                break
        if self.ratio == None:
            raise NoSuchScale
        GenericPitchConverter.__init__(self, central_A_freq, number)
        
if __name__ == '__main__':
    print tet12([Pitch(0, 3),
                 Pitch(2, 3),
                 Pitch(4, 3),
                 Pitch(5, 3),
                 Pitch(7, 3),
                 Pitch(9, 3),
                 Pitch(11, 3),
                 Pitch(12, 3)])
    print tet12([0, 2, 4, 5, 7, 9, 11, 12])
    print tet12(9)

    print tet12(0, 2, 4, 5, 7, 9, 11, 12)
    print ptolemy(0, 2, 4, 5, 7, 9, 11, 12)
    print pythagoran(0, 2, 4, 5, 7, 9, 11, 12)


    
