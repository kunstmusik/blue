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
package blue.orchestra.editor.blueSynthBuilder.swing;

import blue.jfx.BlueFX;
import blue.orchestra.blueSynthBuilder.BSBCheckBox;
import blue.orchestra.editor.blueSynthBuilder.BSBPreferences;
import blue.ui.utilities.UiUtilities;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javafx.application.Platform;
import javafx.beans.value.ChangeListener;
import javax.swing.JCheckBox;

/**
 * @author steven
 */
public class BSBCheckBoxView extends BSBObjectView<BSBCheckBox> {

    final BSBCheckBox checkBox;

    JCheckBox uiBox = new JCheckBox();

    private volatile boolean updating = false;

//    ChangeListener<String> toolTipListener;
    ChangeListener<Boolean> cboxToViewListener = (obs, old, newVal) -> {
        if (!updating) {
            try {
                updating = true;
                
                UiUtilities.invokeOnSwingThread(() -> {
                    uiBox.setSelected(newVal);
                });
            } finally {
                updating = false;
            }
        }
    };
    
    ChangeListener<String> labelListener = (obs, old, newVal) -> {
        uiBox.setText(newVal);
    };

    /**
     * @param box
     */
    public BSBCheckBoxView(BSBCheckBox checkBox) {
        super(checkBox);
        
        updating = true;

        this.checkBox = checkBox;
        
        uiBox.setOpaque(false);
        uiBox.addActionListener((ActionEvent e) -> {
            if (!updating) {
                checkBox.setSelected(uiBox.isSelected());
            }
        });

        this.setLayout(new BorderLayout());
        this.add(uiBox, BorderLayout.CENTER);

        this.setSize(uiBox.getPreferredSize());

        updating = false;

        revalidate();

    }


    @Override
    public void addNotify() {
        uiBox.setSelected(checkBox.isSelected());
        uiBox.setText(checkBox.getLabel());
        
        checkBox.selectedProperty().addListener(cboxToViewListener);
        checkBox.labelProperty().addListener(labelListener);
        
        setSize(uiBox.getPreferredSize());
        
        super.addNotify();
    }

    @Override
    public void removeNotify() {
        checkBox.selectedProperty().removeListener(cboxToViewListener);
        checkBox.labelProperty().removeListener(labelListener);

        super.removeNotify();
    }

}
