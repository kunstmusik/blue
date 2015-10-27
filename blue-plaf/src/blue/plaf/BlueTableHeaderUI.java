/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.plaf;

import java.awt.Dimension;
import java.awt.Graphics;
import javax.swing.JComponent;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.basic.BasicTableHeaderUI;

/**
 *
 * @author stevenyi
 */
public class BlueTableHeaderUI extends BasicTableHeaderUI {

    public static ComponentUI createUI(JComponent c) {
        return new BlueTableHeaderUI();
    }

    @Override
    public void installUI(JComponent c) {
        super.installUI(c); //To change body of generated methods, choose Tools | Templates.
        super.header.setPreferredSize(new Dimension(100, 23));
    }


    
    @Override
    public void paint(Graphics g, JComponent c) {

//    Graphics2D g2D = (Graphics2D)g;
//    GradientPaint gp = BlueGradientFactory.getGradientPaint(c.getBackground());
//    g2D.setPaint( gp);
//    g2D.fillRect( 0,0, c.getWidth(),c.getHeight());
        super.paint(g, c);
    }
}
