
Saudio_file = p4
istart = p5
ifadeInType = p6
ifadeInTime = p7
ifadeOutType = p8
ifadeOutTime = p9

ichannels filenchnls Saudio_file

if (ichannels == 1) then
  
{0}  diskin2 Saudio_file, 1, istart

elseif (ichannels == 2) then

{0}, {1}  diskin2 Saudio_file, 1, istart

else

endif
