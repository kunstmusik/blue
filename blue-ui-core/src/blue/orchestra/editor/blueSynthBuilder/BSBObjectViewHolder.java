/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.editor.blueSynthBuilder;

import java.awt.Color;
import java.awt.Point;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.util.EventListener;

import javax.swing.BorderFactory;
import javax.swing.JLayeredPane;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import javax.swing.border.Border;

import blue.event.GroupMovementSelectionList;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.ui.utilities.UiUtilities;

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

    private boolean selected;

    private GroupMovementSelectionList groupMovementSelectionList;

    public BSBObjectViewHolder(BSBObjectView objectView) {
        this.objectView = objectView;

        this.setLayout(null);
        this.add(objectView, DEFAULT_LAYER);

        this.setSize(objectView.getSize());
        mouseCapturePanel.setSize(objectView.getSize());

        mouseCapturePanel.setOpaque(false);

        mouseCapturePanel.addMouseListener(new MouseListener() {

            public void mouseClicked(MouseEvent e) {
                e.consume();
            }

            public void mouseEntered(MouseEvent e) {
                e.consume();
            }

            public void mouseExited(MouseEvent e) {
                e.consume();
            }

            public void mousePressed(MouseEvent e) {
                requestFocus();

                if (UiUtilities.isRightMouseButton(e)) {
                    if (selected) {
                        BSBEditPanel bsbPanel = (BSBEditPanel) BSBObjectViewHolder.this
                                .getParent();
                        BSBEditPanel.bsbObjPopup.setBSBEditPanel(bsbPanel);

                        BSBEditPanel.bsbObjPopup.show(BSBObjectViewHolder.this,
                                e.getX(), e.getY());
                        e.consume();
                    }
                    return;
                }

                originPoint = SwingUtilities.convertPoint(
                        BSBObjectViewHolder.this, e.getPoint(), getParent());

                int selectionType = SelectionEvent.SELECTION_SINGLE;

                if (e.isShiftDown()) {
                    if (selected) {
                        selectionType = SelectionEvent.SELECTION_REMOVE;
                    } else {
                        selectionType = SelectionEvent.SELECTION_ADD;
                    }
                }

                fireSelected(selectionType);

                groupMovementSelectionList.initiateMovement(BSBObjectViewHolder.this);

                e.consume();
            }

            public void mouseReleased(MouseEvent e) {
                originPoint = null;

                e.consume();
            }

        });

        mouseCapturePanel.addMouseMotionListener(new MouseMotionListener() {

            public void mouseDragged(MouseEvent e) {
                setNewLocation(e.getPoint());

                e.consume();
            }

            public void mouseMoved(MouseEvent e) {
                e.consume();
            }
        });

        objectView.addComponentListener(new ComponentAdapter() {

            public void componentResized(ComponentEvent e) {
                setSize(e.getComponent().getSize());
                mouseCapturePanel.setSize(e.getComponent().getSize());
            }

        });
    }

    public void addSelectionListener(SelectionListener sl) {
        listenerList.add(SelectionListener.class, sl);
    }

    public void removeSelectionListener(SelectionListener sl) {
        listenerList.remove(SelectionListener.class, sl);
    }

    public void fireSelected(int selectionType) {
        EventListener[] listeners = listenerList
                .getListeners(SelectionListener.class);

        SelectionEvent se = new SelectionEvent(this, selectionType);

        for (int i = 0; i < listeners.length; i++) {
            SelectionListener listener = (SelectionListener) listeners[i];
            listener.selectionPerformed(se);
        }

    }

    /**
     * @param b
     */
    public void setSelected(boolean selected) {
        if (selected) {
            mouseCapturePanel.setBorder(selectBorder);
        } else {
            mouseCapturePanel.setBorder(null);
        }
        this.selected = selected;
        repaint();
    }

    /**
     * @param x
     * @param y
     */
    protected void setNewLocation(Point p) {
        if (originPoint == null) {
            return;
        }

        Point newP = SwingUtilities.convertPoint(this, p, this.getParent());

        int relX = newP.x - originPoint.x;
        int relY = newP.y - originPoint.y;

        // System.out.println(relX + " : " + relY);

        groupMovementSelectionList.move(relX, relY);
    }

    public void setEditing(boolean isEditing) {
        if (isEditing) {
            this.add(mouseCapturePanel, DRAG_LAYER);
            // this.setSelected(false);
        } else {
            this.remove(mouseCapturePanel);
        }

    }

    public void setLocation(int x, int y) {
        super.setLocation(x, y);
        this.objectView.setNewLocation(x, y);
    }

    /**
     * @return
     */
    public BSBObjectView getBSBObjectView() {
        return objectView;
    }

    /**
     * @param selectionList
     */
    public void setGroupMovementListener(
            GroupMovementSelectionList selectionList) {
        this.groupMovementSelectionList = selectionList;
    }

    /**
     * @return
     */
    public boolean isSelected() {
        return selected;
    }

}