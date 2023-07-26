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

import blue.orchestra.blueSynthBuilder.BSBGroup;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.GridSettings;
import blue.orchestra.editor.blueSynthBuilder.EditModeConditional;
import blue.ui.utilities.UiUtilities;
import java.awt.Color;
import java.awt.Cursor;
import java.awt.Point;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import javafx.beans.property.BooleanProperty;
import javafx.beans.value.ChangeListener;
import javafx.collections.ObservableList;
import javafx.collections.ObservableSet;
import javafx.collections.SetChangeListener;
import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JLayeredPane;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import javax.swing.border.Border;

/**
 * @author steven
 */
public class BSBObjectViewHolder extends JLayeredPane {

    BSBObjectView objectView;

    JPanel mouseCapturePanel = new JPanel(null);

    Point originPoint;
    BSBObject[] selectedObjects;
    int[] startX;
    int[] startY;
    int minTransX = -1;
    int minTransY = -1;

    JComponent[] resizeHandles = new JComponent[4];

    // boolean selected = false;
    private static Border selectBorder = BorderFactory
            .createLineBorder(Color.green);

    private final ObservableSet<BSBObject> selection;

    private final ChangeListener<Number> xListener;
    private final ChangeListener<Number> yListener;
    private final ChangeListener<Boolean> editEnabledListener;
    private final BooleanProperty editEnabledProperty;
    private final SetChangeListener<BSBObject> selectionListener;
    private final GridSettings gridSettings;

    public BSBObjectViewHolder(BooleanProperty editEnabledProperty,
            ObservableSet<BSBObject> selection,
            ObservableList<BSBGroup> groupsList,
            GridSettings gridSettings,
            BSBObjectView objectView) {

        this.editEnabledProperty = editEnabledProperty;
        this.objectView = objectView;
        this.selection = selection;
        this.gridSettings = gridSettings;

        this.setLayout(null);
        this.add(objectView, DEFAULT_LAYER);
        this.add(mouseCapturePanel, MODAL_LAYER);

        this.setSize(objectView.getSize());
        mouseCapturePanel.setSize(objectView.getSize());

        mouseCapturePanel.setOpaque(false);

        mouseCapturePanel.addMouseListener(new MouseListener() {

            @Override
            public void mouseClicked(MouseEvent e) {
                e.consume();
            }

            @Override
            public void mouseEntered(MouseEvent e) {
                e.consume();
            }

            @Override
            public void mouseExited(MouseEvent e) {
                e.consume();
            }

            @Override
            public void mousePressed(MouseEvent e) {
                requestFocus();

                if (UiUtilities.isRightMouseButton(e)) {
                    if (selection.contains(objectView.getBSBObject())) {
                        BSBEditPanel bsbPanel = (BSBEditPanel) BSBObjectViewHolder.this
                                .getParent();
                        BSBEditPanel.bsbObjPopup.setBSBEditPanel(bsbPanel);

                        BSBEditPanel.bsbObjPopup.show(BSBObjectViewHolder.this,
                                e.getX(), e.getY());
                        e.consume();
                    }
                    return;
                }

                final var bsbObj = objectView.getBSBObject();

                if (e.getClickCount() >= 2 && (bsbObj instanceof BSBGroup)) {
                    groupsList.add((BSBGroup) bsbObj);
                    return;
                }

                originPoint = SwingUtilities.convertPoint(
                        BSBObjectViewHolder.this, e.getPoint(), getParent());

                if (e.isShiftDown()) {
                    if (selection.contains(bsbObj)) {
                        selection.remove(bsbObj);
                    } else {
                        selection.add(bsbObj);
                    }
                } else {
                    if (!selection.contains(bsbObj)) {
                        selection.clear();
                        selection.add(bsbObj);
                    }
                }

                int minX = Integer.MAX_VALUE;
                int minY = Integer.MAX_VALUE;
                startX = new int[selection.size()];
                startY = new int[selection.size()];
                selectedObjects = selection.toArray(new BSBObject[selection.size()]);

                for (var i = 0; i < selectedObjects.length; i++) {
                    var temp = selectedObjects[i];
                    startX[i] = temp.getX();
                    startY[i] = temp.getY();
                    minX = Math.min(minX, startX[i]);
                    minY = Math.min(minY, startY[i]);
                }
                minTransX = -minX;
                minTransY = -minY;

                e.consume();
            }

            @Override
            public void mouseReleased(MouseEvent e) {
                originPoint = null;
                startX = null;
                startY = null;
                minTransX = -1;
                minTransY = -1;
                selectedObjects = null;

                e.consume();
            }

        });

        mouseCapturePanel.addMouseMotionListener(new MouseMotionListener() {

            @Override
            public void mouseDragged(MouseEvent e) {
                if (selectedObjects == null) {
                    return;
                }

                var newPoint = SwingUtilities.convertPoint(
                        BSBObjectViewHolder.this, e.getPoint(), getParent());

                var transX = newPoint.x - originPoint.x;
                var transY = newPoint.y - originPoint.y;

                if (gridSettings != null && gridSettings.isSnapEnabled()) {
                    int w = gridSettings.getWidth();
                    int h = gridSettings.getHeight();
                    
                    transX = (Math.round(transX / w) * w) + (minTransX % w);
                    transY = (Math.round(transY / h) * h) + (minTransY % h);
                }

                transX = Math.max(minTransX, transX);
                transY = Math.max(minTransY, transY);

                for (int i = 0; i < selectedObjects.length; i++) {
                    var bsbObj = selectedObjects[i];
                    bsbObj.setX(startX[i] + transX);
                    bsbObj.setY(startY[i] + transY);
                }

                e.consume();
            }

            @Override
            public void mouseMoved(MouseEvent e) {
                e.consume();
            }
        });

        objectView.addComponentListener(new ComponentAdapter() {

            @Override
            public void componentResized(ComponentEvent e) {
                setSize(e.getComponent().getSize());
                mouseCapturePanel.setSize(e.getComponent().getSize());

                if (resizeHandles[0] != null) {
                    resizeHandles[0].setLocation(getWidth() / 2 - 2, 0);
                }
                if (resizeHandles[1] != null) {
                    resizeHandles[1].setLocation(getWidth() / 2 - 2, getHeight() - 5);
                }
                if (resizeHandles[2] != null) {
                    resizeHandles[2].setLocation(0, getHeight() / 2 - 2);
                }
                if (resizeHandles[3] != null) {
                    resizeHandles[3].setLocation(getWidth() - 5, getHeight() / 2 - 2);
                }
            }

        });

        xListener = (obs, old, newVal) -> {
            setLocation(newVal.intValue(), getY());
        };
        yListener = (obs, old, newVal) -> {
            setLocation(getX(), newVal.intValue());
        };
        editEnabledListener = (obs, old, newVal) -> {
            setEditing(newVal);
        };
        selectionListener = (change) -> {
            updateBorder();
        };

        setupResizeHandles();
    }

    @Override
    public void addNotify() {
        super.addNotify();

        var bsbObj = objectView.getBSBObject();

        setBounds(bsbObj.getX(), bsbObj.getY(), objectView.getWidth(), objectView.getHeight());

        bsbObj.xProperty().addListener(xListener);
        bsbObj.yProperty().addListener(yListener);

        if (editEnabledProperty != null) {
            editEnabledProperty.addListener(editEnabledListener);
            setEditing(editEnabledProperty.getValue());
        } else {
            setEditing(false);
        }
        selection.addListener(selectionListener);
    }

    @Override
    public void removeNotify() {
        super.removeNotify();

        objectView.getBSBObject().xProperty().removeListener(xListener);
        objectView.getBSBObject().yProperty().removeListener(yListener);

        if (editEnabledProperty != null) {
            editEnabledProperty.removeListener(editEnabledListener);
        }

        selection.removeListener(selectionListener);
    }

    public void setEditing(boolean isEditing) {
        if (isEditing) {
            //this.add(mouseCapturePanel, DRAG_LAYER);

            // this.setSelected(false);
            setVisible(true);
        } else {
//            this.remove(mouseCapturePanel);
            setVisible(!isEditModeOnly());
        }
        mouseCapturePanel.setEnabled(isEditing);
        mouseCapturePanel.setVisible(isEditing);

        objectView.setEnabled(!isEditing);
        updateBorder();
    }

    private void updateBorder() {
        var selected = editEnabledProperty != null && editEnabledProperty.getValue()
                && selection.contains(getBSBObjectView().getBSBObject());
        if (selected) {
            mouseCapturePanel.setBorder(selectBorder);

        } else {
            mouseCapturePanel.setBorder(null);
        }

        setResizeHandlesVisible(selected && selection.size() == 1);
    }

    private void setResizeHandlesVisible(boolean visible) {
        for (var c : resizeHandles) {
            if (c != null) {
                c.setVisible(visible);
            }
        }
    }

    /**
     * @return
     */
    public BSBObjectView getBSBObjectView() {
        return objectView;
    }

    public boolean isEditModeOnly() {
        return !(objectView instanceof BSBGroupPanel) && objectView instanceof EditModeConditional;
    }

    // RESIZING
    private void setupResizeHandles() {
        if (!(objectView instanceof ResizeableView) || editEnabledProperty == null) {
            return;
        }

        var mouseHandler = new MouseAdapter() {

            Point origin = null;
            Cursor parentCursor = null;

            @Override
            public void mousePressed(MouseEvent e) {
                var comp = e.getComponent();
                var parent = BSBObjectViewHolder.this.getParent();
                parentCursor = parent.getCursor();
                parent.setCursor(comp.getCursor());
                origin = SwingUtilities.convertPoint(comp, e.getPoint(), parent);
                e.consume();
            }

            @Override
            public void mouseDragged(MouseEvent e) {
                var curPoint = SwingUtilities.convertPoint(e.getComponent(), e.getPoint(), BSBObjectViewHolder.this.getParent());

                if (e.getComponent() == resizeHandles[0]) {
                    resizeUp(origin, curPoint);
                } else if (e.getComponent() == resizeHandles[1]) {
                    resizeDown(origin, curPoint);
                } else if (e.getComponent() == resizeHandles[2]) {
                    resizeLeft(origin, curPoint);
                } else if (e.getComponent() == resizeHandles[3]) {
                    resizeRight(origin, curPoint);
                }

                e.consume();
            }

            @Override
            public void mouseReleased(MouseEvent e) {
                var parent = BSBObjectViewHolder.this.getParent();
                parent.setCursor(parentCursor);

                origin = null;
                parentCursor = null;

                e.consume();
            }

        };

        var rView = (ResizeableView) objectView;

        if (rView.canResizeWidgetHeight()) {
            var topHandle = new JPanel();
            topHandle.setSize(5, 5);
            topHandle.setBackground(Color.GREEN);
            mouseCapturePanel.add(topHandle, JLayeredPane.DRAG_LAYER);
            topHandle.setLocation(getWidth() / 2 - 2, 0);
            topHandle.addMouseListener(mouseHandler);
            topHandle.addMouseMotionListener(mouseHandler);
            topHandle.setCursor(Cursor.getPredefinedCursor(Cursor.N_RESIZE_CURSOR));
            resizeHandles[0] = topHandle;

            var bottomHandle = new JPanel();
            bottomHandle.setSize(5, 5);
            bottomHandle.setBackground(Color.GREEN);
            mouseCapturePanel.add(bottomHandle, JLayeredPane.DRAG_LAYER);
            bottomHandle.setLocation(getWidth() / 2 - 2, getHeight() - 5);
            bottomHandle.addMouseListener(mouseHandler);
            bottomHandle.addMouseMotionListener(mouseHandler);
            bottomHandle.setCursor(Cursor.getPredefinedCursor(Cursor.S_RESIZE_CURSOR));
            resizeHandles[1] = bottomHandle;
        }
        if (rView.canResizeWidgetWidth()) {
            var leftHandle = new JPanel();
            leftHandle.setSize(5, 5);
            leftHandle.setBackground(Color.GREEN);
            mouseCapturePanel.add(leftHandle, JLayeredPane.DRAG_LAYER);
            leftHandle.setLocation(0, getHeight() / 2 - 2);
            leftHandle.addMouseListener(mouseHandler);
            leftHandle.addMouseMotionListener(mouseHandler);
            leftHandle.setCursor(Cursor.getPredefinedCursor(Cursor.W_RESIZE_CURSOR));
            resizeHandles[2] = leftHandle;

            var rightHandle = new JPanel();
            rightHandle.setSize(5, 5);
            rightHandle.setBackground(Color.GREEN);
            mouseCapturePanel.add(rightHandle, JLayeredPane.DRAG_LAYER);
            rightHandle.setLocation(getWidth() - 5, getHeight() / 2 - 2);
            rightHandle.addMouseListener(mouseHandler);
            rightHandle.addMouseMotionListener(mouseHandler);
            rightHandle.setCursor(Cursor.getPredefinedCursor(Cursor.E_RESIZE_CURSOR));
            resizeHandles[3] = rightHandle;
        }
    }

    protected void resizeRight(Point origin, Point curPoint) {
        var x = curPoint.x;
        var rView = (ResizeableView) objectView;

        if (gridSettings.isSnapEnabled()) {
            var w = gridSettings.getWidth();
            x = (int) Math.round((double) x / w);
            x *= w;
        }

        var newWidth = Math.max(x - rView.getWidgetX(),
                rView.getWidgetMinimumWidth());

        if (newWidth != rView.getWidgetWidth()) {
            rView.setWidgetWidth(newWidth);
        }

    }

    protected void resizeLeft(Point origin, Point curPoint) {
        var x = Math.max(0, curPoint.x);
        var rView = (ResizeableView) objectView;

        if (gridSettings.isSnapEnabled()) {
            var w = gridSettings.getWidth();
            x = (int) Math.round((double) x / w);
            x *= w;
        }

        var curRight = rView.getWidgetX() + rView.getWidgetWidth();

        var newWidth = Math.max(curRight - x,
                rView.getWidgetMinimumWidth());

        if (newWidth != rView.getWidgetWidth()) {
            rView.setWidgetX(x);
            rView.setWidgetWidth(newWidth);
        }

    }

    protected void resizeUp(Point origin, Point curPoint) {
        var y = Math.max(0, curPoint.y);
        var rView = (ResizeableView) objectView;

        if (gridSettings.isSnapEnabled()) {
            var h = gridSettings.getHeight();
            y = (int) Math.round((double) y / h);
            y *= h;
        }

        var curBottom = rView.getWidgetY() + rView.getWidgetHeight();
        var newHeight = Math.max(curBottom - y,
                rView.getWidgetMinimumHeight());

        System.out.println("ResizeUp: " + curBottom + " : " + newHeight);

        if (newHeight != rView.getWidgetHeight()) {
            rView.setWidgetY(y);
            rView.setWidgetHeight(newHeight);
        }
    }

    protected void resizeDown(Point origin, Point curPoint) {
        var y = Math.max(0, curPoint.y);
        var rView = (ResizeableView) objectView;

        if (gridSettings.isSnapEnabled()) {
            var h = gridSettings.getHeight();
            y = (int) Math.round((double) y / h);
            y *= h;
        }

        var newHeight = Math.max(y - rView.getWidgetY(),
                rView.getWidgetMinimumHeight());

        if (newHeight != rView.getWidgetHeight()) {
            rView.setWidgetHeight(newHeight);
        }
    }
}
