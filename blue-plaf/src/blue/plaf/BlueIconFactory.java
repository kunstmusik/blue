/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.plaf;

import java.awt.*;
import java.io.Serializable;
import javax.swing.ButtonModel;
import javax.swing.Icon;
import javax.swing.JCheckBox;
import javax.swing.JRadioButton;
import javax.swing.plaf.UIResource;
import javax.swing.plaf.metal.MetalLookAndFeel;

/**
 *
 * @author stevenyi
 */
public class BlueIconFactory {

    private static Icon checkBoxIcon;
    private static Icon radioButtonIcon;

    public static Icon getCheckBoxIcon() {
        if (checkBoxIcon == null) {
            checkBoxIcon = new BlueIconFactory.CheckBoxIcon();
        }
        return checkBoxIcon;
    }

    public static Icon getRadioButtonIcon() {
        if (radioButtonIcon == null) {
            radioButtonIcon = new BlueIconFactory.RadioButtonIcon();
        }
        return radioButtonIcon;
    }

    private static class CheckBoxIcon implements Icon, UIResource, Serializable {

        GradientPaint gp = new GradientPaint(0, 0, BlueLookAndFeel.getControl().brighter(),
                0, 6, BlueLookAndFeel.getControl());

        protected int getControlSize() {
            return 13;
        }

        public void paintIcon(Component c, Graphics g, int x, int y) {
//            if (MetalLookAndFeel.usingOcean()) {
//                paintOceanIcon(c, g, x, y);
//                return;
//            }
            ButtonModel model = ((JCheckBox) c).getModel();
            int controlSize = getControlSize();

            if (model.isEnabled()) {
                if (model.isPressed() && model.isArmed()) {
                    g.setColor(MetalLookAndFeel.getControlShadow());
                    g.fillRect(x, y, controlSize - 1, controlSize - 1);
                    BlueBorderUtilities.drawPressed3DBorder(g, x, y, controlSize, controlSize);
                } else {
                    //BlueBorderUtilities.drawSimple3DBorder(g, x, y, controlSize, controlSize);
                    Graphics2D g2d = (Graphics2D) g;
                    Paint p = g2d.getPaint();

                    // need to find a way to cache this GradientPaint...
                    g2d.setPaint(gp);

                    g2d.translate(x, y);

                    g2d.fillRoundRect(0, 0, controlSize - 1, controlSize - 1, 2, 2);
                    g2d.setPaint(p);

                    g.setColor(MetalLookAndFeel.getControlShadow());
                    g.drawRoundRect(0, 0, controlSize - 1, controlSize - 1, 2, 2);

                    g2d.translate(-x, -y);
                }
                g.setColor(c.getForeground());
            } else {
                g.setColor(BlueLookAndFeel.getControlShadow());
                g.drawRoundRect(x, y, controlSize - 1, controlSize - 1, 2, 2);
            }

            if (model.isSelected()) {
                drawCheck(c, g, x, y);
            }

        }

        protected void drawCheck(Component c, Graphics g, int x, int y) {
            int controlSize = getControlSize();
            g.fillRect(x + 3, y + 5, 2, controlSize - 8);
            g.drawLine(x + (controlSize - 4), y + 3, x + 5, y + (controlSize - 6));
            g.drawLine(x + (controlSize - 4), y + 4, x + 5, y + (controlSize - 5));
        }

        public int getIconWidth() {
            return getControlSize();
        }

        public int getIconHeight() {
            return getControlSize();
        }
    } // End class CheckBoxIcon

    private static class RadioButtonIcon implements Icon, UIResource, Serializable {

        GradientPaint gp = new GradientPaint(0, 0, BlueLookAndFeel.getControl().brighter(),
                0, 6, BlueLookAndFeel.getControl());
        private static int controlSize = 13;

        public void paintIcon(Component c, Graphics g, int x, int y) {

            JRadioButton rb = (JRadioButton) c;
            ButtonModel model = rb.getModel();
            boolean drawDot = model.isSelected();

//            Color background = c.getBackground();
            Color dotColor = c.getForeground();
//            Color shadow = MetalLookAndFeel.getControlShadow();
//            Color darkCircle = MetalLookAndFeel.getControlDarkShadow();
//            Color whiteInnerLeftArc = MetalLookAndFeel.getControlHighlight();
//            Color whiteOuterRightArc = MetalLookAndFeel.getControlHighlight();
//            Color interiorColor = background;

            g.translate(x, y);

            Graphics2D g2d = (Graphics2D) g;
            Paint p = g2d.getPaint();

            // need to find a way to cache this GradientPaint...
            g2d.setPaint(gp);

            g2d.fillOval(0, 0, controlSize - 2, controlSize - 2);
            g2d.setPaint(p);

            g2d.setColor(MetalLookAndFeel.getControlShadow());
            g2d.drawOval(0, 0, controlSize - 2, controlSize - 2);

            // Set up colors per RadioButtonModel condition
//            if (!model.isEnabled()) {
//                whiteInnerLeftArc = whiteOuterRightArc = background;
//                darkCircle = dotColor = shadow;
//            } else if (model.isPressed() && model.isArmed()) {
//                whiteInnerLeftArc = interiorColor = shadow;
//            }



//            // fill interior
//            g.setColor(interiorColor);
//            g.fillRect(2, 2, 9, 9);
//
//            // draw Dark Circle (start at top, go clockwise)
//            g.setColor(darkCircle);
//            g.drawLine(4, 0, 7, 0);
//            g.drawLine(8, 1, 9, 1);
//            g.drawLine(10, 2, 10, 3);
//            g.drawLine(11, 4, 11, 7);
//            g.drawLine(10, 8, 10, 9);
//            g.drawLine(9, 10, 8, 10);
//            g.drawLine(7, 11, 4, 11);
//            g.drawLine(3, 10, 2, 10);
//            g.drawLine(1, 9, 1, 8);
//            g.drawLine(0, 7, 0, 4);
//            g.drawLine(1, 3, 1, 2);
//            g.drawLine(2, 1, 3, 1);
//
//            // draw Inner Left (usually) White Arc
//            //  start at lower left corner, go clockwise
//            g.setColor(whiteInnerLeftArc);
//            g.drawLine(2, 9, 2, 8);
//            g.drawLine(1, 7, 1, 4);
//            g.drawLine(2, 2, 2, 3);
//            g.drawLine(2, 2, 3, 2);
//            g.drawLine(4, 1, 7, 1);
//            g.drawLine(8, 2, 9, 2);
//            // draw Outer Right White Arc
//            //  start at upper right corner, go clockwise
//            g.setColor(whiteOuterRightArc);
//            g.drawLine(10, 1, 10, 1);
//            g.drawLine(11, 2, 11, 3);
//            g.drawLine(12, 4, 12, 7);
//            g.drawLine(11, 8, 11, 9);
//            g.drawLine(10, 10, 10, 10);
//            g.drawLine(9, 11, 8, 11);
//            g.drawLine(7, 12, 4, 12);
//            g.drawLine(3, 11, 2, 11);

            // selected dot
            if (drawDot) {
                g.setColor(dotColor);
                g.fillRect(4, 4, 4, 4);
                g.drawLine(4, 3, 7, 3);
                g.drawLine(8, 4, 8, 7);
                g.drawLine(7, 8, 4, 8);
                g.drawLine(3, 7, 3, 4);
            }

            g.translate(-x, -y);
        }

        public int getIconWidth() {
            return 13;
        }

        public int getIconHeight() {
            return 13;
        }
    }  // End class RadioButtonIcon
}
