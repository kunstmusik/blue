/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.project;

import blue.BlueData;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.soundObject.SoundObject;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.core.score.ScoreTopComponent;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.Collection;
import org.openide.util.Utilities;

public final class AuditionSelectedSoundObjectsAction implements ActionListener {

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

        Collection<? extends SoundObject> soundObjects = 
                Utilities.actionsGlobalContext().lookupAll(SoundObject.class);

        if (soundObjects.isEmpty()) {
            return;
        }

        RealtimeRenderManager.getInstance().auditionSoundObjects(data, 
                soundObjects.toArray(new SoundObject[0]));

    }
}
