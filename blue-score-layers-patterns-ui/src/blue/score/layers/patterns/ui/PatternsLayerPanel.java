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

import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.score.layers.patterns.core.PatternsLayerGroup;
import java.awt.Color;
import java.awt.Dimension;
import javax.swing.JPanel;

/**
 *
 * @author stevenyi
 */
public class PatternsLayerPanel extends JPanel implements LayerGroupListener 
{

    private PatternsLayerGroup layerGroup;

    public PatternsLayerPanel(PatternsLayerGroup layerGroup) {
        this.layerGroup = layerGroup;
        this.setPreferredSize(new Dimension(30, 22));
        this.setSize(new Dimension(30, 22));
        this.setBackground(Color.CYAN);
    }

    @Override
    public void layerGroupChanged(LayerGroupDataEvent event) {
        //throw new UnsupportedOperationException("Not supported yet.");
    }
}
