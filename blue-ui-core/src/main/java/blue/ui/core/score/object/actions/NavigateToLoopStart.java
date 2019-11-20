/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.score.object.actions;

import blue.ui.core.score.ScoreTopComponent;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;
import org.openide.windows.WindowManager;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.object.actions.NavigateToLoopStart"
)
@ActionRegistration(
        displayName = "#CTL_NavigateToLoopStart"
)
@Messages("CTL_NavigateToLoopStart=Navigate to Loop Start")
@ActionReference(path = "blue/score/shortcuts", name = "G")
public final class NavigateToLoopStart implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
                ScoreTopComponent scoreTopComponent = (ScoreTopComponent) WindowManager.getDefault().findTopComponent(
                "ScoreTopComponent");
                scoreTopComponent.scrollToRenderStartPointer();
    }
}
