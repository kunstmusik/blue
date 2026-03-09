/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Library General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.plaf;

import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Toolkit;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import javax.swing.JComponent;
import javax.swing.JMenuItem;
import javax.swing.JToolTip;
import javax.swing.KeyStroke;
import javax.swing.UIManager;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.metal.MetalToolTipUI;

public class BlueToolTipUI extends MetalToolTipUI {

    static BlueToolTipUI sharedInstance = new BlueToolTipUI();

    public static ComponentUI createUI(JComponent c) {
        return sharedInstance;
    }

    private Font smallFont;

    private String acceleratorDelimiter;

    private JToolTip tip;

    @Override
    public void installUI(JComponent c) {
        super.installUI(c);

        Font f = c.getFont();
        smallFont = new Font(f.getName(), f.getStyle(), f.getSize() - 2);
        acceleratorDelimiter = UIManager
                .getString("MenuItem.acceleratorDelimiter");
        if (acceleratorDelimiter == null) {
            acceleratorDelimiter = "-";
        }
    }

    @Override
    public void paint(Graphics g, JComponent c) {
        JToolTip tip = (JToolTip) c;

        super.paint(g, c);

        Font font = c.getFont();
        String keyText = getAcceleratorString(tip);
        String tipText = tip.getTipText();
        if (tipText == null) {
            tipText = "";
        }
        if (!(keyText.equals(""))) { // only draw control key if there is one
            g.setFont(smallFont);
            g.setColor(BlueLookAndFeel.getPrimaryControlDarkShadow());
            FontMetrics metrics = g.getFontMetrics();
            g.drawString(keyText, metrics.stringWidth(tipText)
                    + padSpaceBetweenStrings, 2 + metrics.getAscent());
        }
    }

    private String getAcceleratorString(JToolTip tip) {
        this.tip = tip;

        String retValue = getAcceleratorString();

        this.tip = null;
        return retValue;
    }

    // NOTE: This requires the tip field to be set before this is invoked.
    // As MetalToolTipUI is shared between all JToolTips the tip field is
    // set appropriately before this is invoked. Unfortunately this means
    // that subclasses that randomly invoke this method will see varying
    // results. If this becomes an issue, MetalToolTipUI should no longer be
    // shared.
    @SuppressWarnings("deprecation")
    @Override
    public String getAcceleratorString() {
        if (tip == null || isAcceleratorHidden()) {
            return "";
        }
        JComponent comp = tip.getComponent();
        if (comp == null) {
            return "";
        }
        KeyStroke[] keys = comp.getRegisteredKeyStrokes();
        String controlKeyStr = "";

        for (KeyStroke key : keys) {
            int mod = key.getModifiers();
            int condition = comp.getConditionForKeyStroke(key);

            // KeyStroke.getModifiers() may return legacy or extended masks;
            // check both to detect any modifier presence
            boolean hasModifier = (mod & InputEvent.ALT_DOWN_MASK) != 0
                    || (mod & InputEvent.CTRL_DOWN_MASK) != 0
                    || (mod & InputEvent.SHIFT_DOWN_MASK) != 0
                    || (mod & InputEvent.META_DOWN_MASK) != 0
                    || (mod & (InputEvent.SHIFT_MASK | InputEvent.CTRL_MASK | InputEvent.META_MASK | InputEvent.ALT_MASK)) != 0;

            if (condition == JComponent.WHEN_IN_FOCUSED_WINDOW && hasModifier) {
                controlKeyStr = InputEvent.getModifiersExText(
                                KeyStroke.getKeyStroke(key.getKeyCode(), mod).getModifiers())
                        + acceleratorDelimiter
                        + KeyEvent.getKeyText(key.getKeyCode());
                break;
            }
        }

        /*
         * Special case for menu item since they do not register a keyboard
         * action for their mnemonics and they always use Alt
         */
        if (controlKeyStr.equals("") && comp instanceof JMenuItem) {
            int mnemonic = ((JMenuItem) comp).getMnemonic();
            if (mnemonic != 0) {
                controlKeyStr = InputEvent.getModifiersExText(InputEvent.ALT_DOWN_MASK)
                        + acceleratorDelimiter + (char) mnemonic;
            }
        }

        return controlKeyStr;
    }

}
