
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

    if (aenv[0] == 1 && aenv[ksmps-1] == 1) then
        {0} = a0
    else
        {0} = {0} * ainv + a0 * aenv
    endif


elseif (ichannels == 2) then

    a0, a1  diskin2 Saudio_file, 1, ifileStart

    if (aenv[0] == 1 && aenv[ksmps-1] == 1) then
        {0} = a0
        {1} = a1
    else
        {0} = {0} * ainv + a0 * aenv 
        {1} = {1} * ainv + a1 * aenv 
    endif

else

endif


