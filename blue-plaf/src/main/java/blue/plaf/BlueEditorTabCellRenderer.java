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
import java.awt.Graphics;
import java.awt.Insets;
import java.awt.Polygon;
import java.awt.Rectangle;
import javax.swing.Icon;
import javax.swing.JComponent;
import javax.swing.UIManager;
import org.netbeans.swing.tabcontrol.plaf.AbstractTabCellRenderer;
import org.netbeans.swing.tabcontrol.plaf.TabPainter;

/**
 *
 * @author syi
 */
public class BlueEditorTabCellRenderer extends AbstractTabCellRenderer {
    private static final TabPainter leftClip = new WinClassicLeftClipPainter();
    private static final TabPainter rightClip = new WinClassicRightClipPainter();
    private static final TabPainter normal = new WinClassicPainter();

    static final Color ATTENTION_COLOR = new Color(255, 238, 120);


    /**
     * Creates a new instance of BlueEditorTabCellRenderer
     */
    public BlueEditorTabCellRenderer() {
          super(leftClip, normal, rightClip, new Dimension (28, 32));
      }

    @Override
    public Color getSelectedForeground() {
//        return UIManager.getColor("textText"); //NOI18N
        return Color.WHITE;
    }

    @Override
    public Color getForeground() {
        return getSelectedForeground();
    }

    /**
     * #56245 - need more space between icon and edge on classic for the case
     * of full 16x16 icons.
     */
    @Override
    public int getPixelsToAddToSelection() {
        return 4;
    }

    @Override
    protected int getCaptionYAdjustment() {
        return 0;
    }

    @Override
    public Dimension getPadding() {
        Dimension d = super.getPadding();
        d.width = isShowCloseButton() && !Boolean.getBoolean("nb.tabs.suppressCloseButton") ? 28 : 14;
        return d;
    }

    private static final Insets INSETS = new Insets(0, 2, 0, 10);

    private static class WinClassicPainter implements TabPainter {

        @Override
        public Insets getBorderInsets(Component c) {
            return INSETS;
        }

        @Override
        public Polygon getInteriorPolygon(Component c) {
            BlueEditorTabCellRenderer ren = (BlueEditorTabCellRenderer) c;

            Insets ins = getBorderInsets(c);
            Polygon p = new Polygon();
            int x = ren.isLeftmost() ? 1 : 0;
//            int y = isGenericUI ? 0 : 1;
            int y = 1;

            int width = ren.isLeftmost() ? c.getWidth() - 1 : c.getWidth();
            int height = ren.isSelected() ?
                    c.getHeight() + 2 : c.getHeight() - 1;

            p.addPoint(x, y + ins.top + 2);
            p.addPoint(x + 2, y + ins.top);
            p.addPoint(x + width - 3, y + ins.top);
            p.addPoint(x + width - 1, y + ins.top + 2);
            p.addPoint(x + width - 1, y + height - 2);
            p.addPoint(x, y + height - 2);
            return p;
        }

        @Override
        public boolean isBorderOpaque() {
            return true;
        }

        @Override
        public void paintBorder(Component c, Graphics g, int x, int y,
                                int width, int height) {
            BlueEditorTabCellRenderer ren = (BlueEditorTabCellRenderer) c;
            Polygon p = getInteriorPolygon(c);
            g.setColor(ren.isSelected() ?
                       UIManager.getColor("controlLtHighlight") :
                       UIManager.getColor("controlHighlight")); //NOI18N

            int[] xpoints = p.xpoints;
            int[] ypoints = p.ypoints;

            g.drawLine(xpoints[0], ypoints[0], xpoints[p.npoints - 1],
                       ypoints[p.npoints - 1]);

            for (int i = 0; i < p.npoints - 1; i++) {
                g.drawLine(xpoints[i], ypoints[i], xpoints[i + 1],
                           ypoints[i + 1]);
                if (i == p.npoints - 4) {
                    g.setColor(ren.isSelected() ?
                               UIManager.getColor("controlDkShadow") :
                               UIManager.getColor("controlShadow")); //NOI18N
                    g.drawLine(xpoints[i] + 1, ypoints[i] + 1,
                               xpoints[i] + 2, ypoints[i] + 2);
                }
            }
        }

        @Override
        public void paintInterior(Graphics g, Component c) {

            BlueEditorTabCellRenderer ren = (BlueEditorTabCellRenderer) c;
//            boolean wantGradient = ren.isSelected() && ren.isActive() || ((ren.isClipLeft()
//                    || ren.isClipRight())
//                    && ren.isPressed());
//
//            if (wantGradient) {
//                ((Graphics2D) g).setPaint(ColorUtil.getGradientPaint(0, 0, getSelGradientColor(), ren.getWidth(), 0, getSelGradientColor2()));
//            } else {
                if (!ren.isAttention()) {
//                    g.setColor(ren.isSelected() ?
//                               UIManager.getColor("TabbedPane.background") :
//                               UIManager.getColor("tab_unsel_fill")); //NOI18N
                    g.setColor(BlueLookAndFeel.getControl());
                } else {
                    g.setColor(ATTENTION_COLOR);
                }
//            }
            Polygon p = getInteriorPolygon(c);
            g.fillPolygon(p);

            if (!supportsCloseButton((JComponent)c)) {
                return;
            }

            paintCloseButton( g, (JComponent)c );
        }

        @Override
        public void getCloseButtonRectangle(JComponent jc, Rectangle rect, Rectangle bounds) {
            boolean rightClip = ((BlueEditorTabCellRenderer) jc).isClipRight();
            boolean leftClip = ((BlueEditorTabCellRenderer) jc).isClipLeft();
            boolean notSupported = !((BlueEditorTabCellRenderer) jc).isShowCloseButton();
            if (leftClip || rightClip || notSupported) {
                rect.x = -100;
                rect.y = -100;
                rect.width = 0;
                rect.height = 0;
            } else {
                String iconPath = findIconPath((BlueEditorTabCellRenderer) jc);
                Icon icon = BlueTabControlButtonFactory.getIcon(iconPath);
                int iconWidth = icon.getIconWidth();
                int iconHeight = icon.getIconHeight();
                rect.x = bounds.x + bounds.width - iconWidth - 2;
                rect.y = bounds.y + (Math.max(0, bounds.height / 2 - iconHeight / 2));
                rect.width = iconWidth;
                rect.height = iconHeight;
            }
        }

        private void paintCloseButton(Graphics g, JComponent c) {
            if (((AbstractTabCellRenderer) c).isShowCloseButton()) {

                Rectangle r = new Rectangle(0, 0, c.getWidth(), c.getHeight());
                Rectangle cbRect = new Rectangle();
                getCloseButtonRectangle(c, cbRect, r);

                //paint close button
                String iconPath = findIconPath( (BlueEditorTabCellRenderer)c );
                Icon icon = BlueTabControlButtonFactory.getIcon( iconPath );
                icon.paintIcon(c, g, cbRect.x, cbRect.y);
            }
        }

        /**
         * Returns path of icon which is correct for currect state of tab at given
         * index
         */
        private String findIconPath( BlueEditorTabCellRenderer renderer ) {
            if( renderer.inCloseButton() && renderer.isPressed() ) {
                return "blue/plaf/resources/metal_close_pressed.png"; // NOI18N
            }
            if( renderer.inCloseButton() ) {
                return "blue/plaf/resources/metal_close_rollover.png"; // NOI18N
            }
            return "blue/plaf/resources/metal_close_enabled.png"; // NOI18N
        }

        @Override
        public boolean supportsCloseButton(JComponent renderer) {
            return
                ((AbstractTabCellRenderer) renderer).isShowCloseButton();
        }

    }


    private static class WinClassicLeftClipPainter implements TabPainter {

        @Override
        public Insets getBorderInsets(Component c) {
            return INSETS;
        }

        @Override
        public Polygon getInteriorPolygon(Component c) {
            BlueEditorTabCellRenderer ren = (BlueEditorTabCellRenderer) c;

            Insets ins = getBorderInsets(c);
            Polygon p = new Polygon();
            int x = -3;
//            int y = isGenericUI ? 0 : 1;
            int y = 1;

            int width = c.getWidth() + 3;
            int height = ren.isSelected() ?
                    c.getHeight() + 2 : c.getHeight() - 1;

            p.addPoint(x, y + ins.top + 2);
            p.addPoint(x + 2, y + ins.top);
            p.addPoint(x + width - 3, y + ins.top);
            p.addPoint(x + width - 1, y + ins.top + 2);
            p.addPoint(x + width - 1, y + height - 1);
            p.addPoint(x, y + height - 1);
            return p;
        }

        @Override
        public void paintBorder(Component c, Graphics g, int x, int y,
                                int width, int height) {
            BlueEditorTabCellRenderer ren = (BlueEditorTabCellRenderer) c;
            Polygon p = getInteriorPolygon(c);
            g.setColor(ren.isSelected() ?
                       UIManager.getColor("controlLtHighlight") :
                       UIManager.getColor("controlHighlight")); //NOI18N

            int[] xpoints = p.xpoints;
            int[] ypoints = p.ypoints;

            g.drawLine(xpoints[0], ypoints[0], xpoints[p.npoints - 1],
                       ypoints[p.npoints - 1]);

            for (int i = 0; i < p.npoints - 1; i++) {
                g.drawLine(xpoints[i], ypoints[i], xpoints[i + 1],
                           ypoints[i + 1]);
                if (i == p.npoints - 4) {
                    g.setColor(ren.isSelected() ?
                               UIManager.getColor("controlDkShadow") :
                               UIManager.getColor("controlShadow")); //NOI18N
                    g.drawLine(xpoints[i] + 1, ypoints[i] + 1,
                               xpoints[i] + 2, ypoints[i] + 2);
                }
            }
        }

        @Override
        public void paintInterior(Graphics g, Component c) {
            BlueEditorTabCellRenderer ren = (BlueEditorTabCellRenderer) c;
//            boolean wantGradient = ren.isSelected() && ren.isActive() || ((ren.isClipLeft()
//                    || ren.isClipRight())
//                    && ren.isPressed());
//
//            if (wantGradient) {
//                ((Graphics2D) g).setPaint(ColorUtil.getGradientPaint(0, 0, getSelGradientColor(), ren.getWidth(), 0, getSelGradientColor2()));
//            } else {
                if (!ren.isAttention()) {
//                    g.setColor(ren.isSelected() ?
//                           UIManager.getColor("TabbedPane.background") :
//                           UIManager.getColor("tab_unsel_fill")); //NOI18N
                    g.setColor(BlueLookAndFeel.getControl());
                } else {
                    g.setColor(ATTENTION_COLOR);
                }
//            }
            Polygon p = getInteriorPolygon(c);
            g.fillPolygon(p);
        }

        @Override
        public boolean isBorderOpaque() {
            return true;
        }

        @Override
        public void getCloseButtonRectangle(JComponent jc,
                                            final Rectangle rect,
                                            Rectangle bounds) {
            rect.setBounds(-20, -20, 0, 0);
        }

        @Override
        public boolean supportsCloseButton(JComponent renderer) {
            return false;
        }
    }

    private static class WinClassicRightClipPainter implements TabPainter {

        @Override
        public Insets getBorderInsets(Component c) {
            return INSETS;
        }

        @Override
        public boolean isBorderOpaque() {
            return true;
        }

        @Override
        public Polygon getInteriorPolygon(Component c) {
            BlueEditorTabCellRenderer ren = (BlueEditorTabCellRenderer) c;

            Insets ins = getBorderInsets(c);
            Polygon p = new Polygon();
            int x = 0;
//            int y = isGenericUI ? 0 : 1;
            int y = 1;

            int width = c.getWidth();
            int height = ren.isSelected() ?
                    c.getHeight() + 2 : c.getHeight() - 1;

            p.addPoint(x, y + ins.top + 2);
            p.addPoint(x + 2, y + ins.top);
            p.addPoint(x + width - 1, y + ins.top);
            p.addPoint(x + width - 1, y + height - 1);
            p.addPoint(x, y + height - 1);
            return p;
        }

        @Override
        public void paintBorder(Component c, Graphics g, int x, int y,
                                int width, int height) {
            BlueEditorTabCellRenderer ren = (BlueEditorTabCellRenderer) c;
            Polygon p = getInteriorPolygon(c);
            g.setColor(ren.isSelected() ?
                       UIManager.getColor("controlLtHighlight") :
                       UIManager.getColor("controlHighlight")); //NOI18N

            int[] xpoints = p.xpoints;
            int[] ypoints = p.ypoints;

            g.drawLine(xpoints[0], ypoints[0], xpoints[p.npoints - 1],
                       ypoints[p.npoints - 1]);

            for (int i = 0; i < p.npoints - 1; i++) {
                g.drawLine(xpoints[i], ypoints[i], xpoints[i + 1],
                           ypoints[i + 1]);
                if (ren.isSelected() && i == p.npoints - 4) {
//                    g.setColor(ren.isActive() ?
//                               UIManager.getColor("Table.selectionBackground") :
//                               UIManager.getColor("control")); //NOI18n
                    g.setColor(BlueLookAndFeel.getControl());
                } else if (i == p.npoints - 4) {
                    break;
                }
                if (i == p.npoints - 3) {
                    break;
                }
            }
        }

        @Override
        public void paintInterior(Graphics g, Component c) {
            BlueEditorTabCellRenderer ren = (BlueEditorTabCellRenderer) c;
            boolean wantGradient = ren.isSelected() && ren.isActive() || ((ren.isClipLeft()
                    || ren.isClipRight())
                    && ren.isPressed());

//            if (wantGradient) {
//                ((Graphics2D) g).setPaint(ColorUtil.getGradientPaint(0, 0, getSelGradientColor(), ren.getWidth(), 0, getSelGradientColor2()));
//            } else {
                if (!ren.isAttention()) {
                    g.setColor(ren.isSelected() ?
                           UIManager.getColor("TabbedPane.background") : //NOI18N
                           UIManager.getColor("tab_unsel_fill")); //NOI18N
                } else {
                    g.setColor(ATTENTION_COLOR);
                }
//            }

            Polygon p = getInteriorPolygon(c);
            g.fillPolygon(p);
        }

        @Override
        public boolean supportsCloseButton(JComponent renderer) {
            return false;
        }

        @Override
        public void getCloseButtonRectangle(JComponent jc,
                                            final Rectangle rect,
                                            Rectangle bounds) {
            rect.setBounds(-20, -20, 0, 0);
        }
    }
}
