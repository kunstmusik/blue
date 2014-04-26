/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
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
import blue.score.ScoreObject;
import blue.soundObject.PolyObject;
import blue.ui.core.score.ModeManager;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.layers.soundObject.SoundObjectEditorTopComponent;
import java.awt.event.MouseEvent;
import java.util.Collection;
import java.util.Collections;

/**
 *
 * @author stevenyi
 */
@ScoreMouseListenerPlugin(displayName = "ScoreObjectSelectionListener",
        position=40)
public class ScoreObjectSelectionListener extends BlueMouseAdapter {

    @Override
    public void mousePressed(MouseEvent e) {

        if (ModeManager.getInstance().getMode() != ModeManager.MODE_SCORE) {
            return;
        }

        if (currentScoreObjectView == null) {
            return;
        }

        // consume as a click was done on a score object
        ScoreObject scoreObj = currentScoreObjectView.getScoreObject();
        Collection<? extends ScoreObject> selectedScoreObjects
                = scoreTC.getLookup().lookupAll(ScoreObject.class);

        if (e.isShiftDown()) {
            if (selectedScoreObjects.contains(scoreObj)) {
                ScoreController.getInstance().removeSelectedScoreObject(scoreObj);

            } else {
                ScoreController.getInstance().addSelectedScoreObject(scoreObj);
            }
            e.consume();
        } else {
            if (!selectedScoreObjects.contains(scoreObj)) {
                ScoreController.getInstance().setSelectedScoreObjects(
                        Collections.singleton(scoreObj));
                e.consume();
            } else if (e.getClickCount() == 2) {
                editScoreObject(selectedScoreObjects, scoreObj);
                e.consume();
            }
        }

    }

    protected void editScoreObject(Collection<? extends ScoreObject> selectedScoreObjects,
            ScoreObject scoreObj) {
        if (scoreObj instanceof PolyObject) {
            PolyObject pObj = (PolyObject) scoreObj;
            ScoreController.getInstance().editLayerGroup(pObj);
        } else {
            if (selectedScoreObjects.size() == 1) {
                SoundObjectEditorTopComponent editor
                        = SoundObjectEditorTopComponent.findInstance();

                if (!editor.isOpened()) {
                    editor.open();
                }

                editor.requestActive();

            }
        }
    }
}
