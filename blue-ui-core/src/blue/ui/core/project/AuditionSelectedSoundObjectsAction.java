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
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.List;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;

@ActionID(
        category = "Project",
        id = "blue.ui.core.project.AuditionSelectedSoundObjectsAction")
@ActionRegistration(
        displayName = "#CTL_AuditionScoreObjectsAction")
@Messages("CTL_AuditionScoreObjectsAction=Audition ScoreObjects")
@ActionReferences({
    @ActionReference(path = "blue/score/actions", position = 10, separatorAfter = 15),
    @ActionReference(path = "Menu/Project", position = 150),
    @ActionReference(path = "Shortcuts", name = "DS-A")
})
public final class AuditionSelectedSoundObjectsAction implements ActionListener {

    private final List<SoundObject> context;

    public AuditionSelectedSoundObjectsAction(List<SoundObject> context) {
        this.context = context;
    }

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

        RealtimeRenderManager.getInstance().auditionSoundObjects(data,
                context.toArray(new SoundObject[0]));

    }
}
