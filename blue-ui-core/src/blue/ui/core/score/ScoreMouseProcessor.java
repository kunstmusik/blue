/*
 * Created on May 8, 2003
 *
 */
package blue.ui.core.score;

import blue.BlueSystem;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.util.Iterator;
import java.util.Vector;

import javax.swing.JComponent;
import javax.swing.JOptionPane;
import javax.swing.JViewport;
import javax.swing.SwingUtilities;

import blue.SoundLayer;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.ui.core.score.undo.AddSoundObjectEdit;
import blue.ui.core.score.undo.MoveSoundObjectsEdit;
import blue.ui.core.score.undo.ResizeSoundObjectEdit;
import blue.soundObject.Instance;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.utilities.UiUtilities;
import blue.undo.BlueUndoManager;
import blue.utility.ObjectUtilities;

/**
 * ScoreMouseProcessor handles mouse actions for ScoreTimeCanvas
 * 
 * TODO - clean up, looking at
 * blue.soundObject.editor.pianoRoll.NoteCanvasMouseListener
 * 
 */

class ScoreMouseProcessor implements MouseListener, MouseMotionListener {

    private static final int EDGE = 5;

    private static final int OS_CTRL_KEY = BlueSystem.getMenuShortcutKey();

    private final Cursor LEFT_RESIZE_CURSOR = Cursor
            .getPredefinedCursor(Cursor.W_RESIZE_CURSOR);
    
    private final Cursor RIGHT_RESIZE_CURSOR = Cursor
            .getPredefinedCursor(Cursor.E_RESIZE_CURSOR);

    private final Cursor NORMAL_CURSOR = Cursor
            .getPredefinedCursor(Cursor.DEFAULT_CURSOR);

    private static final int MOVE = 0;

    private static final int RESIZE_RIGHT = 1;
    
    private static final int RESIZE_LEFT = 2;

    private int dragMode = MOVE;

    private boolean dragStart = true;

    private transient Vector<SelectionListener> listeners = new Vector<SelectionListener>();

    private ScoreTimeCanvas sCanvas;

    private boolean justSelected = false;

    boolean isPopupOpen = false;

    private Rectangle scrollRect = new Rectangle(0, 0, 1, 1);

    private float initialDuration;
    
    private float initialEndTime;

    public ScoreMouseProcessor(ScoreTimeCanvas sCanvas) {
        this.sCanvas = sCanvas;
    }

    public void mousePressed(MouseEvent e) {
        dragStart = true;

        AuditionManager.getInstance().stop();

        sCanvas.requestFocus();

        Component comp = sCanvas.getSoundObjectPanel().getComponentAt(
                e.getPoint());

        SoundObjectView sObjView;

        if (UiUtilities.isRightMouseButton(e)) {
            showPopup(comp, e);
        } else if (SwingUtilities.isLeftMouseButton(e)) {
            if (comp instanceof SoundObjectView) {
                sObjView = (SoundObjectView) comp;

                if (dragMode == RESIZE_RIGHT) {
                    setBufferedSoundObject(sObjView, e);
                    this.justSelected = false;
                    this.initialDuration = sObjView.getSubjectiveDuration();
                    sCanvas.automationPanel.initiateScoreScale(sObjView.getX(), 
                            sObjView.getX() + sObjView.getWidth(), 
                            getSoundLayerIndex(sObjView.getY()));
                } else if (dragMode == RESIZE_LEFT) {
                    setBufferedSoundObject(sObjView, e);
                    this.justSelected = false;
                    this.initialEndTime = sObjView.getStartTime() + sObjView.getSubjectiveDuration();                
                    sCanvas.automationPanel.initiateScoreScale(sObjView.getX(), 
                            sObjView.getX() + sObjView.getWidth(), 
                            getSoundLayerIndex(sObjView.getY()));
                } else {
                    if (e.isShiftDown()) {
                        if (sCanvas.mBuffer.contains(sObjView)) {
                            removeBufferedSoundObject(sObjView, e);
                        } else {
                            addBufferedSoundObject(sObjView, e);
                        }
                    } else if (sCanvas.mBuffer.contains(sObjView)) {
                        if ((sObjView.getSoundObject() instanceof PolyObject)
                                && (e.getClickCount() >= 2)) {
                            PolyObject pObj = (PolyObject) (sObjView
                                    .getSoundObject());
                            editPolyObject(pObj);
                        } else {
                            sCanvas.start = e.getPoint();
                            sCanvas.mBuffer.motionBufferObjects();
                            isPopupOpen = false;
                            this.justSelected = false;
                        }
                    } else {
                        if ((sObjView.getSoundObject() instanceof PolyObject)
                                && (e.getClickCount() >= 2)) {
                            PolyObject pObj = (PolyObject) (sObjView
                                    .getSoundObject());
                            editPolyObject(pObj);
                        } else {
                            setBufferedSoundObject(sObjView, e);
                        }
                    }
                }
            } else if (e.isShiftDown()) {
                fireSelectionEvent(new SelectionEvent(null,
                        SelectionEvent.SELECTION_CLEAR));

                int soundLayerIndex = getSoundLayerIndex(e.getY());
                int start = e.getX();

                if (sCanvas.pObj.isSnapEnabled()) {
                    int snapPixels = (int) (sCanvas.pObj.getSnapValue() * sCanvas.pObj
                            .getPixelSecond());
                    int fraction = start % snapPixels;

                    start = start - fraction;
                    
                    if(fraction > snapPixels / 2) {
                        start += snapPixels;
                    }
                
                }

                pasteSoundObject(soundLayerIndex, start);
                this.justSelected = true;
            } else if ((e.getModifiers() & OS_CTRL_KEY) == OS_CTRL_KEY){
                int soundLayerIndex = getSoundLayerIndex(e.getY());
                int start = e.getX();

                if (sCanvas.pObj.isSnapEnabled()) {
                    int snapPixels = (int) (sCanvas.pObj.getSnapValue() * sCanvas.pObj
                            .getPixelSecond());

                    start = start - (start % snapPixels);
                }
                pasteSoundObjects(soundLayerIndex, start);
                this.justSelected = true;
            } else if (e.getClickCount() >= 2) {
                int soundLayerIndex = getSoundLayerIndex(e.getY());

                selectLayer(soundLayerIndex);

            } else {
                clearBuffer(e);
                startMarquee(e.getPoint());
            }
        }
    }

    public void mouseReleased(MouseEvent e) {
        if (SwingUtilities.isLeftMouseButton(e)) {
            if (sCanvas.mBuffer.motionBuffer != null) {
                if (dragMode == MOVE && !this.justSelected) {
                    MoveSoundObjectsEdit moveEdit = sCanvas.mBuffer
                            .getMoveEdit(sCanvas.getPolyObject());

                    sCanvas.updateSoundObjectsLayerMap();

                    sCanvas.automationPanel.commitMultiLineDrag();
                    
                    BlueUndoManager.setUndoManager("score");

                    BlueUndoManager.addEdit(moveEdit);

                } else if (dragMode == RESIZE_RIGHT) {
                    BlueUndoManager.setUndoManager("score");

                    SoundObjectView sObjView = sCanvas.mBuffer.motionBuffer[0];

                    BlueUndoManager.addEdit(new ResizeSoundObjectEdit(sObjView
                            .getSoundObject(), initialDuration, sObjView
                            .getSubjectiveDuration()));
                    
                    sCanvas.automationPanel.endScoreScale();
                } else if (dragMode == RESIZE_LEFT) {
//                    TODO: FIX THIS
//                    BlueUndoManager.setUndoManager("score");
//
//                    SoundObjectView sObjView = sCanvas.mBuffer.motionBuffer[0];
//
//                    BlueUndoManager.addEdit(new ResizeSoundObjectEdit(sObjView
//                            .getSoundObject(), initialDuration, sObjView
//                            .getSubjectiveDuration()));
                    sCanvas.automationPanel.endScoreScale();
                }
            } else if (sCanvas.marquee.isVisible()) {
                endMarquee();
            }
            // clearMarquee();
            sCanvas.repaint();
        }
    }

    public void mouseDragged(MouseEvent e) {
        if (sCanvas.mBuffer.size() != 0 && !isPopupOpen && !justSelected) {
            if (dragMode == MOVE) {
                if (dragStart && SwingUtilities.isLeftMouseButton(e)) {
                    if((e.getModifiers() & OS_CTRL_KEY) == OS_CTRL_KEY) {
                        duplicateSoundObjectsInPlace();
                    } else {
                        setSelectionDragRegions();
                    }
                }
                moveSoundObjects(e);

            } else if (dragMode == RESIZE_RIGHT && !isPopupOpen && !justSelected) { // maybe
                // should
                // rescale
                // all
                // soundobjects?
                resizeSoundObject(e);
                SoundObjectView sObjView = sCanvas.mBuffer.motionBuffer[0];
                sCanvas.automationPanel.setScoreScaleEnd(
                        sObjView.getX() + sObjView.getWidth());
            } else if (dragMode == RESIZE_LEFT && !isPopupOpen && !justSelected) { 
                resizeSoundObjectLeft(e);
                SoundObjectView sObjView = sCanvas.mBuffer.motionBuffer[0];
                sCanvas.automationPanel.setScoreScaleStart(sObjView.getX());
            }
        } else if (SwingUtilities.isLeftMouseButton(e) && !justSelected) {
            // updateMarquee(e);
            sCanvas.marquee.setDragPoint(e.getPoint());
        }
        checkScroll(e);
        sCanvas.checkSize();

        dragStart = false;
    }

    private void duplicateSoundObjectsInPlace() {
        PolyObject pObj = sCanvas.getPolyObject();

        SoundObject[] soundObjects = sCanvas.mBuffer.getSoundObjectsAsArray();

        AddSoundObjectEdit top = null;

        for (int i = 0; i < soundObjects.length; i++) {
            SoundObject sObj = soundObjects[i];
            SoundObject temp = (SoundObject) ObjectUtilities.clone(sObj);

            int index = pObj.getSoundLayerIndex(sObj);

            if (index < 0) {
                System.err.println("ERROR: ScoreMouseProcessor."
                        + "duplicateSoundObjectsInPlace");
                return;
            }

            ((SoundLayer) pObj.getElementAt(index)).addSoundObject(temp);

            AddSoundObjectEdit edit = new AddSoundObjectEdit(pObj, temp, index);

            if (top == null) {
                top = edit;
            } else {
                top.addSubEdit(edit);
            }
        }

        BlueUndoManager.setUndoManager("score");
        BlueUndoManager.addEdit(top);
    }

    public void mouseMoved(MouseEvent e) {
        Component comp = sCanvas.getSoundObjectPanel().getComponentAt(
                e.getPoint());
        if (comp instanceof SoundObjectView) {
            if (e.getX() > (comp.getX() + comp.getWidth() - EDGE)) {
                sCanvas.setCursor(RIGHT_RESIZE_CURSOR);
                dragMode = RESIZE_RIGHT;
            } else if (e.getX() < (comp.getX() + EDGE)) {
                sCanvas.setCursor(LEFT_RESIZE_CURSOR);
                dragMode = RESIZE_LEFT;
            } else {
                sCanvas.setCursor(NORMAL_CURSOR);
                dragMode = MOVE;
            }
        } else {
            sCanvas.setCursor(NORMAL_CURSOR);
            dragMode = MOVE;
        }
    }

    public void mouseExited(MouseEvent e) {
    }

    public void mouseEntered(MouseEvent e) {
    }

    public void mouseClicked(MouseEvent e) {
    }

    // MOUSE PRESSED CODE

    private void clearBuffer(MouseEvent e) {
        fireSelectionEvent(new SelectionEvent(null,
                SelectionEvent.SELECTION_CLEAR));
        isPopupOpen = false;

        this.justSelected = false;
    }

    private void addBufferedSoundObject(SoundObjectView sObjView, MouseEvent e) {

        fireSelectionEvent(new SelectionEvent(sObjView,
                SelectionEvent.SELECTION_ADD));

        sCanvas.start = e.getPoint();
        sCanvas.mBuffer.motionBufferObjects();
        isPopupOpen = false;

        this.justSelected = true;
    }

    private void removeBufferedSoundObject(SoundObjectView sObjView,
            MouseEvent e) {
        fireSelectionEvent(new SelectionEvent(sObjView,
                SelectionEvent.SELECTION_REMOVE));

        sCanvas.start = e.getPoint();
        sCanvas.mBuffer.motionBufferObjects();
        isPopupOpen = false;

        this.justSelected = true;
    }

    private void setBufferedSoundObject(SoundObjectView sObjView, MouseEvent e) {

        fireSelectionEvent(new SelectionEvent(sObjView,
                SelectionEvent.SELECTION_SINGLE));

        sCanvas.start = e.getPoint();
        sCanvas.mBuffer.motionBufferObjects();
        isPopupOpen = false;

        this.justSelected = true;
    }

    private void editPolyObject(PolyObject pObj) {
        fireSelectionEvent(new SelectionEvent(null,
                SelectionEvent.SELECTION_CLEAR));

        PolyObjectBar.getInstance().addPolyObject(pObj);

        this.justSelected = true;
    }

    private void showPopup(Component comp, MouseEvent e) {
        if (comp instanceof SoundObjectView) {
            if (sCanvas.mBuffer.contains(comp)) {
                sCanvas.showSoundObjectPopup((SoundObjectView) comp, e.getX(),
                        e.getY());
            }
        } else if (e.getY() < sCanvas.pObj.getTotalHeight()) {
            sCanvas.showSoundLayerPopup(getSoundLayerIndex(e.getY()), e.getX(),
                    e.getY());
        }
        isPopupOpen = true;

        this.justSelected = true;
    }

    public void pasteSoundObject(int soundLayerIndex, int start) {
        PolyObject pObj = sCanvas.getPolyObject();
        int size = pObj.getSize();

        if (soundLayerIndex >= size) {
            return;
        }

        SoundObjectBuffer buffer = SoundObjectBuffer.getInstance();
        SoundObject sObj = buffer.getBufferedSoundObject();

        if (sObj != null) {

            if (sObj instanceof Instance) {
                Instance instance = (Instance) sObj;
//                if (!sCanvas.sGUI.soundObjectLibraryDialog
//                        .containsSoundObject(instance.getSoundObject())) {
//                    SoundObject clone = (SoundObject) instance.getSoundObject()
//                            .clone();
//                    instance.setSoundObject(clone);
//                    sCanvas.sGUI.soundObjectLibraryDialog.addSoundObject(clone);
//                }
            }

            float startTime = (float) start / pObj.getPixelSecond();
            sObj.setStartTime(startTime);

            pObj.addSoundObject(soundLayerIndex, sObj);

            BlueUndoManager.setUndoManager("score");
            BlueUndoManager.addEdit(new AddSoundObjectEdit(pObj, sObj,
                    soundLayerIndex));

        }
    }

    public void pasteSoundObjects(int soundLayerIndex, int start) {
        int size = sCanvas.getPolyObject().getSize();

        SoundObjectBuffer sObjBuffer = SoundObjectBuffer.getInstance();

        if (soundLayerIndex >= size || sObjBuffer.size() == 0) {
            return;
        }

        float insertTime = getTimeForX(start);

        int minLayer = getLayerMin(sObjBuffer);
        int maxLayer = getLayerMax(sObjBuffer);
        float bufferStart = getStartTime(sObjBuffer);

        int layerTranslation = soundLayerIndex - minLayer;
        float startTranslation = insertTime - bufferStart;

        if ((maxLayer + layerTranslation) > size - 1) {
            JOptionPane.showMessageDialog(null, "Not Enough Layers to Paste");
            return;
        }

        AddSoundObjectEdit undoEdit = null;

        for (int i = 0; i < sObjBuffer.size(); i++) {
            SoundObject sObj = (SoundObject) sObjBuffer.getSoundObject(i)
                    .clone();

            int newLayerIndex = getSoundLayerIndex(sObjBuffer.getY(i))
                    + layerTranslation;

            if (sObj instanceof Instance) {
                Instance instance = (Instance) sObj;
//                if (!sCanvas.sGUI.soundObjectLibraryDialog
//                        .containsSoundObject(instance.getSoundObject())) {
//                    SoundObject clone = (SoundObject) instance.getSoundObject()
//                            .clone();
//                    instance.setSoundObject(clone);
//                    sCanvas.sGUI.soundObjectLibraryDialog.addSoundObject(clone);
//                }
            }

            sObj.setStartTime(sObj.getStartTime() + startTranslation);

            sCanvas.getPolyObject().addSoundObject(newLayerIndex, sObj);

            AddSoundObjectEdit tempEdit = new AddSoundObjectEdit(sCanvas
                    .getPolyObject(), sObj, newLayerIndex);

            if (undoEdit == null) {
                undoEdit = tempEdit;
            } else {
                undoEdit.addSubEdit(tempEdit);
            }
        }

        BlueUndoManager.setUndoManager("score");
        BlueUndoManager.addEdit(undoEdit);

    }

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

    private void setSelectionDragRegions() {
        SoundObjectView[] sObjViews = sCanvas.mBuffer.motionBuffer;
        if(sObjViews == null) {
            return;
        }
        
        for (int i = 0; i < sObjViews.length; i++) {
            SoundObjectView sObjView = sObjViews[i];
            int startX = sObjView.getX();
            int endX = startX + sObjView.getWidth();
            
            int layerNum = sCanvas.pObj.getLayerNumForY(sObjView.getY());
            
            sCanvas.automationPanel.addSelectionDragRegion(startX, endX, layerNum);
        }
    }
    
    private void moveSoundObjects(MouseEvent e) {
        int xTranslation = e.getX() - sCanvas.start.x;

        int layerStart = sCanvas.pObj.getLayerNumForY(sCanvas.start.y);
        int newLayer = sCanvas.pObj.getLayerNumForY(e.getY());

        int yTranslation = -(layerStart - newLayer);

        // snap to layer

        int minLayer = sCanvas.pObj.getLayerNumForY(sCanvas.mBuffer.minY);
        int maxLayer = sCanvas.pObj.getLayerNumForY(sCanvas.mBuffer.maxY);

        if ((yTranslation + minLayer) < 0) {
            yTranslation = -minLayer;
        } else if ((yTranslation + maxLayer) >= sCanvas.pObj.getSize()) {
            yTranslation = sCanvas.pObj.getSize() - maxLayer - 1;
        }

        if (sCanvas.pObj.isSnapEnabled()) {
            int snapPixels = (int) (sCanvas.pObj.getSnapValue() * sCanvas.pObj
                    .getPixelSecond());
            int correction = sCanvas.mBuffer.point[0][0]
                    - Math.round((float) sCanvas.mBuffer.point[0][0]
                            / snapPixels) * snapPixels;

            xTranslation = (xTranslation / snapPixels) * snapPixels;
            xTranslation -= correction;
            // System.out.println("correction: " + correction + " : " +
            // "xTranslation: " + xTranslation);
        }

        if (xTranslation < -sCanvas.mBuffer.point[0][0]) {
            xTranslation = -sCanvas.mBuffer.point[0][0];
        }

        int newX, newY;
        
        sCanvas.automationPanel.setMultiLineTranslation(xTranslation);

        for (int i = 0; i < sCanvas.mBuffer.motionBuffer.length; i++) {
            newX = sCanvas.mBuffer.point[i][0] + xTranslation;

            int originalLayer = sCanvas.pObj
                    .getLayerNumForY(sCanvas.mBuffer.point[i][1]);

            newY = sCanvas.pObj.getYForLayerNum(originalLayer + yTranslation);

            float newStart = (float) newX / sCanvas.pObj.getPixelSecond();

            SoundObjectView sObjView = sCanvas.mBuffer.motionBuffer[i];
            sObjView.setLocation(sObjView.getX(), newY);

            sObjView.setSize(sObjView.getWidth(), sCanvas.pObj
                    .getSoundLayerHeight(originalLayer + yTranslation));

            SoundObject sObj = sObjView.getSoundObject();

            sObj.setStartTime(newStart);

        }

    }

    private void resizeSoundObject(MouseEvent e) {
        int newWidth = sCanvas.mBuffer.resizeWidth;
        int xVal = e.getX();

        newWidth += (xVal - sCanvas.start.x);

        if (sCanvas.pObj.isSnapEnabled()) {
            int snapPixels = (int) (sCanvas.pObj.getSnapValue() * sCanvas.pObj
                    .getPixelSecond());
            newWidth = (Math.round(xVal / (float) snapPixels) * snapPixels)
                    - sCanvas.mBuffer.point[0][0];
        }

        if (newWidth < EDGE) {
            newWidth = EDGE;
        }

        float newDuration = (float) newWidth / sCanvas.pObj.getPixelSecond();

        SoundObject sObj = sCanvas.mBuffer.motionBuffer[0].getSoundObject();

        sObj.setSubjectiveDuration(newDuration);
    }
    
    private void resizeSoundObjectLeft(MouseEvent e) {
//        int newWidth = sCanvas.mBuffer.resizeWidth;
        int newX = e.getX();
        int endX = (int)(initialEndTime * sCanvas.pObj.getPixelSecond());
        
//        newWidth += (xVal - sCanvas.start.x);

        if (sCanvas.pObj.isSnapEnabled()) {
            int snapPixels = (int) (sCanvas.pObj.getSnapValue() * sCanvas.pObj
                    .getPixelSecond());
            newX = (Math.round(newX / (float) snapPixels) * snapPixels);
        }
        
        if (newX < 0) {
            newX = 0;
        }
                
        if (newX > endX - EDGE) {
            newX = endX - EDGE;
        }
        
        float newStart = (float) newX / sCanvas.pObj.getPixelSecond();
               

        float newDuration = initialEndTime - newStart;

        SoundObject sObj = sCanvas.mBuffer.motionBuffer[0].getSoundObject();

        sObj.setStartTime(newStart);
        sObj.setSubjectiveDuration(newDuration);
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
        sCanvas.marquee.setStart(point);
        sCanvas.marquee.setVisible(true);
    }

    public void endMarquee() {
        sCanvas.marquee.setVisible(false);

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

        sCanvas.marquee.setSize(1, 1);
        sCanvas.marquee.setLocation(-1, -1);
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
        if(listeners != null && listeners.size() > 0) {
            for (Iterator<SelectionListener> iter = listeners.iterator(); iter.hasNext();) {
                SelectionListener listener = iter.next();

                if(listener != null) {
                    listener.selectionPerformed(se);
                }
            }
        }
    }

    public void addSelectionListener(SelectionListener sl) {
        listeners.add(sl);
    }

    public void removeSelectionListener(SelectionListener sl) {
        listeners.remove(sl);
    }

}