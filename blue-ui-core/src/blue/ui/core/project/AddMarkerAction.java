/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.project;

import blue.BlueData;
import blue.MainToolBar;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.ui.core.render.RenderTimeManager;
import blue.ui.core.score.ScoreTopComponent;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

public final class AddMarkerAction implements ActionListener {

    public void actionPerformed(ActionEvent e) {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();

        if (project == null) {
            return;
        }

        BlueData data = project.getData();

        if (data == null) {
            return;
        }

        RenderTimeManager timeManager = RenderTimeManager.getInstance();

        if (ScoreTopComponent.getDefault().isEditingRootScore()) {
            float markerTime = MainToolBar.getInstance().isRendering() ? timeManager.getRenderTime() + timeManager.getRenderStartTime() : data.getRenderStartTime();
            data.getMarkersList().addMarker(markerTime);
        }

    }
}
