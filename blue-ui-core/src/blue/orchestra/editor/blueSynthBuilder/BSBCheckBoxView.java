/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.editor.blueSynthBuilder;

import blue.orchestra.blueSynthBuilder.BSBCheckBox;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JCheckBox;

/**
 * @author steven
 */
public class BSBCheckBoxView extends AutomatableBSBObjectView implements
        PropertyChangeListener {

    BSBCheckBox box;

    JCheckBox uiBox = new JCheckBox();

    private boolean updating = false;

    /**
     * @param box
     */
    public BSBCheckBoxView(BSBCheckBox box) {
        updating = true;

        this.box = box;
        this.setBSBObject(box);

        uiBox.setSelected(box.isSelected());
        uiBox.setText(box.getLabel());

        uiBox.addActionListener((ActionEvent e) -> {
            if (!updating) {
                updateSelected();
            }
        });

        this.setLayout(new BorderLayout());
        this.add(uiBox, BorderLayout.CENTER);

        this.setSize(uiBox.getPreferredSize());

        box.addPropertyChangeListener(this);

        updating = false;

        revalidate();

    }

    private void updateSelected() {
        box.setSelected(uiBox.isSelected());
    }

    public String getLabel() {
        return box.getLabel();
    }

    public void setLabel(String label) {
        this.box.setLabel(label);
        uiBox.setText(label);

        this.setSize(uiBox.getPreferredSize());
        repaint();
    }

    public boolean isRandomizable() {
        return box.isRandomizable();
    }

    public void setRandomizable(boolean randomizable) {
        box.setRandomizable(randomizable);
    }

    @Override
    public void propertyChange(PropertyChangeEvent pce) {
        if (pce.getSource() == this.box) {
            if (pce.getPropertyName().equals("selected")) {
                updating = true;

                uiBox.setSelected(box.isSelected());

                updating = false;
            }
        }
    }

    @Override
    public void cleanup() {
        box.removePropertyChangeListener(this);
    }

}
