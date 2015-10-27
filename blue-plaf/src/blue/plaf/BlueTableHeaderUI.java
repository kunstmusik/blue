/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.plaf;

import java.awt.GradientPaint;
import java.awt.Graphics;
import java.awt.Graphics2D;
import javax.swing.JComponent;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.basic.BasicTableHeaderUI;

/**
 *
 * @author stevenyi
 */
public class BlueTableHeaderUI extends BasicTableHeaderUI {
    	
	public static ComponentUI createUI( JComponent c) {
    return new BlueTableHeaderUI();
  }
 
    @Override
  public void paint( Graphics g, JComponent c) {
    
//    Graphics2D g2D = (Graphics2D)g;
    
//    GradientPaint gp = BlueGradientFactory.getGradientPaint(c.getBackground());
                                            
//    g2D.setPaint( gp);
//    g2D.fillRect( 0,0, c.getWidth(),c.getHeight());
    
    super.paint( g, c);
  }
}
