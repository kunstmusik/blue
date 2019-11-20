/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.score.object.actions;

import blue.ui.core.score.ModeManager;
import blue.ui.core.score.ScoreMode;
import blue.ui.core.score.SingleLineScoreSelection;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.object.actions.SwitchModeScore"
)
@ActionRegistration(
        displayName = "#CTL_SwitchModeScore"
)
@Messages("CTL_SwitchModeScore=Switch Mode Score")
@ActionReference(path = "blue/score/shortcuts", name = "1")
public final class SwitchModeScore implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        ModeManager.getInstance().setMode(ScoreMode.SCORE);
                SingleLineScoreSelection.getInstance().updateSelection(null, -1.0, -1.0);
    }
}
