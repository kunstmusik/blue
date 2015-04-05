/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.ui.core.score.mouse;

import blue.plugin.ScoreMouseListenerPlugin;
import blue.BlueSystem;
import blue.ui.core.score.ModeManager;
import blue.ui.core.score.ScoreMode;
import blue.ui.core.score.layers.soundObject.actions.PasteSoundObjectAction;
import java.awt.Point;
import java.awt.event.MouseEvent;
import javax.swing.Action;

/**
 *
 * @author stevenyi
 */
@ScoreMouseListenerPlugin(displayName = "PasteClickMouseListener",
        position=20)
public class PasteClickMouseListener extends BlueMouseAdapter {

    private static final int OS_CTRL_KEY = BlueSystem.getMenuShortcutKey();
    PasteSoundObjectAction pasteActionFactory = new PasteSoundObjectAction();

    @Override
    public void mousePressed(MouseEvent e) {
        if (ModeManager.getInstance().getMode() != ScoreMode.SCORE
                || currentScoreObjectView != null
                || (e.getModifiers() & OS_CTRL_KEY) != OS_CTRL_KEY
        
            ) {
            return;
        }
        
        e.consume();

        Point p = e.getPoint();
        content.add(p);
        content.add(scoreTC.getTimeState());

        Action a = pasteActionFactory.createContextAwareInstance(
                scoreTC.getLookup());
        if (a.isEnabled()) {
            a.actionPerformed(null);
        }

        content.remove(p);
        content.remove(scoreTC.getTimeState());
    }

    @Override
    public boolean acceptsMode(ScoreMode mode) {
        return mode == ScoreMode.SCORE;
    }
}
