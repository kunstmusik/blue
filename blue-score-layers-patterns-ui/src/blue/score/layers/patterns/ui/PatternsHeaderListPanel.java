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

import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.score.layers.patterns.core.PatternLayer;
import blue.score.layers.patterns.core.PatternsLayerGroup;
import blue.ui.utilities.LinearLayout;
import java.awt.Component;
import java.awt.Dimension;
import javax.swing.JPanel;

/**
 *
 * @author stevenyi
 */
public class PatternsHeaderListPanel extends JPanel implements LayerGroupListener {

    private final PatternsLayerGroup layerGroup;

    public PatternsHeaderListPanel(PatternsLayerGroup patternsLayerGroup) {
        this.layerGroup = patternsLayerGroup;
        this.layerGroup.addLayerGroupListener(this);
        this.setLayout(new LinearLayout());
        this.setPreferredSize(new Dimension(30,
                22 * patternsLayerGroup.getSize()));

        for (int i = 0; i < patternsLayerGroup.getSize(); i++) {
            this.add(new PatternLayerPanel(
                        (PatternLayer) patternsLayerGroup.getLayerAt(i)));
        }

    }
    
    public void checkSize() {
        if (layerGroup == null || getParent() == null) {
            setSize(0, 0);
            return;
        }

        int w = getParent().getWidth();

        int h = layerGroup.getSize() * Layer.LAYER_HEIGHT;

        this.setSize(w, h);
    }

     /* LAYER GROUP LISTENER */

    @Override
    public void layerGroupChanged(LayerGroupDataEvent event) {
      switch(event.getType()) {
            case LayerGroupDataEvent.DATA_ADDED:
                layersAdded(event);
                break;
            case LayerGroupDataEvent.DATA_REMOVED:
                layersRemoved(event);
                break;
            case LayerGroupDataEvent.DATA_CHANGED:
                contentsChanged(event);
                break;
        }
    }
    
     public void layersAdded(LayerGroupDataEvent e) {
        int index = e.getStartIndex();
        PatternLayer sLayer = (PatternLayer)layerGroup.getLayerAt(index);

        PatternLayerPanel panel = new PatternLayerPanel(sLayer);
        
        this.add(panel, index);
        checkSize();
    }

    public void layersRemoved(LayerGroupDataEvent e) {
        int start = e.getStartIndex();
        int end = e.getEndIndex();

        for (int i = end; i >= start; i--) {
            remove(i);
        }

        checkSize();

        //selection.setAnchor(-1);
    }

    public void contentsChanged(LayerGroupDataEvent e) {
        int start = e.getStartIndex();
        int end = e.getEndIndex();

        // This is a hack to determine what direction the layers were
        // pushed
        boolean isUp = ((start >= 0) && (end >= 0));

        if (isUp) {
            Component c = getComponent(start);

            PatternLayerPanel panel = (PatternLayerPanel) c;

            remove(start);
            add(c, end);

//            int i1 = selection.getStartIndex() - 1;
//            int i2 = selection.getEndIndex() - 1;
//
//            selection.setAnchor(i1);
//            selection.setEnd(i2);

        } else {
            // have to flip because listDataEvent stores as min and max
            Component c = getComponent(-start);

            PatternLayerPanel panel = (PatternLayerPanel) c;

            remove(-start);
            add(c, -end);

//            int i1 = selection.getStartIndex() + 1;
//            int i2 = selection.getEndIndex() + 1;
//
//            selection.setAnchor(i1);
//            selection.setEnd(i2);
        }

        revalidate();
    }
}
