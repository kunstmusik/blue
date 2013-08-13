/*
 BlueSplitPaneDivider - derived from Sun's Metal Split Pane Divider
 */

package blue.plaf;

import java.awt.Color;
import java.awt.Component;
import java.awt.Container;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Insets;
import java.awt.LayoutManager;
import java.awt.Rectangle;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import javax.swing.JButton;
import javax.swing.JSplitPane;
import javax.swing.border.Border;
import javax.swing.plaf.basic.BasicSplitPaneDivider;
import javax.swing.plaf.basic.BasicSplitPaneUI;
import javax.swing.plaf.metal.MetalLookAndFeel;

/**
 * Metal's split pane divider
 * <p>
 * <strong>Warning:</strong> Serialized objects of this class will not be
 * compatible with future Swing releases. The current serialization support is
 * appropriate for short term storage or RMI between applications running the
 * same version of Swing. As of 1.4, support for long term storage of all
 * JavaBeans<sup><font size="-2">TM</font></sup> has been added to the
 * <code>java.beans</code> package. Please see {@link java.beans.XMLEncoder}.
 * 
 * @version 1.17 12/03/01
 * @author Steve Wilson
 * @author Ralph kar
 */
class BlueSplitPaneDivider extends BasicSplitPaneDivider {
    private int inset = 2;
    
    private int dividerRestoreLocation = 0;

    private Color controlColor = MetalLookAndFeel.getControl();

    private Color primaryControlColor = MetalLookAndFeel.getPrimaryControl();

    public BlueSplitPaneDivider(BasicSplitPaneUI ui) {
        super(ui);
        setLayout(new BlueDividerLayout());
        this.setBorder(null);
        this.addMouseListener(new MouseAdapter() {

            @Override
            public void mouseClicked(MouseEvent me) {
                if (me.getClickCount() == 2) {
                    handleDoubleClick();
                }
            }
            
        });
    }
    
    protected void handleDoubleClick() {
        JSplitPane jsp = getSplitPaneFromSuper();
        
        int currentLoc = jsp.getDividerLocation();
        
        if(currentLoc == jsp.getMinimumDividerLocation() || 
                currentLoc == jsp.getMaximumDividerLocation()) {
            
            jsp.setDividerLocation(dividerRestoreLocation);
            
        } else {
            
            dividerRestoreLocation = currentLoc;
            
            if((currentLoc - jsp.getMinimumDividerLocation()) < (jsp.getMaximumDividerLocation() - currentLoc)) {
                jsp.setDividerLocation(jsp.getMinimumDividerLocation());
            } else {
                jsp.setDividerLocation(jsp.getMaximumDividerLocation());
            }
        
        }
    }

    @Override
    public void paint(Graphics g) {
        if (splitPane.hasFocus()) {
            g.setColor(primaryControlColor);
        } else {
            g.setColor(controlColor);
        }
        Rectangle clip = g.getClipBounds();
        Insets insets = getInsets();
        g.fillRect(clip.x, clip.y, clip.width, clip.height);
        Dimension size = getSize();
        size.width -= inset * 2;
        size.height -= inset * 2;
        int drawX = inset;
        int drawY = inset;
        if (insets != null) {
            size.width -= (insets.left + insets.right);
            size.height -= (insets.top + insets.bottom);
            drawX += insets.left;
            drawY += insets.top;
        }
        super.paint(g);
    }

    /**
     * Creates and return an instance of JButton that can be used to collapse
     * the left component in the metal split pane.
     */
    @Override
    protected JButton createLeftOneTouchButton() {
        JButton b = new JButton() {
            // Sprite buffer for the arrow image of the left button
            int[][] buffer = { { 0, 0, 0, 2, 2, 0, 0, 0, 0 },
                    { 0, 0, 2, 1, 1, 1, 0, 0, 0 },
                    { 0, 2, 1, 1, 1, 1, 1, 0, 0 },
                    { 2, 1, 1, 1, 1, 1, 1, 1, 0 },
                    { 0, 3, 3, 3, 3, 3, 3, 3, 3 } };

            @Override
            public void setBorder(Border b) {
            }

            @Override
            public void paint(Graphics g) {
                JSplitPane splitPane = getSplitPaneFromSuper();
                if (splitPane != null) {
                    int oneTouchSize = getOneTouchSizeFromSuper();
                    int orientation = getOrientationFromSuper();
                    int blockSize = Math.min(getDividerSize(), oneTouchSize);

                    // Initialize the color array
                    Color[] colors = { this.getBackground(),
                            MetalLookAndFeel.getPrimaryControlDarkShadow(),
                            MetalLookAndFeel.getPrimaryControlInfo(),
                            MetalLookAndFeel.getPrimaryControlHighlight() };

                    // Fill the background first ...
                    g.setColor(this.getBackground());
                    g.fillRect(0, 0, this.getWidth(), this.getHeight());

                    // ... then draw the arrow.
                    if (getModel().isPressed()) {
                        // Adjust color mapping for pressed button state
                        colors[1] = colors[2];
                    }
                    if (orientation == JSplitPane.VERTICAL_SPLIT) {
                        // Draw the image for a vertical split
                        for (int i = 1; i <= buffer[0].length; i++) {
                            for (int j = 1; j < blockSize; j++) {
                                if (buffer[j - 1][i - 1] == 0) {
                                    continue;
                                }

                                g.setColor(colors[buffer[j - 1][i - 1]]);
                                g.drawLine(i, j, i, j);
                            }
                        }
                    } else {
                        // Draw the image for a horizontal split
                        // by simply swaping the i and j axis.
                        // Except the drawLine() call this code is
                        // identical to the code block above. This was done
                        // in order to remove the additional orientation
                        // check for each pixel.
                        for (int i = 1; i <= buffer[0].length; i++) {
                            for (int j = 1; j < blockSize; j++) {
                                if (buffer[j - 1][i - 1] == 0) {
                                    // Nothing needs
                                    // to be drawn
                                    continue;
                                }

                                g.setColor(colors[buffer[j - 1][i - 1]]);
                                g.drawLine(j, i, j, i);
                            }
                        }
                    }
                }
            }

            // Don't want the button to participate in focus traversable.
            @Override
            public boolean isFocusTraversable() {
                return false;
            }
        };
        b.setRequestFocusEnabled(false);
        b.setCursor(Cursor.getPredefinedCursor(Cursor.DEFAULT_CURSOR));
        b.setFocusPainted(false);
        b.setBorderPainted(false);
        return b;
    }

    /**
     * Creates and return an instance of JButton that can be used to collapse
     * the right component in the metal split pane.
     */
    @Override
    protected JButton createRightOneTouchButton() {
        JButton b = new JButton() {
            // Sprite buffer for the arrow image of the right button
            int[][] buffer = { { 2, 2, 2, 2, 2, 2, 2, 2 },
                    { 0, 1, 1, 1, 1, 1, 1, 3 }, { 0, 0, 1, 1, 1, 1, 3, 0 },
                    { 0, 0, 0, 1, 1, 3, 0, 0 }, { 0, 0, 0, 0, 3, 0, 0, 0 } };

            @Override
            public void setBorder(Border border) {
            }

            @Override
            public void paint(Graphics g) {
                JSplitPane splitPane = getSplitPaneFromSuper();
                if (splitPane != null) {
                    int oneTouchSize = getOneTouchSizeFromSuper();
                    int orientation = getOrientationFromSuper();
                    int blockSize = Math.min(getDividerSize(), oneTouchSize);

                    // Initialize the color array
                    Color[] colors = { this.getBackground(),
                            MetalLookAndFeel.getPrimaryControlDarkShadow(),
                            MetalLookAndFeel.getPrimaryControlInfo(),
                            MetalLookAndFeel.getPrimaryControlHighlight() };

                    // Fill the background first ...
                    g.setColor(this.getBackground());
                    g.fillRect(0, 0, this.getWidth(), this.getHeight());

                    // ... then draw the arrow.
                    if (getModel().isPressed()) {
                        // Adjust color mapping for pressed button state
                        colors[1] = colors[2];
                    }
                    if (orientation == JSplitPane.VERTICAL_SPLIT) {
                        // Draw the image for a vertical split
                        for (int i = 1; i <= buffer[0].length; i++) {
                            for (int j = 1; j < blockSize; j++) {
                                if (buffer[j - 1][i - 1] == 0) {
                                    continue;
                                }

                                g.setColor(colors[buffer[j - 1][i - 1]]);
                                g.drawLine(i, j, i, j);
                            }
                        }
                    } else {
                        // Draw the image for a horizontal split
                        // by simply swaping the i and j axis.
                        // Except the drawLine() call this code is
                        // identical to the code block above. This was done
                        // in order to remove the additional orientation
                        // check for each pixel.
                        for (int i = 1; i <= buffer[0].length; i++) {
                            for (int j = 1; j < blockSize; j++) {
                                if (buffer[j - 1][i - 1] == 0) {
                                    // Nothing needs
                                    // to be drawn
                                    continue;
                                }

                                g.setColor(colors[buffer[j - 1][i - 1]]);
                                g.drawLine(j, i, j, i);
                            }
                        }
                    }
                }
            }

            // Don't want the button to participate in focus traversable.
            @Override
            public boolean isFocusTraversable() {
                return false;
            }
        };
        b.setCursor(Cursor.getPredefinedCursor(Cursor.DEFAULT_CURSOR));
        b.setFocusPainted(false);
        b.setBorderPainted(false);
        b.setRequestFocusEnabled(false);
        return b;
    }

    /**
     * Used to layout a MetalSplitPaneDivider. Layout for the divider involves
     * appropriately moving the left/right buttons around.
     * <p>
     * This inner class is marked &quot;public&quot; due to a compiler bug. This
     * class should be treated as a &quot;protected&quot; inner class.
     * Instantiate it only within subclasses of MetalSplitPaneDivider.
     */
    public class BlueDividerLayout implements LayoutManager {
        public void layoutContainer(Container c) {
            JButton leftButton = getLeftButtonFromSuper();
            JButton rightButton = getRightButtonFromSuper();
            JSplitPane splitPane = getSplitPaneFromSuper();
            int orientation = getOrientationFromSuper();
            int oneTouchSize = getOneTouchSizeFromSuper();
            int oneTouchOffset = getOneTouchOffsetFromSuper();
            Insets insets = getInsets();

            // This layout differs from the one used in BasicSplitPaneDivider.
            // It does not center justify the oneTouchExpadable buttons.
            // This was necessary in order to meet the spec of the Metal
            // splitpane divider.
            if (leftButton != null && rightButton != null
                    && c == BlueSplitPaneDivider.this) {
                if (splitPane.isOneTouchExpandable()) {
                    if (orientation == JSplitPane.VERTICAL_SPLIT) {
                        int extraY = (insets != null) ? insets.top : 0;
                        int blockSize = getDividerSize();

                        if (insets != null) {
                            blockSize -= (insets.top + insets.bottom);
                        }
                        blockSize = Math.min(blockSize, oneTouchSize);
                        leftButton.setBounds(oneTouchOffset, extraY,
                                blockSize * 2, blockSize);
                        rightButton.setBounds(
                                oneTouchOffset + oneTouchSize * 2, extraY,
                                blockSize * 2, blockSize);
                    } else {
                        int blockSize = getDividerSize();
                        int extraX = (insets != null) ? insets.left : 0;

                        if (insets != null) {
                            blockSize -= (insets.left + insets.right);
                        }
                        blockSize = Math.min(blockSize, oneTouchSize);
                        leftButton.setBounds(extraX, oneTouchOffset, blockSize,
                                blockSize * 2);
                        rightButton.setBounds(extraX, oneTouchOffset
                                + oneTouchSize * 2, blockSize, blockSize * 2);
                    }
                } else {
                    leftButton.setBounds(-5, -5, 1, 1);
                    rightButton.setBounds(-5, -5, 1, 1);
                }
            }
        }

        public Dimension minimumLayoutSize(Container c) {
            return new Dimension(0, 0);
        }

        public Dimension preferredLayoutSize(Container c) {
            return new Dimension(0, 0);
        }

        public void removeLayoutComponent(Component c) {
        }

        public void addLayoutComponent(String string, Component c) {
        }
    }

    /*
     * The following methods only exist in order to be able to access protected
     * members in the superclass, because these are otherwise not available in
     * any inner class.
     */

    int getOneTouchSizeFromSuper() {
        return super.ONE_TOUCH_SIZE;
    }

    int getOneTouchOffsetFromSuper() {
        return super.ONE_TOUCH_OFFSET;
    }

    int getOrientationFromSuper() {
        return super.orientation;
    }

    JSplitPane getSplitPaneFromSuper() {
        return super.splitPane;
    }

    JButton getLeftButtonFromSuper() {
        return super.leftButton;
    }

    JButton getRightButtonFromSuper() {
        return super.rightButton;
    }
}
