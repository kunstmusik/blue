/*
 * blue - object composition environment for csound
 * Copyright (C) 2026
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.ui.core.score;

import blue.score.Score;
import blue.score.layers.LayerGroup;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import javax.swing.JMenuItem;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;

/**
 * Interactive spacer panel placed below each LayerGroup header in the Score
 * Timeline. Shows a "+" circle on rollover; double-click adds a layer to the
 * group above; right-click offers Add Layer, Move Group Up, Move Group Down.
 *
 * @author stevenyi
 */
public class LayerGroupSpacerPanel extends JPanel {

    private static final Color PLUS_COLOR = new Color(120, 120, 120);

    private final LayerGroup<?> layerGroup;
    private final Score score;
    private boolean rollover = false;

    public LayerGroupSpacerPanel(LayerGroup<?> layerGroup, Score score) {
        this.layerGroup = layerGroup;
        this.score = score;

        int h = Score.SPACER;
        setPreferredSize(new Dimension(0, h));
        setMinimumSize(new Dimension(0, h));
        setMaximumSize(new Dimension(Integer.MAX_VALUE, h));
        setSize(getWidth(), h);
        setOpaque(false);

        var mouseHandler = new MouseAdapter() {
            @Override
            public void mouseEntered(MouseEvent e) {
                rollover = true;
                repaint();
            }

            @Override
            public void mouseExited(MouseEvent e) {
                rollover = false;
                repaint();
            }

            @Override
            public void mouseClicked(MouseEvent e) {
                if (SwingUtilities.isLeftMouseButton(e)
                        && e.getClickCount() == 2) {
                    addLayer();
                }
            }

            @Override
            public void mousePressed(MouseEvent e) {
                maybeShowPopup(e);
            }

            @Override
            public void mouseReleased(MouseEvent e) {
                maybeShowPopup(e);
            }

            private void maybeShowPopup(MouseEvent e) {
                if (e.isPopupTrigger()) {
                    showPopupMenu(e.getX(), e.getY());
                }
            }
        };

        addMouseListener(mouseHandler);
    }

    public LayerGroup<?> getLayerGroup() {
        return layerGroup;
    }

    private void addLayer() {
        layerGroup.newLayerAt(layerGroup.size());
    }

    private void showPopupMenu(int x, int y) {
        JPopupMenu popup = new JPopupMenu();

        JMenuItem addLayerItem = new JMenuItem("Add Layer");
        addLayerItem.addActionListener(e -> addLayer());
        popup.add(addLayerItem);

        int groupIndex = score.indexOf(layerGroup);

        if (groupIndex > 0) {
            JMenuItem moveUpItem = new JMenuItem("Move Layer Group Up");
            moveUpItem.addActionListener(e -> {
                int idx = score.indexOf(layerGroup);
                if (idx > 0) {
                    score.pushUpItems(idx, idx);
                }
            });
            popup.add(moveUpItem);
        }

        if (groupIndex >= 0 && groupIndex < score.size() - 1) {
            JMenuItem moveDownItem = new JMenuItem("Move Layer Group Down");
            moveDownItem.addActionListener(e -> {
                int idx = score.indexOf(layerGroup);
                if (idx >= 0 && idx < score.size() - 1) {
                    score.pushDownItems(idx, idx);
                }
            });
            popup.add(moveDownItem);
        }

        popup.show(this, x, y);
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);

        if (!rollover) {
            return;
        }

        Graphics2D g2 = (Graphics2D) g.create();
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON);

        int cx = getWidth() / 2;
        int cy = getHeight() / 2;

        // Draw subtle "+" sign
        g2.setColor(PLUS_COLOR);
        g2.setStroke(new java.awt.BasicStroke(1.5f));
        int armLen = 4;
        g2.drawLine(cx - armLen, cy, cx + armLen, cy);
        g2.drawLine(cx, cy - armLen, cx, cy + armLen);

        g2.dispose();
    }
}
