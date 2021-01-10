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
import blue.orchestra.editor.blueSynthBuilder.EditModeOnly;
import blue.ui.utilities.UiUtilities;
import java.awt.Color;
import java.awt.Point;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import javafx.beans.property.BooleanProperty;
import javafx.beans.value.ChangeListener;
import javafx.collections.ObservableList;
import javafx.collections.ObservableSet;
import javafx.collections.SetChangeListener;
import javax.swing.BorderFactory;
import javax.swing.JLayeredPane;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import javax.swing.border.Border;

/**
 * @author steven
 */
public class BSBObjectViewHolder extends JLayeredPane {

    BSBObjectView objectView;

    JPanel mouseCapturePanel = new JPanel();

    boolean dragging = false;

    Point originPoint;

    // boolean selected = false;
    private static Border selectBorder = BorderFactory
            .createLineBorder(Color.green);

    private final ObservableSet<BSBObject> selection;

    private final ChangeListener<Number> xListener;
    private final ChangeListener<Number> yListener;
    private final ChangeListener<Boolean> editEnabledListener;
    private final BooleanProperty editEnabledProperty;
    private final SetChangeListener<BSBObject> selectionListener;

    public BSBObjectViewHolder(BooleanProperty editEnabledProperty,
            ObservableSet<BSBObject> selection,
            ObservableList<BSBGroup> groupsList,
            BSBObjectView objectView) {

        this.editEnabledProperty = editEnabledProperty;
        this.objectView = objectView;
        this.selection = selection;

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
                    if (selection.size() != 1 || !selection.contains(bsbObj)) {
                        selection.clear();
                        selection.add(bsbObj);
                    }
                }

//                groupMovementSelectionList.initiateMovement(BSBObjectViewHolder.this);
                e.consume();
            }

            @Override
            public void mouseReleased(MouseEvent e) {
                originPoint = null;

                e.consume();
            }

        });

        mouseCapturePanel.addMouseMotionListener(new MouseMotionListener() {

            @Override
            public void mouseDragged(MouseEvent e) {
                //setNewLocation(e.getPoint());

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

    @Override
    public void setLocation(int x, int y) {
        super.setLocation(x, y);
        this.objectView.setNewLocation(x, y);
    }

    private void updateBorder() {
        if (editEnabledProperty != null && editEnabledProperty.getValue()
                && selection.contains(getBSBObjectView().getBSBObject())) {
            mouseCapturePanel.setBorder(selectBorder);
        } else {
            mouseCapturePanel.setBorder(null);
        }
    }

    /**
     * @return
     */
    public BSBObjectView getBSBObjectView() {
        return objectView;
    }

    public boolean isEditModeOnly() {
        return objectView instanceof EditModeOnly;
    }

}
