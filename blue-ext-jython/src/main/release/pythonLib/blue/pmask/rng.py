# random.py

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

import random
from math import tan, pi

from pmask.generator import *
from pmask.exception import *

class UniformRandom(Generator):
    def __init__(self):
        Generator.__init__(self)
        self.rng = random.WichmannHill()

    def valueAt(self, evaluationTime):
        return self.rng.random()

class LinearRandom(Generator):
    def __init__(self):
        Generator.__init__(self)
        self.rng = random.WichmannHill()

    def valueAt(self, evaluationTime):
        a = self.rng.random()
        b = self.rng.random()
        
        if a < b:
            return a
        else:
            return b

class InverseLinearRandom(Generator):
    def __init__(self):
        Generator.__init__(self)
        self.rng = random.WichmannHill()

    def valueAt(self, evaluationTime):
        a = self.rng.random()
        b = self.rng.random()
                
        if a > b:
            return a
        else:
            return b

class TriangularRandom(Generator):
    def __init__(self):
        Generator.__init__(self)
        self.rng = random.WichmannHill()

    def valueAt(self, evaluationTime):
        while 1:
            a = self.rng.random()
            b = self.rng.random() / 2
                
            if (a < 0.5 and a > b) or (a >= 0.5 and (a - 0.5) < b):
                return a

class InverseTriangularRandom(Generator):
    def __init__(self):
        Generator.__init__(self)
        self.rng = random.WichmannHill()

    def valueAt(self, evaluationTime):
        while 1:
            a = self.rng.random()
            b = self.rng.random() / 2
                
            if (a < 0.5 and a < b) or (a >= 0.5 and (a - 0.5) > b):
                return a

class ExponentialRandom(Generator):
    def __init__(self, lambd = 1.0):
        Generator.__init__(self)
        self.lambd = lambd

    def valueAt(self, evaluationTime):
        lambd = evaluateAt(self.lambd, evaluationTime)
        while 1:
            r = random.expovariate(lambd)
            if r < 1.0: break
        return r

class ReverseExponentialRandom(Generator):
    def __init__(self, lambd = 1.0):
        Generator.__init__(self)
        self.lambd = lambd

    def valueAt(self, evaluationTime):
        lambd = evaluateAt(self.lambd, evaluationTime)
        while 1:
            r = 1.0 - random.expovariate(lambd)
            if r > 0.0: break
        return r

class BilateralExponentialRandom(Generator):
    def __init__(self, lambd = 1.0):
        Generator.__init__(self)
        self.lambd = lambd

    def valueAt(self, evaluationTime):
        lambd = evaluateAt(self.lambd, evaluationTime)
        while 1:
                r = random.expovariate(lambd)
                if r < 1.0: break
        if random.random() > 0.5:
            return 0.5 + r / 2.0
        else:
            return 0.5 - r / 2.0
            
class GaussRandom(Generator):
    def __init__(self, mu = 0.5, sigma = 0.1):
        Generator.__init__(self)
        self.mu = mu
        self.sigma = sigma

    def valueAt(self, evaluationTime):
        mu = evaluateAt(self.mu, evaluationTime)
        sigma = evaluateAt(self.sigma, evaluationTime)
        while 1:
            value = random.gauss(mu, sigma)
            if value >= 0.0 and value <= 1.0:
                break
        return value
            
class CauchyRandom(Generator):
    def __init__(self, alpha = 0.1, mu = 0.5):
        Generator.__init__(self)
        self.alpha = alpha
        self.mu = mu

    def valueAt(self, evaluationTime):
        mu = evaluateAt(self.mu, evaluationTime)
        alpha = evaluateAt(self.alpha, evaluationTime)
        while 1:
            while 1:
                x = random.random()
                if x != 0.5: break
            value = alpha * tan(x * pi) + mu
            if value <= 1.0 and value >= 0: break
        return value

class BetaRandom(Generator):
    def __init__(self, alpha = 0.1, beta = 0.1):
        Generator.__init__(self)
        self.rng = random.WichmannHill()
        self.alpha = alpha
        self.beta = beta

    def valueAt(self, evaluationTime):
        alpha = evaluateAt(self.alpha, evaluationTime)
        beta = evaluateAt(self.beta, evaluationTime)
        if self.rng.random() > 0.5:
            return 1.0 - random.betavariate(alpha, beta)
        else:
            return random.betavariate(alpha, beta)
    
class WeibullRandom(Generator):
    def __init__(self, alpha = 0.5, beta = 2.0):
        Generator.__init__(self)
        self.alpha = alpha
        self.beta = beta

    def valueAt(self, evaluationTime):
        alpha = evaluateAt(self.alpha, evaluationTime)
        beta = evaluateAt(self.beta, evaluationTime)
        while 1:
            value = random.weibullvariate(alpha, beta)
            if value >= 0.0 and value <= 1.0:
                break
        return value

if __name__ == '__main__':
    def testRandom(rng, begin, end, n, m):
        counter = []
        for i in range(m):
            counter.append(0)

        t = 0.0
        step = (end - begin) / n
        for i in range(n):
            r = rng.valueAt(t)
            print r
            for j in range(m-1, -1, -1):
                floor = j / float(m)
                ceil = (j+1)/float(m)
                if r >= floor and r < ceil:
                    counter[j] = counter[j] + 1
                    break
            t += step
        #sum = 0
        #for j in range(m):
        #    sum += counter[j]
        #    print (j+1) / float(m), counter[j]/float(n)

    #rng = UniformRandom()
    #testRandom(rng, 10000, 100)

    #rng = LinearRandom()
    #testRandom(rng, 10000, 100)

    #rng = InverseLinearRandom()
    #testRandom(rng, 10000, 100)

    #rng = TriangularRandom()
    #testRandom(rng, 10000, 100)

    #rng = InverseTriangularRandom()
    #testRandom(rng, 10000, 100)

    #rng = ExponentialRandom(1.0)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    #rng = ExponentialRandom(0.7)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    #rng = ExponentialRandom(2.0)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    
    #rng = ReverseExponentialRandom(1.0)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    #rng = ReverseExponentialRandom(0.7)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    #rng = ReverseExponentialRandom(2.0)
    #testRandom(rng, 0.0, 20.0, 10000, 100)

    #rng = BilateralExponentialRandom(1.0)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    #rng = BilateralExponentialRandom(0.7)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    #rng = BilateralExponentialRandom(2.0)
    #testRandom(rng, 0.0, 20.0, 10000, 100)

    #rng = GaussRandom(0.5, 0.2)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    #rng = GaussRandom(0.5, 0.1)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    #rng = GaussRandom(0.2, 0.2)
    #testRandom(rng, 0.0, 20.0, 10000, 100)

    rng = CauchyRandom(0.5, 0.2)
    testRandom(rng, 0.0, 20.0, 10000, 100)
    rng = CauchyRandom(0.5, 0.15)
    testRandom(rng, 0.0, 20.0, 10000, 100)
    rng = CauchyRandom(0.2, 0.2)
    testRandom(rng, 0.0, 20.0, 10000, 100)
    
    #rng = BetaRandom(0.2, 0.2)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    #rng = BetaRandom(0.6, 0.6)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    #rng = BetaRandom(0.1, 0.3)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    
    #rng = WeibullRandom(0.5, 3.0)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    #rng = WeibullRandom(0.5, 5.0)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    #rng = WeibullRandom(0.5, 1.0)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
    #rng = WeibullRandom(0.5, 0.3)
    #testRandom(rng, 0.0, 20.0, 10000, 100)
