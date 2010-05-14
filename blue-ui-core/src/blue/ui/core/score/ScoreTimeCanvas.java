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
package blue.ui.core.score;

import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.ActionEvent;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.HashMap;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JLayeredPane;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JViewport;
import javax.swing.KeyStroke;
import javax.swing.Scrollable;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;
import javax.swing.ToolTipManager;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;

import blue.BlueData;
import blue.BlueSystem;
import blue.SoundLayer;
import blue.SoundLayerListener;
import blue.components.AlphaMarquee;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.settings.PlaybackSettings;
import blue.ui.core.render.RenderTimeManager;
import blue.ui.core.score.undo.AddSoundObjectEdit;
import blue.ui.core.score.undo.RemoveSoundObjectEdit;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.undo.BlueUndoManager;
import blue.utility.ObjectUtilities;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */
public final class ScoreTimeCanvas extends JLayeredPane implements Scrollable,
        PropertyChangeListener, ListDataListener, SoundLayerListener {

    private static final MessageFormat toolTipFormat = new MessageFormat(
            "<html><b>Name:</b> {0}<br>" + "<b>Type:</b> {1}<br>" + "<b>Start Time:</b> {2}<br>" + "<b>Duration:</b> {3}<br>" + "<b>End Time:</b> {4}</html>");

    private static int NUDGE_HORIZONTAL = 0;

    private static int NUDGE_VERTICAL = 1;

    protected ScoreTimeCanvasController controller = new ScoreTimeCanvasController(
            this);

    protected ScoreActions actions = new ScoreActions(controller);

    private final SoundLayerPopup sLayerPopup = new SoundLayerPopup();

    private final SoundObjectPopup sObjPopup;

    private final QuickTimeDialog qtDialog;

    private final HashMap<SoundObject, SoundObjectView> soundObjectToViewMap =
            new HashMap<SoundObject, SoundObjectView>();

    int time;

    PolyObject pObj;

    public final SoundObjectBuffer buffer;

    // TODO - Make private and eventually remove need to store reference
//    ScoreGUI sGUI;
    AlphaMarquee marquee = new AlphaMarquee();

    TimePointer renderStartPointer = new TimePointer(Color.GREEN);

    TimePointer renderLoopPointer = new TimePointer(Color.YELLOW);

    TimePointer renderTimePointer = new TimePointer(Color.ORANGE);

    float renderStart = -1.0f;

    float timePointer = -1.0f;

    MotionBuffer mBuffer = MotionBuffer.getInstance();

    Point start = new Point(0, 0);

    Point end;

    ScoreMouseProcessor sMouse;

    MultiLineMouseProcessor multiLineMouse;

    AutomationLayerPanel automationPanel = new AutomationLayerPanel(marquee);

    JPanel sObjPanel = new JPanel();

    private final PropertyChangeListener heightListener;

    public ScoreTimeCanvas() {
        qtDialog = new QuickTimeDialog(this);
        sObjPopup = new SoundObjectPopup(this);

        this.buffer = SoundObjectBuffer.getInstance();
//        this.sGUI = sGUI;

        heightListener = new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                reset();
            }
        };

        sObjPanel.setLayout(null);

        time = 3;

        sMouse = new ScoreMouseProcessor(this);

        multiLineMouse = new MultiLineMouseProcessor(this);

        ModeManager.getInstance().addModeListener(new ModeListener() {

            public void modeChanged(int mode) {
                marquee.setVisible(false);

                sMouse.fireSelectionEvent(new SelectionEvent(null,
                        SelectionEvent.SELECTION_CLEAR));

                if (mode == ModeManager.MODE_SCORE) {
                    addMouseListener(sMouse);
                    addMouseMotionListener(sMouse);
                    removeMouseListener(multiLineMouse);
                    removeMouseMotionListener(multiLineMouse);
                } else if (mode == ModeManager.MODE_MULTI_LINE) {
                    removeMouseListener(sMouse);
                    removeMouseMotionListener(sMouse);
                    addMouseListener(multiLineMouse);
                    addMouseMotionListener(multiLineMouse);
                } else {
                    removeMouseListener(sMouse);
                    removeMouseMotionListener(sMouse);
                    removeMouseListener(multiLineMouse);
                    removeMouseMotionListener(multiLineMouse);
                }
            }
        });

        sMouse.addSelectionListener(mBuffer);
        multiLineMouse.addSelectionListener(mBuffer);

        initActions();

        sObjPanel.setOpaque(false);

        this.add(automationPanel, MODAL_LAYER);
        this.add(sObjPanel, DEFAULT_LAYER);
        this.add(marquee, JLayeredPane.DRAG_LAYER);

        this.addComponentListener(new ComponentAdapter() {

            public void componentResized(ComponentEvent e) {
                Dimension size = getSize();
                automationPanel.setSize(size);
                sObjPanel.setSize(size);
            }
        });

        // this.setAutoscrolls(false);
//        this.setOpaque(true);
//        this.setDoubleBuffered(true);

        new ScoreTimelineDropTargetListener(this);

        ToolTipManager.sharedInstance().registerComponent(this);

        this.setFocusable(true);

        RenderTimeManager renderTimeManager = RenderTimeManager.getInstance();
        renderTimeManager.addPropertyChangeListener(this);

    }

    public JPanel getSoundObjectPanel() {
        return sObjPanel;
    }

    public String getToolTipText(MouseEvent e) {

        String tip = null;

        Object obj = this.getComponentAt(e.getPoint());
        if (obj instanceof SoundObjectView) {
            SoundObject sObj = ((SoundObjectView) obj).getSoundObject();

            float subjectiveDuration = sObj.getSubjectiveDuration();
            float startTime = sObj.getStartTime();

            Object[] args = {sObj.getName(),
                ObjectUtilities.getShortClassName(sObj),
                new Float(startTime), new Float(subjectiveDuration),
                new Float(startTime + subjectiveDuration)};

            tip = toolTipFormat.format(args);
        }

        return tip;
    }

    private void initActions() {
        InputMap inputMap = this.getInputMap(WHEN_FOCUSED);
        ActionMap actionMap = this.getActionMap();
        
        final int osCtrlKey = BlueSystem.getMenuShortcutKey();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_X, osCtrlKey), "cutSoundObjects");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_C, osCtrlKey), "copySoundObjects");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_DELETE, 0),
                "deleteSoundObjects");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_BACK_SPACE, 0),
                "deleteSoundObjects");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_T, osCtrlKey), "showQuickTimeDialog");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_D, osCtrlKey), "duplicateSoundObjects");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_R, osCtrlKey), "repeatSoundObjects");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_UP, 0), "nudgeUp");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_DOWN, 0), "nudgeDown");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_UP,
                KeyEvent.SHIFT_DOWN_MASK), "nudgeUp");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_DOWN,
                KeyEvent.SHIFT_DOWN_MASK), "nudgeDown");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_LEFT, 0), "nudgeLeft");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_RIGHT, 0), "nudgeRight");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_LEFT,
                KeyEvent.SHIFT_DOWN_MASK), "nudgeLeft10");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_RIGHT,
                KeyEvent.SHIFT_DOWN_MASK), "nudgeRight10");

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_RIGHT, osCtrlKey), "raisePixelSecond");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_LEFT, osCtrlKey), "lowerPixelSecond");

        // Extra set of shortcuts in case the others interfere with window
        // manager
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_EQUALS, osCtrlKey), "raisePixelSecond");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_MINUS, osCtrlKey), "lowerPixelSecond");

        actionMap.put("cutSoundObjects", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (mBuffer.size() > 0) {
                    sObjPopup.copySObj();
                    sObjPopup.removeSObj();
                }
            }
        });

        actionMap.put("copySoundObjects", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (mBuffer.size() > 0) {
                    sObjPopup.copySObj();
                }
            }
        });

        actionMap.put("deleteSoundObjects", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (mBuffer.size() > 0) {
                    removeSoundObjects();
                }
            }
        });

        actionMap.put("duplicateSoundObjects", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (mBuffer.size() > 0) {
                    SoundObject[] sObjects = mBuffer.getSoundObjectsAsArray();

                    AddSoundObjectEdit top = null;

                    for (int i = 0; i < sObjects.length; i++) {
                        SoundObject sObj = sObjects[i];
                        SoundObject temp = (SoundObject) ObjectUtilities.clone(sObj);
                        temp.setStartTime(temp.getStartTime() + temp.getSubjectiveDuration());

                        int index = getPolyObject().getSoundLayerIndex(sObj);

                        if (index < 0) {
                            JOptionPane.showMessageDialog(
                                    SwingUtilities.getRoot(ScoreTimeCanvas.this),
                                    "Could not find SoundLayer for SoundObject",
                                    "Error", JOptionPane.ERROR_MESSAGE);
                            return;
                        }

                        ((SoundLayer) getPolyObject().getElementAt(index)).addSoundObject(temp);

                        AddSoundObjectEdit edit = new AddSoundObjectEdit(getPolyObject(), temp,
                                index);

                        if (top == null) {
                            top = edit;
                        } else {
                            top.addSubEdit(edit);
                        }
                    }

                    BlueUndoManager.setUndoManager("score");
                    BlueUndoManager.addEdit(top);

                }
            }
        });

        actionMap.put("repeatSoundObjects", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (mBuffer.size() > 0) {

                    Object retVal = JOptionPane.showInputDialog(SwingUtilities.getRoot(ScoreTimeCanvas.this),
                            "Enter number of times to repeat:", new Integer(1));

                    if (retVal == null) {
                        return;
                    }

                    int count = -1;

                    try {
                        count = Integer.parseInt((String) retVal);
                    } catch (Exception exception) {
                        JOptionPane.showMessageDialog(SwingUtilities.getRoot(ScoreTimeCanvas.this),
                                "Entry must be an integer value.", "Error",
                                JOptionPane.ERROR_MESSAGE);
                        return;
                    }

                    if (count < 1) {
                        JOptionPane.showMessageDialog(SwingUtilities.getRoot(ScoreTimeCanvas.this),
                                "Value must be greater than 0.", "Error",
                                JOptionPane.ERROR_MESSAGE);
                        return;
                    }

                    SoundObject[] sObjects = mBuffer.getSoundObjectsAsArray();

                    AddSoundObjectEdit top = null;

                    for (int i = 0; i < sObjects.length; i++) {
                        SoundObject sObj = sObjects[i];

                        float start = sObj.getStartTime();

                        for (int j = 0; j < count; j++) {
                            SoundObject temp = (SoundObject) ObjectUtilities.clone(sObj);

                            start += sObj.getSubjectiveDuration();

                            temp.setStartTime(start);

                            int index = getPolyObject().getSoundLayerIndex(sObj);

                            if (index < 0) {
                                JOptionPane.showMessageDialog(
                                        SwingUtilities.getRoot(ScoreTimeCanvas.this),
                                        "Could not find SoundLayer for SoundObject",
                                        "Error",
                                        JOptionPane.ERROR_MESSAGE);
                                return;
                            }

                            ((SoundLayer) getPolyObject().getElementAt(index)).addSoundObject(temp);

                            AddSoundObjectEdit edit = new AddSoundObjectEdit(
                                    getPolyObject(), temp, index);

                            if (top == null) {
                                top = edit;
                            } else {
                                top.addSubEdit(edit);
                            }
                        }

                    }

                    BlueUndoManager.setUndoManager("score");
                    BlueUndoManager.addEdit(top);

                }
            }
        });

        actionMap.put("showQuickTimeDialog", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (mBuffer.size() > 0) {
                    qtDialog.show(mBuffer.get(0));
                }
            }
        });

        // NUDGE ACTIONS

        actionMap.put("nudgeUp", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                nudge(-1, NUDGE_VERTICAL);
            }
        });

        actionMap.put("nudgeDown", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                nudge(1, NUDGE_VERTICAL);
            }
        });

        actionMap.put("nudgeLeft", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                nudge(-1, NUDGE_HORIZONTAL);
            }
        });

        actionMap.put("nudgeRight", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                nudge(1, NUDGE_HORIZONTAL);
            }
        });

        actionMap.put("nudgeLeft10", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                nudge(-10, NUDGE_HORIZONTAL);
            }
        });

        actionMap.put("nudgeRight10", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                nudge(10, NUDGE_HORIZONTAL);
            }
        });

        // ZOOM ACTIONS

        actionMap.put("raisePixelSecond", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
//                sGUI.timePixel.raisePixelSecond();
            }
        });

        actionMap.put("lowerPixelSecond", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
//                sGUI.timePixel.lowerPixelSecond();
            }
        });

    }

    // TODO - Respect snap values, Make Undoable
    private void nudge(int amount, int direction) {

        if (mBuffer.size() == 0) {
            return;
        }

        mBuffer.motionBufferObjects();

        if (direction == NUDGE_HORIZONTAL) {
            if (amount < 0) {
                if (mBuffer.point[0][0] < -amount) {
                    return;
                }
            }

            for (int i = 0; i < mBuffer.motionBuffer.length; i++) {
                int newX = mBuffer.point[i][0] + amount;

                float newStart = (float) newX / getPolyObject().getPixelSecond();

                SoundObject sObj = mBuffer.motionBuffer[i].getSoundObject();

                sObj.setStartTime(newStart);
            }

            mBuffer.motionBufferObjects();

        } else if (direction == NUDGE_VERTICAL) {
            if (amount < 0) { // MOVE UP
                for (int i = 0; i < mBuffer.motionBuffer.length; i++) {
                    if (mBuffer.motionBuffer[i].getY() == 0) {
                        return;
                    }
                }

                for (int i = 0; i < mBuffer.motionBuffer.length; i++) {
                    SoundObjectView sObjView = mBuffer.motionBuffer[i];

                    SoundObject sObj = sObjView.getSoundObject();

                    mBuffer.remove(sObjView);

                    int currentIndex = getPolyObject().getLayerNumForY(sObjView.getY());
                    int newIndex = currentIndex - 1;

                    getPolyObject().removeSoundObject(sObj);
                    getPolyObject().addSoundObject(newIndex, sObj);

                    sObjView = soundObjectToViewMap.get(sObj);
                    sObjView.select();
                    mBuffer.add(sObjView);
                }

            } else if (amount > 0) { // MOVE DOWN

                int maxY = getPolyObject().getYForLayerNum(getPolyObject().getSize() - 1);

                for (int i = 0; i < mBuffer.motionBuffer.length; i++) {
                    if (mBuffer.motionBuffer[i].getY() == maxY) {
                        return;
                    }
                }

                for (int i = 0; i < mBuffer.motionBuffer.length; i++) {
                    SoundObjectView sObjView = mBuffer.motionBuffer[i];

                    mBuffer.remove(sObjView);

                    SoundObject sObj = sObjView.getSoundObject();

                    int currentIndex = getPolyObject().getLayerNumForY(sObjView.getY());
                    int newIndex = currentIndex + 1;

                    getPolyObject().removeSoundObject(sObj);
                    getPolyObject().addSoundObject(newIndex, sObj);

                    sObjView = soundObjectToViewMap.get(sObj);
                    sObjView.select();
                    mBuffer.add(sObjView);
                }

            }

            mBuffer.motionBufferObjects();
        }

    }

    public void reset() {
        // setPObj(this.pObj);

        SwingUtilities.invokeLater(new Runnable() {

            public void run() {
                Component[] components = sObjPanel.getComponents();

                for (int i = 0; i < components.length; i++) {
                    Component c = components[i];

                    if (c instanceof SoundObjectView) {
                        SoundObjectView sObjView = (SoundObjectView) c;

                        int index = getPolyObject().getSoundLayerIndex(sObjView.getSoundObject());

                        if (index < 0) {
                            sObjView.cleanup();
                            sObjPanel.remove(c);
                            soundObjectToViewMap.remove(sObjView.getSoundObject());
                        } else {
                            int newY = getPolyObject().getYForLayerNum(index);
                            int newHeight = getPolyObject().getSoundLayerHeight(index);

                            sObjView.updateView(newY, newHeight);
                        }
                    }
                }

                if (getPolyObject().isRoot()) {
                    BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();

                    if (data != null) {

                        int startTime = (int) (data.getRenderStartTime() * getPolyObject().getPixelSecond());
                        int endTime = (int) (data.getRenderEndTime() * getPolyObject().getPixelSecond());

                        updateRenderStartPointerX(startTime, false);
                        updateRenderLoopPointerX(endTime);
                    }
                }

                checkSize();

                automationPanel.revalidate();

                revalidate();
                repaint();
            }
        });

    }

    public void setPObj(PolyObject pObj) {
        Component[] components = sObjPanel.getComponents();

        for (int i = 0; i < components.length; i++) {
            Component c = components[i];

            if (c instanceof SoundObjectView) {
                SoundObjectView sObjView = (SoundObjectView) c;
                sObjView.cleanup();
            }            
        }

        sObjPanel.removeAll();


        this.soundObjectToViewMap.clear();
        marquee.setVisible(false);

        if (this.getPolyObject() != null) {
            this.getPolyObject().removePropertyChangeListener(this);
            this.getPolyObject().removeListDataListener(this);

            SoundLayer tempLayer;

            for (int i = 0; i < pObj.getSize(); i++) {
                tempLayer = (SoundLayer) (pObj.getElementAt(i));
                tempLayer.removePropertyChangeListener(heightListener);
                tempLayer.removeSoundLayerListener(this);
            }
        }

        this.pObj = pObj;

        if (this.getPolyObject() != null) {
            pObj.addPropertyChangeListener(this);
            pObj.addListDataListener(this);
        }

        this.mBuffer.setPolyObject(pObj);
        this.automationPanel.setPolyObject(pObj);

        sMouse.fireSelectionEvent(new SelectionEvent(null,
                SelectionEvent.SELECTION_CLEAR));

        // TODO - REFACTOR THIS OUT TO POLY OBJECT CONTROLLER

        SoundLayer tempLayer;
        SoundObject tempSObj;
        ArrayList sObjects;

        int size = pObj.getSize();

        if (size != 0) {
            for (int i = 0; i < size; i++) {
                tempLayer = (SoundLayer) (pObj.getElementAt(i));
                tempLayer.addPropertyChangeListener(heightListener);
                tempLayer.addSoundLayerListener(this);

                sObjects = tempLayer.getSoundObjects();
                for (int j = 0; j < sObjects.size(); j++) {
                    tempSObj = (SoundObject) sObjects.get(j);
                    addSoundObjectView(i, tempSObj);
                }
            }
        } else {
            JOptionPane.showMessageDialog(null,
                    "ScoreTimeCanvas: setPObj found size == 0");
        }

        if (pObj.isRoot()) {
            
            BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
            BlueData data = null;
            
            if(project != null) {
                data = project.getData();
            }

            if (data != null) {

                int startTime = (int) (data.getRenderStartTime() * pObj.getPixelSecond());
                int endTime = (int) (data.getRenderEndTime() * pObj.getPixelSecond());

                this.add(renderStartPointer, DRAG_LAYER);
                this.add(renderLoopPointer, DRAG_LAYER);
                this.add(renderTimePointer, DRAG_LAYER);

                updateRenderStartPointerX(startTime, false);
                updateRenderLoopPointerX(endTime);
                updateRenderTimePointer();

            }
        } else {
            this.remove(renderStartPointer);
            this.remove(renderLoopPointer);
            this.remove(renderTimePointer);
        }

        this.checkSize();
        this.revalidate();
        this.repaint();
    }

    /**
     * checkSize is called when dragging an object
     */
    protected void checkSize() {
        if (getPolyObject() == null) {
            return;
        }

        int tempTime = (int) (getPolyObject().getMaxTime() / 60) + 2;
        int height = getPolyObject().getTotalHeight();

        int width = tempTime * getPolyObject().getPixelSecond() * 60;

        if (getParent() != null) {

            if (width < getParent().getWidth()) {
                width = getParent().getWidth();
            }

            time = tempTime;

            if (height < getParent().getHeight()) {
                height = getParent().getHeight();
            }

        }

        if (width == this.getWidth() && height == this.getHeight()) {
            return;
        }

        Dimension d = new Dimension(width, height);
        this.setSize(d);
        this.setPreferredSize(d);

//        sGUI.timeBar.setTimeView(time);
    }

    //
    /** ******************* */
    private void addSoundObjectView(int soundLayerIndex, SoundObject sObj) {
        SoundObjectView temp = new SoundObjectView(sObj, getPolyObject());
        sObjPanel.add(temp);
        temp.setLocation((int) (sObj.getStartTime() * getPolyObject().getPixelSecond()),
                getPolyObject().getYForLayerNum(soundLayerIndex));
        temp.setSize((int) (sObj.getSubjectiveDuration() * getPolyObject().getPixelSecond()), getPolyObject().getSoundLayerHeight(soundLayerIndex));

        // add to map of soundObjects and views
        // so that you can retrieve a view from a given soundObject
        this.soundObjectToViewMap.put(sObj, temp);

    }

    private void removeSoundObjectView(SoundObject sObj) {

        SoundObjectView sObjView = this.soundObjectToViewMap.remove(sObj);

        sObjView.cleanup();
        sObjPanel.remove(sObjView);

        sObjPanel.repaint(sObjView.getBounds());

    }

    public void updateSoundObjectViewLayerIndex(SoundObject sObj,
            int soundLayerIndex) {
        SoundObjectView sObjView = this.soundObjectToViewMap.get(sObj);
        sObjView.setLocation(sObjView.getX(), getPolyObject().getYForLayerNum(soundLayerIndex));
    }

    public SoundObjectView getViewForSoundObject(SoundObject sObj) {
        return this.soundObjectToViewMap.get(sObj);
    }

    /** ******************* */
    public void removeSoundObjects() {
        int size = mBuffer.size();
        SoundObjectView sObjView;
        RemoveSoundObjectEdit firstEdit = null;
        RemoveSoundObjectEdit lastEdit = null;
        RemoveSoundObjectEdit temp;

        for (int i = 0; i < size; i++) {
            sObjView = mBuffer.get(i);
            SoundObject sObj = sObjView.getSoundObject();

            int sLayerIndex = getPolyObject().removeSoundObject(sObj);

            if (firstEdit == null) {
                firstEdit = new RemoveSoundObjectEdit(getPolyObject(), sObj, sLayerIndex);
                lastEdit = firstEdit;
            } else {
                temp = new RemoveSoundObjectEdit(getPolyObject(), sObj, sLayerIndex);
                lastEdit.setNextEdit(temp);
                lastEdit = temp;
            }
        }

        if (firstEdit != null) {
            BlueUndoManager.setUndoManager("score");
            BlueUndoManager.addEdit(firstEdit);
        }

        sMouse.fireSelectionEvent(new SelectionEvent(null,
                SelectionEvent.SELECTION_CLEAR));

        repaint();
    }

    /* TODO - Remove this method and implement by events */
    public void updateSoundObjectsLayerMap() {
        int startIndex, endIndex;
        SoundObject sObj;
        for (int i = 0; i < mBuffer.motionBuffer.length; i++) {
            sObj = mBuffer.motionBuffer[i].getSoundObject();

            startIndex = getPolyObject().getLayerNumForY(mBuffer.point[i][1]);
            endIndex = getPolyObject().getLayerNumForY(mBuffer.motionBuffer[i].getY());

            if (startIndex != endIndex) {
                getPolyObject().removeSoundObject(sObj);
                getPolyObject().addSoundObject(endIndex, sObj);
            }

        }
    }

    /** *********************************** */
    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        int width = this.getWidth();

        g.setColor(Color.black);
        g.fillRect(0, 0, width, this.getHeight());

        if(getPolyObject() == null) {
            return;
        }

        int y = 0;
        g.setColor(Color.darkGray);

        for (int i = 0; i < getPolyObject().getSize(); i++) {
            SoundLayer layer = (SoundLayer) getPolyObject().getElementAt(i);
            y += layer.getSoundLayerHeight();
            g.drawLine(0, y, width, y);
        }

        if (getPolyObject().isSnapEnabled()) {
            int snapPixels = (int) (getPolyObject().getSnapValue() * getPolyObject().getPixelSecond());
            // System.out.println("snap: " + snapPixels + " : " +
            // pObj.getPixelSecond());
            int x;
            if (snapPixels <= 0) {
                return;
            }

            int height = getPolyObject().getTotalHeight();

            for (int i = 0; i < width / snapPixels; i++) {
                x = i * snapPixels;
                g.drawLine(x, 0, x, height);
            }
        }

        if (getPolyObject().isRoot()) {
            int newHeight = getPolyObject().getTotalHeight();

            if (renderStartPointer.getHeight() != newHeight) {
                renderStartPointer.setSize(1, newHeight);
                renderLoopPointer.setSize(1, newHeight);
                renderTimePointer.setSize(1, newHeight);
            }
        }
    }

    public void paintPreview(Graphics g) {
        synchronized (getTreeLock()) {

            Component[] components = getSoundObjectPanel().getComponents();

            g.setColor(Color.WHITE);

            Rectangle bounds = g.getClipBounds();

            for (int i = 0; i < components.length; i++) {
                SoundObjectView component = (SoundObjectView) components[i];
                Rectangle r = component.getBounds();

                g.translate(r.x, r.y);
                g.setClip(0, 0, r.width, r.height);

                component.getRenderer().render(g, component,
                        getPolyObject().getPixelSecond());

                g.translate(-r.x, -r.y);

            }

            g.setClip(bounds);
        }
    }

    public void update() {
        repaint();
    }
    /** ************************************************************** */
    // code for scrollable interface
    /** ************************************************************** */
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

    /*
     * Wrapper Methods for showing popups
     */
    protected void showSoundObjectPopup(SoundObjectView sObjView, int x, int y) {
        sObjPopup.show(sObjView, this, x, y);
    }

    protected void showSoundLayerPopup(int soundLayerIndex, int x, int y) {
        sLayerPopup.show(soundLayerIndex, this, x, y);
    }

    /**
     * 
     */
    public PolyObject getPolyObject() {
        return this.pObj;
    }

    // TODO - Reevaulate to see if this can't be done with a
    // PropertyChangeListener on BlueData
    public void updateRenderStartPointerX(int x, boolean fireUpdate) {

        boolean left = x < renderStartPointer.getX();

        renderStartPointer.setLocation(x, 0);

        if (fireUpdate) {
            JViewport viewPort = (JViewport) this.getParent();

            Rectangle rect;

            if (left) {
                rect = new Rectangle(x - 20,
                        viewPort.getViewPosition().y,
                        1,
                        1);
            } else {
                rect = new Rectangle(x + 20,
                        viewPort.getViewPosition().y,
                        1,
                        1);
            }

            scrollRectToVisible(rect);
        }
    }

    // TODO - Reevaulate to see if this can't be done with a
    // PropertyChangeListener on BlueData
    public void updateRenderLoopPointerX(int newX) {
        renderLoopPointer.setLocation(newX, 0);
    }

    private void updateRenderTimePointer() {
        if (!pObj.isRoot()) {
            return;
        }

        float latency = PlaybackSettings.getInstance().getPlaybackLatencyCorrection();

        if (renderStart < 0.0f || timePointer < latency) {
            renderTimePointer.setLocation(-1, 0);
        } else {
            int x = (int) ((renderStart + timePointer - latency) * getPolyObject().getPixelSecond());
            renderTimePointer.setLocation(x, 0);
        }
    }

    /* EVENT LISTENING METHODS */
    public void propertyChange(PropertyChangeEvent evt) {
        String prop = evt.getPropertyName();

        if (evt.getSource() == this.getPolyObject()) {
            if (prop.equals("pixelSecond")) {
                reset();
            } else if (prop.equals("snapEnabled") || prop.equals("snapValue")) {
                repaint();
            }
        } else if (evt.getSource() == RenderTimeManager.getInstance()) {
            if (getPolyObject() == RenderTimeManager.getInstance().getRootPolyObject()) {
                if (prop.equals(RenderTimeManager.RENDER_START)) {
                    this.renderStart = ((Float) evt.getNewValue()).floatValue();
                    this.timePointer = -1.0f;
                    updateRenderTimePointer();
                } else if (prop.equals(RenderTimeManager.TIME_POINTER)) {
                    this.timePointer = ((Float) evt.getNewValue()).floatValue();
                    updateRenderTimePointer();
                }
            } else {
                this.timePointer = -1.0f;
                updateRenderTimePointer();
            }
        }

    }

    /**
     * Adds a selection listener to the ScoreMouseProcessor
     * 
     * @param listener
     */
    public void addSelectionListener(SelectionListener listener) {
        sMouse.addSelectionListener(listener);
        multiLineMouse.addSelectionListener(listener);
    }

    /* LIST DATA LISTENER */
    public void intervalAdded(ListDataEvent e) {
        SoundLayer layer = (SoundLayer) getPolyObject().getElementAt(e.getIndex0());
        layer.addPropertyChangeListener(heightListener);
        layer.addSoundLayerListener(this);
        reset();
    }

    public void intervalRemoved(ListDataEvent e) {
        reset();
    }

    public void contentsChanged(ListDataEvent e) {
        reset();
    }

    /* SOUND LAYER LISTENER */
    public void soundObjectAdded(SoundLayer source, SoundObject sObj) {
        addSoundObjectView(getPolyObject().getLayerNum(source), sObj);
    }

    public void soundObjectRemoved(SoundLayer source, SoundObject sObj) {
        removeSoundObjectView(sObj);
    }

    public void modifyLayerHeight(int value, int y) {
        int index = getPolyObject().getLayerNumForY(y);

        if (index < 0 || index >= getPolyObject().getSize()) {
            return;
        }

        SoundLayer layer = (SoundLayer) getPolyObject().getElementAt(index);

        int hIndex = layer.getHeightIndex();

        if (value < 0 && hIndex < 1) {
            return;
        } else if (value > 0 && hIndex > SoundLayer.HEIGHT_MAX_INDEX - 1) {
            return;
        }

        layer.setHeightIndex(hIndex + value);
    }
}