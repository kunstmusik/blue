/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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
 */
package blue.components;

import java.awt.Color;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.AdjustmentEvent;
import java.awt.event.AdjustmentListener;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.ComponentListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.awt.event.WindowEvent;
import java.awt.event.WindowFocusListener;

import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JEditorPane;
import javax.swing.JLayeredPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JViewport;
import javax.swing.SwingUtilities;
import javax.swing.border.LineBorder;

import blue.WindowSettingManager;
import blue.WindowSettingsSavable;
import blue.gui.DialogUtil;
import blue.ui.core.score.layers.LayerGroupPanel;
import blue.utility.GUI;
import electric.xml.Element;

public class JScrollNavigator extends JDialog implements ComponentListener,
        AdjustmentListener, WindowSettingsSavable {

    private JScrollPane jScrollPane;

    private NavBox overBox = new NavBox();

    boolean isAdjusting = false;
    private JPanel layerPanel;

    public JScrollNavigator() {
        this(null);
    }

    public JScrollNavigator(Frame owner) {
        super(owner);

        this.setTitle("Navigation");
        this.setSize(new Dimension(80, 100));

        final JLayeredPane layeredPane = new JLayeredPane();
        layeredPane.setDoubleBuffered(true);

        setContentPane(layeredPane);

        final PreviewPanel drawPanel = new PreviewPanel();

        layeredPane.add(drawPanel, JLayeredPane.DEFAULT_LAYER);

        layeredPane.setBackground(Color.BLACK);

        layeredPane.add(overBox, JLayeredPane.DRAG_LAYER);

        layeredPane.addComponentListener(new ComponentAdapter() {

            public void componentResized(ComponentEvent e) {
                updateOverBox();
                drawPanel.setSize(layeredPane.getWidth(), layeredPane
                        .getHeight());
                drawPanel.repaint();
            }

        });

        overBox.addComponentListener(this);

        WindowSettingManager.getInstance().registerWindow("JScrollNavigator",
                this);

        this.addWindowFocusListener(new WindowFocusListener() {

            public void windowGainedFocus(WindowEvent e) {
                drawPanel.repaint();
            }

            public void windowLostFocus(WindowEvent e) {
            }

        });

        DialogUtil.registerJDialog(this);
    }

    public void setJScrollPane(JScrollPane jScrollPane) {
        this.jScrollPane = jScrollPane;

        Component view = jScrollPane.getViewport().getView();

        if (view != null) {
            view.addComponentListener(this);
            jScrollPane.getViewport().addComponentListener(this);
            jScrollPane.getHorizontalScrollBar().addAdjustmentListener(this);
            jScrollPane.getVerticalScrollBar().addAdjustmentListener(this);
            updateOverBox();
        }

    }

    private void updateOverBox() {
        isAdjusting = true;

        JViewport viewport = this.jScrollPane.getViewport();

        Dimension d = viewport.getViewSize();
        Rectangle vRect = viewport.getViewRect();

        int vWidth = d.width;
        int vHeight = d.height;

        int w = this.getContentPane().getWidth();
        int h = this.getContentPane().getHeight();

        float xMult = (float) w / vWidth;
        float yMult = (float) h / vHeight;

        int newX = (int) (vRect.x * xMult);
        int newY = (int) (vRect.y * yMult);
        int newW = (int) (vRect.width * xMult);
        int newH = (int) (vRect.height * yMult);

        overBox.setLocation(newX, newY);
        overBox.setSize(newW, newH);

        // repaint();

        isAdjusting = false;

    }

    /**
     * @param args
     */
    public static void main(String[] args) {
        GUI.setBlueLookAndFeel();

        JScrollPane jsp = new JScrollPane();
        JEditorPane blueEditorPane = new JEditorPane();

        StringBuffer buffer = new StringBuffer();
        for (int i = 0; i < 100; i++) {
            buffer.append("test" + i + "\n");
        }
        blueEditorPane.setText(buffer.toString());

        jsp.setViewportView(blueEditorPane);

        JScrollNavigator nav = new JScrollNavigator();
        nav.setJScrollPane(jsp);

        GUI.showComponentAsStandalone(jsp, "JScrollNavigator Test", true);
        nav.setModal(false);
        nav.setVisible(true);
    }

    public void componentResized(ComponentEvent e) {
        if (e.getSource() == jScrollPane.getViewport()
                || e.getSource() == jScrollPane.getViewport().getView()) {
            updateOverBox();
        }
    }

    public void componentMoved(ComponentEvent e) {
        if (e.getSource() == overBox && overBox.origin != null) {
            isAdjusting = true;

            Rectangle r = overBox.getBounds();

            JViewport viewport = this.jScrollPane.getViewport();
            Dimension d = viewport.getViewSize();

            int vWidth = d.width;
            int vHeight = d.height;

            int w = this.getContentPane().getWidth();
            int h = this.getContentPane().getHeight();

            float xMult = (float) vWidth / w;
            float yMult = (float) vHeight / h;

            int newX = (int) (r.x * xMult);
            int newY = (int) (r.y * yMult);
            int newW = (int) (r.width * xMult);
            int newH = (int) (r.height * yMult);

            Rectangle newRect = new Rectangle(newX, newY, newW, newH);

            ((JComponent) viewport.getView()).scrollRectToVisible(newRect);

            // repaint();

            isAdjusting = false;
        }
    }

    public void componentShown(ComponentEvent e) {
    }

    public void componentHidden(ComponentEvent e) {
    }

    public void adjustmentValueChanged(AdjustmentEvent e) {
        if (!isAdjusting) {
            updateOverBox();
        }
    }

    public void setLayerPanel(JPanel layerPanel) {
        this.layerPanel = layerPanel;
    }

    static class NavBox extends JPanel {
        boolean dragging = false;

        public Point origin = null;

        int originX = -1;

        int originY = -1;

        public NavBox() {
            // this.setBorder(new LineBorder(Color.GREEN, 1));
            this.setBorder(new LineBorder(Color.WHITE, 1));

            this.setBackground(new Color(255, 255, 255, 32));
            this.setOpaque(true);

            this.addMouseListener(new MouseAdapter() {

                public void mousePressed(MouseEvent e) {
                    origin = SwingUtilities.convertPoint(NavBox.this, e
                            .getPoint(), NavBox.this.getParent());
                    originX = NavBox.this.getX();
                    originY = NavBox.this.getY();
                }

                public void mouseReleased(MouseEvent e) {
                    origin = null;
                    originX = -1;
                    originY = -1;
                }

            });

            this.addMouseMotionListener(new MouseMotionAdapter() {

                public void mouseDragged(MouseEvent e) {
                    NavBox box = NavBox.this;
                    Container c = box.getParent();

                    int leftBound = -originX;
                    int rightBound = c.getWidth() - box.getWidth() - originX;
                    int topBound = -originY;
                    int bottomBound = c.getHeight() - box.getHeight() - originY;

                    Point p = SwingUtilities.convertPoint(box, e.getPoint(), c);

                    int xDiff = p.x - origin.x;
                    int yDiff = p.y - origin.y;

                    if (xDiff < leftBound) {
                        xDiff = leftBound;
                    }

                    if (xDiff > rightBound) {
                        xDiff = rightBound;
                    }

                    if (yDiff < topBound) {
                        yDiff = topBound;
                    }

                    if (yDiff > bottomBound) {
                        yDiff = bottomBound;
                    }

                    box.setLocation(originX + xDiff, originY + yDiff);
                }

            });
        }
    }

    public void loadWindowSettings(Element settings) {
        WindowSettingManager.setBasicSettings(settings, this);
    }

    public Element saveWindowSettings() {
        return WindowSettingManager.getBasicSettings(this);
    }

    private class PreviewPanel extends JComponent {
        
        public PreviewPanel() {
            super();
            setDoubleBuffered(true);
        }

        public void paintComponent(Graphics g) {
            if (jScrollPane == null) {
                return;
            }

            super.paintComponent(g);

            JComponent view = (JComponent) jScrollPane.getViewport()
                    .getView();

            Graphics2D g2d = (Graphics2D) g.create();

            int w = this.getWidth();
            int h = this.getHeight();

            

            g2d.setColor(Color.BLACK);
            g2d.fillRect(0, 0, w, h);

            if(layerPanel != null) {
                
                double xscale = ((double) w) / view.getWidth();
                double yscale = ((double) h) / view.getHeight();
                g2d.scale(xscale, yscale);

                Component[] comps = layerPanel.getComponents();
                
                for(Component c : comps) {
                    if(c instanceof LayerGroupPanel) {
                        g2d.translate(c.getX(), c.getY());
                        ((LayerGroupPanel)c).paintNavigatorView(g2d);
                        g2d.translate(-c.getX(), -c.getY());
                    }
                }
                
            }

            g2d.dispose();

        }
    }
}
