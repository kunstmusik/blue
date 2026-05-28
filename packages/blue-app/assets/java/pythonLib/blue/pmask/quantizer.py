# quantizer.py

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

import math
from pmask.generator import *

class Quantizer(Generator):
    def __init__(self, generator, delta, strength = 1.0, offset = 0.0):
        Generator.__init__(self)
        self.generator = generator
        self.delta = delta
        self.strength = strength
        self.offset = offset

    def valueAt(self, evaluationTime):
        value = evaluateAt(self.generator, evaluationTime)
        delta = evaluateAt(self.delta, evaluationTime)
        strength = evaluateAt(self.strength, evaluationTime)
        if strength >= 1.0:
            factor = 0.0
        elif strength <= 0.0:
            factor = 1.0
        else:
            factor = 1.0 - strength
        offset = evaluateAt(self.offset, evaluationTime)

        value -= offset

        delta_2 = delta / 2.0
        quantized_value = 0

        quantized_value = int(value / delta) * delta
        difference = value - quantized_value
        
        if difference > delta_2:
            quantized_value += delta

        if difference < -delta_2:
            quantized_value -= delta

        difference = value - quantized_value
        quantized_value += difference * factor
        return quantized_value + offset

class Attractor(Generator):
    def __init__(self, generator, points, strength = 1.0, exponent = 0.0):
        Generator.__init__(self)
        self.generator = generator
        self.points = points
        self.strength = strength
        self.exponent = exponent

    def findClosest(self, value, evaluationTime):
        min = None
        closest_point = None
        for point in self.points:
            distance = value - evaluateAt(point, evaluationTime)
            if min == None or abs(distance) < abs(min):
                min = distance
                closest_point = point
        return min, closest_point

    def valueAt(self, evaluationTime):
        value = evaluateAt(self.generator, evaluationTime)
        strength = evaluateAt(self.strength, evaluationTime)
        if strength >= 1.0:
            factor = 0.0
        elif strength <= 0.0:
            factor = 1.0
        else:
            factor = pow(1.0 - strength, pow(2.0, self.exponent))

        difference, closest_point = self.findClosest(value, evaluationTime)

        return closest_point + difference * factor

if __name__ == '__main__':
    from pmask.rng import *
    from pmask.mask import *
    from pmask.bpf import *
    from pmask.range import *
    
    rng = UniformRandom()

    strength = LinearSegment([(0.0, 0.0), (1.0, 1.0), (2.0, 0.5)])

    upper = LinearSegment([(0.0, 300.0), (1.0, 350.0), (2.0, 200)])

    m = Mask(rng, 100, upper)
    q = Quantizer(m, 10.0, strength, 0.0)

    t = 0.0
    step = 0.001
    for i in range(2001):
        print t, q.valueAt(t)
        t = t + step

    a = Attractor(Range(100, 1000), [120.0, 160.0, 200.0, 400.0], 0.8, 1.0)
    t = 2.0
    step = 0.001
    for i in range(2001):
        print t, a.valueAt(t)
        t = t + step
