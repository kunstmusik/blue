/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.plaf;

import java.awt.*;
import javax.swing.*;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.basic.BasicComboBoxRenderer;
import javax.swing.plaf.metal.MetalComboBoxUI;

/**
 *
 * @author stevenyi
 */
public class BlueComboBoxUI extends MetalComboBoxUI {

    boolean oldOpaque = false;
    ListCellRenderer renderer;


    public static ComponentUI createUI(JComponent c) {
        return new BlueComboBoxUI();
    }
    
     @Override
    public void installUI( JComponent c ) {
         super.installUI(c);
         comboBox.setRenderer(createRenderer());
     }
    
 
    protected ListCellRenderer createRenderer() {
        ListCellRenderer c =  new BlueComboBoxRenderer();
        return c;
    }
    
    public static class BlueComboBoxRenderer extends BasicComboBoxRenderer.UIResource {
        
        public Component getListCellRendererComponent(
                                                 JList list, 
                                                 Object value,
                                                 int index, 
                                                 boolean isSelected, 
                                                 boolean cellHasFocus)
    {

        if (isSelected) {
            setBackground(list.getSelectionBackground());
            setForeground(list.getSelectionForeground());
            setOpaque(true);
        }
        else {
            setOpaque(false);
            setForeground(list.getForeground());
        }

        setFont(list.getFont());

        if (value instanceof Icon) {
            setIcon((Icon)value);
        }
        else {
            setText((value == null) ? "" : value.toString());
        }
        return this;
    }
    }
}
