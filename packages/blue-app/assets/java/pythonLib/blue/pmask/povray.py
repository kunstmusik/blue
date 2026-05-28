# povray.py

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

import UserList, types
from exception import *
from generator import *
from math import *

#---------------------------------------------------------------
# Point class with rotation, translation, set.
#---------------------------------------------------------------
class Point:
  def __init__(self, x=0.0, y=0.0, z=0.0):
    self.x = x
    self.y = y
    self.z = z

  def rotate(self, xy=0.0, xz=0.0, yz=0.0):
    xx     =  self.x*cos(xy)+self.y*sin(xy)
    self.y = -self.x*sin(xy)+self.y*cos(xy)
    self.x = xx

    xx     =  self.x*cos(xz)+self.z*sin(xz)
    self.z = -self.x*sin(xz)+self.z*cos(xz)
    self.x = xx

    yy     =  self.y*cos(yz)+self.z*sin(yz)
    self.y = -self.y*sin(yz)+self.z*cos(yz)
    self.y = yy

  def translate(self, dx=0.0, dy=0.0, dz=0.0):
    self.x += dx
    self.y += dy
    self.z += dz

  def set(self, x=0.0, y=0.0, z=0.0):
    self.x = x
    self.y = y
    self.z = z

  def __str__(self):
    return "<"+str(self.x)+","+str(self.z)+","+str(self.y)+">"

#---------------------------------------------------------------
# Simple color class with red, green, blue and transparency
#---------------------------------------------------------------
class Color:
  def __init__(self, r=1.0, g=1.0, b=1.0, t=0.0):
    self.r = r
    self.g = g
    self.b = b
    self.t = t

  def set(self, r=1.0, g=1.0, b=1.0, t=0.0):
    self.r = r
    self.g = g
    self.b = b
    self.t = t

  def __str__(self):
    return "texture{pigment{rgbt <"+str(self.r)+","+str(self.g)+","+str(self.b)+","+str(self.t)+">}}"

#---------------------------------------------------------------
# Sphere class, paint, locate, rotate, duplicate, size, reflect
#---------------------------------------------------------------
class Sphere:
  def __init__(self,r=1.0,x=0.0,y=0.0,z=0.0,red=1.0,green=1.0,blue=1.0,trans=0.0):
    self.pos    = Point()
    self.pos.set(x,y,z)
    self.color  = Color()
    self.color.set(red,green,blue,trans)
    self.radius = r

  def __str__(self):
    s = "sphere{"
    s = s+str(self.pos)
    s = s+" "+str(self.radius)
    s = s+" "+str(self.color)+"finish {phong 1 phong_size 100 reflection 0.21}}"
    return s

  def locate(self, x, y, z):
    self.pos.set(x,y,z)

  def paint(self,r=1.0,g=1.0,b=1.0,t=0.0):
    self.color.set(r,g,b,t)

  def rotate(self,rx=0.0,ry=0.0,rz=0.0):
    self.pos.rotate(rx,ry,rz)

  def size(self,r=1.0):
    self.radius = r

  def dup(self):
    s = Sphere()
    s.radius = self.radius
    s.color.set(self.color.r,self.color.g,self.color.b,self.color.t)
    s.pos.set(self.pos.x,self.pos.y,self.pos.z)
    return s

  def reflect(self):
    self.pos.x = -self.pos.x

#---------------------------------------------------------------
# Prism object
#---------------------------------------------------------------
class Prism:
  def __init__(self,x=0.0,y=0.0,z=0.0,h=1.0,c=None):
    c = Color()

    self.xcoord = []
    self.ycoord = []
    self.pos = Point(x,y,z)
    self.h      = h
    self.color  = c
    self.xy     = 0.0
    self.xz     = 0.0
    self.yz     = 0.0

  def __str__(self):
    s = 'prism {linear_sweep '
    s = s+str(self.pos.z)+','+str(self.pos.z+self.h)
    s = s+','+str(len(self.xcoord)+1)+',\n'
    for i in range(len(self.xcoord)):
      s = s+'<'+str(self.xcoord[i])+','+str(self.ycoord[i])+'>,'
    s = s+'<'+str(self.xcoord[0])+','+str(self.ycoord[0])+'>\n'
    s = s+str(self.color)+\
          '\nfinish {phong 1 phong_size 100 reflection 0.25}'+\
          ' rotate <'+str(self.xy)+','+str(self.xz)+','+str(self.yz)+'>'+\
          ' translate <'+str(self.pos.x)+','+str(self.pos.z)+','+str(self.pos.y)+'>}\n'
    return s
#          ' rotate <'+str(self.xz)+',0.0,'+str(self.yz)+'>'+\

  def locate(self, x, y, z):
    self.pos.set(x,y,z)

  def rotate(self, xy):
    for i in range(len(self.xcoord)):
      xx             =  cos(xy)*(self.xcoord[i]) + sin(xy)*(self.ycoord[i])
      self.ycoord[i] = -sin(xy)*(self.xcoord[i]) + cos(xy)*(self.ycoord[i])
      self.xcoord[i] = xx
    xx         =  cos(xy)*(self.pos.x) + sin(xy)*(self.pos.y)
    self.pos.y = -sin(xy)*(self.pos.x) + cos(xy)*(self.pos.y)
    self.pos.x = xx

  def set_rot(self, xy=0.0, xz=0.0, yz=0.0):
    self.xy = xy
    self.xz = xz
    self.yz = yz

  def paint(self,r=1.0,g=1.0,b=1.0,t=0.0):
    self.color.set(r,g,b,t)

  def dup(self):
    p    = Prism()
    p.xcoord = []
    for xi in self.xcoord:
      p.xcoord.append(xi)
    p.ycoord = []
    for yi in self.ycoord:
      p.ycoord.append(yi)
    p.color.set(self.color.r,self.color.g,self.color.b,self.color.t)
    p.h = self.h
    p.pos.set(self.pos.x,self.pos.y,self.pos.z)
    p.xy = self.xy
    p.xz = self.xz
    p.yz = self.yz
    return p

  def reflect(self):
    self.pos.x = -self.pos.x
    for i in range(len(self.xcoord)):
      self.xcoord[i] = -self.xcoord[i]
    self.yz = -self.yz

#---------------------------------------------------------------
# Color scheme
#---------------------------------------------------------------
def colorscheme (n=1.0,x=0.0):
  c=Color()

  # Black & White
  if n == 1:
    c.set(x,x,x)

  # Pink->White->Blue
  if n == 2:
    if x<.5:
      c.set(1.0,x*2.0,.5+x)
    if x>=.5:
      c.set(1.0-(x-.5)*2.0,1.0-(x-.5)*2.0,1.0-(x-.5))

  # Green->Yellow->Red
  if n == 3:
    if x<.5:
      c.set(x*2.0,.5+x,0.0)
    if x>=.5:
      c.set(1.0,1.0-(x-.5)*2.0,0.0)

  # Gold->Purple->Cyan
  if n == 4:
    if x<.5:
      c.set(1.0-x,.5-x,x*2)
    if x>=.5:
      c.set(1.0-x,(x-.5)*2,1)

  return c

#---------------------------------------------------------------
# POV Section Class
#---------------------------------------------------------------
class PovSection(UserList.UserList):		# Inherits from UserList.UserList
  def __init__(self, number, shape, *args):
    UserList.UserList.__init__(self)

    for i in range(number):
      apply_list = []
      for pfield in args:
        apply_list.append(evaluateAt(pfield, i))
      povobject = apply(eval(shape), apply_list)
      self.append(povobject)

  def __str__(self):
    s = ''
    for obj in self:
      s = s + str(obj) + '\n'
    return s

  def symmetry(self, n=6):
    l2 = []
    for li in self:
      l2.append(li)

    for li in l2[:]:
      for i in range(n-1):
        l1 = li.dup()
        l1.rotate(2.0*(i+1)*pi/n)
        self.append(l1)

  def genl(self,l,n,gen):
    for obj in self:
      #eval("self."+l+" = []")
      for i in range(n):
        eval("obj."+l+".append(evaluateAt(gen,i))")

  #---------------------------------------------------------------
  # Reflect the list of objects through x
  #---------------------------------------------------------------
  def mirror(self):
    l2 = []
    for li in self:
      l2.append(li)

    for li in l2[:]:
      l1 = li.dup()
      l1.reflect()
      self.append(l1)

  def recolor(self,scheme=1,x=1.0):
    t = 0
    for obj in self:
      obj.color=colorscheme(scheme,evaluateAt(x,t))
      t=t+1
      

