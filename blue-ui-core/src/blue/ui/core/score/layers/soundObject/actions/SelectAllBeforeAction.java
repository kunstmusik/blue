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

import blue.score.Score;
import blue.score.ScoreObject;
import blue.score.layers.Layer;
import blue.score.layers.ScoreObjectLayer;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScoreTopComponent;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.List;
import javax.swing.AbstractAction;
import javax.swing.Action;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.awt.ActionRegistration;
import org.openide.util.ContextAwareAction;
import org.openide.util.Lookup;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;
import org.openide.util.Utilities;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.layers.soundObject.actions.SelectAllBeforeAction")
@ActionRegistration(
        displayName = "#CTL_SelectAllBeforeAction")
@Messages("CTL_SelectAllBeforeAction=Select All Before")
@ActionReferences({
    @ActionReference(path = "blue/score/layers/soundObject/actions", position = 90),
    @ActionReference(path = "blue/score/layers/audio/actions", position = 90)})
public final class SelectAllBeforeAction extends AbstractAction implements
        ContextAwareAction {

    final Point p;

    public SelectAllBeforeAction() {
        this(Utilities.actionsGlobalContext());
    }

    private SelectAllBeforeAction(Lookup lookup) {

        super(NbBundle.getMessage(SelectLayerAction.class,
                "CTL_SelectAllBeforeAction"));
        this.p = lookup.lookup(Point.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        // FIXME
//        JComponent comp = ((JComponent) lgPanel);
//
//        if (p.y < 0 || p.y > comp.getHeight()) {
//            return;
//        }

        Score score = ScoreController.getInstance().getScore();

        float pointTime = (float) p.x
                / ScoreTopComponent.findInstance().getTimeState().getPixelSecond();
        List<ScoreObject> newSelected = new ArrayList<>();
        List<Layer> allLayers = score.getAllLayers();

        for (Layer layer : allLayers) {
            if (layer instanceof ScoreObjectLayer) {
                ScoreObjectLayer<ScoreObject> sLayer = (ScoreObjectLayer) layer;

                for (ScoreObject scoreObject : sLayer) {
                    if (scoreObject.getStartTime() + scoreObject.getSubjectiveDuration()
                            <= pointTime) {
                        newSelected.add(scoreObject);
                    }
                }
            }
        }

        ScoreController.getInstance().setSelectedScoreObjects(newSelected);

    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new SelectAllBeforeAction(actionContext);
    }
}
