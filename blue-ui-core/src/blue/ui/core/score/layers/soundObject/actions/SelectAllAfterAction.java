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

import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.score.layers.ScoreObjectLayer;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScorePath;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.List;
import javax.swing.AbstractAction;
import javax.swing.Action;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.ContextAwareAction;
import org.openide.util.Lookup;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;
import org.openide.util.Utilities;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.layers.soundObject.actions.SelectAllAfterAction")
@ActionRegistration(
        displayName = "#CTL_SelectAllAfterAction")
@Messages("CTL_SelectAllAfterAction=Select All After")
@ActionReference(path = "blue/score/layers/soundObject/actions",
        position = 100, separatorAfter = 105)
public final class SelectAllAfterAction extends AbstractAction
        implements ContextAwareAction {

    final Point p;
    private final ScorePath scorePath;
    private final TimeState timeState;

    public SelectAllAfterAction() {
        this(Utilities.actionsGlobalContext());
    }

    private SelectAllAfterAction(Lookup lookup) {

        super(NbBundle.getMessage(SelectLayerAction.class,
                "CTL_SelectAllAfterAction"));
        this.p = lookup.lookup(Point.class);
        this.scorePath = lookup.lookup(ScorePath.class);
        this.timeState = lookup.lookup(TimeState.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
// FIXME - 
//        if (p.y < 0 || p.y > comp.getHeight()) {
//            return;
//        }

        float pointTime = (float) p.x
                / timeState.getPixelSecond();
        List<ScoreObject> newSelected = new ArrayList<>();
        List<Layer> allLayers = scorePath.getAllLayers();

        for (Layer layer : allLayers) {
            if (layer instanceof ScoreObjectLayer) {
                ScoreObjectLayer<ScoreObject> sLayer = (ScoreObjectLayer) layer;

                for (ScoreObject scoreObject : sLayer) {
                    if (scoreObject.getStartTime() >= pointTime) {
                        newSelected.add(scoreObject);
                    }
                }

            }
        }

        ScoreController.getInstance().setSelectedScoreObjects(newSelected);
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new SelectAllAfterAction(actionContext);
    }
}
