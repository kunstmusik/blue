# bpf.py

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

# Ottimizzazione:
# - Memorizzare le costanti delle formule di interpolazione
#   per ogni segmento nel costruttore

# Robustezza:
# - Controllare che le coppie siano in sequenza temporale
# - Specificare solo il tempo della prima coppia e un
#   una durata: [ (t0, v0) (d0, v1) (d1, v2) ... ]

import math

from pmask.generator import *

class TooFewPairs:
    pass

class TooFewElements:
    pass

class BPF(Generator):
    def __init__(self, pairs):
        self.pairs = pairs

        if len(self.pairs) < 2:
            raise TooFewPairs
        
    def valueAt(self, evaluationTime):
        (time0, value0) = self.pairs[0]
        
        # Evaluation before first point
        if evaluationTime < time0:
            return value0

        index = 0
        for (time1, value1) in self.pairs:
            if evaluationTime < time1:
                break
            index = index + 1
            time0, value0 = time1, value1

        # Evaluation past last point
        if index == len(self.pairs):
            return value0

        return self.interpolate(evaluationTime,
                                time0, value0, time1, value1)
        
    def interpolate(self, time,
                    time0, value0, time1, value1):
        raise AbstractBaseClass

class PowerSegment(BPF):
    def __init__(self, pairs, exponent):
        BPF.__init__(self, pairs)
        self.exponent = exponent

    def interpolate(self, time,
                    time0, value0, time1, value1):

        if value0 < value1:
            x = (time - time0)/(time1 - time0)
            return value0 + (value1 - value0) * math.pow(x, self.exponent)
        elif value0 > value1:
            x = 1 - (time - time0)/(time1 - time0)
            return value1 + (value0 - value1) * math.pow(x, self.exponent)
        else:
            return value0

class LinearSegment(BPF):
    def __init__(self, pairs):
        BPF.__init__(self, pairs)
        
    def interpolate(self, time,
                    time0, value0, time1, value1):
        return value0 + ((time - time0)/(time1 - time0)) * (value1 - value0)

class HalfCosineSegment(BPF):
    def __init__(self, pairs):
        BPF.__init__(self, pairs)
        
    def interpolate(self, time,
                    time0, value0, time1, value1):
        x = ((time - time0) / (time1 - time0)) * math.pi - math.pi
        return value0 + ((value1 - value0) * (1 + math.cos(x)) / 2.0)

class NoInterpolationSegment(BPF):
    def __init__(self, pairs):
        BPF.__init__(self, pairs)
        
    def interpolate(self, time,
                    time0, value0, time1, value1):
        return value0

def BPFFactory(pairs, kind):
    pass
