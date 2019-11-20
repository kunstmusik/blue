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
        id = "blue.ui.core.score.object.actions.SwitchModeSingleLine"
)
@ActionRegistration(
        displayName = "#CTL_SwitchModeSingleLine"
)
@Messages("CTL_SwitchModeSingleLine=Switch Mode Single Line")
@ActionReference(path = "blue/score/shortcuts", name = "2")
public final class SwitchModeSingleLine implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        ModeManager.getInstance().setMode(ScoreMode.SINGLE_LINE);
        SingleLineScoreSelection.getInstance().updateSelection(null, -1.0, -1.0);
    }
}
