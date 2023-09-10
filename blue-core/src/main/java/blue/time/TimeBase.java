/*
 * blue - object composition environment for csound
 * Copyright (c) 2023 Steven Yi (stevenyi@gmail.com)
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
package blue.time;

/**
 * Timebase settings to choose manner of preservation when time context changes 
 * (e.g., tempo change, meter change, time insert/delete)
 *
 * @author Steven Yi
 */
public enum TimeBase {
    /** Delegate to project default timebase */
    PROJECT_DEFAULT,
    
    /** Class Blue timebase using global number of Csound beats. Does not take 
     * into account measures.
     */
    
    CSOUND_BEATS, 
    
    /** Hours:Minutes:Seconds.MS **/
    TIME, 
    
    /** Hours:Minutes:Seconds.Frames **/
    SMPTE,
    
    /** Audio Sample Frame Number **/
    FRAME, 
}
