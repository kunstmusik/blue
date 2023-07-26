package blue.time;

/*
 * blue - object composition environment for csound
 * Copyright (c) 2020 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */

/**
 * 
 * Utility class for converting time values according to meter and tempo. 
 * Support conversions from Csound beat time, samples, bar/beats, 
 * Min:Sec:Ms, H:M:S.F.
 *
 * @author Steven Yi
 */
public class TimeUtilities {
    public static double convertSampleTimeToSeconds(long sampleTime, long sampleRate) {
        return sampleTime / (double)sampleRate;
    }
    
    public static String convertSecondsToTimeString(double timeSeconds) {        
        int hours = (int) (timeSeconds / 3600);
        int minutes = (int) ((timeSeconds % 3600) / 60);
        int seconds = (int) (timeSeconds % 60);
        int milliseconds = (int) Math.round((timeSeconds - (int) timeSeconds) * 1000);

        String timeString = String.format("%02d:%02d:%02d.%03d", hours, minutes, seconds, milliseconds);
        return timeString;
    }
    
    public static double convertTimeToSeconds(int hours, int minutes, int seconds, int milliseconds) {
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000.0;
    }
    
    // FIXME: need to review if this is correct
    public static String convertSecondsToSMPTE(double timeSeconds, double smpteFrameRate) {
        int hours = (int) (timeSeconds / 3600);
        int minutes = (int) ((timeSeconds % 3600) / 60);
        int seconds = (int) (timeSeconds % 60);
        int frameNumber = (int) Math.round((timeSeconds - (int) timeSeconds) * smpteFrameRate);

        String timeString = String.format("%02d:%02d:%02d.%02d", hours, minutes, seconds, frameNumber);
        return timeString;
    }
}
