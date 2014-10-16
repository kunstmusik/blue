/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */

package blue.soundObject.editor.ceciliaModule;

import java.awt.BorderLayout;

import javax.swing.JComponent;
import javax.swing.JScrollPane;
import javax.swing.JTabbedPane;
import javax.swing.JTextArea;

import blue.soundObject.CeciliaModule;
import blue.soundObject.ceciliaModule.ModuleDefinition;

public class EditorPanel extends JComponent {
    private JTextArea info = new JTextArea();

    private JTextArea tk_interface = new JTextArea();

    private JTextArea mono = new JTextArea();

    private JTextArea stereo = new JTextArea();

    private JTextArea quad = new JTextArea();

    private JTextArea score = new JTextArea();

    public EditorPanel() {
        JTabbedPane tabs = new JTabbedPane(JTabbedPane.BOTTOM);

        info.setEditable(false);
        tk_interface.setEditable(false);
        mono.setEditable(false);
        stereo.setEditable(false);
        quad.setEditable(false);
        score.setEditable(false);

        addTab(tabs, "info", info);
        addTab(tabs, "tk_interface", tk_interface);
        addTab(tabs, "mono", mono);
        addTab(tabs, "stereo", stereo);
        addTab(tabs, "quad", quad);
        addTab(tabs, "score", score);

        this.setLayout(new BorderLayout());
        this.add(tabs, BorderLayout.CENTER);
    }

    private void addTab(JTabbedPane tabs, String title, JComponent comp) {
        JScrollPane jsp = new JScrollPane();
        jsp.setViewportView(comp);
        tabs.addTab(title, jsp);
    }

    public void editCeciliaModule(CeciliaModule ceciliaModule) {
        ModuleDefinition moduleDefinition = ceciliaModule.getModuleDefinition();
        info.setText(moduleDefinition.info);
        tk_interface.setText(moduleDefinition.tk_interface);
        mono.setText(moduleDefinition.mono);
        stereo.setText(moduleDefinition.stereo);
        quad.setText(moduleDefinition.quad);
        score.setText(moduleDefinition.score);
    }

}
