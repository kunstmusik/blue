/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.score.layers.soundObject;

import blue.automation.ParameterLinePanel;
import blue.score.TimeState;
import blue.score.layers.AutomatableLayer;
import blue.score.layers.LayerGroup;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.ui.core.score.MultiLineScoreSelection;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScorePath;
import blue.ui.core.score.soundLayer.SoundLayerLayout;
import java.awt.Component;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.JComponent;

public class AutomationLayerPanel extends JComponent implements
        PropertyChangeListener, LayerGroupListener {

    SoundLayerLayout layout = new SoundLayerLayout();

    private LayerGroup layerGroup = null;

    private TimeState timeState = null;

    MultiLineScoreSelection selection = MultiLineScoreSelection.getInstance();

    final ScorePath path;

    public AutomationLayerPanel() {
        this.setLayout(layout);
        path = ScoreController.getInstance().getScorePath();
    }

    public void setLayerGroup(LayerGroup layerGroup, TimeState timeState) {
        if (this.layerGroup != null && path.getLastLayerGroup() == null) {
            this.timeState.removePropertyChangeListener(this);
            this.layerGroup.removeLayerGroupListener(this);
        }

        Component[] components = this.getComponents();
        this.removeAll();

        layout.setPolyObject(layerGroup);

        this.layerGroup = layerGroup;
        this.timeState = timeState;

        if (layerGroup != null && path.getLastLayerGroup() == null) {
            this.timeState.addPropertyChangeListener(this);
            this.layerGroup.addLayerGroupListener(this);
        }

        this.populate();
    }

    private void populate() {
        if (layerGroup == null || path.getLastLayerGroup() != null) {
            return;
        }

        for (int i = 0; i < layerGroup.size(); i++) {
            AutomatableLayer sLayer = (AutomatableLayer) layerGroup.get(i);

            ParameterLinePanel paramPanel = new ParameterLinePanel(
                    timeState, sLayer.getAutomationParameters());

            this.add(paramPanel);

        }
        revalidate();
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.layerGroup) {
            if (evt.getPropertyName().equals("heightIndex")) {
                revalidate();
            }
        } else if (evt.getPropertyName().equals("pixelSecond")) {

            // FIXME: Need to adjust marquee for pixelSecond changes, maybe should do it once in ScoreTopComponent...
//            int pixelSecond = timeState.getPixelSecond();
//
//            if (marquee.isVisible()) {
//                int newX = (int) (marquee.startTime * pixelSecond);
//                marquee.setLocation(newX, marquee.getY());
//                int newW = (int) (marquee.endTime * pixelSecond) - newX;
//                marquee.setSize(newW, marquee.getHeight());
//            }
        }
    }

    @Override
    public void layerGroupChanged(LayerGroupDataEvent event) {
        switch (event.getType()) {
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

    public void contentsChanged(LayerGroupDataEvent e) {
        int start = e.getStartIndex();
        int end = e.getEndIndex();

        // This is a hack to determine what direction the layers were
        // pushed
        boolean isUp = ((start >= 0) && (end >= 0));

        if (isUp) {
            Component c = getComponent(start);
            remove(start);
            add(c, end);

        } else {
            // have to flip because listDataEvent stores as min and max
            Component c = getComponent(-start);
            remove(-start);
            add(c, -end);
        }

        revalidate();
    }

    public void layersAdded(LayerGroupDataEvent e) {
        int index = e.getStartIndex();
        AutomatableLayer sLayer = (AutomatableLayer) layerGroup.get(index);

        ParameterLinePanel paramPanel = new ParameterLinePanel(
                timeState, sLayer.getAutomationParameters());

        // this.add(paramPanel);
        this.add(paramPanel, index);

        revalidate(); // is this necessary?
    }

    public void layersRemoved(LayerGroupDataEvent e) {
        int start = e.getStartIndex();
        int end = e.getEndIndex();

        for (int i = end; i >= start; i--) {
            remove(i);
        }

        revalidate(); // is this necessary?
    }

}
