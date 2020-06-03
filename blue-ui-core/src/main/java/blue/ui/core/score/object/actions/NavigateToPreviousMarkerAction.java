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

import blue.Marker;
import blue.MarkersList;
import blue.projects.BlueProjectManager;
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
        id = "blue.ui.core.score.object.actions.NavigateToPreviousMarkerAction"
)
@ActionRegistration(
        displayName = "#CTL_NavigateToPreviousMarkerAction"
)
@Messages("CTL_NavigateToPreviousMarkerAction=Navigate to Previous Marker")
@ActionReference(path = "blue/score/shortcuts", name = "OPEN_BRACKET")

// TODO: See about adding an image icon 
// ImageIcon icon = new ImageIcon(
//                    ImageUtilities.loadImage(
//                    "blue/resources/images/StepBack16.gif"));
public final class NavigateToPreviousMarkerAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        var data = BlueProjectManager.getInstance().getCurrentBlueData();
        double startTime = data.getRenderStartTime();
        double newStartTime = 0.0;

        MarkersList markers = data.getMarkersList();

        Marker selected = null;

        for (int i = markers.size() - 1; i >= 0; i--) {
            Marker a = markers.getMarker(i);

            if (a.getTime() < startTime) {
                selected = a;
                break;
            }
        }

        if (selected != null) {
            newStartTime = selected.getTime();
        }

        data.setRenderStartTime(newStartTime);

        ScoreTopComponent scoreTopComponent = (ScoreTopComponent) WindowManager.getDefault().findTopComponent(
                "ScoreTopComponent");
        scoreTopComponent.scrollToTime(newStartTime);
    }
}
