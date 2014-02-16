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

    public SelectLayerAction() {
        this(null);
    }

    private SelectLayerAction(Point p) {

        super(NbBundle.getMessage(SelectLayerAction.class,
                "CTL_SelectLayerAction"));
        this.p = p;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        Score score = ScoreController.getInstance().getScore();

        Layer layer = score.getGlobalLayerForY(p.y);

        if(layer != null && layer instanceof ScoreObjectLayer) {
            ArrayList<ScoreObject> newSelected = new ArrayList<>();
            for(ScoreObject temp : (ScoreObjectLayer<ScoreObject>)layer) {
                newSelected.add(temp);
            }
            ScoreController.getInstance().setSelectedScoreObjects(newSelected);
        }
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new SelectLayerAction(
                actionContext.lookup(Point.class));
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
