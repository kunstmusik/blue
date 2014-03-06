/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.project;

import blue.BlueData;
import blue.MainToolBar;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.services.render.RenderTimeManager;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScorePath;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import org.openide.util.Lookup;

public final class AddMarkerAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();

        if (project == null) {
            return;
        }

        BlueData data = project.getData();

        if (data == null) {
            return;
        }

        RenderTimeManager timeManager = Lookup.getDefault().lookup(
                RenderTimeManager.class);

        ScorePath path = ScoreController.getInstance().getScorePath();
        if (path.getLayerGroups().size() == 0) {
            float markerTime = MainToolBar.getInstance().isRendering()
                    ? timeManager.getRenderTime() + timeManager.getRenderStartTime()
                    : data.getRenderStartTime();
            data.getMarkersList().addMarker(markerTime);
        }

    }
}
