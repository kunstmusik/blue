/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.plaf;

import java.awt.*;
import java.io.Serializable;
import java.util.HashMap;
import javax.swing.*;
import javax.swing.plaf.UIResource;
import javax.swing.plaf.metal.MetalLookAndFeel;

/**
 *
 * @author stevenyi
 */
public class BlueIconFactory {

    private static Icon checkBoxIcon;
    private static Icon radioButtonIcon;
    private static Icon horizontalSliderThumbIcon;
    private static Icon verticalSliderThumbIcon;
    
    private static HashMap<Color, GradientPaint> gpCache = new HashMap<Color, GradientPaint>();

    public static GradientPaint getGradientPaint(Color c) {
        GradientPaint gp = gpCache.get(c);
        if (gp == null) {
            gp = new GradientPaint(0, 0, c.brighter(),
                    0, 6, c);
            gpCache.put(c, gp);
        }
        return gp;
    }

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

    public static Icon getHorizontalSliderThumbIcon() {
        if (horizontalSliderThumbIcon == null) {
            horizontalSliderThumbIcon = new BlueIconFactory.HorizontalSliderThumbIcon();
        }
        return horizontalSliderThumbIcon;
    }
    
    public static Icon getVerticalSliderThumbIcon() {
        if (verticalSliderThumbIcon == null) {
            verticalSliderThumbIcon = new BlueIconFactory.VerticalSliderThumbIcon();
        }
        return verticalSliderThumbIcon;
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
                    g2d.setPaint(BlueIconFactory.getGradientPaint(c.getBackground()));

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

            g2d.setPaint(BlueIconFactory.getGradientPaint(c.getBackground()));

            g2d.fillOval(0, 0, controlSize - 2, controlSize - 2);
            g2d.setPaint(p);

            g2d.setColor(MetalLookAndFeel.getControlShadow());
            g2d.drawOval(0, 0, controlSize - 2, controlSize - 2);

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

    private static class HorizontalSliderThumbIcon implements Icon, Serializable, UIResource {

        public void paintIcon(Component c, Graphics g, int x, int y) {
            JSlider slider = (JSlider) c;

            g.translate(x, y);

            // Draw the frame
            if (slider.hasFocus()) {
                g.setColor(BlueLookAndFeel.getPrimaryControlInfo());
            } else {
                g.setColor(slider.isEnabled() ? BlueLookAndFeel.getPrimaryControlInfo()
                        : BlueLookAndFeel.getControlDarkShadow());
            }

            g.drawLine(1, 0, 13, 0);  // top
            g.drawLine(0, 1, 0, 8);  // left
            g.drawLine(14, 1, 14, 8);  // right
            g.drawLine(1, 9, 7, 15); // left slant
            g.drawLine(7, 15, 14, 8);  // right slant

            // Fill in the background
            if (slider.hasFocus()) {
                g.setColor(c.getForeground());
            } else {
                g.setColor(MetalLookAndFeel.getControl());
            }
            g.fillRect(1, 1, 13, 8);

            g.drawLine(2, 9, 12, 9);
            g.drawLine(3, 10, 11, 10);
            g.drawLine(4, 11, 10, 11);
            g.drawLine(5, 12, 9, 12);
            g.drawLine(6, 13, 8, 13);
            g.drawLine(7, 14, 7, 14);

            // Draw the highlight
            if (slider.isEnabled()) {
                g.setColor(slider.hasFocus() ? BlueLookAndFeel.getPrimaryControl()
                        : BlueLookAndFeel.getControlHighlight());
                g.drawLine(1, 1, 13, 1);
                g.drawLine(1, 1, 1, 8);
            }

            g.translate(-x, -y);
        }

        public int getIconWidth() {
            return 15;
        }

        public int getIconHeight() {
            return 16;
        }
    }
    
    private static class VerticalSliderThumbIcon implements Icon, Serializable, UIResource {

    public void paintIcon( Component c, Graphics g, int x, int y ) {
        JSlider slider = (JSlider)c;

	boolean leftToRight = slider.getComponentOrientation().isLeftToRight();

        g.translate( x, y );

	// Draw the frame
	if ( slider.hasFocus() ) {
	    g.setColor( MetalLookAndFeel.getPrimaryControlInfo() );
	}
	else {
	    g.setColor( slider.isEnabled() ? BlueLookAndFeel.getPrimaryControlInfo() :
			                     BlueLookAndFeel.getControlDarkShadow() );
	}

	if (leftToRight) {
	    g.drawLine(  1,0  ,  8,0  ); // top
	    g.drawLine(  0,1  ,  0,13 ); // left
	    g.drawLine(  1,14 ,  8,14 ); // bottom
	    g.drawLine(  9,1  , 15,7  ); // top slant
	    g.drawLine(  9,13 , 15,7  ); // bottom slant
	}
	else {
	    g.drawLine(  7,0  , 14,0  ); // top
	    g.drawLine( 15,1  , 15,13 ); // right
	    g.drawLine(  7,14 , 14,14 ); // bottom
	    g.drawLine(  0,7  ,  6,1  ); // top slant
	    g.drawLine(  0,7  ,  6,13 ); // bottom slant
	}

	// Fill in the background
	if ( slider.hasFocus() ) {
	    g.setColor( c.getForeground() );
	}
	else {
	    g.setColor( BlueLookAndFeel.getControl() );
	}

	if (leftToRight) {
	    g.fillRect(  1,1 ,  8,13 );

	    g.drawLine(  9,2 ,  9,12 );
	    g.drawLine( 10,3 , 10,11 );
	    g.drawLine( 11,4 , 11,10 );
	    g.drawLine( 12,5 , 12,9 );
	    g.drawLine( 13,6 , 13,8 );
	    g.drawLine( 14,7 , 14,7 );
	}
	else {
	    g.fillRect(  7,1,   8,13 );

	    g.drawLine(  6,3 ,  6,12 );
	    g.drawLine(  5,4 ,  5,11 );
	    g.drawLine(  4,5 ,  4,10 );
	    g.drawLine(  3,6 ,  3,9 );
	    g.drawLine(  2,7 ,  2,8 );
	}

	// Draw the highlight
	if ( slider.isEnabled() ) {
	    g.setColor( slider.hasFocus() ? BlueLookAndFeel.getPrimaryControl()
			: BlueLookAndFeel.getControlHighlight() );
	    if (leftToRight) {
	        g.drawLine( 1, 1, 8, 1 );
		g.drawLine( 1, 1, 1, 13 );
	    }
	    else {
	        g.drawLine(  8,1  , 14,1  ); // top
		g.drawLine(  1,7  ,  7,1  ); // top slant
	    }
	}

        g.translate( -x, -y );
    }

    public int getIconWidth() {
        return 16;
    }

    public int getIconHeight() {
        return 15;
    }
}
}
