package blue.score.layers.audio.ui;

import blue.score.layers.audio.core.AudioClip;
import blue.score.layers.audio.core.FadeType;
import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;

/**
 *
 * @author stevenyi
 */
public class FadeTypePopup extends JPopupMenu {

    private AudioClip clip;
    private boolean fadeIn;
    
    private static FadeTypePopup instance = null;
    
    public static FadeTypePopup getInstance() {
        if(instance == null) {
            instance = new FadeTypePopup();
        }
        return instance;
    }
    
    private FadeTypePopup() {
        for(FadeType f : FadeType.values()) {
            Action a = new AbstractAction(f.toString()) {
                public void actionPerformed(ActionEvent ae) {
                    setType(f);
                }
            };
            JMenuItem menuItem = new JMenuItem(a);
            this.add(a);
        }
    }
    
    protected void setType(FadeType f) {
        if(fadeIn) {
            clip.setFadeInType(f);
        } else {
            clip.setFadeOutType(f);
        }
        this.clip = null;
    }
    
    public void setup(AudioClip clip, boolean fadeIn) {
        this.clip = clip;
        this.fadeIn = fadeIn;
    }
}
