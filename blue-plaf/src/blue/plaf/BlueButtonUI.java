/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.plaf;

import java.awt.*;
import javax.swing.AbstractButton;
import javax.swing.JComponent;
import javax.swing.JToolBar;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.metal.MetalButtonUI;
import sun.awt.AppContext;

/**
 *
 * @author stevenyi
 */
public class BlueButtonUI extends MetalButtonUI {

    int cachedWidth = -1;
    int cachedHeight = -1;
    GradientPaint gp = null;

    public static ComponentUI createUI(JComponent c) {
        return new BlueButtonUI();
    }

    @Override
    public void update(Graphics g, JComponent c) {
        super.update(g, c);

//        if (!(c.getParent() instanceof JToolBar)) {
            Graphics2D g2d = (Graphics2D) g;

            Dimension size = c.getSize();

            if (gp == null || cachedWidth != size.width || cachedHeight != size.height) {
                gp = new GradientPaint(0, 0, BlueLookAndFeel.getControl().brighter(), 0, size.height / 2, BlueLookAndFeel.getControl());
            }

            Paint p = g2d.getPaint();
            g2d.setPaint(gp);
//            g2d.fillRoundRect(0, 0, size.width, size.height, 4, 4);
            g2d.fillRect(0, 0, size.width, size.height);
            g2d.setPaint(p);
//        }

        paint(g, c);
    }

    @Override
    protected void paintFocus(Graphics g, AbstractButton b, Rectangle viewRect, Rectangle textRect, Rectangle iconRect) {
        g.setColor(BlueLookAndFeel.getFocusColor());
        Dimension size = b.getSize();
//        g.drawRoundRect(1, 1, size.width - 3, size.height - 3, 4, 4);
//        g.drawRect(1, 1, size.width - 3, size.height - 3);
        g.drawLine(1, 1, size.width - 2, 1);
    }

    @Override
    protected void paintButtonPressed(Graphics g, AbstractButton b) {
        if (b.isContentAreaFilled()) {
            Dimension size = b.getSize();
            g.setColor(getSelectColor());
//            g.fillRoundRect(2, 2, size.width - 4, size.height - 4, 4, 4);
            g.fillRect(0, 0, size.width - 1, size.height - 1);
        }
    }
}
