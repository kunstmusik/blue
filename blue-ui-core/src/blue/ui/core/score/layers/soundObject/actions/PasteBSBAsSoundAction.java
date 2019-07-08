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
import blue.CopyBuffer;
import blue.SoundLayer;
import blue.automation.Parameter;
import blue.components.lines.LinePoint;
import blue.orchestra.BlueSynthBuilder;
import blue.projects.BlueProjectManager;
import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.soundObject.Sound;
import blue.ui.core.score.ScorePath;
import blue.ui.core.score.undo.AddScoreObjectEdit;
import blue.undo.BlueUndoManager;
import blue.utility.ScoreUtilities;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.util.Collection;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JOptionPane;
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
        id = "blue.ui.core.score.layers.soundObject.actions.PasteBSBAsSoundAction")
@ActionRegistration(
        displayName = "#CTL_PasteBSBAsSoundAction")
@Messages("CTL_PasteBSBAsSoundAction=Paste BSB As Sound")
@ActionReference(path = "blue/score/layers/soundObject/actions",
        position = 63)
public final class PasteBSBAsSoundAction extends AbstractAction implements ContextAwareAction {
    
    private Collection<? extends ScoreObject> scoreObjects;
    private Point p;
    private TimeState timeState;
    private final ScorePath scorePath;
    
    public PasteBSBAsSoundAction() {
        this(Utilities.actionsGlobalContext());
    }
    
    private PasteBSBAsSoundAction(Lookup lookup) {
        super(NbBundle.getMessage(PasteBSBAsSoundAction.class,
                "CTL_PasteBSBAsSoundAction"));
        
        this.p = lookup.lookup(Point.class);
        this.timeState = lookup.lookup(TimeState.class);
        this.scorePath = lookup.lookup(ScorePath.class);
    }
    
    @Override
    public boolean isEnabled() {
        Object obj = CopyBuffer.getBufferedObject(CopyBuffer.INSTRUMENT);
        
        return obj != null && obj instanceof BlueSynthBuilder
                && scorePath.getGlobalLayerForY(p.y) != null;
    }
    
    @Override
    public void actionPerformed(ActionEvent e) {
        double start = (double) p.x / timeState.getPixelSecond();
        
        if (timeState.isSnapEnabled()) {
            start = ScoreUtilities.getSnapValueStart(start,
                    timeState.getSnapValue());
        }
        
        Object obj = CopyBuffer.getBufferedObject(CopyBuffer.INSTRUMENT);

        Sound sound = new Sound();
        sound.setStartTime(start);

        BlueSynthBuilder bsbCopy = ((BlueSynthBuilder)obj).deepCopy();
        // clear out any existing automations
        for(Parameter param :bsbCopy.getParameterList()) {
            param.setAutomationEnabled(false);
            param.getLine().clear();
            param.getLine().addLinePoint(new LinePoint(0.0, param.getValue(0.0)));
            param.getLine().addLinePoint(new LinePoint(1.0, param.getValue(0.0)));
        }
        sound.setBlueSynthBuilder(bsbCopy);
        sound.setComment(bsbCopy.getComment());
        
        Layer layer = scorePath.getGlobalLayerForY(p.y);
        
        if (!layer.accepts(sound)) {
            JOptionPane.showMessageDialog(null,
                    "Unable to paste due to target layers not "
                    + "accepting types of objects within the copy buffer (i.e. trying to "
                    + "paste a SoundObject into an AudioLayer");
            return;
        }
        
        SoundLayer sLayer = (SoundLayer) layer;
        sLayer.add(sound);

        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();
        
        AddScoreObjectEdit undoEdit = new AddScoreObjectEdit(sLayer, sound);

        BlueUndoManager.setUndoManager("score");
        BlueUndoManager.addEdit(undoEdit);
    }
    
    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new PasteBSBAsSoundAction(actionContext);
    }
    
}
