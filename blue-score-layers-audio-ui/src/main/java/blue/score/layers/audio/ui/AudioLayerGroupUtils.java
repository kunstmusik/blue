package blue.score.layers.audio.ui;

import blue.score.layers.audio.core.AudioClip;
import blue.score.layers.audio.core.AudioLayer;
import blue.time.TimeContextManager;
import blue.time.TimeDuration;
import blue.time.TimeUnitMath;
import blue.time.TimeUtilities;

/**
 *
 * @author stevenyi
 */


public class AudioLayerGroupUtils {

    public static void splitAudioClip(AudioLayer layer, AudioClip clip, double time) {
        
        AudioClip first = new AudioClip(clip);
        AudioClip second = new AudioClip(clip);

        var context = TimeContextManager.getContext();
        double firstDurBeats = first.getSubjectiveDuration().toBeats(context);
        double secondDurBeats = second.getSubjectiveDuration().toBeats(context);
        double secondStartBeats = second.getStartTime().toBeats(context);
        var startTimeBase = second.getStartTime().getTimeBase();
        var durTimeBase = second.getSubjectiveDuration().getTimeBase();
        
        if(first.getFadeIn() > time) {
            first.setFadeIn(0.0f);
        } else if(time > firstDurBeats - first.getFadeOut()) {
            second.setFadeOut(0.0f);
        }
        
        first.setFadeOut(0.0f);
        second.setFadeIn(0.0f);
        
        first.setSubjectiveDuration(TimeUnitMath.beatsToDuration(time, durTimeBase, context));
        second.setSubjectiveDuration(TimeUnitMath.beatsToDuration(secondDurBeats - time, durTimeBase, context));
        second.setStartTime(TimeUtilities.beatsToTimePosition(secondStartBeats + time, startTimeBase, context));
        second.setFileStartTime(second.getFileStartTime() + time);
        
        layer.remove(clip);
        layer.add(first);
        layer.add(second);
    }
}
