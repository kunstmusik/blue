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
import blue.ui.core.score.ScorePath;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
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
        id = "blue.ui.core.score.layers.soundObject.actions.SelectLayerAction")
@ActionRegistration(
        displayName = "#CTL_SelectLayerAction")
@Messages("CTL_SelectLayerAction=Select Layer")
@ActionReferences({
@ActionReference(path = "blue/score/layers/audio/actions",
        position = 80),
@ActionReference(path = "blue/score/layers/soundObject/actions",
        position = 80) })
public final class SelectLayerAction extends AbstractAction
        implements ContextAwareAction {

    final Point p;
    private final ScorePath scorePath;

    public SelectLayerAction() {
        this(Utilities.actionsGlobalContext());
    }

    private SelectLayerAction(Lookup lookup) {

        super(NbBundle.getMessage(SelectLayerAction.class,
                "CTL_SelectLayerAction"));
        this.p = lookup.lookup(Point.class);
        this.scorePath = lookup.lookup(ScorePath.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {

        Layer layer = scorePath.getGlobalLayerForY(p.y);

        if(layer != null && layer instanceof ScoreObjectLayer) {
            ArrayList<ScoreObject> newSelected = new ArrayList<>((ScoreObjectLayer)layer);

            ScoreController.getInstance().setSelectedScoreObjects(newSelected);
        }
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new SelectLayerAction(actionContext);
    }

//    public void selectLayer(int soundLayerIndex) {
//        final int index = soundLayerIndex;
//
//        SwingUtilities.invokeLater(new Runnable() {
//            @Override
//            public void run() {
//                Component[] comps = sCanvas.getSoundObjectPanel()
//                        .getComponents();
//
////                content.set(Collections.emptyList(), null);
//                ArrayList<SoundObject> selected = new ArrayList<>();
//                for (int i = 0; i < comps.length; i++) {
//                    if (!(comps[i] instanceof SoundObjectView)) {
//                        continue;
//                    }
//
//                    if (getSoundLayerIndex(comps[i].getY()) == index) {
//                        selected.add(
//                                ((SoundObjectView) comps[i]).getSoundObject());
//                    }
//                }
//                content.set(selected, null);
//            }
//        });
//
//    }

}
