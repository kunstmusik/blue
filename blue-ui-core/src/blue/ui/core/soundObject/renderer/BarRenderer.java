package blue.ui.core.soundObject.renderer;

/**
 * Title:        blue
 * Description:  an object composition environment for csound
 * Copyright:    Copyright (c) 2001
 * Company:      steven yi music
 * @author steven yi
 * @version 1.0
 */

import java.awt.Graphics;

import blue.ui.core.score.layers.soundObject.SoundObjectView;

public interface BarRenderer {
    public void render(Graphics graphics, SoundObjectView sObjView,
            int pixelSeconds);

    public void cleanup(SoundObjectView sObjView);

    public Class getSoundObjectClass();
}