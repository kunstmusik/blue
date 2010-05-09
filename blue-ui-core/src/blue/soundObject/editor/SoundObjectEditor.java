package blue.soundObject.editor;

import javax.swing.JComponent;

import blue.soundObject.SoundObject;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public abstract class SoundObjectEditor extends JComponent {
    public abstract void editSoundObject(SoundObject sObj);
}