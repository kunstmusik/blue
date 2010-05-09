/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.project;

import blue.BlueData;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.soundObject.SoundObject;
import blue.ui.core.score.AuditionManager;
import blue.ui.core.score.ScoreTopComponent;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

public final class AuditionSelectedSoundObjectsAction implements ActionListener {

    public void actionPerformed(ActionEvent e) {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();

        if (project == null) {
            return;
        }

        BlueData data = project.getData();

        if (data == null) {
            return;
        }

        SoundObject[] soundObjects = ScoreTopComponent.getDefault().getSoundObjectsAsArray();

        if (soundObjects.length == 0) {
            return;
        }

        AuditionManager audition = AuditionManager.getInstance();
        audition.stop();
        audition.auditionSoundObjects(data, soundObjects);

    }
}
