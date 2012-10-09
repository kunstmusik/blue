# chaos.py

# Chaotic Generators for PMask
# Copyright (C) 2000 by Hans Mikelson
# PMask by Maurizio Umberto Puxeddu

# Lorenz(OK), Circle squared (OK), Bifurcation(OK), Hopalong, Mandelbrot(OK), Julia (OK), Henon (OK)
#---------------------------------------------------------------------
# I just got this going so these are likely to have some bugs in them.
# --Hans
#---------------------------------------------------------------------
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
#---------------------------------------------------------------------

from math import pow, fabs, fmod, sin, cos, pi, sqrt
from generator import *

#---------------------------------------------------------------------
# The Lorenz chaotic oscillator
#---------------------------------------------------------------------
class Lorenz(Generator):
    def __init__(self, val="x", h = .001, x = 19.1,  y = 9.8,  z = 48.0,
		s = 10.0, r = 28.0, b = 2.6667, max = 30):
        Generator.__init__(self)
	self.val = val
        self.h   = h
	self.x   = x
	self.y   = y
	self.z   = z
        self.s   = s
	self.r   = r
	self.b   = b
	self.max = max

    def valueAt(self, evaluationTime):
	h = evaluateAt(self.h, evaluationTime)
	s = evaluateAt(self.s, evaluationTime)
	r = evaluateAt(self.r, evaluationTime)
	b = evaluateAt(self.b, evaluationTime)

	while 1:
	  xx = self.x + h*(s*(self.y - self.x))
	  yy = self.y + h*(-self.x*self.z + r*self.x - self.y)
	  self.z += h*(self.x*self.y - b*self.z)
	  self.x = xx
	  self.y = yy
	  if abs(eval('self.'+self.val))<=self.max:
	    break

        # return eval('self.'+self.val)
        return (eval('self.'+self.val)/self.max + 1.0)/2.0 # Normalize the window 0-1

#---------------------------------------------------------------------
# Circle squared
#---------------------------------------------------------------------
class CircleSqr(Generator):
    def __init__(self, step = .23457, cx = -2.5,  cy = -2.5, loop = 50, c = 8):
        Generator.__init__(self)
	self.step = step	# Step size, Hint: Do not use integer steps.
        self.cx   = cx		# Corner X
	self.x    = cx		# Initial X
	self.y    = cy		# Initial Y
	self.loop = loop	# Number of steps in X before incr Y
	self.i    = 0		# Counter
	self.c    = c		# Mod value, Originally the number of colors

    def valueAt(self, evaluationTime):
	step = evaluateAt(self.step, evaluationTime)

	if self.i >= self.loop:
	  self.i  = 0
	  self.x  = self.cx
	  self.y += step
	else:
	  self.i += 1
	  self.x += step

	val = (self.x*self.x + self.y*self.y)%self.c # Often only the integer portion of this is used.

        return val/self.c	# Normalize 0-1

#---------------------------------------------------------------------
# Verhulst Bifurcation, pp = r*p*(1-p), 0<p<1, 2<r<4
#---------------------------------------------------------------------
class Bifurcation(Generator):
    def __init__(self, r = 3.7, p = .66, cycles = 100):
        Generator.__init__(self)
	self.r    = r		# Initial population
        self.p    = p		# Growth rate
	for i in range(cycles):
	  self.p = self.r*self.p*(1 - self.p)

    def valueAt(self, evaluationTime):
	r      = evaluateAt(self.r, evaluationTime)
	self.p = r*self.p*(1 - self.p)
        return self.p

#---------------------------------------------------------------------
# Hopalong algorithm
#---------------------------------------------------------------------
class Hopalong(Generator):
    def __init__(self, val="x", a = .1, b = 4, c = 0, max = 50):
        Generator.__init__(self)
	self.val = val
	self.a   = a		# Coeff A
        self.b   = b		# Coeff B
	self.c   = c		# Coeff C
	self.x   = 0
	self.y   = 0
	self.max = max		# Only generate points in a window 100 wide

    def valueAt(self, evaluationTime):
	a      = evaluateAt(self.a, evaluationTime)
	b      = evaluateAt(self.b, evaluationTime)
	c      = evaluateAt(self.c, evaluationTime)

	while 1:
	  xx     = self.y - cmp(self.x, 0) + sqrt(abs(b*self.x - c))
	  self.y = a - self.x
	  self.x = xx
	  if abs(eval('self.'+self.val))<=self.max:
	    break

        return (eval('self.'+self.val)/self.max + 1.0)/2.0 # Normalize the window 0-1

#---------------------------------------------------------------------
# Mandelbrot
# z = z^2 + c
# z starts at 0, c is the coordinate (pixel)
#---------------------------------------------------------------------
class Mandelbrot(Generator):
    def __init__(self, stepr = .1, stepj = .1, corner = -1.5-2.5j, max = 200, scan=31, scandir = 'imag'):
        Generator.__init__(self)
	self.stepr   = stepr	# Real step size
	self.stepj   = stepj    # Complex step size
        self.corner  = corner	# Corner Z
	self.max     = max	# Number of steps in X before incr Y
	self.scan    = scan	# Number of steps before reset
	self.scandir = scandir	# Scan direction (real 'r' or imaginary 'i')
	self.i       = 0	# Scan Counter
	self.c       = self.corner # Initilize c

    def valueAt(self, evaluationTime):
	stepr = evaluateAt(self.stepr, evaluationTime)	# stepr & stepj can be modified during
	stepj = evaluateAt(self.stepj, evaluationTime)	# event generation

	if self.scandir == 'real':			# This determines horiz or vert scanning
	  if self.i >= self.scan:			# Time to reset col, i & inc row
	    self.i       = 0
	    self.c       = self.corner.real+self.c.imag*1j
	    self.c      += stepj*1j
	  else:						# Otherwise just inc col & i
	    self.i      += 1
	    self.c      += stepr
	else:
	  if self.i >= self.scan:			# Horiz scanning
	    self.i       = 0
	    self.c       = self.corner.imag*1j + self.c.real
	    self.c      += stepr
	  else:
	    self.i      += 1
	    self.c      += stepj*1j

	self.count = 0
	self.z     = 0					# The main mandelbrot loop
	while (abs(self.z)<2) & (self.count<self.max):
	  self.z  = self.z**2 + self.c
	  self.count += 1

        return float(self.count)/self.max		# Normalize to 1.0

#---------------------------------------------------------------------
# Julia
# z = z^2 + c
# z is the coordinate (pixel), c is constant
#---------------------------------------------------------------------
class Julia(Generator):
    def __init__(self, scandir = 'imag', stepr = .05, stepj = .05, corner = -1.5-1.1j, max = 200, scan=31, c=.3+.6j):
        Generator.__init__(self)
	self.stepr   = stepr	# Step size real
	self.stepj   = stepj    # Step size complex
        self.corner  = corner   # Corner Z
	self.z       = corner
	self.max     = max	# Number of steps in X before incr Y
	self.scan    = scan	# Number of steps before reset
	self.scandir = scandir	# Scan direction (real 'r' or imaginary 'i')
	self.i       = 0	# Scan Counter
	self.c       = c	# Initilize c

    def valueAt(self, evaluationTime):
	stepr = evaluateAt(self.stepr, evaluationTime)
	stepj = evaluateAt(self.stepj, evaluationTime)

	if self.scandir == 'real':
	  if self.i >= self.scan:
	    self.i       = 0
	    self.z       = self.corner.real+self.z.imag*1j
	    self.z      += stepj*1j
	  else:
	    self.i      += 1
	    self.z      += stepr
	else:
	  if self.i >= self.scan:
	    self.i       = 0
	    self.z       = self.corner.imag*1j + self.z.real
	    self.z      += stepr
	  else:
	    self.i      += 1
	    self.z      += stepj*1j

	self.count = 0
	while (abs(self.z)<2) & (self.count<self.max):
	  self.z  = self.z**2 + self.c
	  self.count += 1

        return float(self.count)/self.max

#---------------------------------------------------------------------
# Henon attractor
#---------------------------------------------------------------------
class Henon(Generator):
    def __init__(self, val = 'x', a = 1.4, b = .3, x = .5, y = .2, max = 3):
        Generator.__init__(self)
	self.val = val
	self.a   = a		# A
        self.b   = b		# B, real descriptive, ain't it?
	self.x   = x
	self.y   = y
	self.max = max

    def valueAt(self, evaluationTime):
	a        = evaluateAt(self.a, evaluationTime)
	b        = evaluateAt(self.b, evaluationTime)

	while 1:
	  xx       = 1 + self.y - a*self.x*self.x
	  self.y   = b*self.x
	  self.x   = xx
	  if abs(eval('self.'+self.val))<=self.max:
	    break

        return (eval('self.'+self.val)/self.max + 1.0)/2.0 # This should normalize to 1.0

# 12-10-2000, Attempted to change generators to normalize to 1.0
# 12-9-2000, Fixed bugs in Mandelbrot & Julia which caused them to be always zero.

# Not yet implemented:
# Rossler attractor
# Barnsley J1
# Feather
# Planet
# KA Oscillator ? Does not work
# Simple Chaos 1-5

if __name__ == '__main__':
    lx = Lorenz('x', 0.01)
    ly = Lorenz('y', 0.01)
    lz = Lorenz('z', 0.01)
    
    for i in range(20001):
        print lx.valueAt(i),  lx.valueAt(i), lz.valueAt(i)
