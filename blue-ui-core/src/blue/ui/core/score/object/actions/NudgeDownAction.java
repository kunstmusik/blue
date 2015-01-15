/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
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
package blue.ui.core.score.object.actions;

import blue.score.ScoreObject;
import blue.score.layers.Layer;
import blue.score.layers.ScoreObjectLayer;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScorePath;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.Collection;
import java.util.List;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.object.actions.NudgeDownAction"
)
@ActionRegistration(
        displayName = "#CTL_NudgeDownAction"
)
@Messages("CTL_NudgeDownAction=NudgeDownAction")
@ActionReference(path = "blue/score/shortcuts", name = "DOWN")
public final class NudgeDownAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        Collection<? extends ScoreObject> selected = 
                ScoreController.getInstance().getSelectedScoreObjects();
              
        if (!selected.isEmpty()) {
            ScorePath path = ScoreController.getInstance().getScorePath();

            ScoreObject[] scoreObjects = selected.<ScoreObject>toArray(
                    new ScoreObject[selected.size()]);
            List<Layer> layers = path.getAllLayers();
            int[] indexes = new int[selected.size()];
            int lastIndex = layers.size() - 1;

            for(int i = 0; i < scoreObjects.length; i++) {
                int index = path.getGlobalLayerIndexForScoreObject(scoreObjects[i]);
                
                if(index >= lastIndex) {
                    return;
                }

                Layer layer = layers.get(index + 1);
                if(!layer.accepts(scoreObjects[i])) {
                    return;
                }

                indexes[i] = index; 
            }

            for(int i = 0; i < scoreObjects.length; i++) {
                Layer from = layers.get(indexes[i]);
                Layer to = layers.get(indexes[i] + 1);

                from.remove(scoreObjects[i]);
                ((ScoreObjectLayer)to).add(scoreObjects[i]);
            }

        }
    }
}
