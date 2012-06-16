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
import blue.score.layers.patterns.core.PatternData;
import blue.score.layers.patterns.core.PatternLayer;
import blue.score.layers.patterns.core.PatternsLayerGroup;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;

/**
 *
 * @author stevenyi
 */
public class PatternsLayerPanelMouseListener extends MouseAdapter {

    private final PatternsLayerPanel panel;

    private final PatternsLayerGroup layerGroup;
    private PatternData selectedData = null;
    private boolean setSquareOn = false;
    private final TimeState timeState;

    public PatternsLayerPanelMouseListener(PatternsLayerPanel panel, 
            PatternsLayerGroup layerGroup, 
            TimeState timeState) {
        this.panel = panel;
        this.layerGroup = layerGroup;
        this.timeState = timeState;
    }

    @Override
    public void mousePressed(MouseEvent e) {
        panel.requestFocus();
        int x = e.getX();
        int y = e.getY();

        if (y < 0 || y >= panel.getHeight()) {
            selectedData = null;
            return;
        }
        
        int layerIndex = y / Layer.LAYER_HEIGHT;
        PatternLayer layer = (PatternLayer) layerGroup.getLayerAt(layerIndex);
        
        int patternIndex = (int)(x / (float)(layerGroup.getPatternBeatsLength() * timeState.getPixelSecond()));
        
        selectedData = layer.getPatternData();
        setSquareOn = !(layer.getPatternData().isPatternSet(patternIndex));
        selectedData.setPattern(patternIndex, setSquareOn);
        panel.repaint();
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        selectedData = null;
    }

    @Override
    public void mouseDragged(MouseEvent e) {
        if(selectedData == null) {
            return;
        }
        
        int x = e.getX();
        
        if (x < 0) {
            x = 0; 
        } else if (x > panel.getWidth()) {
            x = panel.getWidth();
        }
        
        int patternIndex = (int)(x / (float)(layerGroup.getPatternBeatsLength() * timeState.getPixelSecond()));
        if(selectedData.isPatternSet(patternIndex) != setSquareOn) {
            selectedData.setPattern(patternIndex, setSquareOn);
            panel.repaint();
        }
    }
}
