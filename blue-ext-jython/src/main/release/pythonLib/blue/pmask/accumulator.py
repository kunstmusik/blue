# accumulator.py

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

class Accumulator(Generator):
    def __init__(self, generator, mode = None, lower = None, upper = None, sum0 = 0):
        Generator.__init__(self)

        self.generator = generator
        self.sum = sum0
        self.upper = upper
        self.lower = lower

        if mode == 'unbound' or mode == None:
            self.add = self.noBounds
        elif mode == 'limit':
            self.add = self.limitAtBounds
        elif mode == 'reflect' or mode == 'mirror':
            self.add = self.reflectAtBounds
        elif mode == 'wrap':
            self.add = self.wrapAtBounds
        else:
            raise BadArgument

    def valueAt(self, evaluationTime):
        self.add(evaluateAt(self.generator, evaluationTime), evaluationTime)
        return self.sum

    def noBounds(self, value, evaluationTime):
        self.sum += value

    def limitAtBounds(self, value, evaluationTime):
        lower = evaluateAt(self.lower, evaluationTime)
        upper = evaluateAt(self.upper, evaluationTime)
        self.sum += value
        if self.sum > upper:
            self.sum = upper
        elif self.sum < lower:
            self.sum = lower

    def reflectAtBounds(self, value, evaluationTime):
        lower = evaluateAt(self.lower, evaluationTime)
        upper = evaluateAt(self.upper, evaluationTime)
        self.sum += value
        if self.sum > upper:
            self.sum = upper - (self.sum - upper)
        elif self.sum < lower:
            self.sum = lower + (lower - self.sum)

    def wrapAtBounds(self, value, evaluationTime):
        lower = evaluateAt(self.lower, evaluationTime)
        upper = evaluateAt(self.upper, evaluationTime)
        self.sum += value
        if self.sum > upper:
            self.sum = lower + (self.sum - upper)
        elif self.sum < lower:
            self.sum = upper - (lower - self.sum)

if __name__ == '__main__':
    from pmask.random import *
    from pmask.function import *

    r = Range(-10, 10)
    a = Accumulator(r, 'wrap', -100.0, 100.0)
    
    for i in range(1000):
        print i, r.valueAt(i), a.valueAt(i)
