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
import blue.score.layers.ScoreObjectLayer;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScorePath;
import blue.ui.core.score.undo.AddScoreObjectEdit;
import blue.ui.core.score.undo.CompoundAppendable;
import blue.undo.BlueUndoManager;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.Collection;
import javax.swing.JOptionPane;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;
import org.openide.windows.WindowManager;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.object.actions.RepeatScoreObjectsAction"
)
@ActionRegistration(
        displayName = "#CTL_RepeatScoreObjectsAction"
)
@Messages("CTL_RepeatScoreObjectsAction=Repeat")
@ActionReference(path = "blue/score/shortcuts", name = "D-R")
public final class RepeatScoreObjectsAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        Collection<? extends ScoreObject> scoreObjects
                = ScoreController.getInstance().getSelectedScoreObjects();
        if (!scoreObjects.isEmpty()) {

            Object retVal = JOptionPane.showInputDialog(
                    WindowManager.getDefault().getMainWindow(),
                    "Enter number of times to repeat:", new Integer(1));

            if (retVal == null) {
                return;
            }

            int count = -1;

            try {
                count = Integer.parseInt((String) retVal);
            } catch (Exception exception) {
                JOptionPane.showMessageDialog(
                        WindowManager.getDefault().getMainWindow(),
                        "Entry must be an integer value.", "Error",
                        JOptionPane.ERROR_MESSAGE);
                return;
            }

            if (count < 1) {
                JOptionPane.showMessageDialog(
                        WindowManager.getDefault().getMainWindow(),
                        "Value must be greater than 0.", "Error",
                        JOptionPane.ERROR_MESSAGE);
                return;
            }

            ScorePath path = ScoreController.getInstance().getScorePath();
            CompoundAppendable compoundEdit = new CompoundAppendable();

            for (ScoreObject sObj : scoreObjects) {
                double start = sObj.getStartTime();
                ScoreObjectLayer layer = (ScoreObjectLayer) path.getLayerForScoreObject(
                        sObj);
                for (int j = 0; j < count; j++) {
                    ScoreObject temp = sObj.deepCopy();

                    start += sObj.getSubjectiveDuration();

                    temp.setStartTime(start);

                    if (layer == null) {
                        JOptionPane.showMessageDialog(
                                WindowManager.getDefault().getMainWindow(),
                                "Could not find SoundLayer for SoundObject",
                                "Error",
                                JOptionPane.ERROR_MESSAGE);
                        return;
                    }

                    layer.add(temp);

                    AddScoreObjectEdit edit = new AddScoreObjectEdit(
                            layer, temp);
                    compoundEdit.addEdit(edit);
                }

            }

            final var top = compoundEdit.getTopEdit();
            if(top != null) {
                BlueUndoManager.setUndoManager("score");
                BlueUndoManager.addEdit(top);
            }
        }
    }
}
