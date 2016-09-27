package blue.score.layers.audio.ui;

import blue.score.layers.audio.core.AudioClip;
import blue.score.layers.audio.core.AudioLayer;

/**
 *
 * @author stevenyi
 */


public class AudioLayerGroupUtils {

    public static void splitAudioClip(AudioLayer layer, AudioClip clip, double time) {
        
        AudioClip first = new AudioClip(clip);
        AudioClip second = new AudioClip(clip);

        
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
