/*
 * blue - object composition environment for csound Copyright (c) 2001-2006
 * Steven Yi (stevenyi@gmail.com)
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

import blue.ui.core.score.layers.soundObject.views.SoundObjectView;
import blue.BlueData;
import blue.SoundLayer;
import blue.SoundLayerListener;
import blue.score.TimeState;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.ScoreObjectView;
import blue.ui.core.score.layers.LayerGroupPanel;
import blue.ui.core.score.layers.SelectionMarquee;
import blue.ui.core.score.layers.soundObject.views.SoundObjectViewFactory;
import blue.ui.utilities.ParentDispatchingMouseAdapter;
import blue.ui.utilities.UiUtilities;
import blue.utility.ObjectUtilities;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.ComponentListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.text.MessageFormat;
import java.util.HashMap;
import java.util.List;
import javax.swing.*;
import org.openide.util.Utilities;
import org.openide.util.lookup.InstanceContent;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */
public final class ScoreTimeCanvas extends JLayeredPane //implements Scrollable,
        implements PropertyChangeListener, LayerGroupListener, SoundLayerListener,
        LayerGroupPanel<PolyObject> {

    private static final MessageFormat toolTipFormat = new MessageFormat(
            "<html><b>Name:</b> {0}<br>" + "<b>Type:</b> {1}<br>" + "<b>Start Time:</b> {2}<br>" + "<b>Duration:</b> {3}<br>" + "<b>End Time:</b> {4}</html>");
    private final HashMap<SoundObject, SoundObjectView> soundObjectToViewMap
            = new HashMap<>();
    
    private static final Color HLINE_COLOR = Color.DARK_GRAY.darker().darker();
    private static final Color VLINE_COLOR = Color.DARK_GRAY;   
            
    int time;
    PolyObject pObj;
    TimeState timeState = null;
    Point start = new Point(0, 0);
    Point end;
    AutomationLayerPanel automationPanel = new AutomationLayerPanel();
    JPanel sObjPanel = new JPanel();
    private final PropertyChangeListener heightListener;
    private final BlueData data;
    private final InstanceContent content;
    private final ScoreTimelineDropTargetListener dropTargetListener;
    private final ComponentListener sObjViewListener;

    public ScoreTimeCanvas(BlueData blueData, InstanceContent ic) {
        this.content = ic;

        this.data = blueData;

        heightListener = (PropertyChangeEvent evt) -> {
            reset();
        };

        sObjViewListener = new ComponentListener() {
            @Override
            public void componentResized(ComponentEvent ce) {
                checkSize();
            }

            @Override
            public void componentMoved(ComponentEvent ce) {
                checkSize();
            }

            @Override
            public void componentShown(ComponentEvent ce) {
            }

            @Override
            public void componentHidden(ComponentEvent ce) {
            }

        };

        sObjPanel.setLayout(null);

        time = 3;

        sObjPanel.setOpaque(false);

        this.add(automationPanel, MODAL_LAYER);
        this.add(sObjPanel, DEFAULT_LAYER);

        this.addComponentListener(new ComponentAdapter() {
            @Override
            public void componentResized(ComponentEvent e) {
                Dimension size = getSize();
                automationPanel.setSize(size);
                sObjPanel.setSize(size);
            }
        });

        dropTargetListener = new ScoreTimelineDropTargetListener(this);

        ToolTipManager.sharedInstance().registerComponent(this);

        this.setFocusable(true);

        final MouseAdapter mouseAdapter = new ParentDispatchingMouseAdapter(this);

        // This is here as the existing mouselisteners prevent bubbling up of
        // events (i.e. from ToolTipManager)
        this.addMouseListener(mouseAdapter);
        this.addMouseMotionListener(mouseAdapter);
    }

    public JPanel getSoundObjectPanel() {
        return sObjPanel;
    }

    @Override
    public String getToolTipText(MouseEvent e) {

        String tip = null;

        Object obj = this.getComponentAt(e.getPoint());
        if (obj instanceof SoundObjectView) {
            SoundObject sObj = ((SoundObjectView) obj).getSoundObject();

            double subjectiveDuration = sObj.getSubjectiveDuration();
            double startTime = sObj.getStartTime();

            Object[] args = {sObj.getName(),
                ObjectUtilities.getShortClassName(sObj), startTime,
                subjectiveDuration, startTime + subjectiveDuration};

            tip = toolTipFormat.format(args);
        }

        return tip;
    }

    public void setSelectionDragRegions() {
//        SoundObjectView[] sObjViews = mBuffer.motionBuffer;
//        if(sObjViews == null) {
//            return;
//        }
//        
//        for (int i = 0; i < sObjViews.length; i++) {
//            SoundObjectView sObjView = sObjViews[i];
//            int layerNum = pObj.getLayerNumForY(sObjView.getY());
//            
//            automationPanel.addSelectionDragRegion(sObjView.getStartTime(), 
//                    sObjView.getStartTime() + sObjView.getSubjectiveDuration(), layerNum);
//        }
    }

    public void reset() {
        UiUtilities.invokeOnSwingThread(() -> {
            Component[] components = sObjPanel.getComponents();
            for (int i = 0; i < components.length; i++) {
                Component c = components[i];

                if (c instanceof SoundObjectView) {
                    SoundObjectView sObjView = (SoundObjectView) c;

                    int index = getPolyObject().getSoundLayerIndex(
                            sObjView.getSoundObject());

                    if (index < 0) {
                        sObjPanel.remove(c);
                        soundObjectToViewMap.remove(
                                sObjView.getSoundObject());
                    } else {
                        int newY = getPolyObject().getYForLayerNum(index);
                        int newHeight = getPolyObject().getSoundLayerHeight(
                                index);

                        sObjView.updateView(newY, newHeight);
                    }
                }
            }
//            if (ScoreController.getInstance().getScorePath().getLastLayerGroup() == null) {
//                BlueData data1 = BlueProjectManager.getInstance().getCurrentBlueData();
//                if (data1 != null) {
//                    int startTime = (int) (data1.getRenderStartTime() * timeState.getPixelSecond());
//                    int endTime = (int) (data1.getRenderEndTime() * timeState.getPixelSecond());
//                }
//            }
            checkSize();
            automationPanel.revalidate();
            revalidate();
            repaint();
        });

    }

    public void setPolyObject(PolyObject pObj, TimeState timeState) {
        Component[] components = sObjPanel.getComponents();

        sObjPanel.removeAll();

        this.soundObjectToViewMap.clear();

        if (this.getPolyObject() != null) {
            this.timeState.removePropertyChangeListener(this);
            this.getPolyObject().removeLayerGroupListener(this);

            SoundLayer tempLayer;

            for (int i = 0; i < pObj.size(); i++) {
                tempLayer = pObj.get(i);
                tempLayer.removePropertyChangeListener(heightListener);
                tempLayer.removeSoundLayerListener(this);
            }
        }

        this.pObj = pObj;
        this.timeState = timeState;

        dropTargetListener.setTimeState(timeState);

        if (this.getPolyObject() != null) {
            timeState.addPropertyChangeListener(this);
            pObj.addLayerGroupListener(this);
        }

        this.automationPanel.setLayerGroup(pObj, timeState);

//        content.set(Collections.emptyList(), null);
        // TODO - REFACTOR THIS OUT TO POLY OBJECT CONTROLLER
        SoundLayer tempLayer;
        List<SoundObject> sObjects;

        int size = pObj.size();

        if (size != 0) {
            for (int i = 0; i < size; i++) {
                tempLayer = pObj.get(i);
                tempLayer.addPropertyChangeListener(heightListener);
                tempLayer.addSoundLayerListener(this);

                for (SoundObject tempSObj : tempLayer) {
                    addSoundObjectView(i, tempSObj);
                }
            }
        } else {
            JOptionPane.showMessageDialog(null,
                    "ScoreTimeCanvas: setPObj found size == 0");
        }

        this.checkSize(true);
        this.revalidate();
        this.repaint();
    }

    /**
     * checkSize is called when dragging an object
     */
    public void checkSize() {
        checkSize(false);
    }

    public void checkSize(boolean setSize) {
        if (getPolyObject() == null || timeState == null) {
            return;
        }

        int tempTime = (int) (getPolyObject().getMaxTime() / 60) + 2;
        int height = getPolyObject().getTotalHeight();

        int width = (int)(tempTime * timeState.getPixelSecond() * 60);
//
//        if (getParent() != null) {
//
////            if (width < getParent().getWidth()) {
////                width = getParent().getWidth();
////            }
//
//            time = tempTime;
//
////            if (height < getParent().getHeight()) {
////                height = getParent().getHeight();
////            }
//
//        }

        if (width == this.getWidth() && height == this.getHeight()) {
//        if (width == this.getWidth()) {
            return;
        }

        Dimension d = new Dimension(width, height);

        if (setSize) {
            this.setSize(d);
        }

        this.setPreferredSize(d);

//        this.setPreferredSize(d);
//        this.setMaximumSize(d);
        //revalidate();
    }

    private void addSoundObjectView(int soundLayerIndex, SoundObject sObj) {

        var factory = SoundObjectViewFactory.getInstance();
        SoundObjectView temp = factory.createView(sObj, timeState);

        temp.addComponentListener(sObjViewListener);
        sObjPanel.add(temp, 0);
        temp.setLocation(
                (int) (sObj.getStartTime() * timeState.getPixelSecond()),
                getPolyObject().getYForLayerNum(soundLayerIndex));
        temp.setSize(
                (int) (sObj.getSubjectiveDuration() * timeState.getPixelSecond()),
                getPolyObject().getSoundLayerHeight(soundLayerIndex));

        // add to map of soundObjects and views
        // so that you can retrieve a view from a given soundObject
        this.soundObjectToViewMap.put(sObj, temp);

    }

    private void removeSoundObjectView(SoundObject sObj) {

        SoundObjectView sObjView = this.soundObjectToViewMap.remove(sObj);
        sObjView.removeComponentListener(sObjViewListener);
        sObjPanel.remove(sObjView);

        sObjPanel.repaint(sObjView.getBounds());

    }

    public void updateSoundObjectViewLayerIndex(SoundObject sObj,
            int soundLayerIndex) {
        SoundObjectView sObjView = this.soundObjectToViewMap.get(sObj);
        sObjView.setLocation(sObjView.getX(), getPolyObject().getYForLayerNum(
                soundLayerIndex));
    }

    public SoundObjectView getViewForSoundObject(SoundObject sObj) {
        return this.soundObjectToViewMap.get(sObj);
    }

    /**
     * ***********************************
     */
    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        int width = this.getWidth();

        g.setColor(Color.BLACK);
        g.fillRect(0, 0, width, this.getHeight());

        if (getPolyObject() == null || timeState == null) {
            return;
        }

        int y = 0;
        g.setColor(HLINE_COLOR);
        
        g.drawLine(0, 0, width, 0);

        for (SoundLayer layer : getPolyObject()) {
            y += layer.getSoundLayerHeight();
            g.drawLine(0, y, width, y);
        }

        g.drawLine(0, getHeight() - 1, width, getHeight() - 1);

        if (timeState.isSnapEnabled()) {
            int snapPixels = (int) (timeState.getSnapValue() * timeState.getPixelSecond());

            int x = 0;
            if (snapPixels <= 0) {
                return;
            }
            
            g.setColor(VLINE_COLOR);

            int height = getPolyObject().getTotalHeight();
            double snapValue = timeState.getSnapValue();
            double pixelSecond = timeState.getPixelSecond();
            double time;
            for (int i = 0; x < width; i++) {
                x = (int) ((i * snapValue) * pixelSecond);
                g.drawLine(x, 0, x, height);
            }

        }
    }

    @Override
    public void paintNavigatorView(Graphics2D g2d) {
        Component[] components = getSoundObjectPanel().getComponents();

        for (Component c : components) {
            SoundObjectView component = (SoundObjectView) c;
            Rectangle r = component.getBounds();

            g2d.setColor(component.getSoundObject().getBackgroundColor());
            g2d.fillRect(r.x, r.y, r.width, r.height);
        }
    }

    public void update() {
        repaint();
    }
    /**
     * **************************************************************
     */
    // code for scrollable interface
    /**
     * **************************************************************
     */
    int maxUnitIncrement = 200;

    public Dimension getPreferredScrollableViewportSize() {
        return getPreferredSize();
    }

    public int getScrollableUnitIncrement(Rectangle visibleRect,
            int orientation, int direction) {
        // Get the current position.
        int currentPosition = 0;
        if (orientation == SwingConstants.HORIZONTAL) {
            currentPosition = visibleRect.x;
        } else {
            currentPosition = visibleRect.y;
        }

        // Return the number of pixels between currentPosition
        // and the nearest tick mark in the indicated direction.
        if (direction < 0) {
            int newPosition = currentPosition - (currentPosition / maxUnitIncrement) * maxUnitIncrement;
            return (newPosition == 0) ? maxUnitIncrement : newPosition;
        }

        return ((currentPosition / maxUnitIncrement) + 1) * maxUnitIncrement - currentPosition;

    }

    public int getScrollableBlockIncrement(Rectangle visibleRect,
            int orientation, int direction) {

        if (orientation == SwingConstants.HORIZONTAL) {
            return visibleRect.width - maxUnitIncrement;
        }

        return visibleRect.height - maxUnitIncrement;
    }

    public boolean getScrollableTracksViewportWidth() {
        return false;
    }

    public boolean getScrollableTracksViewportHeight() {
        return false;
    }

    /**
     *
     */
    public PolyObject getPolyObject() {
        return this.pObj;
    }

    /* EVENT LISTENING METHODS */
    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        String prop = evt.getPropertyName();

        if (evt.getSource() == timeState) {
            switch (prop) {
                case "pixelSecond":
                    reset();
                    break;
                case "snapEnabled":
                case "snapValue":
                    repaint();
                    break;
            }
        }

    }


    /* SOUND LAYER LISTENER */
    @Override
    public void soundObjectAdded(final SoundLayer source, final SoundObject sObj) {
        if (SwingUtilities.isEventDispatchThread()) {
            addSoundObjectView(getPolyObject().getLayerNum(source), sObj);
        } else {
            SwingUtilities.invokeLater(() -> {
                addSoundObjectView(getPolyObject().getLayerNum(source), sObj);
            });
        }
    }

    @Override
    public void soundObjectRemoved(SoundLayer source, final SoundObject sObj) {
        if (SwingUtilities.isEventDispatchThread()) {
            removeSoundObjectView(sObj);
        } else {
            SwingUtilities.invokeLater(() -> {
                removeSoundObjectView(sObj);
            });
        }
    }

    public void modifyLayerHeight(int value, int y) {
        int index = getPolyObject().getLayerNumForY(y);

        if (index < 0 || index >= getPolyObject().size()) {
            return;
        }

        SoundLayer layer = getPolyObject().get(index);

        int hIndex = layer.getHeightIndex();

        if (value < 0 && hIndex < 1) {
            return;
        } else if (value > 0 && hIndex > SoundLayer.HEIGHT_MAX_INDEX - 1) {
            return;
        }

        layer.setHeightIndex(hIndex + value);
    }

    /* LAYER GROUP LISTENER */
    @Override
    public void layerGroupChanged(LayerGroupDataEvent event) {
        if (event.getType() == LayerGroupDataEvent.DATA_ADDED) {
            SoundLayer layer = getPolyObject().get(
                    event.getStartIndex());
            layer.addPropertyChangeListener(heightListener);
            layer.addSoundLayerListener(this);
        }

        reset();
    }

    /* Cleanup code on Remove */
    @Override
    public void removeNotify() {
        this.data.removePropertyChangeListener(this);
        super.removeNotify();
    }

    @Override
    public void marqueeSelectionPerformed(SelectionMarquee marquee) {
        Component[] comps = sObjPanel.getComponents();
        for (int i = 0; i < comps.length; i++) {
            if (!(comps[i] instanceof SoundObjectView)) {
                continue;
            }

            if (marquee.intersects((JComponent) comps[i])) {
                content.add(((SoundObjectView) comps[i]).getSoundObject());
            }

        }
    }

    @Override
    public ScoreObjectView getScoreObjectViewAtPoint(Point p) {
        Component c = sObjPanel.getComponentAt(p);
        if (c instanceof ScoreObjectView) {
            return (ScoreObjectView) c;
        }
        return null;
    }

    @Override
    public Action[] getLayerActions() {
        List<? extends Action> list = Utilities.actionsForPath(
                "blue/score/layers/soundObject/actions");
        return list.toArray(new Action[0]);
    }

    @Override
    public PolyObject getLayerGroup() {
        return pObj;
    }
}
