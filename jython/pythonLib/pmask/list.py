# list.py

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

import whrandom
from pmask.exception import *
from pmask.generator import *

class List(Generator):
    def cycle_next(self):
        item = self.list[self.index]
        if self.index == len(self.list) - 1:
            self.index = 0
        else:
            self.index = self.index + 1
        return item

    def swing_next(self):
        item = self.list[self.index]
        self.index += self.step
        if self.step == 1 and self.index == len(self.list) - 1:
            self.step = -1
        elif self.step == -1 and self.index == 0:
            self.step = 1
        return item

    def random_next(self):
        return whrandom.choice(self.list)
    
    def __init__(self, list, mode = 'cycle'):
        Generator.__init__(self)
        if len(list) == 0:
            raise TooFewElements
        self.list = list

        if mode == 'cycle':
            self.index = 0
            self.next = self.cycle_next
        elif mode == 'swing':
            self.index = 0
            self.step = 1
            self.next = self.swing_next
        elif mode == 'heap':
            self.index = 0
            self.next = self.cycle_next
            self.list = computePermutations(list)
        elif mode == 'random':
            self.next = self.random_next
        else:
            raise BadArgument

    def valueAt(self, evaluationTime):
        return self.next()

def computePermutations(list):
    permutations = []
    permutations.extend(list)
    for i in range(len(list)):
        if i < len(list) - 1:
            n = len(list) - 1
        else:
            n = len(list) - 2
        for j in range(n):
            swapAdiacentElements(list, j)
            permutations.extend(list)
    swapAdiacentElements(list, len(list) - 2)
    return permutations

def swapAdiacentElements(list, n):
    l2 = list[n:n+2]
    l2.reverse()
    list[n:n+2] = l2

