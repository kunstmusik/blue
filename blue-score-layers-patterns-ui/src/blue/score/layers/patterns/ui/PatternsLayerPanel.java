/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
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
package blue.score.layers.patterns.ui;

import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.score.layers.patterns.core.PatternsLayerGroup;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Rectangle;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JPanel;

/**
 *
 * @author stevenyi
 */
public class PatternsLayerPanel extends JPanel implements LayerGroupListener,
        PropertyChangeListener {

    private PatternsLayerGroup layerGroup;
    private final TimeState timeState;

    public PatternsLayerPanel(PatternsLayerGroup layerGroup, TimeState timeState) {
        this.layerGroup = layerGroup;
        this.timeState = timeState;

        layerGroup.addLayerGroupListener(this);
        timeState.addPropertyChangeListener(this);

        final Dimension d = checkSize();
        this.setSize(d);
        this.setBackground(Color.BLACK);
    }

    @Override
    public void removeNotify() {
        layerGroup.removeLayerGroupListener(this);
        timeState.removePropertyChangeListener(this);
    }

    @Override
    public void layerGroupChanged(LayerGroupDataEvent event) {
        checkSize();
    }

    private Dimension checkSize() {
        final Dimension d = new Dimension(30,
                layerGroup.getSize() * Layer.LAYER_HEIGHT);
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
        Rectangle bounds = g.getClipBounds();
        
        if(bounds == null) {
            bounds = getBounds();
        }
        
        g.setColor(Color.BLACK);
        g.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        
        g.setColor(Color.DARK_GRAY);

        int width = getWidth();
        int height = getHeight();
        int bottom = (height - 1);
        int maxX = (int)bounds.getMaxX();
        int maxY = (int)bounds.getMaxY();
        int x = 0;
        int pixelSecond = timeState.getPixelSecond();
        
        int patternBeatsLength = layerGroup.getPatternBeatsLength();

        //Draw lines
        for (int i = 0; i < layerGroup.getSize(); i++) {
            int y = i * Layer.LAYER_HEIGHT;
            if (y < bounds.y) {
                continue;
            } else if (y > maxY) {
                break;
            }
            g.drawLine(bounds.x, y, maxX, y);

        }
        if (bottom < maxY) {
            g.drawLine(bounds.x, bottom, maxX, bottom);
        }
        

        for (int i = 0; x < width; i++) {
            x = (i * patternBeatsLength) * pixelSecond;

            if (x < bounds.x) {
                continue;
            } else if (x > maxX) {
                break;
            }

            g.drawLine(x, bounds.y, x, maxY);
        }


    }
}
