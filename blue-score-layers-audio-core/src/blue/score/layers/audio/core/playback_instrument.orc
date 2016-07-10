
Saudio_file = p4
istart = p5
ifadeInType = p6
ifadeInTime = p7
ifadeOutType = p8
ifadeOutTime = p9

ichannels filenchnls Saudio_file

aenv blue_fade ifadeInTime, ifadeInType, ifadeOutTime, ifadeOutType

if (ichannels == 1) then
  
{0}  diskin2 Saudio_file, 1, istart
{0} *= aenv

elseif (ichannels == 2) then

{0}, {1}  diskin2 Saudio_file, 1, istart

{0} *= aenv
{1} *= aenv

else

endif


