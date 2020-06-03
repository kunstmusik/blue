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
import blue.score.Score;
import blue.score.ScoreObject;
import blue.score.layers.ScoreObjectLayer;
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
        id = "blue.ui.core.score.object.actions.NavigateToNextMarkerAction"
)
@ActionRegistration(
        displayName = "#CTL_NavigateToNextMarkerAction"
)
@Messages("CTL_NavigateToNextMarkerAction=Navigate to Next Marker")
@ActionReference(path = "blue/score/shortcuts", name = "CLOSE_BRACKET")

// TODO: See about adding an image icon 
// ImageIcon icon = new ImageIcon(
//                    ImageUtilities.loadImage(
//                    "blue/resources/images/StepBack16.gif"));
public final class NavigateToNextMarkerAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {

        final var data = BlueProjectManager.getInstance().getCurrentBlueData();
        final double currentStartTime = data.getRenderStartTime();

        MarkersList markers = data.getMarkersList();

        Marker selected = null;

        if (markers.size() > 0) {
            for (int i = 0; i < markers.size(); i++) {
                Marker a = markers.getMarker(i);

                if (a.getTime() > currentStartTime) {
                    selected = a;
                    break;
                }
            }
        }

        final double newStartTime = (selected == null)
                ? getEndTimeOfScore(data.getScore())
                : selected.getTime();

        if (newStartTime > currentStartTime) {

            data.setRenderStartTime(newStartTime);

            ScoreTopComponent scoreTopComponent = (ScoreTopComponent) WindowManager.getDefault().findTopComponent(
                    "ScoreTopComponent");
            scoreTopComponent.scrollToTime(newStartTime);
        }
    }

    private double getEndTimeOfScore(Score score) {
        double max = 0.0;
        for (var layer : score.getAllLayers()) {
            if (layer instanceof ScoreObjectLayer) {
                final var sLayer = (ScoreObjectLayer<ScoreObject>) layer;

                var layerMax = sLayer.stream()
                        .mapToDouble(sObj -> sObj.getStartTime() + sObj.getSubjectiveDuration())
                        .max();

                if (layerMax.isPresent()) {
                    max = Math.max(max, layerMax.getAsDouble());
                }
            }
        }
        return max;
    }
}
