/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2008 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */

package blue.ui.core.score.layers.soundObject;

import blue.components.AlphaMarquee;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.score.TimeState;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.core.score.ModeManager;
import blue.ui.utilities.UiUtilities;
import blue.utility.ScoreUtilities;
import java.awt.Component;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.JComponent;
import javax.swing.JViewport;
import javax.swing.SwingUtilities;

class MultiLineMouseProcessor extends MouseAdapter {

    private transient Vector listeners = new Vector();

    private ScoreTimeCanvas sCanvas;

    boolean isPopupOpen = false;

    private Rectangle scrollRect = new Rectangle(0, 0, 1, 1);

    int startLayer = -1;
    int endLayer = -1;
    float startTime = -1;
    float endTime = -1;
    float mouseDownTime = -1;
    float mouseTranslateTime = 0;
    
    TimeState timeState = null;
    
    public MultiLineMouseProcessor(ScoreTimeCanvas sCanvas) {
        this.sCanvas = sCanvas;
    }

    public void setTimeState(TimeState timeState) {
        this.timeState = timeState;
    }
    
    private float getPixelSecond() {
        return (float)timeState.getPixelSecond();
    }

    @Override
    public void mousePressed(MouseEvent e) {
        
        if(!isMultiLineMode()) {
            return;
        }
        
        e.consume();
        RealtimeRenderManager.getInstance().stopAuditioning();
        
        Component comp = sCanvas.getSoundObjectPanel().getComponentAt(
                e.getPoint());

        SoundObjectView sObjView;

        if (UiUtilities.isRightMouseButton(e)) {
//            showPopup(comp, e);
        } else if (SwingUtilities.isLeftMouseButton(e)) {
            AlphaMarquee marquee = sCanvas.marquee;
            
            if (marquee.isVisible()) {

                int x = e.getX();
                

                if (x >= marquee.getX()
                        && x <= marquee.getX() + marquee.getWidth()) {    
                    mouseDownTime = x / getPixelSecond();
                    mouseTranslateTime = 0.0f;
                    
                    int l1, l2;
                    
                    if(endLayer > startLayer) {
                        l1 = startLayer;
                        l2 = endLayer;
                    } else {
                        l1 = endLayer;
                        l2 = startLayer;
                    }
                    
                    sCanvas.automationPanel.setMultiLineDragStart(
                            marquee.getX() / getPixelSecond(), 
                            marquee.getX() + marquee.getWidth() / getPixelSecond(),
                            l1, l2);
                    
                    sCanvas.start = e.getPoint();
//                    sCanvas.mBuffer.motionBufferObjects();
                    return;
                }
               
            }
            
            startMarquee(e.getPoint());
            
        }
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        
        if(!isMultiLineMode()) {
            return;
        }
        
        e.consume();
        if (SwingUtilities.isLeftMouseButton(e)) {
//            if (sCanvas.mBuffer.motionBuffer != null) {
//                if (dragMode == MOVE && !this.justSelected) {
//                    MoveSoundObjectsEdit moveEdit = sCanvas.mBuffer
//                            .getMoveEdit(sCanvas.getPolyObject());
//
//                    sCanvas.updateSoundObjectsLayerMap();
//
//                    BlueUndoManager.setUndoManager("score");
//
//                    BlueUndoManager.addEdit(moveEdit);
//
//                } else if (dragMode == RESIZE) {
//                    BlueUndoManager.setUndoManager("score");
//
//                    SoundObjectView sObjView = sCanvas.mBuffer.motionBuffer[0];
//
//                    BlueUndoManager.addEdit(new ResizeSoundObjectEdit(sObjView
//                            .getSoundObject(), initialDuration, sObjView
//                            .getSubjectiveDuration()));
//                }
//            } else if (sCanvas.marquee.isVisible()) {
//                endMarquee();
//            }
            // clearMarquee();
            
            if(mouseDownTime < 0) {
                endMarquee();
            }
            
            if(mouseTranslateTime != 0) {
                sCanvas.automationPanel.commitMultiLineDrag();
                startTime = sCanvas.marquee.getX() / getPixelSecond();
                endTime = startTime + (sCanvas.marquee.getWidth() / getPixelSecond());
            }
            
            mouseTranslateTime = 0;
            mouseDownTime = -1;
            
            sCanvas.repaint();
        }
    }

    @Override
    public void mouseDragged(MouseEvent e) {
        
        if(!isMultiLineMode()) {
            return;
        }
        
        e.consume();
        if(!isPopupOpen && sCanvas.marquee.isVisible()) {
            if (SwingUtilities.isLeftMouseButton(e)) {
//FIXME
                int x = e.getX();
                float mouseDragTime = x / getPixelSecond();
                
                
                if (mouseDownTime > 0) {
                                       
                    float start = startTime;
                    
                    if(startTime > endTime) {
                        start = endTime;
                    }
                    
                    AlphaMarquee marquee = sCanvas.marquee;
                    mouseTranslateTime = mouseDragTime - mouseDownTime;

                    float newTime = start + mouseTranslateTime;

                    if (newTime < 0) {
                        mouseTranslateTime -= newTime;
                        newTime = 0;
                    }

                    if (timeState.isSnapEnabled() && !e.isControlDown()) {
                        newTime = ScoreUtilities.getSnapValueMove(
                                newTime, timeState.getSnapValue());
                        
                       mouseTranslateTime = newTime - start;
                       
                    }

                    // FIXME
//                    if (sCanvas.mBuffer.size() != 0 && !isPopupOpen) {
//                        if(mouseTranslateTime + sCanvas.mBuffer.initialStartTimes[0] < 0) {
//                            return; 
//                        }
//                        
//                        
//                        moveSoundObjectsByTime(mouseTranslateTime);                    
//                    }

                    
                    float diff = marquee.endTime - marquee.startTime;
                    marquee.setLocation((int)(newTime * getPixelSecond()), marquee.getY());
                    marquee.startTime = newTime;
                    marquee.endTime = newTime + diff;
                    sCanvas.automationPanel.setMultiLineTranslation(mouseTranslateTime);
                    return;
                }
                
                PolyObject pObj = sCanvas.pObj;
                
                int layerNum = pObj.getLayerNumForY(e.getY());
                endTime = e.getX() / getPixelSecond();
                
                if (timeState.isSnapEnabled()) {
                    endTime = ScoreUtilities.getSnapValueMove(endTime,
                            timeState.getSnapValue());
                }
                    
                if(startLayer <= layerNum) {
                    int y = pObj.getYForLayerNum(layerNum);
                    y += pObj.getSoundLayerHeight(layerNum);
                    
                    sCanvas.marquee.setStart(new Point((int)(startTime * getPixelSecond()), 
                            pObj.getYForLayerNum(startLayer)));
                    sCanvas.marquee.setDragPoint(new Point((int)(endTime * getPixelSecond()), y));
                    
                } else {
                    int y = pObj.getYForLayerNum(layerNum);
                    
                    sCanvas.marquee.setStart(new Point((int)(startTime * getPixelSecond()), y));
                    sCanvas.marquee.setDragPoint(new Point((int)(endTime * getPixelSecond()), 
                            pObj.getYForLayerNum(startLayer) + pObj.getSoundLayerHeight(startLayer)));
                }
                
                sCanvas.marquee.startTime = startTime;
                sCanvas.marquee.endTime = endTime;
                
                endLayer = layerNum;
                
                float start, end;
                int l1, l2;
                
                if(layerNum > startLayer) {
                    l1 = startLayer;
                    l2 = endLayer;
                } else {
                    l1 = layerNum;
                    l2 = startLayer;
                }
                
                if(startTime < endTime) {
                    start = startTime;
                    end = endTime;
                } else {
                    start = endTime;
                    end = startTime;
                }
                
                sCanvas.automationPanel.setMultiLineDragStart(start, end, l1, l2);
                
            }            
        }

        checkScroll(e);
        sCanvas.checkSize();

    }

    private boolean isMultiLineMode() {
        return ModeManager.getInstance().getMode() == ModeManager.MODE_MULTI_LINE;
    }

    // MOUSE DRAGGING CODE

    private void moveSoundObjectsByTime(float transTime) {
        
        float newStart;

        //FIXME
//        for (int i = 0; i < sCanvas.mBuffer.motionBuffer.length; i++) {
//            newStart = sCanvas.mBuffer.initialStartTimes[i] + transTime;
//          
//            SoundObjectView sObjView = sCanvas.mBuffer.motionBuffer[i];
//
//            SoundObject sObj = sObjView.getSoundObject();
//
//            sObj.setStartTime(newStart);
//
//        }

    }


    // MOUSE RELEASED CODE

    private void checkScroll(MouseEvent e) {

        Point temp = SwingUtilities.convertPoint(sCanvas, e.getPoint(), sCanvas
                .getParent().getParent().getParent());

        scrollRect.setLocation(temp);

        ((JViewport) sCanvas.getParent().getParent().getParent()).scrollRectToVisible(scrollRect);

    }

    private int getSoundLayerIndex(int y) {
        return sCanvas.pObj.getLayerNumForY(y);
    }

    public void startMarquee(Point point) {
        PolyObject pObj = sCanvas.pObj;
        
        int layerNum = pObj.getLayerNumForY(point.y);
        
        startLayer = layerNum;
        startTime = point.x / getPixelSecond();
        int y = pObj.getYForLayerNum(layerNum);
        
        if (timeState.isSnapEnabled()) {
            startTime = ScoreUtilities.getSnapValueStart(startTime, timeState.getSnapValue());
        }
                // FIXME
        sCanvas.marquee.setStart(new Point(point.x, y));
        sCanvas.marquee.startTime = startTime;
        sCanvas.marquee.endTime = startTime;
        sCanvas.marquee.setVisible(true);
        
        sCanvas.automationPanel.setMultiLineDragStart(startTime, startTime, startLayer, startLayer);
    }

    public void endMarquee() {
        Component[] comps = sCanvas.getSoundObjectPanel().getComponents();

        fireSelectionEvent(new SelectionEvent(null,
                SelectionEvent.SELECTION_CLEAR));

        for (int i = 0; i < comps.length; i++) {
            if (!(comps[i] instanceof SoundObjectView)) {
                continue;
            }

            if (sCanvas.marquee.intersects((JComponent) comps[i])) {
                SelectionEvent selectionEvent = new SelectionEvent(comps[i],
                        SelectionEvent.SELECTION_ADD);

                fireSelectionEvent(selectionEvent);
            }

        }

    }

    // UTILITY METHODS

    public void selectLayer(int soundLayerIndex) {
        final int index = soundLayerIndex;

        SwingUtilities.invokeLater(new Runnable() {

            @Override
            public void run() {
                Component[] comps = sCanvas.getSoundObjectPanel()
                        .getComponents();

                fireSelectionEvent(new SelectionEvent(null,
                        SelectionEvent.SELECTION_CLEAR));

                for (int i = 0; i < comps.length; i++) {
                    if (!(comps[i] instanceof SoundObjectView)) {
                        continue;
                    }

                    if (getSoundLayerIndex(comps[i].getY()) == index) {
                        SelectionEvent selectionEvent = new SelectionEvent(
                                comps[i], SelectionEvent.SELECTION_ADD);

                        fireSelectionEvent(selectionEvent);
                    }

                }
            }
        });

    }

    public void selectAllBefore(final int value) {
        SwingUtilities.invokeLater(new Runnable() {

            @Override
            public void run() {
                Component[] comps = sCanvas.getSoundObjectPanel()
                        .getComponents();

                fireSelectionEvent(new SelectionEvent(null,
                        SelectionEvent.SELECTION_CLEAR));

                for (int i = 0; i < comps.length; i++) {
                    Component comp = comps[i];

                    if (!(comp instanceof SoundObjectView)) {
                        continue;
                    }

                    if ((comp.getX() + comp.getWidth()) <= value) {
                        SelectionEvent selectionEvent = new SelectionEvent(
                                comp, SelectionEvent.SELECTION_ADD);

                        fireSelectionEvent(selectionEvent);
                    }

                }
            }
        });
    }

    public void selectAllAfter(final int value) {
        SwingUtilities.invokeLater(new Runnable() {

            @Override
            public void run() {
                Component[] comps = sCanvas.getSoundObjectPanel()
                        .getComponents();

                fireSelectionEvent(new SelectionEvent(null,
                        SelectionEvent.SELECTION_CLEAR));

                for (int i = 0; i < comps.length; i++) {
                    Component comp = comps[i];

                    if (!(comp instanceof SoundObjectView)) {
                        continue;
                    }

                    if (comp.getX() >= value) {
                        SelectionEvent selectionEvent = new SelectionEvent(
                                comp, SelectionEvent.SELECTION_ADD);

                        fireSelectionEvent(selectionEvent);
                    }

                }
            }
        });
    }

    // SELECTION EVENT CODE

    public void fireSelectionEvent(SelectionEvent se) {
        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            SelectionListener listener = (SelectionListener) iter.next();
            listener.selectionPerformed(se);
        }
    }

    public void addSelectionListener(SelectionListener sl) {
        listeners.add(sl);
    }

    public void removeSelectionListener(SelectionListener sl) {
        listeners.remove(sl);
    }

}