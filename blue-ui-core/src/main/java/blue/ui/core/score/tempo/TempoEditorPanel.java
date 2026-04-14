/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2025 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307 USA
 */
package blue.ui.core.score.tempo;

import blue.BlueData;
import blue.score.TimeState;
import blue.time.TempoMap;

import javax.swing.*;
import java.awt.*;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

/**
 * Composite panel containing the tempo region bar (always visible) and
 * the collapsible tempo line graph editor.
 * 
 * Layout:
 * - Top: TempoRegionBar (always visible, 20px height)
 * - Bottom: TempoEditor line graph (visible when expanded, 80px height)
 */
public class TempoEditorPanel extends JPanel implements PropertyChangeListener {

    private static final int REGION_BAR_HEIGHT = 20;
    private static final int LINE_GRAPH_HEIGHT = 80;

    private final TempoRegionBar regionBar;
    private final TempoEditor lineGraph;
    private TempoMap tempoMap;
    private boolean expanded = false;

    public TempoEditorPanel() {
        setLayout(new BorderLayout());
        setBackground(Color.BLACK);
        
        regionBar = new TempoRegionBar();
        lineGraph = new TempoEditor();
        
        add(regionBar, BorderLayout.NORTH);
        add(lineGraph, BorderLayout.CENTER);
        
        // Initially collapsed - only show region bar
        lineGraph.setVisible(false);
        updatePreferredSize();
    }

    public void setData(BlueData data) {
        if (this.tempoMap != null) {
            this.tempoMap.removePropertyChangeListener(this);
        }
        
        this.tempoMap = data.getScore().getTempoMap();
        this.tempoMap.addPropertyChangeListener(this);
        
        regionBar.setData(data);
        lineGraph.setData(data);
        
        // Sync expanded state with tempoMap.isVisible()
        setExpanded(tempoMap.isVisible());
    }

    public void setTimeState(TimeState timeState) {
        regionBar.setTimeState(timeState);
        lineGraph.setTimeState(timeState);
    }

    public boolean isExpanded() {
        return expanded;
    }

    public void setExpanded(boolean expanded) {
        if (this.expanded != expanded) {
            boolean oldExpanded = this.expanded;
            this.expanded = expanded;
            lineGraph.setVisible(expanded);
            updatePreferredSize();
            revalidate();
            repaint();
            
            // Fire property change so parent containers can react
            firePropertyChange("expanded", oldExpanded, expanded);
            
            // Sync with tempoMap visibility
            if (tempoMap != null && tempoMap.isVisible() != expanded) {
                tempoMap.setVisible(expanded);
            }
        }
    }

    public void toggleExpanded() {
        setExpanded(!expanded);
    }

    private void updatePreferredSize() {
        int height = REGION_BAR_HEIGHT;
        if (expanded) {
            height += LINE_GRAPH_HEIGHT;
        }
        setPreferredSize(new Dimension(1, height));
        setMinimumSize(new Dimension(1, height));
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == tempoMap) {
            String prop = evt.getPropertyName();
            if ("visible".equals(prop)) {
                setExpanded(tempoMap.isVisible());
            }
        }
    }

    /**
     * Gets the region bar component for direct access if needed.
     */
    public TempoRegionBar getRegionBar() {
        return regionBar;
    }

    /**
     * Gets the line graph editor component for direct access if needed.
     */
    public TempoEditor getLineGraph() {
        return lineGraph;
    }
}
