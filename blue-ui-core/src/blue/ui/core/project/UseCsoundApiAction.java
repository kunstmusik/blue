/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
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
package blue.ui.core.project;

import blue.settings.GeneralSettings;
import blue.utility.APIUtilities;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JCheckBoxMenuItem;
import javax.swing.JComponent;
import javax.swing.JMenuItem;
import org.openide.awt.DynamicMenuContent;

/**
 *
 * @author syi
 */
public class UseCsoundApiAction extends JMenuItem implements DynamicMenuContent {

    private JCheckBoxMenuItem cBoxMenuItem = null;

    public JMenuItem getMenuPresenter() {

        if (cBoxMenuItem == null) {
            cBoxMenuItem = new JCheckBoxMenuItem("Use Csound API");
            cBoxMenuItem.addActionListener(new ActionListener() {

                public void actionPerformed(ActionEvent e) {
                    GeneralSettings settings = GeneralSettings.getInstance();
                    settings.setUsingCsoundAPI(!settings.isUsingCsoundAPI());
                    settings.save();
                }
            });

        }
        

        cBoxMenuItem.setSelected(
                GeneralSettings.getInstance().isUsingCsoundAPI());

        cBoxMenuItem.setEnabled(APIUtilities.isCsoundAPIAvailable());

        return cBoxMenuItem;
    }

    public JComponent[] getMenuPresenters() {
        return new JComponent[] { getMenuPresenter() };
    }

    public JComponent[] synchMenuPresenters(JComponent[] items) {
        return getMenuPresenters();
    }
}
