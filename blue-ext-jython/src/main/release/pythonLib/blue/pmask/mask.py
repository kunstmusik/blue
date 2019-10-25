# mask.py

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

class NoGenerator:
    pass

class Mask(Generator):
    def __init__(self, generator, lowerLimit, upperLimit, exponent = 0.0):
        Generator.__init__(self)
        self.upperLimit = upperLimit
        self.lowerLimit = lowerLimit
        self.generator = generator
        self.exponent = math.pow(2.0, exponent)

    def mapAt(self, value, evaluationTime):
        max = evaluateAt(self.upperLimit, evaluationTime)
        min = evaluateAt(self.lowerLimit, evaluationTime)

        #return min + (max - min) * value
        return min + (max - min) * math.pow(value, self.exponent)

    def valueAt(self, evaluationTime):
        return self.mapAt(self.generator.valueAt(evaluationTime), evaluationTime)

if __name__ == '__main__':
    from pmask.random import *
    rng = UniformRandom()

    m = Mask(rng, 100, 300)

    t = 0.0
    step = 0.001
    for i in range(2000):
        print t, m.valueAt(t)
        t = t + step
