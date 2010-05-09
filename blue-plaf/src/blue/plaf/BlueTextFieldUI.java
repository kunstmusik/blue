package blue.plaf;

import java.awt.Color;
import java.awt.Graphics;

import javax.swing.JComponent;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.basic.BasicTextFieldUI;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

// This code was developed by INCORS GmbH (www.incors.com)
// as part of their Kunstoff Look and Feel
public class BlueTextFieldUI extends BasicTextFieldUI {
    private Color col1 = new Color(0, 0, 0, 48);

    private Color col2 = new Color(0, 0, 0, 0);

    protected JComponent myComponent;

    public BlueTextFieldUI() {
        super();
    }

    BlueTextFieldUI(JComponent c) {
        super();
        myComponent = c;
    }

    public static ComponentUI createUI(JComponent c) {
        return new BlueTextFieldUI(c);
    }

    protected void paintBackground(Graphics g) {
        super.paintBackground(g);
        // Rectangle editorRect = getVisibleEditorRect();
        // Graphics2D g2D = (Graphics2D) g;
        // // paint one gradient in the upper half of the text field
        // GradientPaint gradient = new GradientPaint(0.0f, 0.0f, col1, 0.0f,
        // (float) myComponent.getHeight() * 2 / 3, col2);
        // g2D.setPaint(gradient);
        // g2D.fill(editorRect);
    }
}
