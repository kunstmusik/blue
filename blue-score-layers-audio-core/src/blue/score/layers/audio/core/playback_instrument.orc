
Saudio_file = p4
istart = p5
ioffset = p6
iclipDur = p7
ifadeInType = p8
ifadeInTime = p9
ifadeOutType = p10
ifadeOutTime = p11

ifileStart = istart + ioffset

ichannels filenchnls Saudio_file

aenv, ainv blue_fade ioffset, iclipDur, ifadeInTime, ifadeInType, ifadeOutTime, ifadeOutType

if (ichannels == 1) then
  
a0  diskin2 Saudio_file, 1, ifileStart
a0 *= aenv

kindx = 0
while (kindx < ksmps) do
  if(ainv[kindx] == 0.0) then
    {0}[kindx] = a0[kindx]
  else 
    {0}[kindx] = {0}[kindx] * ainv[kindx] + a0[kindx] 
  endif
  kindx += 1
od



elseif (ichannels == 2) then

a0, a1  diskin2 Saudio_file, 1, ifileStart

a0 *= aenv
a1 *= aenv

kindx = 0
while (kindx < ksmps) do
  if(ainv[kindx] == 0.0) then
    {0}[kindx] = a0[kindx]
    {1}[kindx] = a1[kindx]
  else 
    {0}[kindx] = {0}[kindx] * ainv[kindx] + a0[kindx] 
    {1}[kindx] = {1}[kindx] * ainv[kindx] + a1[kindx] 
  endif
  kindx += 1
od


else

endif


