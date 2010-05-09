/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.plaf;

import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.FontMetrics;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Insets;
import java.awt.Paint;
import javax.swing.JComponent;
import javax.swing.UIManager;
import javax.swing.plaf.ComponentUI;
import org.netbeans.swing.tabcontrol.TabDisplayer;
import org.netbeans.swing.tabcontrol.plaf.AbstractViewTabDisplayerUI;
import org.netbeans.swing.tabcontrol.plaf.TabCellRenderer;
import org.openide.awt.HtmlRenderer;

/**
 *
 * @author syi
 */
public class BlueViewTabDisplayerUI extends AbstractViewTabDisplayerUI {

    private static final int BUMP_X_PAD =  3;
    private static final int BUMP_WIDTH = 3;
    private static final int TXT_X_PAD = BUMP_X_PAD + BUMP_WIDTH + 5;
    private static final int TXT_Y_PAD = 3;

    private static final int ICON_X_PAD = 2;

    private final Dimension prefSize;


    public BlueViewTabDisplayerUI (TabDisplayer displayer) {
        super (displayer);
        prefSize = new Dimension(100, 19);
    }
 
    public static ComponentUI createUI(JComponent c) {
        return new BlueViewTabDisplayerUI((TabDisplayer) c);
    }


    public Dimension getPreferredSize(JComponent c) {
        FontMetrics fm = getTxtFontMetrics();
        int height = fm == null ?
                19 : fm.getAscent() + 2 * fm.getDescent() + 2;
        Insets insets = c.getInsets();
        prefSize.height = height + insets.bottom + insets.top;
        return prefSize;
    }

    @Override
    protected void paintTabContent(Graphics g, int index, String text, int x,
                                   int y, int width, int height) {
        // substract lower border
        height--;
        y -= 2; //align to center
        FontMetrics fm = getTxtFontMetrics();
        // setting font already here to compute string width correctly
        g.setFont(getTxtFont());
        int txtWidth = width;
        if (isSelected(index)) {
            Component buttons = getControlButtons();
            if( null != buttons ) {
                Dimension buttonsSize = buttons.getPreferredSize();
                txtWidth = width - (buttonsSize.width + ICON_X_PAD + 2*TXT_X_PAD);
                buttons.setLocation( x + txtWidth+2*TXT_X_PAD, y + (height-buttonsSize.height)/2+1 );
            }
        } else {
            txtWidth = width - 2 * TXT_X_PAD;
        }
        // draw bump (dragger)
        drawBump(g, index, x + 4, y + 6, BUMP_WIDTH, height - 8);

        // draw text in right color
//        Color txtC = UIManager.getColor("TabbedPane.foreground"); //NOI18N
        Color txtC = Color.WHITE;

        HtmlRenderer.renderString(text, g, x + TXT_X_PAD, y + fm.getAscent()
            + TXT_Y_PAD,
            txtWidth, height, getTxtFont(),
            txtC,
            HtmlRenderer.STYLE_TRUNCATE, true);

    }

    @Override
    protected void paintTabBorder(Graphics g, int index, int x, int y,
                                  int width, int height) {

        // subtract lower border
//        height--;
        boolean isSelected = isSelected(index);

        g.translate(x, y);

        g.setColor(isSelected ? UIManager.getColor(
                "InternalFrame.borderHighlight") //NOI18N
                   : UIManager.getColor("InternalFrame.borderLight")); //NOI18N
        g.drawLine(0, height - 1, width - 2, height - 1);
        g.drawLine(width - 1, height - 1, width - 1, 0);

        g.setColor(UIManager.getColor("InternalFrame.borderShadow")); //NOI18N
        g.drawLine(0, 0, 0, height - 1);
        g.drawLine(1, 0, width - 2, 0);

//        System.out.println(UIManager.getColor("InternalFrame.borderShadow"));
//        System.out.println(UIManager.getColor("InternalFrame.borderHighlight"));
//        System.out.println(UIManager.getColor("InternalFrame.borderLight"));

        g.translate(-x, -y);
    }

    @Override
    protected void paintTabBackground(Graphics g, int index, int x, int y,
                                      int width, int height) {
        // substract lower border
        height--;
        ((Graphics2D) g).setPaint(
                getBackgroundPaint(g, index, x, y, width, height));
//        if (isFocused(index)) {
            g.fillRect(x, y, width, height);
//        } else {
//            g.fillRect(x + 1, y + 1, width - 2, height - 2);
//        }
    }

    private Paint getBackgroundPaint(Graphics g, int index, int x, int y,
                                     int width, int height) {
        // background body, colored according to state
        boolean selected = isSelected(index);
        boolean focused = isFocused(index);
        boolean attention = isAttention(index);

        Paint result = null;
        if (focused && !attention) {
//            result = ColorUtil.getGradientPaint(x, y, getSelGradientColor(), x + width, y, getSelGradientColor2());
            result = BlueLookAndFeel.getControl();
        } else if (selected && !attention) {
//            result = UIManager.getColor("TabbedPane.background"); //NOI18N
            result = BlueLookAndFeel.getControl();
        } else if (attention) {
            Color ATTENTION_COLOR = new Color(255, 238, 120);
            result = ATTENTION_COLOR;
        } else {
//            result = UIManager.getColor("tab_unsel_fill");
            result = BlueLookAndFeel.getControl().darker();
        }
        return result;
    }


     private void drawBump(Graphics g, int index, int x, int y, int width,
                          int height) {
     
        // prepare colors
        Color highlightC, bodyC, shadowC;
        if (isFocused(index)) {
            bodyC = new Color(210, 220, 243); //XXX
            highlightC = bodyC.brighter();
            shadowC = bodyC.darker();
//        } else if (isSelected(index)) {
//            highlightC =
//                    UIManager.getColor("InternalFrame.borderHighlight"); //NOI18N
//            bodyC = UIManager.getColor("InternalFrame.borderLight"); //NOI18N
//            shadowC = UIManager.getColor("InternalFrame.borderShadow"); //NOI18N
        } else {
            highlightC = UIManager.getColor("InternalFrame.borderLight"); //NOI18N
            bodyC = UIManager.getColor("tab_unsel_fill");
            shadowC = UIManager.getColor("InternalFrame.borderShadow"); //NOI18N
        }
        // draw
        for (int i = 0; i < width / 3; i++, x += 3) {
            g.setColor(highlightC);
            g.drawLine(x, y, x, y + height - 1);
            g.drawLine(x, y, x + 1, y);
            g.setColor(bodyC);
            g.drawLine(x + 1, y + 1, x + 1, y + height - 2);
            g.setColor(shadowC);
            g.drawLine(x + 2, y, x + 2, y + height - 1);
            g.drawLine(x, y + height - 1, x + 1, y + height - 1);
        }
    }

}
