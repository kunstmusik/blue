package blue.gui;

/*
 =====================================================================

 ScrollerButton.java

 Created by Claude Duguay
 Copyright (c) 2000

 =====================================================================
 */

import java.awt.Dimension;
import java.awt.Insets;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import org.openide.util.ImageUtilities;

public class ScrollerButton extends JButton {

    public static final ImageIcon LEFT = new ImageIcon(ImageUtilities.loadImage("blue/ui/core/images/left.gif"));

    public static final ImageIcon RIGHT = new ImageIcon(ImageUtilities.loadImage("blue/ui/core/images/right.gif"));

    public static final ImageIcon TOP = new ImageIcon(ImageUtilities.loadImage("blue/ui/core/images/top.gif"));

    public static final ImageIcon BOTTOM = new ImageIcon(ImageUtilities.loadImage("blue/ui/core/images/bottom.gif"));

    public static final ImageIcon NORTH = new ImageIcon(ImageUtilities.loadImage("blue/ui/core/images/north.gif"));

    public static final ImageIcon SOUTH = new ImageIcon(ImageUtilities.loadImage("blue/ui/core/images/south.gif"));

    public static final ImageIcon EAST = new ImageIcon(ImageUtilities.loadImage("blue/ui/core/images/east.gif"));

    public static final ImageIcon WEST = new ImageIcon(ImageUtilities.loadImage("blue/ui/core/images/west.gif"));

    public static final ImageIcon PLUS = new ImageIcon(ImageUtilities.loadImage("blue/ui/core/images/plus.gif"));

    public static final ImageIcon MINUS = new ImageIcon(ImageUtilities.loadImage("blue/ui/core/images/minus.gif"));

    public ScrollerButton(ImageIcon icon) {
        super(icon);
        // setPreferredSize(new Dimension(16, 16));
        // setMargin(new Insets(0, 0, 1, 1));
        setFocusPainted(false);
        setDefaultCapable(false);
    }

    public ScrollerButton(String text) {
        super(text);
        setPreferredSize(new Dimension(16, 16));
        setMargin(new Insets(0, 0, 0, 0));
        setFocusPainted(false);
        setDefaultCapable(false);
    }

    @Override
    public boolean isFocusTraversable() {
        return false;
    }
}
