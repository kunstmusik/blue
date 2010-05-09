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

package blue.ui.core.score;

import java.awt.Component;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

import javax.swing.JComponent;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;

import blue.SoundLayer;
import blue.automation.ParameterLinePanel;
import blue.components.AlphaMarquee;
import blue.ui.core.score.soundLayer.SoundLayerLayout;
import blue.soundObject.PolyObject;

public class AutomationLayerPanel extends JComponent implements
        PropertyChangeListener, ListDataListener {
    SoundLayerLayout layout = new SoundLayerLayout();

    private PolyObject pObj = null;

    private AlphaMarquee marquee;
    
    private int scaleLayerNum = -1;

    public AutomationLayerPanel(AlphaMarquee marquee) {
        this.setLayout(layout);
        this.marquee = marquee;
    }

    public void setPolyObject(PolyObject pObj) {
        if (this.pObj != null && this.pObj.isRoot()) {
            this.pObj.removePropertyChangeListener(this);
            this.pObj.removeListDataListener(this);
        }

        Component[] components = this.getComponents();
        this.removeAll();

        for(int i = 0; i < components.length; i++) {
            ((ParameterLinePanel)components[i]).cleanup();
        }

        layout.setPolyObject(pObj);

        this.pObj = pObj;

        if (pObj != null && pObj.isRoot()) {
            this.pObj.addPropertyChangeListener(this);
            this.pObj.addListDataListener(this);
        }

        this.populate();
    }

    private void populate() {
        if (pObj == null || !pObj.isRoot()) {
            return;
        }

        for (int i = 0; i < pObj.getSize(); i++) {
            SoundLayer sLayer = (SoundLayer) pObj.getElementAt(i);

            ParameterLinePanel paramPanel = new ParameterLinePanel(this.marquee);
            paramPanel.setPolyObject(pObj);
            paramPanel.setParameterIdList(sLayer.getAutomationParameters());

            this.add(paramPanel);

        }
        revalidate();
    }

    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getSource() == this.pObj) {
            if (evt.getPropertyName().equals("heightIndex")) {
                revalidate();
            }
        }
    }

    public void contentsChanged(ListDataEvent e) {
        int start = e.getIndex0();
        int end = e.getIndex1();

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

    public void intervalAdded(ListDataEvent e) {
        int index = e.getIndex0();
        SoundLayer sLayer = (SoundLayer) pObj.getElementAt(index);

        ParameterLinePanel paramPanel = new ParameterLinePanel(this.marquee);
        paramPanel.setPolyObject(this.pObj);
        paramPanel.setParameterIdList(sLayer.getAutomationParameters());

        // this.add(paramPanel);

        this.add(paramPanel, index);

        revalidate(); // is this necessary?
    }

    public void intervalRemoved(ListDataEvent e) {
        int start = e.getIndex0();
        int end = e.getIndex1();

        for (int i = end; i >= start; i--) {
            Component c = getComponent(i);
            remove(i);
            ((ParameterLinePanel)c).cleanup();
        }

        revalidate(); // is this necessary?
    }
    
    public void addSelectionDragRegion(int startX, int endX, int layerNum) {
        if(layerNum >= getComponentCount()) {
            return;
        }
        
        ParameterLinePanel paramLinePanel = (ParameterLinePanel) getComponent(layerNum);
        paramLinePanel.addSelectionDragRegion(startX, endX);
    }
    
    public void setMultiLineDragStart(int startX, int endX, int startLayer, int endLayer) {
        for(int i = 0; i < getComponentCount(); i++) {
            ParameterLinePanel paramLinePanel = (ParameterLinePanel) getComponent(i);
            if(i >= startLayer && i <= endLayer) {
                paramLinePanel.setSelectionDragRegion(startX, endX);
            } else {
                paramLinePanel.clearSelectionDragRegions();
            }
        }
    }

    public void commitMultiLineDrag() {
        for(int i = 0; i < getComponentCount(); i++) {
            ParameterLinePanel paramLinePanel = (ParameterLinePanel) getComponent(i);
            paramLinePanel.commitMultiLineDrag();
        }
    }

    public void setMultiLineTranslation(int mouseTranslateX) {
        for(int i = 0; i < getComponentCount(); i++) {
            ParameterLinePanel paramLinePanel = (ParameterLinePanel) getComponent(i);
            paramLinePanel.setMultiLineMouseTranslation(mouseTranslateX);
        }
    }
    
    /* SCORE SCALING */
    
    public void initiateScoreScale(int startX, int endX, int scaleLayerNum) {
        this.scaleLayerNum = scaleLayerNum;
        
        ParameterLinePanel paramLinePanel = 
                ((ParameterLinePanel)this.getComponent(this.scaleLayerNum));
        paramLinePanel.initiateScoreScale(startX, endX);
    }
    
    public void setScoreScaleStart(int newSelectionStartX) {
        ParameterLinePanel paramLinePanel = 
                ((ParameterLinePanel)this.getComponent(this.scaleLayerNum));
        paramLinePanel.setScoreScaleStart(newSelectionStartX);
    }
    
    public void setScoreScaleEnd(int newSelectionEndX) {
        ParameterLinePanel paramLinePanel = 
                ((ParameterLinePanel)this.getComponent(this.scaleLayerNum));
        paramLinePanel.setScoreScaleEnd(newSelectionEndX);
    }
    
    
    public void endScoreScale() {
        ParameterLinePanel paramLinePanel = 
                ((ParameterLinePanel)this.getComponent(this.scaleLayerNum));
        paramLinePanel.commitScoreScale();
        this.scaleLayerNum = -1;
    }
}
