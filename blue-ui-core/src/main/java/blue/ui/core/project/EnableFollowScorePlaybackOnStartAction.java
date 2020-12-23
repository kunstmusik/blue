/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.project;

import blue.settings.PlaybackSettings;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.AbstractAction;
import static javax.swing.Action.NAME;
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
        id = "blue.ui.core.project.EnableFollowScorePlaybackOnStartAction"
)
@ActionRegistration(
        displayName = "#CTL_EnableFollowScorePlaybackOnStartAction"
)
@ActionReference(path = "Menu/Project", position = 300)
@Messages("CTL_EnableFollowScorePlaybackOnStartAction=Enable follow playback on render start")
public final class EnableFollowScorePlaybackOnStartAction extends AbstractAction implements Presenter.Menu {

    JCheckBoxMenuItem menuItem;
    private final PlaybackSettings prefs = PlaybackSettings.getInstance();

    public EnableFollowScorePlaybackOnStartAction() {
        menuItem = new JCheckBoxMenuItem();
        putValue(NAME, NbBundle.getMessage(EnableFollowScorePlaybackOnStartAction.class,
                "CTL_EnableFollowScorePlaybackOnStartAction"));
        menuItem.setAction(this);
        PlaybackSettings.getPreferences().addPreferenceChangeListener(evt -> {
             menuItem.setSelected(prefs.isFollowPlaybackOnStart());
        });
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        prefs.setFollowPlaybackOnStart(menuItem.isSelected());
        prefs.save();

    }

    @Override
    public JMenuItem getMenuPresenter() {
        menuItem.setSelected(prefs.isFollowPlaybackOnStart());

        return menuItem;
    }
}