/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.editor.blueSynthBuilder.swing;

import blue.BlueSystem;
import blue.components.AlphaMarquee;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBGroup;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.BSBObjectEntry;
import blue.orchestra.blueSynthBuilder.GridSettings;
import blue.orchestra.editor.blueSynthBuilder.EditModeConditional;
import blue.ui.utilities.UiUtilities;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.event.ActionEvent;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.ComponentListener;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import javafx.beans.InvalidationListener;
import javafx.beans.property.BooleanProperty;
import javafx.beans.value.ChangeListener;
import javafx.collections.FXCollections;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;
import javafx.collections.ObservableSet;
import javafx.collections.SetChangeListener;
import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JLayeredPane;
import javax.swing.KeyStroke;

/**
 * @author steven
 *
 */
public class BSBEditPanel extends JLayeredPane implements
        PropertyChangeListener, ListChangeListener<BSBGroup> {

    private static final Color GRID_COLOR
            = new Color(38, 51, 76, 128).brighter();

    protected static final BSBObjectEditPopup bsbObjPopup = new BSBObjectEditPopup();
    private final BSBEditPanelPopup popup;
    private BSBEditPanelNonEditPopup nonEditPopup;

    private BSBGraphicInterface bsbInterface = null;

    private final ObservableSet<BSBObject> selection;

    private static final List<BSBObject> copyBuffer = new ArrayList<>();
    private static int copyX, copyY;

    private final AlphaMarquee marquee = new AlphaMarquee();

    private final InvalidationListener gridListener;

    ComponentListener cl;
    private final SetChangeListener<BSBObject> scl;

    ObservableList<BSBGroup> groupsList = FXCollections.observableArrayList();

    BSBGroup currentBSBGroup = null;

    ChangeListener<Boolean> editEnabledListener = (obs, old, newVal) -> {
        if (newVal) {
            if (groupsList.size() > 1) {
                clearBSBObjects();
                setBSBObjects(currentBSBGroup.interfaceItemsProperty());
            }
        } else {
            if (groupsList.size() > 1) {
                clearBSBObjects();
                setBSBObjects(groupsList.get(0).interfaceItemsProperty());
            }
        }
        setEditing(newVal);
    };

    private final boolean allowEditing;

    public BSBEditPanel(BSBObjectEntry[] bsbObjectEntries) {
        this(bsbObjectEntries, true);
    }

    public BSBEditPanel(BSBObjectEntry[] bsbObjectEntries, boolean allowEditing) {

        this.selection = FXCollections.observableSet();
        this.allowEditing = allowEditing;

        popup = new BSBEditPanelPopup(bsbObjectEntries);

        cl = new ComponentAdapter() {
            @Override
            public void componentMoved(ComponentEvent e) {
                recalculateSize();

            }

            @Override
            public void componentResized(ComponentEvent e) {
                recalculateSize();
            }
        };

        this.setLayout(null);

        this.add(marquee, JLayeredPane.DRAG_LAYER);

        marquee.setVisible(false);

        this.addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                requestFocus();

                selection.clear();

                if (isEditing()) {
                    if (UiUtilities.isRightMouseButton(e)) {
                        popup.show(BSBEditPanel.this, e.getX(), e.getY());
                    } else if ((e.getModifiers() & BlueSystem.getMenuShortcutKey())
                            == BlueSystem.getMenuShortcutKey()
                            && copyBuffer.size() > 0) {
                        int itemX = e.getX();
                        int itemY = e.getY();
                        GridSettings gridSettings = bsbInterface.getGridSettings();

                        if (gridSettings.isSnapEnabled()) {
                            final int width = gridSettings.getWidth();
                            final int height = gridSettings.getHeight();

                            itemX = (int) Math.floor((float) itemX / width) * width;
                            itemY = (int) Math.floor((float) itemY / height) * height;
                        }

                        paste(itemX, itemY);
                    } else {
                        marquee.setVisible(true);
                        marquee.setStart(e.getPoint());
                    }
                } else {
                    if (UiUtilities.isRightMouseButton(e)) {
                        if (nonEditPopup == null) {
                            nonEditPopup = new BSBEditPanelNonEditPopup(
                                    BSBEditPanel.this);
                        }

                        nonEditPopup.show(BSBEditPanel.this, e.getX(), e.getY());
                    }
                }
            }

            @Override
            public void mouseReleased(MouseEvent e) {

                if (marquee.isVisible()) {

                    for (var c : getComponentsInLayer(DEFAULT_LAYER)) {
                        if (c instanceof BSBObjectViewHolder) {
                            var viewHolder = (BSBObjectViewHolder) c;
                            if (marquee.intersects(viewHolder)) {
                                selection.add(viewHolder.getBSBObjectView().getBSBObject());
                            }
                        }
                    }

                    marquee.setVisible(false);
                    marquee.setSize(1, 1);
                    marquee.setLocation(-1, -1);
                }
            }
        });

        this.addMouseMotionListener(new MouseMotionAdapter() {
            @Override
            public void mouseDragged(MouseEvent e) {
                if (isEditing() && marquee.isVisible()) {
                    marquee.setDragPoint(e.getPoint());
                }
            }
        });

        initActions();

        gridListener = cl -> {
            repaint();
        };

        scl = sce -> {
            if (sce.wasAdded()) {
                addBSBObject(sce.getElementAdded());
            } else {
                removeBSBObject(sce.getElementRemoved());
            }
        };

        groupsList.addListener(this);

    }

    private void initActions() {
        InputMap inputMap = this.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
        ActionMap actionMap = this.getActionMap();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_X,
                BlueSystem.getMenuShortcutKey()), "cut");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_C,
                BlueSystem.getMenuShortcutKey()), "copy");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_DELETE, 0), "delete");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_BACK_SPACE, 0), "delete");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_UP, 0), "up");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_UP,
                InputEvent.SHIFT_DOWN_MASK), "up10");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_DOWN, 0), "down");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_DOWN,
                InputEvent.SHIFT_DOWN_MASK), "down10");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_LEFT, 0), "left");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_LEFT,
                InputEvent.SHIFT_DOWN_MASK), "left10");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_RIGHT, 0), "right");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_RIGHT,
                InputEvent.SHIFT_DOWN_MASK), "right10");

        actionMap.put("cut", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    cut();
                }
            }
        });

        actionMap.put("copy", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    copy();
                }
            }
        });

        actionMap.put("delete", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    removeSelectedBSBObjects();
                }
            }
        });

        actionMap.put("up", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 1;
                    BSBNudgeUtils.nudgeVertical(selection, -val);
                }
            }
        });

        actionMap.put("up10", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 10;
                    BSBNudgeUtils.nudgeVertical(selection, -val);
                }
            }
        });

        actionMap.put("down", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 1;
                    BSBNudgeUtils.nudgeVertical(selection, val);
                }
            }
        });

        actionMap.put("down10", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 10;
                    BSBNudgeUtils.nudgeVertical(selection, val);
                }
            }
        });

        actionMap.put("left", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 1;
                    BSBNudgeUtils.nudgeHorizontal(selection, -val);
                }
            }
        });

        actionMap.put("left10", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 10;
                    BSBNudgeUtils.nudgeHorizontal(selection, -val);
                }
            }
        });

        actionMap.put("right", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 1;
                    BSBNudgeUtils.nudgeHorizontal(selection, val);
                }
            }
        });

        actionMap.put("right10", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 10;
                    BSBNudgeUtils.nudgeHorizontal(selection, val);
                }
            }
        });
    }

    /**
     *
     */
    protected void recalculateSize() {
        Dimension d = getPreferredSize();
        var size = getSize();

        if (Math.abs(d.width - size.width) > 10
                || Math.abs(d.height - size.height) > 10) {

            this.setSize(d);
            this.setPreferredSize(d);
        }

    }

    public boolean isEditing() {
        return (!allowEditing || bsbInterface == null)
                ? false
                : bsbInterface.isEditEnabled();
    }

    public void setEditing(boolean isEditing) {
        for (var c : this.getComponentsInLayer(JLayeredPane.DEFAULT_LAYER)) {
            var viewHolder = (BSBObjectViewHolder) c;
            viewHolder.setEditing(isEditing);
        }
        recalculateSize();
        revalidate();
        repaint();
    }

    public void editBSBGraphicInterface(BSBGraphicInterface bsbInterface) {

//      Commented out to fix issue with updating interface after setting preset
//      However, the whole code for updating from presets needs to be fixed
//      so that UI is only listening to changes from data model
//        if (this.bsbInterface == bsbInterface) {
//            return;
//        }
        if (this.bsbInterface != null) {
            GridSettings gridSettings = this.bsbInterface.getGridSettings();
            gridSettings.widthProperty().removeListener(gridListener);
            gridSettings.heightProperty().removeListener(gridListener);
            gridSettings.gridStyleProperty().removeListener(gridListener);

            this.bsbInterface.editEnabledProperty().removeListener(
                    editEnabledListener);
        }

        this.bsbInterface = null;

//        clearBSBObjects();
        if (bsbInterface != null) {
            GridSettings gridSettings = bsbInterface.getGridSettings();
            gridSettings.widthProperty().addListener(gridListener);
            gridSettings.heightProperty().addListener(gridListener);
            gridSettings.gridStyleProperty().addListener(gridListener);

            if (allowEditing) {
                bsbInterface.editEnabledProperty().addListener(
                        editEnabledListener);
            }
            this.bsbInterface = bsbInterface;

            groupsList.setAll(bsbInterface.getRootGroup());

            setEditing(isEditing());
        } else {
            groupsList.clear();
        }

        recalculateSize();

        revalidate();
        repaint();

    }

    public BSBGraphicInterface getBSBGraphicInterface() {
        return bsbInterface;
    }

    /**
     *
     */
    private void clearBSBObjects() {

//        for (var c : this.getComponentsInLayer(JLayeredPane.DEFAULT_LAYER)) {
//            var viewHolder = (BSBObjectViewHolder) c;
//
//            viewHolder.removeComponentListener(cl);
//            this.remove(c);
//        }
        for (var c : getComponents()) {
            if (c instanceof BSBObjectViewHolder) {
                var viewHolder = (BSBObjectViewHolder) c;

                viewHolder.removeComponentListener(cl);
            }

        }
        this.removeAll();
        this.add(marquee, JLayeredPane.DRAG_LAYER);
        marquee.setVisible(false);

//        for (BSBObjectViewHolder viewHolder : objectViews) {
//            viewHolder.removeSelectionListener(this);
//            viewHolder.setGroupMovementListener(null);
//            viewHolder.removeComponentListener(cl);
////            viewHolder.getBSBObjectView().cleanup();
//        }
//        objectViews.clear();
    }

    /**
     * Called when adding a new BSBObject or when pasting.
     *
     * @param bsbObj
     */
    private BSBObjectViewHolder addBSBObject(BSBObject bsbObj) {

        return addBSBObject(bsbObj, true);
    }

    public void addNewBSBObject(BSBObject bsbObj) {
        currentBSBGroup.interfaceItemsProperty().add(bsbObj);
    }

    private BSBObjectViewHolder addBSBObject(BSBObject bsbObj, boolean revalidate) {
        BSBObjectViewHolder viewHolder = getEditorForBSBObject(bsbObj);

        if (bsbObj instanceof BSBGroup) {
            this.add(viewHolder, JLayeredPane.DEFAULT_LAYER, 0);
        } else {
            this.add(viewHolder, JLayeredPane.DEFAULT_LAYER);
//            setComponentZOrder(viewHolder, 0);
        }

        if (revalidate) {
            revalidate();
            repaint();
        }

        return viewHolder;
    }

    protected void setBSBObjects(Collection<BSBObject> bsbObjects) {
        if (bsbInterface != null) {
            for (var bsbOj : bsbObjects) {
                addBSBObject(bsbOj, false);
            }
        }
        revalidate();
        repaint();
    }

    private BSBObjectViewHolder getEditorForBSBObject(BSBObject bsbObj) {
        BooleanProperty editEnabledProperty = allowEditing
                ? bsbInterface.editEnabledProperty() : null;

        BSBObjectView objectView = BSBObjectEditorFactory.getView(bsbObj);

        if (objectView instanceof EditModeConditional) {
            ((EditModeConditional) objectView).setEditEnabledProperty(editEnabledProperty);
        }

        BSBObjectViewHolder viewHolder
                = new BSBObjectViewHolder(editEnabledProperty,
                        selection, groupsList, bsbInterface.getGridSettings(), objectView);

//        if (objectView instanceof EditModeOnly) {
//            if (allowEditing) {
//                viewHolder.visibleProperty().bind(bsbInterface.editEnabledProperty());
//            } else {
//                viewHolder.setVisible(false);
//            }
//        }
//        if (bsbObj instanceof BSBGroup) {
//            BSBGroupPanel bsbGroupView = (BSBGroupPanel) objectView;
//            //bsbGroupPanel.initialize(editEnabledProperty, selection, groupsList);
//        }
        viewHolder.addComponentListener(cl);

        return viewHolder;
    }

    protected void removeBSBObject(BSBObject bsbObj) {
        BSBObjectViewHolder found = null;
        for (var c : getComponents()) {
            if (c instanceof BSBObjectViewHolder) {
                var vh = (BSBObjectViewHolder) c;
                if (vh.getBSBObjectView().getBSBObject() == bsbObj) {
                    found = vh;
                    break;
                }
            }
        }

        if (found != null) {
            remove(found);
        }
    }

    /* BUFFER METHODS */
    protected void cut() {
        if (selection.size() > 0) {
            copy();
            removeSelectedBSBObjects();
        }
    }

    protected void copy() {
        copyBuffer.clear();

        copyX = Integer.MAX_VALUE;
        copyY = Integer.MAX_VALUE;

        for (var bsbObj : selection) {
            copyBuffer.add(bsbObj.deepCopy());
            copyX = Math.min(copyX, bsbObj.getX());
            copyY = Math.min(copyY, bsbObj.getY());
        }
    }

    protected void paste(int x, int y) {
        int offSetX = x - copyX;
        int offSetY = y - copyY;

        selection.clear();

        for (BSBObject bsbObj : copyBuffer) {
            BSBObject clone = (BSBObject) bsbObj.deepCopy();

            clone.setX(clone.getX() + offSetX);
            clone.setY(clone.getY() + offSetY);

            groupsList.get(groupsList.size() - 1).addBSBObject(clone);

            selection.add(clone);
        }

    }

    /**
     *
     */
    public void removeSelectedBSBObjects() {

        for (BSBObject bsbObj : selection) {
            groupsList.get(groupsList.size() - 1).interfaceItemsProperty().remove(bsbObj);
        }

        selection.clear();

        repaint();
    }

    /**
     * @return
     */
    public boolean canPaste() {
        return (copyBuffer.size() > 0);
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (!"snapEnabled".equals(evt.getPropertyName())) {
            repaint();
        }
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);

        if (this.bsbInterface == null || !this.bsbInterface.isEditEnabled()) {
            return;
        }

        GridSettings gridSettings = bsbInterface.getGridSettings();

        g.setColor(GRID_COLOR);
        int w = gridSettings.getWidth();
        int h = gridSettings.getHeight();

        if (w < 1 || h < 1) {
            return;
        }

        int totalWidth = getWidth();
        int totalHeight = getHeight();

        switch (gridSettings.getGridStyle()) {
            case DOT:
                for (int x = 0; x < totalWidth; x += w) {
                    for (int y = 0; y < totalHeight; y += h) {
                        g.drawRect(x, y, 1, 1);
                    }
                }
                break;
            case LINE:
                for (int x = 0; x < totalWidth; x += w) {
                    g.drawLine(x, 0, x, totalHeight);
                }
                for (int y = 0; y < totalHeight; y += h) {
                    g.drawLine(0, y, totalWidth, y);
                }
                break;
        }

    }

    @Override
    public void onChanged(Change<? extends BSBGroup> change) {
        if (this.currentBSBGroup != null) {
            this.currentBSBGroup.interfaceItemsProperty().
                    removeListener(scl);
        }

        clearBSBObjects();

        if (groupsList.size() > 0) {
            this.currentBSBGroup = groupsList.get(groupsList.size() - 1);
            setBSBObjects(currentBSBGroup.interfaceItemsProperty());
            currentBSBGroup.interfaceItemsProperty().addListener(scl);
        } else {
            this.currentBSBGroup = null;
        }
        repaint();
    }

    public ObservableSet<BSBObject> getSelection() {
        return selection;
    }

    public List<BSBObjectViewHolder> getSelectedViews() {
        List<BSBObjectViewHolder> retVal = new ArrayList<>();

        for (var c : getComponents()) {
            if (c instanceof BSBObjectViewHolder) {
                var holder = (BSBObjectViewHolder) c;
                var bsbObjView = holder.getBSBObjectView();
                if (selection.contains(bsbObjView.getBSBObject())) {
                    retVal.add(holder);
                }
            }
        }
        return retVal;
    }

    public ObservableList<BSBGroup> getGroupsList() {
        return groupsList;
    }

    @Override
    public Dimension getPreferredSize() {
        if (bsbInterface == null) {
            return new Dimension(10, 10);
        }

        int maxW = 1;
        int maxH = 1;

        for (var c : getComponents()) {
            if (c instanceof BSBObjectViewHolder) {
                var viewHolder = (BSBObjectViewHolder) c;
                if (!isEditing() && viewHolder.isEditModeOnly()) {
                    continue;
                }

                var view = viewHolder.getBSBObjectView();

                int newW = viewHolder.getX() + view.getWidth();
                int newH = viewHolder.getY() + view.getHeight();

                if (newW > maxW) {
                    maxW = newW;
                }

                if (newH > maxH) {
                    maxH = newH;
                }
            }
        }

        return new Dimension(maxW + 10, maxH + 10);
    }
    
    
    static class BSBNudgeUtils {
        
        public static enum DIRECTION {
            HORIZONTAL, VERTICAL;
        }
        
        public static HashMap<BSBObject, int[]> nudgeHorizontal(Collection<BSBObject> objects, int amount) {
            if(objects.isEmpty()) {
                return null;
            }
            if(amount < 0) {
                var obj = objects.stream().min((a,b) -> a.getX() - b.getX()).get();
                if(obj.getX() + amount < 0) {
                    return null;
                }
            }
//            System.out.println("Nudge Horizontal: " + amount);

            var startEndValues = new HashMap<BSBObject, int[]>();
            
            for(var obj : objects) {
                var start = obj.getX();
                var end = start + amount;
                obj.setX(end);
                
                startEndValues.put(obj, new int[]{start,end});
            }
            
            return startEndValues;
        }
        
        public static HashMap<BSBObject, int[]> nudgeVertical(Collection<BSBObject> objects, int amount) {
            if(objects.isEmpty()) {
                return null;
            }
            
            if(amount < 0) {
                var obj = objects.stream().min((a,b) -> a.getY() - b.getY()).get();
                if(obj.getY() + amount < 0) {
                    return null;
                }
            }
//            System.out.println("Nudge Vertical: " + amount);

            var startEndValues = new HashMap<BSBObject, int[]>();
            
            for(var obj : objects) {
                var start = obj.getY();
                var end = start + amount;
                obj.setY(end);
                
                startEndValues.put(obj, new int[]{start,end});
            }
            
            return startEndValues;
        }
    }

}
