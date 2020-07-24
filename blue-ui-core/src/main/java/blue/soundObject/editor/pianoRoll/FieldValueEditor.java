/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.soundObject.editor.pianoRoll;

import blue.soundObject.pianoRoll.Field;
import java.awt.Color;
import java.awt.Graphics;
import javax.swing.JPanel;

/**
 *
 * @author stevenyi
 */
public class FieldValueEditor extends JPanel {

    private final Field field;
    
    public FieldValueEditor(Field f) {
        this.field = f;
        setOpaque(false);
    }

    @Override
    protected void paintComponent(Graphics g) {
        double proportion = 0.5;
        var h = getHeight();
        
        g.setColor(Color.WHITE);
        
//        g.fillR
    }
    
    
    
}
