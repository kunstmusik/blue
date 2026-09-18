/**
 * Playback instrument template for audio clip playback.
 * Mirrors the Java playback_instrument.orc resource.
 *
 * Placeholders:
 *   {0} — left channel output variable
 *   {1} — right channel output variable
 */
export const PLAYBACK_INSTRUMENT_ORC = `Saudio_file = p4
istart = p5
ioffset = p6
iclipDur = p7
ifadeInType = p8
ifadeInTime = p9
ifadeOutType = p10
ifadeOutTime = p11
iwrap = p12

ifileStart = istart + ioffset

ichannels filenchnls Saudio_file

aenv, ainv blue_fade ioffset, iclipDur, ifadeInTime, ifadeInType, ifadeOutTime, ifadeOutType

if (ichannels == 1) then

    a0  diskin2 Saudio_file, 1, ifileStart, iwrap

    if (aenv[0] == 1 && aenv[ksmps-1] == 1) then
        {0} = a0
    else
        {0} = {0} * ainv + a0 * aenv
    endif


elseif (ichannels == 2) then

    a0, a1  diskin2 Saudio_file, 1, ifileStart, iwrap

    if (aenv[0] == 1 && aenv[ksmps-1] == 1) then
        {0} = a0
        {1} = a1
    else
        {0} = {0} * ainv + a0 * aenv
        {1} = {1} * ainv + a1 * aenv
    endif

else

endif
`;

/**
 * Playback instrument template with equal-power mono upmix for stereo project output.
 * For mono source (ichannels == 1): a_upmix = a0 / sqrt(2) is routed to both {0} and {1}.
 * For stereo source (ichannels == 2): {0} = a0, {1} = a1.
 *
 * Contributions accumulate into the destination bus variables because the
 * BlueMixer clears them every control cycle: overlapping clips on one track
 * sum instead of silently overwriting one another.
 */
export const PLAYBACK_INSTRUMENT_ORC_PANNING = `Saudio_file = p4
istart = p5
ioffset = p6
iclipDur = p7
ifadeInType = p8
ifadeInTime = p9
ifadeOutType = p10
ifadeOutTime = p11
iwrap = p12

ifileStart = istart + ioffset

ichannels filenchnls Saudio_file

aenv, ainv blue_fade ioffset, iclipDur, ifadeInTime, ifadeInType, ifadeOutTime, ifadeOutType

if (ichannels == 1) then

    a0  diskin2 Saudio_file, 1, ifileStart, iwrap
    a_upmix = a0 / sqrt(2)

    if (aenv[0] == 1 && aenv[ksmps-1] == 1) then
        {0} = {0} + a_upmix
        {1} = {1} + a_upmix
    else
        {0} = {0} * ainv + a_upmix * aenv
        {1} = {1} * ainv + a_upmix * aenv
    endif


elseif (ichannels == 2) then

    a0, a1  diskin2 Saudio_file, 1, ifileStart, iwrap

    if (aenv[0] == 1 && aenv[ksmps-1] == 1) then
        {0} = {0} + a0
        {1} = {1} + a1
    else
        {0} = {0} * ainv + a0 * aenv
        {1} = {1} * ainv + a1 * aenv
    endif

else

endif
`;

/**
 * Playback instrument template for 1-channel (mono) project output.
 * Only {0} is assigned.
 */
export const PLAYBACK_INSTRUMENT_ORC_MONO = `Saudio_file = p4
istart = p5
ioffset = p6
iclipDur = p7
ifadeInType = p8
ifadeInTime = p9
ifadeOutType = p10
ifadeOutTime = p11
iwrap = p12

ifileStart = istart + ioffset

ichannels filenchnls Saudio_file

aenv, ainv blue_fade ioffset, iclipDur, ifadeInTime, ifadeInType, ifadeOutTime, ifadeOutType

if (ichannels == 1) then

    a0  diskin2 Saudio_file, 1, ifileStart, iwrap

    if (aenv[0] == 1 && aenv[ksmps-1] == 1) then
        {0} = a0
    else
        {0} = {0} * ainv + a0 * aenv
    endif


elseif (ichannels == 2) then

    a0, a1  diskin2 Saudio_file, 1, ifileStart, iwrap
    a_mono = (a0 + a1) * 0.5

    if (aenv[0] == 1 && aenv[ksmps-1] == 1) then
        {0} = a_mono
    else
        {0} = {0} * ainv + a_mono * aenv
    endif

else

endif
`;

export function getPlaybackInstrumentOrc(panningEnabled = false, nchnls = 2): string {
  if (!panningEnabled) {
    return PLAYBACK_INSTRUMENT_ORC;
  }
  if (nchnls === 1) {
    return PLAYBACK_INSTRUMENT_ORC_MONO;
  }
  return PLAYBACK_INSTRUMENT_ORC_PANNING;
}
