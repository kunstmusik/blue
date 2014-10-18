/*
 * blue - object composition environment for csound Copyright (c) 2000-2014
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

import blue.BlueData;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

public final class ToggleLoopRenderingAction implements ActionListener {

    public void actionPerformed(ActionEvent e) {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();

        if (project != null) {
            BlueData data = project.getData();

            if (data != null) {
                data.setLoopRendering(!data.isLoopRendering());
            }

        }
    }
}
