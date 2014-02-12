/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.ui.core.blueLive;

import blue.midi.MidiInputManager;
import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import javax.swing.JCheckBoxMenuItem;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;
import org.openide.util.actions.Presenter;

@ActionID(
        category = "Project",
        id = "blue.ui.core.blueLive.BlueLiveMenu"
)
@ActionRegistration(
        displayName = "#CTL_BlueLiveMenu"
)
@ActionReference(path = "Menu/Project", position = 375, separatorAfter = 387)
@Messages("CTL_BlueLiveMenu=Blue Live")
/* FIXME - This class should not directly call doClick() on the buttons within
 the BlueLiveToolBar.  Instead, a BlueLiveController or BlueLiveManager should be 
 created.  However, this should probably be done in the 2.6 or 3.x branches, so 
 is implemented as such for now.
 */
public final class BlueLiveMenu extends AbstractAction implements Presenter.Menu {

    JMenu menu = new JMenu("Blue Live");
    JMenuItem items[] = null;

    @Override
    public void actionPerformed(ActionEvent e) {
        final BlueLiveToolBar toolbar = BlueLiveToolBar.getInstance();

        if (e.getSource() == items[0]) {
            toolbar.runButton.doClick();
        } else if (e.getSource() == items[1]) {
            toolbar.refreshButton.doClick();
        } else if (e.getSource() == items[2]) {
            toolbar.allNotesOffButton.doClick();
        } else if (e.getSource() == items[3]) {
            toolbar.midiButton.doClick();
        }
    }

    @Override
    public JMenuItem getMenuPresenter() {
        if (items == null) {
            items = new JMenuItem[4];
            items[0] = new JCheckBoxMenuItem("Start/Stop Blue Live");
            items[1] = new JMenuItem("Recompile");
            items[2] = new JMenuItem("All Notes Off");
            items[3] = new JCheckBoxMenuItem("MIDI Input");

            for (JMenuItem item : items) {
                menu.add(item);
                item.addActionListener(this);
            }
        }

        items[0].setSelected(BlueLiveToolBar.getInstance().isRunning());
        items[3].setSelected(MidiInputManager.getInstance().isRunning());

        return menu;
    }
}
