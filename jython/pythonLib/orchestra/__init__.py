# orchestra - a library for orchestral composition techniques 
#             for use with Csound
# Copyright (C) 2003-2004 by Steven Yi
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
# 

"""
Library to model orchestral composition and performance

Copyright (c) 2003-2004 by Steven Yi
""" 

from orchestra.Note import *
from orchestra.Performer import *
from orchestra.PerformerGroup import *
import orchestra.PerformerGroupFactory
from orchestra.ScoreUtilities import *
#import orchestra.ornamentations 
from orchestra.NoteModifiers import *
from orchestra.NoteList import *
from orchestra.Instruments import instruments
from orchestra.Tuning import *

#__all__ = ['Note', 'Performer', 'PerformerGroup', 'PerformerGroupFactory', 
#    'ScoreUtilities', 'NoteModifiers', 'NoteList', 'Instruments', 'Tuning']

__version__ = '0.1.0'

__author__ = 'Steven Yi <stevenyi@gmail.com>'