package blue.score.layers.audio.ui;

import blue.score.layers.audio.core.AudioClip;
import blue.score.layers.audio.core.AudioLayer;
import blue.utility.ObjectUtilities;

/**
 *
 * @author stevenyi
 */


public class AudioLayerGroupUtils {

    public static void splitAudioClip(AudioLayer layer, AudioClip clip, float time) {
        
        AudioClip first = (AudioClip) ObjectUtilities.clone(clip);
        AudioClip second = (AudioClip) ObjectUtilities.clone(clip);

        
        if(first.getFadeIn() > time) {
            first.setFadeIn(0.0f);
        } else if(time > first.getDuration() - first.getFadeOut()) {
            second.setFadeOut(0.0f);
        }
        
        first.setFadeOut(0.0f);
        second.setFadeIn(0.0f);
        
        first.setDuration(time);
        second.setDuration(second.getDuration() - time);
        second.setStart(second.getStart() + time);
        second.setFileStartTime(second.getFileStartTime() + time);
        
        layer.remove(clip);
        layer.add(first);
        layer.add(second);
    }
}
