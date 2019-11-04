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
import blue.SoundLayer;
import blue.SoundObjectLibrary;
import blue.projects.BlueProjectManager;
import blue.score.Score;
import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.score.layers.ScoreObjectLayer;
import blue.soundObject.Instance;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScorePath;
import blue.ui.core.score.undo.AddScoreObjectEdit;
import blue.undo.BlueUndoManager;
import blue.utility.ScoreUtilities;
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
        id = "blue.ui.core.score.layers.soundObject.actions.PasteAsPolyObjectAction")
@ActionRegistration(
        displayName = "#CTL_PasteAsPolyObjectAction")
@Messages("CTL_PasteAsPolyObjectAction=Paste as PolyObject")
@ActionReference(path = "blue/score/layers/soundObject/actions",
        position = 60, separatorAfter = 65)
public final class PasteAsPolyObjectAction extends AbstractAction implements ContextAwareAction {

    private List<? extends ScoreObject> scoreObjects;
    private List<Integer> layerIndexes;
    private Point p;
    private TimeState timeState;
    private PolyObject pObj = new PolyObject();
    private final ScorePath scorePath;

    public PasteAsPolyObjectAction() {
        this(Utilities.actionsGlobalContext());
    }

    public PasteAsPolyObjectAction(Lookup lookup) {

        super(NbBundle.getMessage(PasteAsPolyObjectAction.class,
                "CTL_PasteAsPolyObjectAction"));

        ScoreController scoreController = ScoreController.getInstance();
        Score score = scoreController.getScore();

        this.scoreObjects = scoreController.getScoreObjectBuffer().scoreObjects;
        this.layerIndexes = scoreController.getScoreObjectBuffer().layerIndexes;
        this.p = lookup.lookup(Point.class);
        this.timeState = lookup.lookup(TimeState.class);
        this.scorePath = lookup.lookup(ScorePath.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {

        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();
        SoundObjectLibrary sObjLib = data.getSoundObjectLibrary();
        List<Instance> instanceSoundObjects = new ArrayList<>();
        ScoreController.ScoreObjectBuffer buffer
                = ScoreController.getInstance().getScoreObjectBuffer();

        double start = (double) p.x / timeState.getPixelSecond();

        if (timeState.isSnapEnabled()) {
            start = ScoreUtilities.getSnapValueStart(start,
                    timeState.getSnapValue());
        }

        int minLayer = Integer.MAX_VALUE;
        int maxLayer = Integer.MIN_VALUE;

        for (Integer layerIndex : layerIndexes) {
            if (layerIndex < minLayer) {
                minLayer = layerIndex;
            }
            if (layerIndex > maxLayer) {
                maxLayer = layerIndex;
            }
        }

        int numLayers = maxLayer - minLayer + 1;

        for (int i = 0; i < numLayers; i++) {
            pObj.newLayerAt(-1);
        }

        for (int i = 0; i < scoreObjects.size(); i++) {
            ScoreObject scoreObj = scoreObjects.get(i);
            int layerIndex = layerIndexes.get(i);
            SoundLayer layer = pObj.get(layerIndex - minLayer);

            SoundObject clone = (SoundObject)scoreObj.deepCopy();
            layer.add(clone);

            if (clone instanceof Instance) {
                instanceSoundObjects.add((Instance) clone);
            }

        }

        sObjLib.checkAndAddInstanceSoundObjects(instanceSoundObjects);

        pObj.normalizeSoundObjects();

        pObj.setStartTime(start);
        final ScoreObjectLayer layer = (ScoreObjectLayer) scorePath.getGlobalLayerForY(
                p.y);
        layer.add(pObj);

        AddScoreObjectEdit edit = new AddScoreObjectEdit(layer, pObj);

        BlueUndoManager.setUndoManager("score");
        BlueUndoManager.addEdit(edit);
    }

    @Override
    public boolean isEnabled() {
        for (ScoreObject scoreObj : scoreObjects) {
            if (!(scoreObj instanceof SoundObject)) {
                return false;
            }
        }

        Layer layer = scorePath.getGlobalLayerForY(p.y);

        return scoreObjects.size() > 0 && layer != null && layer.accepts(
                pObj);
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new PasteAsPolyObjectAction(actionContext);
    }
}
