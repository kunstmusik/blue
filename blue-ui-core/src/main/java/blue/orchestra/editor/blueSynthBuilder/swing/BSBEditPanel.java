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
import blue.event.EditModeListener;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBGroup;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.BSBObjectEntry;
import blue.orchestra.blueSynthBuilder.GridSettings;
import static blue.orchestra.blueSynthBuilder.GridSettings.GridStyle.DOT;
import static blue.orchestra.blueSynthBuilder.GridSettings.GridStyle.LINE;
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

    private final List<BSBObject> copyBuffer = new ArrayList<>();
    int copyX, copyY;

    private final AlphaMarquee marquee = new AlphaMarquee();

    private final InvalidationListener gridListener;

    ComponentListener cl;
    private final SetChangeListener<BSBObject> scl;

    ObservableList<BSBGroup> groupsList = FXCollections.observableArrayList();
    BSBGroup currentBSBGroup = null;

    ChangeListener<Boolean> editEnabledListener = (obs, old, newVal) -> {
        if (newVal) {
            if (groupsList.size() > 1) {
                setBSBObjects(currentBSBGroup.interfaceItemsProperty());
            }
        } else {
            if (groupsList.size() > 1) {
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
//                    selectionList.nudgeUp(val);
                }
            }
        });

        actionMap.put("up10", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 10;
//                    selectionList.nudgeUp(val);
                }
            }
        });

        actionMap.put("down", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 1;
//                    selectionList.nudgeDown(val);
                }
            }
        });

        actionMap.put("down10", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 10;
//                    selectionList.nudgeDown(val);
                }
            }
        });

        actionMap.put("left", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 1;
//                    selectionList.nudgeLeft(val);
                }
            }
        });

        actionMap.put("left10", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 10;
//                    selectionList.nudgeLeft(val);
                }
            }
        });

        actionMap.put("right", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 1;
//                    selectionList.nudgeRight(val);
                }
            }
        });

        actionMap.put("right10", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selection.size() > 0) {
                    GridSettings gridSettings = bsbInterface.getGridSettings();
                    int val = gridSettings.isSnapEnabled() ? gridSettings.getHeight() : 10;
//                    selectionList.nudgeRight(val);
                }
            }
        });
    }

    /**
     *
     */
    protected void recalculateSize() {

        if (bsbInterface == null) {
            return;
        }

        int maxW = 1;
        int maxH = 1;

        for (var c : getComponentsInLayer(DEFAULT_LAYER)) {
            if (c instanceof BSBObjectViewHolder) {
                var viewHolder = (BSBObjectViewHolder) c;
                if (!isEditing() && viewHolder.isEditModeOnly()) {
                    continue;
                }
                int newW = viewHolder.getX() + viewHolder.getWidth();
                int newH = viewHolder.getY() + viewHolder.getHeight();

                if (newW > maxW) {
                    maxW = newW;
                }

                if (newH > maxH) {
                    maxH = newH;
                }
            }
        }

        Dimension d = new Dimension(maxW, maxH);
        this.setSize(d);
        this.setPreferredSize(d);

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
            setEditing(isEditing());

            groupsList.setAll(bsbInterface.getRootGroup());
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

        for (var c : this.getComponentsInLayer(JLayeredPane.DEFAULT_LAYER)) {
            var viewHolder = (BSBObjectViewHolder) c;

            viewHolder.removeComponentListener(cl);
            this.remove(c);
        }

//        this.add(marquee, JLayeredPane.DRAG_LAYER);
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
        this.add(viewHolder, JLayeredPane.DEFAULT_LAYER);

        if (revalidate) {
            revalidate();
            repaint();
        }

        return viewHolder;
    }

    protected void setBSBObjects(Collection<BSBObject> bsbObjects) {
        if (bsbInterface != null) {
            for (var bsbOj : bsbObjects) {
                add(getEditorForBSBObject(bsbOj), DEFAULT_LAYER);
            }
        }
    }

    private BSBObjectViewHolder getEditorForBSBObject(BSBObject bsbObj) {
        BooleanProperty editEnabledProperty = allowEditing
                ? bsbInterface.editEnabledProperty() : null;

        BSBObjectView objectView = BSBObjectEditorFactory.getView(bsbObj);
        BSBObjectViewHolder viewHolder = new BSBObjectViewHolder(editEnabledProperty,
                selection, groupsList, objectView);

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
        for (var c : getComponentsInLayer(DEFAULT_LAYER)) {
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

        for (var bsbObj : selection) {
            copyBuffer.add(bsbObj.deepCopy());
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

//        for (BSBObjectViewHolder viewHolder : selectionList) {
//            BSBObject bsbObj = viewHolder.getBSBObjectView().getBSBObject();
//
//            if (bsbInterface != null) {
//                bsbInterface.remove(bsbObj);
//            }
//
//            viewHolder.removeSelectionListener(this);
//            viewHolder.setGroupMovementListener(null);
//            viewHolder.removeComponentListener(cl);
//            viewHolder.getBSBObjectView().cleanup();
//
//            this.remove(viewHolder);
//        }
        selection.clear();

        repaint();
    }

    /**
     * @return
     */
    public boolean canPaste() {
        return (copyBuffer.size() > 0);
    }

//    /**
//     * @return
//     */
//    public List<BSBObjectViewHolder> getSelectionList() {
//        return selectionList;
//    }
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
    }

    public ObservableSet<BSBObject> getSelection() {
        return selection;
    }

}
