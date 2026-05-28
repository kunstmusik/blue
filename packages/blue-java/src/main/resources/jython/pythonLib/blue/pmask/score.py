# score.py

# PMask, a Python implementation of CMask
# Copyright (C) 2000 by Maurizio Umberto Puxeddu
# Copyright (C) 2001 by Maurizio Umberto Puxeddu and Hans Mikelson

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

import UserList, types
from exception import *
from generator import *

class ScoreEvent:
    def __init__(self, kind, *args):
        self.kind = kind
        self.pfields = []
        self.pfields.extend(args)
        
    def __str__(self):
        string = self.kind
        for pfield in self.pfields:
            if type(pfield) is types.StringType:
                string += ' "' + pfield + '"'
            else:
                string += ' ' + str(pfield)
        return string

    def writeTo(self, file):
        file.write(str(self) + '\n')

class IStatement(ScoreEvent):
    def __init__(self, number, time, duration, *args):
        apply_list = [self, 'i', number, time, duration]
        apply_list.extend(args)
        apply(ScoreEvent.__init__, apply_list)

class FStatement(ScoreEvent):
    def __init__(self, number, time, length, type, *args):
        apply_list = [self, 'f', number, time, length, type]
        apply_list.extend(args)
        apply(ScoreEvent.__init__, apply_list)

class ScoreSection(UserList.UserList):
    def __init__(self, begin, end,
                 number, time, duration, *args):
        UserList.UserList.__init__(self)

        t = begin
        while t < end:
            apply_list = [number, t, evaluateAt(duration, t)]
            for pfield in args:
                apply_list.append(evaluateAt(pfield, t))
            istatement = apply(IStatement, apply_list)
            self.add(istatement)
            t += evaluateAt(time, t)

    def add(self, istatement):
        if not isinstance(istatement, IStatement):
            raise BadArgument
        self.append(istatement)

    def translate(self, time, mode = 'absolute'):
        if mode == 'absolute':
            tmin = None
            for event in self.data:
                if tmin == None or event.pfields[1] < tmin:
                    tmin = event.pfields[1]
            offset = time - tmin
        else:
            offset = time

        for i in self.data:
            i.pfields[1] += offset

    def reverse(self):
        tmin, tmax = self.tmin_tmax()
        for event in self.data:
            event.pfields[1] = tmax - (event.pfields[1] - tmin)

        self.data.reverse()

    def expand(self, factor, mode = 'forward', duration = 'fixed'):
        tmin, tmax = self.tmin_tmax()
        if mode == 'forward':
            zero = tmin
        elif mode == 'backward':
            zero = tmax
        elif mode == 'center':
            zero = (tmin + tmax) / 2.0
        else:
            raise BadArgument

        for event in self.data:
            event.pfields[1] = zero - (zero - event.pfields[1]) * factor

        if duration != 'fixed':
            for event in self.data:
                event.pfields[2] *= factor

    def adjust(self, time):
        for i in self.data:
            offset = evaluateAt(time, i.pfields[1])
            i.pfields[1] += offset

    def tmin_tmax(self):
        tmin = None
        tmax = None
        for event in self.data:
            if tmin == None or event.pfields[1] < tmin:
                tmin = event.pfields[1]
            if tmax == None or event.pfields[1] > tmax:
                tmax = event.pfields[1]
        return tmin, tmax

    def begin_end(self):
        begin = None
        end = None
        for event in self.data:
            if begin == None or event.pfields[1] < begin:
                begin = event.pfields[1]
            if end == None or event.pfields[1] + event.pfields[2] > end:
                end = event.pfields[1] + event.pfields[2] 
        return begin, end
        
    def __str__(self):
        if len(self.data):
            s = str(self.data[0])
            for i in self.data[1:]:
                s += '\n' + str(i)
            return s
        return ''

    def writeTo(self, file):
        s = str(self)
        if s != '':
            file.write(str(self) + '\n')
    
def serializeSections(time, mode = 'joint', *args):
    startTime = time
    for section in args:
        if not isinstance(section, ScoreSection):
            raise BadArgument
        if startTime != None:
            section.translate(startTime)
            
        if mode == 'joint':
            tmin, startTime = section.tmin_tmax()
        elif mode == 'disjoint':
            begin, startTime = section.begin_end()
        else:
            raise BadArgument
