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

    def normalize(self):
        max = None
        min = None
        for t, v in self.pairs:
            if max == None or v > max:
                max = v
            if min == None or v < min:
                min = v

        if max == None or min == None:
            return
        
        factor = max - min
        new_pairs = []
        for t, v in self.pairs:
            v = (v - min) / factor
            new_pairs.append((t, v))

        self.pairs = new_pairs
            
class PowerSegment(BPF):
    def __init__(self, pairs, exponent):
        BPF.__init__(self, pairs)
        self.exponent = exponent

    def interpolate(self, time,
                    time0, value0, time1, value1):
        r = (time - time0)/(time1 - time0)

        if value1 == value0:
            return value0
        elif self.exponent == 0.0:
            return value0 + r * (value1 - value0)
        elif self.exponent > 0.0:
            if value1 >= value0:
                return value0 + pow(r, 1.0 + self.exponent) * (value1 - value0)
            else:
                return value1 + pow(1.0 - r, 1.0 + self.exponent) * (value0 - value1)
        else:
            if value1 >= value0:
                return value1 + pow(1.0 - r, 1.0 - self.exponent) * (value0 - value1)
            else:
                return value0 + pow(r, 1.0 - self.exponent) * (value1 - value0)
            
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
        x = ((time - time0) / (time1 - time0)) * math.pi + math.pi
        return value0 + ((value1 - value0) * (1 + math.cos(x)) / 2.0)

class NoInterpolationSegment(BPF):
    def __init__(self, pairs):
        BPF.__init__(self, pairs)
        
    def interpolate(self, time,
                    time0, value0, time1, value1):
        return value0

def BPFFactory(pairs, kind):
    pass

if __name__ == '__main__':
    pairs = [(0.0, 0.0), (4.0, 10.0), (7.0, 5.0), (9.0, 8.0)]
    
    segment1 = HalfCosineSegment(pairs)
    segment2 = NoInterpolationSegment(pairs)
    segment3 = PowerSegment(pairs, 0.5)
    segment4 = PowerSegment(pairs, 2.0)
    segment5 = PowerSegment(pairs, -0.5)
    segment6 = PowerSegment(pairs, -2.0)
    segment7 = LinearSegment(pairs)
    
    t = 0.0
    step = 0.01
    for i in range(1200):
        print t, segment1.valueAt(t), segment2.valueAt(t), segment3.valueAt(t),\
              segment4.valueAt(t), segment5.valueAt(t), segment6.valueAt(t),\
              segment7.valueAt(t)
        t = t + step
