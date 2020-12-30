/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.project;

import blue.orchestra.editor.blueSynthBuilder.ShowWidgetComments;
import blue.settings.PlaybackSettings;
import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import javax.swing.JCheckBoxMenuItem;
import javax.swing.JMenuItem;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;
import org.openide.util.actions.Presenter;

@ActionID(
        category = "Project",
        id = "blue.ui.core.project.FollowScorePlaybackAction"
)
@ActionRegistration(
        displayName = "#CTL_FollowScorePlaybackAction"
)
@ActionReference(path = "Menu/Project", position = 250, separatorBefore = 200)
@Messages("CTL_FollowScorePlaybackAction=Follow playback by scrolling score")
public final class FollowScorePlaybackAction extends AbstractAction implements Presenter.Menu {

    JCheckBoxMenuItem menuItem;
    private final PlaybackSettings prefs = PlaybackSettings.getInstance();

    public FollowScorePlaybackAction() {
        menuItem = new JCheckBoxMenuItem();
        putValue(NAME, NbBundle.getMessage(FollowScorePlaybackAction.class,
                "CTL_FollowScorePlaybackAction"));
        menuItem.setAction(this);
        
        PlaybackSettings.getPreferences().addPreferenceChangeListener(evt -> {
             menuItem.setSelected(prefs.isFollowPlayback());
        });
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        prefs.setFollowPlayback(!prefs.isFollowPlayback());
        prefs.save();

    }

    @Override
    public JMenuItem getMenuPresenter() {
        menuItem.setSelected(prefs.isFollowPlayback());

        return menuItem;
    }
}
