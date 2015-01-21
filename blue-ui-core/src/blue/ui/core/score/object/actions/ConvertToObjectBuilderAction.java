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
package blue.ui.core.score.object.actions;

import blue.SoundLayer;
import blue.score.ScoreObject;
import blue.soundObject.External;
import blue.soundObject.ObjectBuilder;
import blue.soundObject.PythonObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScorePath;
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
        id = "blue.ui.core.score.actions.ConvertToObjectBuilderAction")
@ActionRegistration(
        displayName = "#CTL_ConvertToObjectBuilderAction")
@Messages("CTL_ConvertToObjectBuilderAction=Convert to ObjectBuilder")
@ActionReference(path = "blue/score/actions", position = 50)
public final class ConvertToObjectBuilderAction extends AbstractAction
        implements ContextAwareAction {

    private final Collection<? extends SoundObject> soundObjects;
    private final Collection<? extends ScoreObject> scoreObjects;
    private final Point p;
    private final ScorePath scorePath;

    public ConvertToObjectBuilderAction() {
        this(Utilities.actionsGlobalContext());
    }

    public ConvertToObjectBuilderAction(Lookup lookup) {
        super(NbBundle.getMessage(ConvertToObjectBuilderAction.class,
                "CTL_ConvertToObjectBuilderAction"));

        this.soundObjects = lookup.lookupAll(SoundObject.class);
        this.scoreObjects = lookup.lookupAll(ScoreObject.class);
        this.p = lookup.lookup(Point.class);
        this.scorePath = lookup.lookup(ScorePath.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        SoundObject temp = soundObjects.iterator().next();

        int retVal = JOptionPane.showConfirmDialog(null,
                "This operation can not be undone.\nAre you sure?");

        if (retVal != JOptionPane.OK_OPTION) {
            return;
        }

        SoundLayer layer = (SoundLayer) scorePath.getGlobalLayerForY(p.y);

        ObjectBuilder objBuilder = new ObjectBuilder();

        if (temp instanceof PythonObject) {
            PythonObject tempPython = (PythonObject) temp;
            objBuilder.setName(tempPython.getName());
            objBuilder.setNoteProcessorChain(tempPython.getNoteProcessorChain());
            objBuilder.setTimeBehavior(tempPython.getTimeBehavior());
            objBuilder.setStartTime(tempPython.getStartTime());
            objBuilder.setSubjectiveDuration(tempPython.getSubjectiveDuration());
            objBuilder.setCode(tempPython.getText());
            objBuilder.setBackgroundColor(tempPython.getBackgroundColor());

        } else if (temp instanceof External) {
            External tempExt = (External) temp;
            objBuilder.setName(tempExt.getName());
            objBuilder.setNoteProcessorChain(tempExt.getNoteProcessorChain());
            objBuilder.setTimeBehavior(tempExt.getTimeBehavior());
            objBuilder.setStartTime(tempExt.getStartTime());
            objBuilder.setSubjectiveDuration(tempExt.getSubjectiveDuration());
            objBuilder.setCode(tempExt.getText());
            objBuilder.setCommandLine(tempExt.getCommandLine());
            objBuilder.setExternal(true);
            objBuilder.setBackgroundColor(tempExt.getBackgroundColor());
        } else {
            return;
        }

        layer.remove(temp);
        layer.add(objBuilder);

        ScoreController.getInstance().removeSelectedScoreObject(temp);
        ScoreController.getInstance().addSelectedScoreObject(objBuilder);
    }

    @Override
    public boolean isEnabled() {
        if (scoreObjects.size() != soundObjects.size()
                || soundObjects.size() != 1) {
            return false;
        }
        SoundObject sObj = soundObjects.iterator().next();
        return (sObj instanceof PythonObject || sObj instanceof External);
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new ConvertToObjectBuilderAction(actionContext);
    }
}
