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

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.HashMap;
import java.util.Iterator;

import javax.swing.JCheckBox;
import javax.swing.JComponent;

import pnuts.awt.PnutsLayout;
import blue.soundObject.CeciliaModule;
import blue.soundObject.ceciliaModule.CToggle;
import blue.soundObject.ceciliaModule.CeciliaObject;

/**
 * @author Administrator
 * 
 * To change the template for this generated type comment go to
 * Window>Preferences>Java>Code Generation>Code and Comments
 */
public class TogglePanel extends JComponent implements ActionListener {
    private HashMap interfaceObjectMap = new HashMap();

    private HashMap dataValues = new HashMap();

    public TogglePanel() {
        this.setLayout(new PnutsLayout("cols=1,valign=top, halign=left"));
    }

    public void clearToggles() {
        this.removeAll();
        interfaceObjectMap.clear();
        dataValues.clear();
    }

    public void addToggle(String name) {
        JCheckBox toggle = new JCheckBox(name);
        toggle.setActionCommand(name);
        toggle.addActionListener(this);
        this.add(toggle);

        interfaceObjectMap.put(name, toggle);
    }

    public void actionPerformed(ActionEvent e) {
        System.err.println(e.getActionCommand());
        JCheckBox checkBox = (JCheckBox) e.getSource();
        CToggle toggle = (CToggle) dataValues.get(e.getActionCommand());
        toggle.setToggled(checkBox.isSelected());
    }

    /**
     * @param ceciliaModule
     */
    public void editCeciliaModule(CeciliaModule ceciliaModule) {
        HashMap map = ceciliaModule.getStateData();

        if (map.size() == 0) {
            return;
        }

        for (Iterator iter = map.values().iterator(); iter.hasNext();) {
            CeciliaObject element = (CeciliaObject) iter.next();

            if (element instanceof CToggle) {
                CToggle toggle = (CToggle) element;

                JCheckBox checkBox = (JCheckBox) interfaceObjectMap.get(toggle
                        .getObjectName());
                checkBox.setText(toggle.getLabel());
                checkBox.setSelected(toggle.isToggled());

                dataValues.put(toggle.getObjectName(), toggle);
            }
        }

    }
}
