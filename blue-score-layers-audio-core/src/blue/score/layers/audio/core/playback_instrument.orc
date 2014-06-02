
Saudio_file = p4
istart = p5

ichannels filenchnls Saudio_file

if (ichannels == 1) then
  
{0}  diskin2 Saudio_file, 1

elseif (ichannels == 2) then

{0}, {1}  diskin2 Saudio_file, 1

else

endif
