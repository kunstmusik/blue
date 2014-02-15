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
package blue.ui.core.score.layers.soundObject.actions;

import blue.BlueData;
import blue.projects.BlueProjectManager;
import blue.score.Score;
import blue.score.ScoreObject;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import blue.score.layers.ScoreObjectLayer;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScoreTopComponent;
import blue.ui.core.score.layers.LayerGroupPanel;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JComponent;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.awt.ActionRegistration;
import org.openide.util.ContextAwareAction;
import org.openide.util.Lookup;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.layers.soundObject.actions.SelectAllAfterAction")
@ActionRegistration(
        displayName = "#CTL_SelectAllAfterAction")
@Messages("CTL_SelectAllAfterAction=Select All After")
@ActionReferences({
@ActionReference(path = "blue/score/layers/audio/actions",
        position = 100, separatorAfter = 105), 
@ActionReference(path = "blue/score/layers/soundObject/actions",
        position = 100, separatorAfter = 105)})
public final class SelectAllAfterAction extends AbstractAction
        implements ContextAwareAction {

    final Point p;
    final LayerGroupPanel lgPanel;

    public SelectAllAfterAction() {
        this(null, null);
    }

    private SelectAllAfterAction(Point p, LayerGroupPanel lgPanel) {

        super(NbBundle.getMessage(SelectLayerAction.class,
                "CTL_SelectAllAfterAction"));
        this.p = p;
        this.lgPanel = lgPanel;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        JComponent comp = ((JComponent) lgPanel);

        if (p.y < 0 || p.y > comp.getHeight()) {
            return;
        }

        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();
        Score score = data.getScore();

        float pointTime = (float) p.x
                / ScoreTopComponent.findInstance().getTimeState().getPixelSecond();
        ArrayList<ScoreObject> newSelected = new ArrayList<>();

        for (LayerGroup<Layer> layerGroup : score) {
            for (Layer layer : layerGroup) {
                if (layer instanceof ScoreObjectLayer) {
                    ScoreObjectLayer<ScoreObject> sLayer = (ScoreObjectLayer) layer;

                    for (ScoreObject scoreObject : sLayer) {
                        if (scoreObject.getStartTime() >= pointTime) {
                            newSelected.add(scoreObject);
                        }
                    }


                }
            }
        }

        ScoreController.getInstance().setSelectedScoreObjects(newSelected);
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new SelectAllAfterAction(
                actionContext.lookup(Point.class),
                actionContext.lookup(LayerGroupPanel.class));
    }
}
