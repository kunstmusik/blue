/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
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
