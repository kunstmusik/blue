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

package blue.ui.core.score;

import java.awt.Component;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.util.Iterator;
import java.util.Vector;

import javax.swing.JComponent;
import javax.swing.JViewport;
import javax.swing.SwingUtilities;

import blue.components.AlphaMarquee;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.utilities.UiUtilities;

class MultiLineMouseProcessor implements MouseListener, MouseMotionListener {

    private transient Vector listeners = new Vector();

    private ScoreTimeCanvas sCanvas;

    boolean isPopupOpen = false;

    private Rectangle scrollRect = new Rectangle(0, 0, 1, 1);

    int startLayer = -1;
    int endLayer = -1;
    int startTime = -1;
    int endTime = -1;
    int mouseDownX = -1;
    int mouseTranslateX = 0;
    
    public MultiLineMouseProcessor(ScoreTimeCanvas sCanvas) {
        this.sCanvas = sCanvas;
    }

    public void mousePressed(MouseEvent e) {
        AuditionManager.getInstance().stop();

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
                    mouseDownX = e.getX();
                    mouseTranslateX = 0;
                    
                    int l1, l2;
                    
                    if(endLayer > startLayer) {
                        l1 = startLayer;
                        l2 = endLayer;
                    } else {
                        l1 = endLayer;
                        l2 = startLayer;
                    }
                    
                    sCanvas.automationPanel.setMultiLineDragStart(
                            marquee.getX(), marquee.getX() + marquee.getWidth(),
                            l1, l2);
                    
                    sCanvas.start = e.getPoint();
                    sCanvas.mBuffer.motionBufferObjects();
                    return;
                }
               
            }
            
            startMarquee(e.getPoint());
            
        }
    }

    public void mouseReleased(MouseEvent e) {
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
            
            if(mouseDownX < 0) {
                endMarquee();
            }
            
            if(mouseTranslateX != 0) {
                sCanvas.automationPanel.commitMultiLineDrag();
                startTime = sCanvas.marquee.getX();
                endTime = startTime + sCanvas.marquee.getWidth();
            }
            
            mouseTranslateX = 0;
            mouseDownX = -1;
            
            sCanvas.repaint();
        }
    }

    public void mouseDragged(MouseEvent e) {
        if(!isPopupOpen && sCanvas.marquee.isVisible()) {
            if (SwingUtilities.isLeftMouseButton(e)) {
                // updateMarquee(e);
                
                int x = e.getX();
                
                
                if (mouseDownX > 0) {
                                       
                    int start = startTime;
                    
                    if(startTime > endTime) {
                        start = endTime;
                    }
                    
                    AlphaMarquee marquee = sCanvas.marquee;
                    mouseTranslateX = x - mouseDownX;

                    int newX = start + mouseTranslateX;

                    if (newX < 0) {
                        mouseTranslateX -= newX;
                        newX = 0;
                    }

                    if (sCanvas.pObj.isSnapEnabled() && !e.isControlDown()) {
                        int snapX = setStartForSnap(newX);
                        mouseTranslateX += snapX - newX;
                        newX = snapX;
                    }

                    if (sCanvas.mBuffer.size() != 0 && !isPopupOpen) {
                        if(mouseTranslateX + sCanvas.mBuffer.point[0][0] < 0) {
                            return; 
                        }
                        
                        
                        moveSoundObjects(mouseTranslateX);                    
                    }

                    
                    marquee.setLocation(newX, marquee.getY());
                    sCanvas.automationPanel.setMultiLineTranslation(mouseTranslateX);
                    return;
                }
                
                PolyObject pObj = sCanvas.pObj;
                
                int layerNum = pObj.getLayerNumForY(e.getY());
                endTime = e.getX();
                
                if (sCanvas.pObj.isSnapEnabled()) {
                    endTime = setStartForSnap(endTime);
                }
                    
                if(startLayer <= layerNum) {
                    int y = pObj.getYForLayerNum(layerNum);
                    y += pObj.getSoundLayerHeight(layerNum);
                    
                    sCanvas.marquee.setStart(new Point(startTime, pObj.getYForLayerNum(startLayer)));
                    sCanvas.marquee.setDragPoint(new Point(endTime, y));
                    
                } else {
                    int y = pObj.getYForLayerNum(layerNum);
                    
                    sCanvas.marquee.setStart(new Point(startTime, y));
                    sCanvas.marquee.setDragPoint(new Point(endTime, 
                            pObj.getYForLayerNum(startLayer) + pObj.getSoundLayerHeight(startLayer)));
                }
                
                endLayer = layerNum;
                
                int x1, x2, l1, l2;
                
                if(layerNum > startLayer) {
                    l1 = startLayer;
                    l2 = endLayer;
                } else {
                    l1 = layerNum;
                    l2 = startLayer;
                }
                
                if(startTime < endTime) {
                    x1 = startTime;
                    x2 = endTime;
                } else {
                    x1 = endTime;
                    x2 = startTime;
                    
//                    startTime = x1;
//                    endTime = x2;
                }
                
                sCanvas.automationPanel.setMultiLineDragStart(x1, x2, l1, l2);
                
            }            
        }

        checkScroll(e);
        sCanvas.checkSize();

    }

    public void mouseMoved(MouseEvent e) {
    }

    public void mouseExited(MouseEvent e) {
    }

    public void mouseEntered(MouseEvent e) {
    }

    public void mouseClicked(MouseEvent e) {
    }

    private int setStartForSnap(int start) {
        int snapPixels = (int) (sCanvas.pObj.getSnapValue() * sCanvas.pObj.getPixelSecond());
        int fraction = start % snapPixels;

        start = start - fraction;

        if (fraction > snapPixels / 2) {
            start += snapPixels;
        }
        return start;
    }
    
    // MOUSE PRESSED CODE

    private float getTimeForX(int xValue) {
        PolyObject pObj = sCanvas.getPolyObject();

        return (float) xValue / pObj.getPixelSecond();
    }

    public float getStartTime(SoundObjectBuffer objBuffer) {
        float min = Float.MAX_VALUE;

        for (int i = 0; i < objBuffer.size(); i++) {
            float x = objBuffer.getSoundObject(i).getStartTime();
            if (x < min) {
                min = x;
            }

        }

        return min;
    }

    // MOUSE DRAGGING CODE

    private void moveSoundObjects(int xTranslation) {
        
        int newX;

        for (int i = 0; i < sCanvas.mBuffer.motionBuffer.length; i++) {
            newX = sCanvas.mBuffer.point[i][0] + xTranslation;
          
            float newStart = (float) newX / sCanvas.pObj.getPixelSecond();

            SoundObjectView sObjView = sCanvas.mBuffer.motionBuffer[i];
//            sObjView.setLocation(sObjView.getX(), sObjView.getY());

            SoundObject sObj = sObjView.getSoundObject();

            sObj.setStartTime(newStart);

        }

    }


    // MOUSE RELEASED CODE

    private void checkScroll(MouseEvent e) {

        Point temp = SwingUtilities.convertPoint(sCanvas, e.getPoint(), sCanvas
                .getParent());

        scrollRect.setLocation(temp);

        ((JViewport) sCanvas.getParent()).scrollRectToVisible(scrollRect);

    }

    private int getSoundLayerIndex(int y) {
        return sCanvas.pObj.getLayerNumForY(y);
    }

    public void startMarquee(Point point) {
        PolyObject pObj = sCanvas.pObj;
        
        int layerNum = pObj.getLayerNumForY(point.y);
        
        startLayer = layerNum;
        startTime = point.x;
        int y = pObj.getYForLayerNum(layerNum);
        
        if (pObj.isSnapEnabled()) {
            startTime = setStartForSnap(startTime);
        }
                
        sCanvas.marquee.setStart(new Point(startTime, y));
        sCanvas.marquee.setVisible(true);
        
        sCanvas.automationPanel.setMultiLineDragStart(startTime, startTime, startLayer, startLayer);
    }

    public void endMarquee() {
//        sCanvas.marquee.setVisible(false);

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

//        sCanvas.marquee.setSize(1, 1);
//        sCanvas.marquee.setLocation(-1, -1);
    }

    // UTILITY METHODS

    public int getLayerMin(SoundObjectBuffer objBuffer) {
        int min = Integer.MAX_VALUE;

        for (int i = 0; i < objBuffer.size(); i++) {
            int layerNum = getSoundLayerIndex(objBuffer.getY(i));

            if (layerNum < min) {
                min = layerNum;
            }

        }

        return min;
    }

    public int getLayerMax(SoundObjectBuffer objBuffer) {
        int max = Integer.MIN_VALUE;

        for (int i = 0; i < objBuffer.size(); i++) {
            int layerNum = getSoundLayerIndex(objBuffer.getY(i));

            if (layerNum > max) {
                max = layerNum;
            }

        }

        return max;
    }

    public int getStartX(SoundObjectBuffer objBuffer) {
        int min = Integer.MAX_VALUE;

        for (int i = 0; i < objBuffer.size(); i++) {
            int x = objBuffer.getX(i);
            if (x < min) {
                min = x;
            }

        }

        return min;
    }

    public void selectLayer(int soundLayerIndex) {
        final int index = soundLayerIndex;

        SwingUtilities.invokeLater(new Runnable() {

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