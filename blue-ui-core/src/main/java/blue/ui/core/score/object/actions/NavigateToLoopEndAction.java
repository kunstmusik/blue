/*
 * blue - object composition environment for csound Copyright (c) 2020
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
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
        id = "blue.ui.core.score.object.actions.NavigateToLoopEndAction"
)
@ActionRegistration(
        displayName = "#CTL_NavigateToLoopEndAction"
)
@Messages("CTL_NavigateToLoopEndAction=Navigate to Loop End")
@ActionReference(path = "blue/score/shortcuts", name = "Y")
public final class NavigateToLoopEndAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        ScoreTopComponent scoreTopComponent = (ScoreTopComponent) WindowManager.getDefault().findTopComponent(
                "ScoreTopComponent");
            scoreTopComponent.scrollToRenderLoopPointer();
    }
}
