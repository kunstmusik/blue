/*
 * Created on May 8, 2003
 *
 */
package blue.ui.core.score.layers.soundObject;

import blue.BlueData;
import blue.BlueSystem;
import blue.SoundLayer;
import blue.SoundObjectLibrary;
import blue.projects.BlueProjectManager;
import blue.score.TimeState;
import blue.soundObject.Instance;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.ModeManager;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.undo.AddSoundObjectEdit;
import blue.ui.utilities.UiUtilities;
import blue.undo.BlueUndoManager;
import blue.utility.ObjectUtilities;
import blue.utility.ScoreUtilities;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import javax.swing.JOptionPane;
import javax.swing.JViewport;
import javax.swing.SwingUtilities;
import org.openide.util.Utilities;
import org.openide.util.lookup.InstanceContent;
import org.openide.windows.WindowManager;

/**
 * ScoreMouseProcessor handles mouse actions for ScoreTimeCanvas
 *
 * TODO - clean up, looking at
 * blue.soundObject.editor.pianoRoll.NoteCanvasMouseListener
 *
 */
class ScoreMouseProcessor extends MouseAdapter {

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
    private ScoreTimeCanvas sCanvas;
    private boolean justSelected = false;
    boolean isPopupOpen = false;
    private Rectangle scrollRect = new Rectangle(0, 0, 1, 1);
    private float initialDuration;
    private float initialEndTime;
    TimeState timeState = null;
    private final InstanceContent content;

    public ScoreMouseProcessor(ScoreTimeCanvas sCanvas, InstanceContent ic) {
        this.sCanvas = sCanvas;
        this.content = ic;
    }

    public void setTimeState(TimeState timeState) {
        this.timeState = timeState;
    }

    @Override
    public void mousePressed(MouseEvent e) {

        if (!isScoreMode()) {
            return;
        }

        dragStart = true;

        boolean shouldConsume = true;

        sCanvas.requestFocus();

        Component comp = sCanvas.getSoundObjectPanel().getComponentAt(
                e.getPoint());

        Collection<? extends SoundObject> selectedSoundObjects
                = Utilities.actionsGlobalContext().lookupAll(SoundObject.class);

        SoundObjectView sObjView;

        if (UiUtilities.isRightMouseButton(e)) {
            showPopup(comp, e);
        } else if (SwingUtilities.isLeftMouseButton(e)) {
            if (comp instanceof SoundObjectView) {
                sObjView = (SoundObjectView) comp;

                if (dragMode == RESIZE_RIGHT) {
                    content.set(Collections.singleton(sObjView.getSoundObject()),
                            null);
                    this.justSelected = false;
                    this.initialDuration = sObjView.getSubjectiveDuration();
                    sCanvas.automationPanel.initiateScoreScale(
                            sObjView.getStartTime(),
                            sObjView.getStartTime() + sObjView.getSubjectiveDuration(),
                            getSoundLayerIndex(sObjView.getY()));
                } else if (dragMode == RESIZE_LEFT) {
                    content.set(Collections.singleton(sObjView.getStartTime()),
                            null);
                    this.justSelected = false;
                    this.initialEndTime = sObjView.getStartTime() + sObjView.getSubjectiveDuration();
                    sCanvas.automationPanel.initiateScoreScale(
                            sObjView.getStartTime(),
                            sObjView.getStartTime() + sObjView.getSubjectiveDuration(),
                            getSoundLayerIndex(sObjView.getY()));
                } else {
                    if (e.isShiftDown()) {
                        // FIXME - figure out movement system
//                        if (sCanvas.mBuffer.contains(sObjView)) {
//                            removeBufferedSoundObject(sObjView, e);
//                        } else {
//                            addBufferedSoundObject(sObjView, e);
//                        }
                    } else if (selectedSoundObjects.contains(
                            sObjView.getSoundObject())) {
                        if (e.getClickCount() >= 2) {
                            if ((sObjView.getSoundObject() instanceof PolyObject)) {
                                PolyObject pObj = (PolyObject) (sObjView
                                        .getSoundObject());
                                editPolyObject(pObj);
                            } else {
                                if (selectedSoundObjects.size() == 1) {
                                    ScoreObjectEditorTopComponent editor
                                            = (ScoreObjectEditorTopComponent) WindowManager
                                            .getDefault()
                                            .findTopComponent(
                                                    "ScoreObjectEditorTopComponent");

                                    if (!editor.isOpened()) {
                                        editor.open();
                                    }

                                    editor.requestActive();

                                }
                            }
                        } else {
                            sCanvas.start = e.getPoint();
                            // FIXME
//                            sCanvas.mBuffer.motionBufferObjects();
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
                            content.set(Collections.singleton(
                                    sObjView.getSoundObject()), null);
                        }
                    }
                }
            } else if (e.isShiftDown()) {
                content.set(Collections.emptyList(), null);

                int soundLayerIndex = getSoundLayerIndex(e.getY());
                float start = getTimeForX(e.getX());

                if (timeState.isSnapEnabled()) {
                    start = ScoreUtilities.getSnapValueStart(start,
                            timeState.getSnapValue());
                }

                pasteSoundObject(soundLayerIndex, start);
                this.justSelected = true;
            } else if ((e.getModifiers() & OS_CTRL_KEY) == OS_CTRL_KEY) {
                int soundLayerIndex = getSoundLayerIndex(e.getY());
                float start = getTimeForX(e.getX());

                if (timeState.isSnapEnabled()) {
                    start = ScoreUtilities.getSnapValueStart(start,
                            timeState.getSnapValue());
                }

                pasteSoundObjects(soundLayerIndex, start);
                this.justSelected = true;
            } else if (e.getClickCount() >= 2) {
                int soundLayerIndex = getSoundLayerIndex(e.getY());

                selectLayer(soundLayerIndex);

            } else {
                clearBuffer(e);
                shouldConsume = false;
            }
        }

        if (shouldConsume) {
            e.consume();
        }
    }

    @Override
    public void mouseReleased(MouseEvent e) {

        if (!isScoreMode()) {
            return;
        }

        boolean shouldConsume = true;

        Collection<? extends SoundObject> selectedSoundObjects
                = Utilities.actionsGlobalContext().lookupAll(SoundObject.class);

        if (SwingUtilities.isLeftMouseButton(e)) {
            //FIXME
//            if (sCanvas.mBuffer.motionBuffer != null) {
            if (!selectedSoundObjects.isEmpty()) {
                if (dragMode == MOVE && !this.justSelected) {
//                    MoveSoundObjectsEdit moveEdit = sCanvas.mBuffer
//                            .getMoveEdit(sCanvas.getPolyObject());
//
//                    sCanvas.updateSoundObjectsLayerMap();
//
//                    sCanvas.automationPanel.commitMultiLineDrag();
//
//                    BlueUndoManager.setUndoManager("score");
//
//                    BlueUndoManager.addEdit(moveEdit);

                } else if (dragMode == RESIZE_RIGHT) {
                    // FIXME
//                    BlueUndoManager.setUndoManager("score");
//
//                    SoundObjectView sObjView = sCanvas.mBuffer.motionBuffer[0];
//
//                    BlueUndoManager.addEdit(new ResizeSoundObjectEdit(sObjView
//                            .getSoundObject(), initialDuration, sObjView
//                            .getSubjectiveDuration()));
//
//                    sCanvas.automationPanel.endScoreScale();
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
            } else {
                shouldConsume = false;
            }
//            else if (sCanvas.marquee.isVisible()) {
//                endMarquee();
//                e.consume();
//            }
            // clearMarquee();
            sCanvas.repaint();

            if (shouldConsume) {
                e.consume();
            }
        }
    }

    @Override
    // FIXME
    public void mouseDragged(MouseEvent e) {
//        if (!isScoreMode()) {
//            return;
//        }
//
//        boolean shouldConsume = true;
//
//        if (sCanvas.mBuffer.size() != 0 && !isPopupOpen && !justSelected) {
//            if (dragMode == MOVE) {
//                if (dragStart && SwingUtilities.isLeftMouseButton(e)) {
//                    if ((e.getModifiers() & OS_CTRL_KEY) == OS_CTRL_KEY) {
//                        duplicateSoundObjectsInPlace();
//                    } else {
//                        sCanvas.setSelectionDragRegions();
//                    }
//                }
//                moveSoundObjects(e);
//
//            } else if (dragMode == RESIZE_RIGHT && !isPopupOpen && !justSelected) { // maybe
//                // should
//                // rescale
//                // all
//                // soundobjects?
//                resizeSoundObject(e);
//                SoundObjectView sObjView = sCanvas.mBuffer.motionBuffer[0];
//                sCanvas.automationPanel.setScoreScaleEnd(
//                        sObjView.getStartTime() + sObjView.getSubjectiveDuration());
//            } else if (dragMode == RESIZE_LEFT && !isPopupOpen && !justSelected) {
//                resizeSoundObjectLeft(e);
//                SoundObjectView sObjView = sCanvas.mBuffer.motionBuffer[0];
//                sCanvas.automationPanel.setScoreScaleStart(
//                        sObjView.getStartTime());
//            }
//        } else if (SwingUtilities.isLeftMouseButton(e) && !justSelected) {
//            // updateMarquee(e);
//            //sCanvas.marquee.setDragPoint(e.getPoint());
//            shouldConsume = false;
//        }
//        checkScroll(e);
//        sCanvas.checkSize();
//
//        dragStart = false;
//
//        if (shouldConsume) {
//            e.consume();
//        }
    }

    private void duplicateSoundObjectsInPlace() {
        PolyObject pObj = sCanvas.getPolyObject();

        Collection<? extends SoundObject> selectedSoundObjects
                = Utilities.actionsGlobalContext().lookupAll(SoundObject.class);

        AddSoundObjectEdit top = null;

        for (SoundObject sObj : selectedSoundObjects) {
            SoundObject temp = (SoundObject) ObjectUtilities.clone(sObj);

            int index = pObj.getSoundLayerIndex(sObj);

            if (index < 0) {
                System.err.println("ERROR: ScoreMouseProcessor."
                        + "duplicateSoundObjectsInPlace");
                return;
            }

            pObj.get(index).add(temp);

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

    @Override
    public void mouseMoved(MouseEvent e) {

        if (!isScoreMode()) {
            return;
        }

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

    private boolean isScoreMode() {
        return ModeManager.getInstance().getMode() == ModeManager.MODE_SCORE;
    }

    // MOUSE PRESSED CODE
    private void clearBuffer(MouseEvent e) {
        content.set(Collections.emptyList(), null);
        isPopupOpen = false;

        this.justSelected = false;
    }

//    private void addBufferedSoundObject(SoundObjectView sObjView, MouseEvent e) {
//        
//        fireSelectionEvent(new SelectionEvent(sObjView,
//                SelectionEvent.SELECTION_ADD));
//        
//        sCanvas.start = e.getPoint();
//        sCanvas.mBuffer.motionBufferObjects();
//        isPopupOpen = false;
//        
//        this.justSelected = true;
//    }
//    
//    private void removeBufferedSoundObject(SoundObjectView sObjView,
//            MouseEvent e) {
//        fireSelectionEvent(new SelectionEvent(sObjView,
//                SelectionEvent.SELECTION_REMOVE));
//        
//        sCanvas.start = e.getPoint();
//        sCanvas.mBuffer.motionBufferObjects();
//        isPopupOpen = false;
//        
//        this.justSelected = true;
//    }
//    
//    private void setBufferedSoundObject(SoundObjectView sObjView, MouseEvent e) {
//        
//        fireSelectionEvent(new SelectionEvent(sObjView,
//                SelectionEvent.SELECTION_SINGLE));
//        
//        sCanvas.start = e.getPoint();
//        sCanvas.mBuffer.motionBufferObjects();
//        isPopupOpen = false;
//        
//        this.justSelected = true;
//    }
    private void editPolyObject(PolyObject pObj) {
        content.set(Collections.emptyList(), null);

        ScoreController.getInstance().editLayerGroup(pObj);
//        ScoreObjectBar.getInstance().addLayerGroup(pObj);

        this.justSelected = true;
    }

    private void showPopup(Component comp, MouseEvent e) {
        Collection<? extends SoundObject> soundObjects
                = Utilities.actionsGlobalContext().lookupAll(SoundObject.class);
        if (comp instanceof SoundObjectView) {
            if (soundObjects.contains(((SoundObjectView) comp).getSoundObject())) {
                sCanvas.showSoundObjectPopup((SoundObjectView) comp, e.getX(),
                        e.getY());
            }
        } else if (e.getY() < sCanvas.pObj.getTotalHeight()) {
//            sCanvas.showSoundLayerPopup(getSoundLayerIndex(e.getY()), e.getX(),
//                    e.getY());
        }
        isPopupOpen = true;

        this.justSelected = true;
    }

    public void pasteSoundObject(int soundLayerIndex, float startTime) {
        PolyObject pObj = sCanvas.getPolyObject();
        int size = pObj.size();

        if (soundLayerIndex >= size) {
            return;
        }

        SoundObjectBuffer buffer = SoundObjectBuffer.getInstance();
        SoundObject sObj = buffer.getBufferedSoundObject();

        if (sObj != null) {

            if (sObj instanceof Instance) {
                Instance instance = (Instance) sObj;

                BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();

                SoundObjectLibrary sObjLib = data.getSoundObjectLibrary();

                if (!sObjLib.contains(instance.getSoundObject())) {
                    SoundObject clone = (SoundObject) instance.getSoundObject().clone();
                    instance.setSoundObject(clone);
                    sObjLib.addSoundObject(clone);
                }

            }

            sObj.setStartTime(startTime);

            pObj.addSoundObject(soundLayerIndex, sObj);

            BlueUndoManager.setUndoManager("score");
            BlueUndoManager.addEdit(new AddSoundObjectEdit(pObj, sObj,
                    soundLayerIndex));

        }
    }

    public void pasteSoundObjects(int soundLayerIndex, float startTime) {
        int size = sCanvas.getPolyObject().size();

        SoundObjectBuffer sObjBuffer = SoundObjectBuffer.getInstance();

        if (soundLayerIndex >= size || sObjBuffer.size() == 0) {
            return;
        }

        int minLayer = getLayerMin(sObjBuffer);
        int maxLayer = getLayerMax(sObjBuffer);
        float bufferStart = getStartTime(sObjBuffer);

        int layerTranslation = soundLayerIndex - minLayer;
        float startTranslation = startTime - bufferStart;

        if ((maxLayer + layerTranslation) > size - 1) {
            JOptionPane.showMessageDialog(null, "Not Enough Layers to Paste");
            return;
        }

        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();

        SoundObjectLibrary sObjLib = data.getSoundObjectLibrary();
        AddSoundObjectEdit undoEdit = null;

        Set<Instance> instanceSoundObjects = new HashSet<Instance>();

        for (int i = 0; i < sObjBuffer.size(); i++) {
            SoundObject sObj = (SoundObject) sObjBuffer.getSoundObject(i)
                    .clone();

            int newLayerIndex = getSoundLayerIndex(sObjBuffer.getY(i))
                    + layerTranslation;

            if (sObj instanceof Instance) {
                instanceSoundObjects.add((Instance) sObj);
//                if (!sObjLib.contains(instance.getSoundObject())) {
//                    SoundObject clone = (SoundObject) instance.getSoundObject().clone();
//                    instance.setSoundObject(clone);
//                    sObjLib.addSoundObject(clone);
//                }
            } else if (sObj instanceof PolyObject) {
                PolyObject pObj = (PolyObject) sObj;
                getInstancesFromPolyObject(instanceSoundObjects, pObj);
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

        checkAndAddInstanceSoundObjects(sObjLib, instanceSoundObjects);

        BlueUndoManager.setUndoManager("score");
        BlueUndoManager.addEdit(undoEdit);

    }

    private float getTimeForX(int xValue) {
        return (float) xValue / timeState.getPixelSecond();
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
    private void moveSoundObjects(MouseEvent e) {
        // FIXME
//        int xTrans = e.getX() - sCanvas.start.x;
//
//        int layerStart = sCanvas.pObj.getLayerNumForY(sCanvas.start.y);
//        int newLayer = sCanvas.pObj.getLayerNumForY(e.getY());
//
//        int yTranslation = -(layerStart - newLayer);
//
//        // snap to layer
//
//        int minLayer = sCanvas.pObj.getLayerNumForY(sCanvas.mBuffer.minY);
//        int maxLayer = sCanvas.pObj.getLayerNumForY(sCanvas.mBuffer.maxY);
//
//        if ((yTranslation + minLayer) < 0) {
//            yTranslation = -minLayer;
//        } else if ((yTranslation + maxLayer) >= sCanvas.pObj.getSize()) {
//            yTranslation = sCanvas.pObj.getSize() - maxLayer - 1;
//        }
//
//        float timeAdjust = (float) xTrans / timeState.getPixelSecond();
//
//        float initialStartTime = sCanvas.mBuffer.initialStartTimes[0];
//
//        if (timeAdjust < -initialStartTime) {
//            timeAdjust = -initialStartTime;
//        }
//
//        if (timeState.isSnapEnabled()) {
//
//
//            float tempStart = initialStartTime + timeAdjust;
//            float snappedStart = ScoreUtilities.getSnapValueMove(tempStart,
//                    timeState.getSnapValue());
//
//
//            timeAdjust = snappedStart - initialStartTime;
//
//        }
//
//
//
//        //FIXME - needs to use time instead of x value
//        sCanvas.automationPanel.setMultiLineTranslation(timeAdjust);
//
//        for (int i = 0; i < sCanvas.mBuffer.motionBuffer.length; i++) {
//
//
//            int originalLayer = sCanvas.pObj
//                    .getLayerNumForY(sCanvas.mBuffer.sObjYValues[i]);
//
//            int newY = sCanvas.pObj.getYForLayerNum(originalLayer + yTranslation);
//
//            SoundObjectView sObjView = sCanvas.mBuffer.motionBuffer[i];
//            SoundObject sObj = sObjView.getSoundObject();
//
//            float newStart = sCanvas.mBuffer.initialStartTimes[i] + timeAdjust;
//
//            sObjView.setLocation(sObjView.getX(), newY);
//
//            sObjView.setSize(sObjView.getWidth(), sCanvas.pObj
//                    .getSoundLayerHeight(originalLayer + yTranslation));
//
//            sObj.setStartTime(newStart);
//
//        }
    }

    private void resizeSoundObject(MouseEvent e) {
        //FIXME
//        int newWidth = sCanvas.mBuffer.resizeWidth;
//        int xVal = e.getX();
//
//        newWidth += (xVal - sCanvas.start.x);
//
//        float newDuration;
//
//        SoundObject sObj = sCanvas.mBuffer.motionBuffer[0].getSoundObject();
//
//        if (timeState.isSnapEnabled()) {
//            final float snapValue = timeState.getSnapValue();
//
//            float endTime = ScoreUtilities.getSnapValueMove(
//                    xVal / (float) timeState.getPixelSecond(), snapValue);
//
//            float minTime = ScoreUtilities.getSnapValueMove(
//                    sObj.getStartTime() + snapValue / 2, snapValue);
//
//            endTime = (endTime < minTime) ? minTime : endTime;
//
//            newDuration = endTime - sObj.getStartTime();
//
//        } else {
//            if (newWidth < EDGE) {
//                newWidth = EDGE;
//            }
//
//            newDuration = (float) newWidth / timeState.getPixelSecond();
//        }
//
//        sObj.setSubjectiveDuration(newDuration);
    }

    private void resizeSoundObjectLeft(MouseEvent e) {
        //FIXME
//        int newX = e.getX();
//        int endX = (int) (initialEndTime * timeState.getPixelSecond());
//
//
//        float newStart;
//
//        SoundObject sObj = sCanvas.mBuffer.motionBuffer[0].getSoundObject();
//
//
//        if (timeState.isSnapEnabled()) {
//            float snapValue = timeState.getSnapValue();
//            float endTime = sObj.getStartTime() + sObj.getSubjectiveDuration();
//
//            newStart = ScoreUtilities.getSnapValueMove(
//                    newX / (float) timeState.getPixelSecond(),
//                    snapValue);
//            newStart = (newStart < 0.0f) ? 0.0f : newStart;
//
//            if (newStart > endTime) {
//                newStart = ScoreUtilities.getSnapValueMove(
//                        endTime - snapValue / 2, snapValue);
//            }
//
//        } else {
//            if (newX < 0) {
//                newX = 0;
//            }
//
//            if (newX > endX - EDGE) {
//                newX = endX - EDGE;
//            }
//
//            newStart = (float) newX / timeState.getPixelSecond();
//        }
//
//
//        float newDuration = initialEndTime - newStart;
//
//
//        sObj.setStartTime(newStart);
//        sObj.setSubjectiveDuration(newDuration);
    }

    // MOUSE RELEASED CODE
    private void checkScroll(MouseEvent e) {

        Point temp = SwingUtilities.convertPoint(sCanvas, e.getPoint(), sCanvas
                .getParent().getParent().getParent());

        scrollRect.setLocation(temp);

        ((JViewport) sCanvas.getParent().getParent().getParent()).scrollRectToVisible(
                scrollRect);

    }

    private int getSoundLayerIndex(int y) {
        return sCanvas.pObj.getLayerNumForY(y);
    }

//    public void startMarquee(Point point) {
//        sCanvas.marquee.setStart(point);
//        sCanvas.marquee.setVisible(true);
//    }
//    
//    public void endMarquee() {
//        sCanvas.marquee.setVisible(false);
//        
//        Component[] comps = sCanvas.getSoundObjectPanel().getComponents();
//
//        content.set(Collections.emptyList(), null);
//                
//        for (int i = 0; i < comps.length; i++) {
//            if (!(comps[i] instanceof SoundObjectView)) {
//                continue;
//            }
//            
//            if (sCanvas.marquee.intersects((JComponent) comps[i])) {
//                SelectionEvent selectionEvent = new SelectionEvent(comps[i],
//                        SelectionEvent.SELECTION_ADD);
//                
//                fireSelectionEvent(selectionEvent);
//            }
//            
//        }
//        
//        sCanvas.marquee.setSize(1, 1);
//        sCanvas.marquee.setLocation(-1, -1);
//    }
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
            @Override
            public void run() {
                Component[] comps = sCanvas.getSoundObjectPanel()
                        .getComponents();

//                content.set(Collections.emptyList(), null);
                ArrayList<SoundObject> selected = new ArrayList<>();
                for (int i = 0; i < comps.length; i++) {
                    if (!(comps[i] instanceof SoundObjectView)) {
                        continue;
                    }

                    if (getSoundLayerIndex(comps[i].getY()) == index) {
                        selected.add(
                                ((SoundObjectView) comps[i]).getSoundObject());
                    }
                }
                content.set(selected, null);
            }
        });

    }

    public void selectAllBefore(final int value) {
        SwingUtilities.invokeLater(new Runnable() {
            @Override
            public void run() {
                Component[] comps = sCanvas.getSoundObjectPanel()
                        .getComponents();

//                content.set(Collections.emptyList(), null);
                ArrayList<SoundObject> selected = new ArrayList<>();
                for (int i = 0; i < comps.length; i++) {
                    Component comp = comps[i];

                    if (!(comp instanceof SoundObjectView)) {
                        continue;
                    }

                    if ((comp.getX() + comp.getWidth()) <= value) {
                        selected.add(
                                ((SoundObjectView) comps[i]).getSoundObject());
                    }

                }
                content.set(selected, null);
            }
        });
    }

    public void selectAllAfter(final int value) {
        SwingUtilities.invokeLater(new Runnable() {
            @Override
            public void run() {
                Component[] comps = sCanvas.getSoundObjectPanel()
                        .getComponents();

//                content.set(Collections.emptyList(), null);
                ArrayList<SoundObject> selected = new ArrayList<>();

                for (int i = 0; i < comps.length; i++) {
                    Component comp = comps[i];

                    if (!(comp instanceof SoundObjectView)) {
                        continue;
                    }

                    if (comp.getX() >= value) {
                        selected.add(
                                ((SoundObjectView) comps[i]).getSoundObject());
                    }

                }
                content.set(selected, null);
            }
        });
    }

    private void getInstancesFromPolyObject(Set<Instance> instanceSoundObjects, PolyObject pObj) {
        for (SoundLayer layer : pObj) {
            for (SoundObject sObj : layer) {
                if (sObj instanceof Instance) {
                    Instance instance = (Instance) sObj;
                    instanceSoundObjects.add(instance);
                } else if (sObj instanceof PolyObject) {
                    getInstancesFromPolyObject(instanceSoundObjects,
                            (PolyObject) sObj);
                }
            }
        }
    }

    private void checkAndAddInstanceSoundObjects(SoundObjectLibrary sObjLib, Set<Instance> instanceSoundObjects) {
        Map<SoundObject, SoundObject> originalToCopyMap = new HashMap<SoundObject, SoundObject>();

        for (Instance instance : instanceSoundObjects) {
            final SoundObject instanceSObj = instance.getSoundObject();
            if (!sObjLib.contains(instanceSObj)) {
                SoundObject copy;

                if (originalToCopyMap.containsKey(instanceSObj)) {
                    copy = originalToCopyMap.get(instanceSObj);
                } else {
                    copy = (SoundObject) instance.getSoundObject().clone();
                    sObjLib.addSoundObject(copy);
                    originalToCopyMap.put(instanceSObj, copy);
                }

                instance.setSoundObject(copy);
            }
        }
    }
}
