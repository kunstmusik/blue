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
import blue.score.layers.audio.core.AudioLayer;
import blue.score.layers.audio.core.AudioLayerGroup;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;

/**
 *
 * @author stevenyi
 */
public class AudioLayerPanelMouseListener extends MouseAdapter {

    private final AudioLayerPanel panel;

    private final AudioLayerGroup layerGroup;
    private final TimeState timeState;
    
    int startIndex = -1;
    int lastIndex = -1;
    AudioLayer currentAudioLayer = null;

    public AudioLayerPanelMouseListener(AudioLayerPanel panel, 
            AudioLayerGroup layerGroup, 
            TimeState timeState) {
        this.panel = panel;
        this.layerGroup = layerGroup;
        this.timeState = timeState;
    }

    @Override
    public void mousePressed(MouseEvent e) {
        e.consume();
        
        panel.requestFocus();
        int x = e.getX();
        int y = e.getY();

    }

    @Override
    public void mouseReleased(MouseEvent e) {
        e.consume();
    }

    @Override
    public void mouseDragged(MouseEvent e) {
        e.consume();
        
    }
}
