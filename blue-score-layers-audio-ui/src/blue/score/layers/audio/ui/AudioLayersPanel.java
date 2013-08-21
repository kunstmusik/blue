/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
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
package blue.score.layers.audio.ui;

import blue.score.TimeState;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.score.layers.audio.core.AudioLayer;
import blue.score.layers.audio.core.AudioLayerGroup;
import blue.ui.core.score.layers.LayerGroupPanel;
import blue.ui.core.score.layers.SelectionMarquee;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.event.MouseWheelEvent;
import java.awt.event.MouseWheelListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JPanel;

/**
 *
 * @author stevenyi
 */
public class AudioLayersPanel extends JPanel implements LayerGroupListener,
        PropertyChangeListener, LayerGroupPanel {

    private static final Color PATTERN_COLOR = new Color(198, 226, 255);
    private AudioLayerGroup layerGroup;
    private final TimeState timeState;

    public AudioLayersPanel(AudioLayerGroup layerGroup, TimeState timeState) {
        this.layerGroup = layerGroup;
        this.timeState = timeState;

        layerGroup.addLayerGroupListener(this);
        timeState.addPropertyChangeListener(this);

        final Dimension d = checkSize();
        this.setSize(d);
        this.setBackground(Color.BLACK);

        this.addMouseWheelListener(new MouseWheelListener() {

            @Override
            public void mouseWheelMoved(MouseWheelEvent mwe) {
                mwe.getComponent().getParent().dispatchEvent(mwe);
            }
        });

        AudioLayerPanelMouseListener listener =
                new AudioLayerPanelMouseListener(this, layerGroup, timeState);
        this.addMouseListener(listener);
        this.addMouseMotionListener(listener);

        new AudioLayersDropTargetListener(this);
    }

    @Override
    public void removeNotify() {
        super.removeNotify();
        layerGroup.removeLayerGroupListener(this);
        timeState.removePropertyChangeListener(this);
    }

    @Override
    public void layerGroupChanged(LayerGroupDataEvent event) {
        checkSize();
        repaint();
    }

    protected Dimension checkSize() {
        int h = layerGroup.getTotalHeight();
        int tempTime = (int) (layerGroup.getMaxTime() / 60) + 2;
        int width = tempTime * timeState.getPixelSecond() * 60;
        final Dimension d = new Dimension(width, h);
        this.setPreferredSize(d);
        return d;
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == timeState) {
            if (evt.getPropertyName().equals("pixelSecond")) {
                checkSize();
            }
        }
    }

    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);
        
        int width = this.getWidth();

        g.setColor(Color.BLACK);
        g.fillRect(0, 0, width, this.getHeight());

        int y = 0;
        g.setColor(Color.DARK_GRAY);
        g.drawLine(0, 0, width, 0);

        for (int i = 0; i < layerGroup.getSize(); i++) {
            AudioLayer layer = (AudioLayer) layerGroup.getLayerAt(i);
            y += layer.getSoundLayerHeight();
            
            g.drawLine(0, y, width, y);
        }
        
        g.drawLine(0, getHeight() - 1, width, getHeight() - 1);
    }

    @Override
    public void marqueeSelectionPerformed(SelectionMarquee marquee) {
        // ignore as this panel does not handle this event
    }

    @Override
    public void paintNavigatorView(Graphics2D g2d) {
//        int pixelSecond = timeState.getPixelSecond();
//
//        int patternBeatsLength = layerGroup.getAudioBeatsLength();
//        int patternWidth = patternBeatsLength * pixelSecond;
//        
//        for (int i = 0; i < layerGroup.getSize(); i++) {
//            int y = i * Layer.LAYER_HEIGHT;
//            int x = 0; 
//            AudioLayer layer = (AudioLayer) layerGroup.getLayerAt(i);
//            AudioData data = layer.getAudioData();
//
//            g2d.setColor(PATTERN_COLOR);
//
//            for (int j = 0; x < getBounds().getMaxX(); j++) {
//                x = (j * patternBeatsLength) * pixelSecond;
//                if (data.isAudioSet(j)) {
//                    //System.out.println("pattern set: " + j);
//                    g2d.fillRect(x, y, patternWidth, Layer.LAYER_HEIGHT);
//                }
//            }
//        }
    }
}
