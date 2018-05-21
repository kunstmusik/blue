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
import blue.score.TimeState;
import blue.ui.core.score.ModeManager;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScoreMode;
import blue.ui.core.score.layers.soundObject.actions.PasteSoundObjectAction;
import blue.utility.ScoreUtilities;
import java.awt.Point;
import java.awt.event.MouseEvent;
import javax.swing.Action;

/**
 *
 * @author stevenyi
 */
@ScoreMouseListenerPlugin(displayName = "PasteClickMouseListener",
        position = 20)
public class PasteClickMouseListener extends BlueMouseAdapter {

    private static final int OS_CTRL_KEY = BlueSystem.getMenuShortcutKey();
    PasteSoundObjectAction pasteActionFactory = new PasteSoundObjectAction();

    @Override
    public void mousePressed(MouseEvent e) {
        if ((e.getModifiers() & OS_CTRL_KEY) != OS_CTRL_KEY) {
            return;
        }

        final ScoreController scoreController = ScoreController.getInstance();
        final Point p = e.getPoint();
        final TimeState timeState = scoreTC.getTimeState();

        content.add(p);
        content.add(timeState);

        try {

            double start = (double) p.x / timeState.getPixelSecond();

            if (timeState.isSnapEnabled()) {
                start = ScoreUtilities.getSnapValueStart(start,
                        timeState.getSnapValue());
            }

            switch (ModeManager.getInstance().getMode()) {
                case SCORE:
                    if (currentScoreObjectView == null) {
                        Action a = pasteActionFactory.createContextAwareInstance(
                                scoreTC.getLookup());
                        if (a.isEnabled()) {
                            a.actionPerformed(null);
                        }

                        e.consume();
                    }
                    break;
                case SINGLE_LINE:
                    scoreController.pasteSingleLine(start);
                    break;
                case MULTI_LINE:
                    scoreController.pasteMultiLine(start);
                    break;
            }
        } finally {
            content.remove(p);
            content.remove(timeState);
        }

    }

    @Override
    public boolean acceptsMode(ScoreMode mode) {
        return true;
    }
}
