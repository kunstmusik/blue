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

import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import javax.swing.JComponent;
import javax.swing.JMenuItem;
import org.openide.awt.DynamicMenuContent;

/**
 *
 * @author syi
 */
public class CurrentProjectsAction extends JMenuItem implements
        DynamicMenuContent {

    private static ActionListener al;

    static {
        al = new ActionListener() {

            @Override
            public void actionPerformed(ActionEvent e) {
                JMenuItem item = (JMenuItem) e.getSource();
                Object obj = item.getClientProperty("project");

                if (obj != null) {
                    BlueProjectManager.getInstance().setCurrentProject(
                            (BlueProject) obj);
                }
            }
        };
    }

    @Override
    public JComponent[] getMenuPresenters() {

        BlueProjectManager manager = BlueProjectManager.getInstance();

        if (manager.getNumProjects() == 0) {
            return new JComponent[0];
        }

        JComponent[] items = new JComponent[manager.getNumProjects()];

        for (int i = 0; i < manager.getNumProjects(); i++) {
            BlueProject proj = manager.getProject(i);
            File f = proj.getDataFile();

            String name = (f == null) ? "[new blue project]" : f.getName();


            JMenuItem menuItem = new JMenuItem(i + " " + name);
            menuItem.putClientProperty("project", proj);
            menuItem.setMnemonic(Integer.toString(i).charAt(0));
            menuItem.setEnabled(proj != manager.getCurrentProject());
            menuItem.addActionListener(al);

            items[i] = menuItem;
        }

        return items;
    }

    @Override
    public JComponent[] synchMenuPresenters(JComponent[] items) {
        return getMenuPresenters();
    }
}
