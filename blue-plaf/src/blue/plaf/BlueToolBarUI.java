/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 *                                                                              
 * This file uses code from MetouiaToolBarUI.java by Taoufik Romdhane
 * 
 */
package blue.plaf;

import java.awt.Component;
import java.awt.Insets;

import javax.swing.AbstractButton;
import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.border.Border;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.metal.MetalToolBarUI;

/**
 * This class represents the UI delegate for the JToolBar component.
 * 
 * @author Taoufik Romdhane
 */
public class BlueToolBarUI extends MetalToolBarUI {

    /**
     * The Cached UI delegate.
     */
    private final static BlueToolBarUI toolBarUI = new BlueToolBarUI();

    /**
     * These insets are forced inner margin for the toolbar buttons.
     */
    private Insets insets = new Insets(2, 2, 2, 2);

    /**
     * Creates the UI delegate for the given component.
     * 
     * @param c
     *            The component to create its UI delegate.
     * @return The UI delegate for the given component.
     */
    public static ComponentUI createUI(JComponent c) {
        return toolBarUI;
    }

    /**
     * Installs some default values for the given toolbar. The gets a rollover
     * property.
     * 
     * @param c
     *            The reference of the toolbar to install its default values.
     */
    public void installUI(JComponent c) {
        super.installUI(c);
        c.putClientProperty("JToolBar.isRollover", Boolean.FALSE);
    }

    /**
     * Paints the given component.
     * 
     * @param g
     *            The graphics context to use.
     * @param c
     *            The component to paint.
     */

    protected Border createNonRolloverBorder() {
        return BorderFactory.createCompoundBorder(new BlueButtonBorder(),
                BorderFactory.createEmptyBorder(3, 3, 3, 3));
    }

    /**
     * Sets the border of the given component to a rollover border.
     * 
     * @param c
     *            The component to set its border.
     */
    protected void setBorderToRollover(Component c) {
        if (c instanceof AbstractButton) {
            AbstractButton button = (AbstractButton) c;

            if (!button.isRolloverEnabled()) {
                button.setRolloverEnabled(true);
            }
            if (button.isContentAreaFilled()) {
                button.setContentAreaFilled(false);
            }
            if (button.isFocusPainted()) {
                button.setFocusPainted(false);
            }
            button.setMargin(insets);
        }
    }
}