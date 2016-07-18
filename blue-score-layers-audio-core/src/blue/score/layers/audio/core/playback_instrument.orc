
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

aenv blue_fade ioffset, iclipDur, ifadeInTime, ifadeInType, ifadeOutTime, ifadeOutType

if (ichannels == 1) then
  
{0}  diskin2 Saudio_file, 1, ifileStart
{0} *= aenv

elseif (ichannels == 2) then

{0}, {1}  diskin2 Saudio_file, 1, ifileStart

{0} *= aenv
{1} *= aenv

else

endif


