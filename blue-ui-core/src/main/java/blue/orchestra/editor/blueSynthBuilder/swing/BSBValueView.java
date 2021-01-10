/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2016 Steven Yi (stevenyi@gmail.com)
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

import blue.components.lines.LineBoundaryDialog;
import blue.orchestra.blueSynthBuilder.BSBValue;
import blue.orchestra.editor.blueSynthBuilder.EditModeOnly;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Graphics;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javafx.scene.layout.BorderPane;
import javax.swing.JLabel;
import javax.swing.JOptionPane;

/**
 * @author steven
 */
public class BSBValueView extends BSBObjectView<BSBValue> implements EditModeOnly {

    BorderPane pane;

    JLabel displayLabel;

    /**
     * @param knob
     */
    public BSBValueView(BSBValue value) {
        super(value);

        this.setLayout(new BorderLayout());
        
        displayLabel = new JLabel() {
            Color bgColor = new Color(255, 255, 255, 64);
            
            @Override
            protected void paintComponent(Graphics g) {
                g.setColor(bgColor);
                g.fillRect(0,0, getWidth(), getHeight());
                super.paintComponent(g); 
            }
            
        };
        this.add(displayLabel, BorderLayout.CENTER);

        updateLabel();
        
//        value.addPropertyChangeListener(this);
        
        displayLabel.setOpaque(false);
    }

//    public float getMinimum() {
//        return value.getMinimum();
//    }
//
//    public void setMinimum(float minimum) {
//        if (minimum >= value.getMaximum()) {
//            JOptionPane.showMessageDialog(null, "Error: Min value "
//                    + "can not be set greater or equals to Max value.",
//                    "Error", JOptionPane.ERROR_MESSAGE);
//            return;
//        }
//
//        String retVal = LineBoundaryDialog.getLinePointMethod();
//
//        if (retVal == null) {
//            return;
//        }
//
//        value.setMinimum(minimum, (retVal == LineBoundaryDialog.TRUNCATE));
//    }
//
//    public float getMaximum() {
//        return value.getMaximum();
//    }
//
//    public void setMaximum(float maximum) {
//        if (maximum <= value.getMinimum()) {
//            JOptionPane.showMessageDialog(null, "Error: Max value "
//                    + "can not be set less than or " + "equal to Min value.",
//                    "Error", JOptionPane.ERROR_MESSAGE);
//
//            return;
//        }
//
//        String retVal = LineBoundaryDialog.getLinePointMethod();
//
//        if (retVal == null) {
//            return;
//        }
//        value.setMaximum(maximum, (retVal == LineBoundaryDialog.TRUNCATE));
//    }
//    
//    public float getDefaultValue() {
//        return value.getDefaultValue();
//    }
//    
//    public void setDefaultValue(float defaultValue) {
//        value.setDefaultValue(defaultValue);
//    }

//    @Override
//    public void propertyChange(PropertyChangeEvent pce) {
//        if (pce.getSource() == this.value) {
//            switch (pce.getPropertyName()) {
//                case "objectName":
//                    updateLabel();
//                    break;
//            }
////            if (pce.getPropertyName().equals("updateDefaultValue")) {
////                updating = true;
////
////                updateValueDisplay();
////
////                updating = false;
////            }
//        }
//    }

    public void updateLabel() {
        displayLabel.setText("Value: <" + bsbObj.getObjectName() + ">");
        this.setPreferredSize(displayLabel.getPreferredSize());
        this.setSize(displayLabel.getPreferredSize());
        revalidate();
    }

//    @Override
//    public void cleanup() {
//        value.removePropertyChangeListener(this);
//    }
}
