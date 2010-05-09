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
package blue.orchestra.editor.blueSynthBuilder;

import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.ComponentListener;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.util.ArrayList;
import java.util.EventListener;
import java.util.Iterator;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JLayeredPane;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;

import blue.BlueSystem;
import blue.components.AlphaMarquee;
import blue.event.EditModeListener;
import blue.event.GroupMovementSelectionList;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBObject;
import blue.orchestra.blueSynthBuilder.BSBObjectEntry;

/**
 * @author steven
 * 
 */
public class BSBEditPanel extends JLayeredPane implements SelectionListener,
        EditModeListener {

    protected static final BSBObjectEditPopup bsbObjPopup = new BSBObjectEditPopup();

    private final BSBEditPanelPopup popup;

    private BSBEditPanelNonEditPopup nonEditPopup;

    private boolean isEditing = false;

    private BSBGraphicInterface bsbInterface = null;

    private final GroupMovementSelectionList selectionList = new GroupMovementSelectionList();

    SelectionEvent clearSelection;

    private final ArrayList copyBuffer = new ArrayList();

    int copyX, copyY;

    ArrayList objectViews = new ArrayList();

    ComponentListener cl;

    private final AlphaMarquee marquee = new AlphaMarquee();

    public BSBEditPanel(BSBObjectEntry[] bsbObjectEntries) {
        popup = new BSBEditPanelPopup(bsbObjectEntries);

        clearSelection = new SelectionEvent(null,
                SelectionEvent.SELECTION_CLEAR);

        cl = new ComponentAdapter() {

            public void componentMoved(ComponentEvent e) {
                recalculateSize();

            }

            public void componentResized(ComponentEvent e) {
                recalculateSize();
            }
        };

        this.setLayout(null);

        this.add(marquee, JLayeredPane.DRAG_LAYER);

        marquee.setVisible(false);

        this.addSelectionListener(selectionList);

        this.addMouseListener(new MouseAdapter() {

            public void mousePressed(MouseEvent e) {
                requestFocus();

                selectionPerformed(clearSelection);

                if (isEditing()) {
                    if (SwingUtilities.isRightMouseButton(e)) {
                        popup.show(BSBEditPanel.this, e.getX(), e.getY());
                    } else if (e.isControlDown() && copyBuffer.size() > 0) {
                        paste(e.getX(), e.getY());
                    } else {
                        marquee.setVisible(true);
                        marquee.setStart(e.getPoint());
                    }
                } else {
                    if (SwingUtilities.isRightMouseButton(e)) {
                        if (nonEditPopup == null) {
                            nonEditPopup = new BSBEditPanelNonEditPopup(
                                    BSBEditPanel.this);
                        }

                        nonEditPopup.show(BSBEditPanel.this, e.getX(), e.getY());
                    }
                }
            }

            public void mouseReleased(MouseEvent e) {

                if (marquee.isVisible()) {

                    for (Iterator iter = objectViews.iterator(); iter.hasNext();) {
                        BSBObjectViewHolder viewHolder = (BSBObjectViewHolder) iter.next();

                        if (marquee.intersects(viewHolder)) {
                            selectionPerformed(new SelectionEvent(viewHolder,
                                    SelectionEvent.SELECTION_ADD));
                        }

                    // if(viewHolder.)

                    }

                    marquee.setVisible(false);
                    marquee.setSize(1, 1);
                    marquee.setLocation(-1, -1);
                }
            }
        });

        this.addMouseMotionListener(new MouseMotionAdapter() {

            public void mouseDragged(MouseEvent e) {
                if (isEditing() && marquee.isVisible()) {
                    marquee.setDragPoint(e.getPoint());
                }
            }
        });

        initActions();
    }

    private void initActions() {
        InputMap inputMap = this.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
        ActionMap actionMap = this.getActionMap();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_X, BlueSystem.getMenuShortcutKey()), "cut");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_C, BlueSystem.getMenuShortcutKey()), "copy");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_DELETE, 0), "delete");
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

            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selectionList.size() > 0) {
                    cut();
                }
            }
        });

        actionMap.put("copy", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selectionList.size() > 0) {
                    copy();
                }
            }
        });

        actionMap.put("delete", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                if (isEditing() && selectionList.size() > 0) {
                    removeSelectedBSBObjects();
                }
            }
        });

        actionMap.put("up", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                selectionList.nudgeUp(1);
            }
        });

        actionMap.put("up10", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                selectionList.nudgeUp(10);
            }
        });

        actionMap.put("down", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                selectionList.nudgeDown(1);
            }
        });

        actionMap.put("down10", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                selectionList.nudgeDown(10);
            }
        });

        actionMap.put("left", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                selectionList.nudgeLeft(1);
            }
        });

        actionMap.put("left10", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                selectionList.nudgeLeft(10);
            }
        });

        actionMap.put("right", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                selectionList.nudgeRight(1);
            }
        });

        actionMap.put("right10", new AbstractAction() {

            public void actionPerformed(ActionEvent e) {
                selectionList.nudgeRight(10);
            }
        });
    }

    /**
     * 
     */
    protected void recalculateSize() {
        int maxW = 1;
        int maxH = 1;

        for (Iterator iter = objectViews.iterator(); iter.hasNext();) {
            BSBObjectViewHolder viewHolder = (BSBObjectViewHolder) iter.next();
            int newW = viewHolder.getX() + viewHolder.getWidth();
            int newH = viewHolder.getY() + viewHolder.getHeight();

            if (newW > maxW) {
                maxW = newW;
            }

            if (newH > maxH) {
                maxH = newH;
            }
        }

        Dimension d = new Dimension(maxW, maxH);
        this.setSize(d);
        this.setPreferredSize(d);

    }

    public boolean isEditing() {
        return isEditing;
    }

    public void setEditing(boolean isEditing) {
        this.isEditing = isEditing;
        for (Iterator iter = objectViews.iterator(); iter.hasNext();) {
            BSBObjectViewHolder viewHolder = (BSBObjectViewHolder) iter.next();
            viewHolder.setEditing(isEditing);
        }
        repaint();
    }

    public void editBSBGraphicInterface(BSBGraphicInterface bsbInterface) {
        this.bsbInterface = null;

        clearBSBObjects();

        if (bsbInterface != null) {
            for (Iterator iter = bsbInterface.iterator(); iter.hasNext();) {
                BSBObject bsbObj = (BSBObject) iter.next();
                addBSBObject(bsbObj, false);
            }
        }

        this.bsbInterface = bsbInterface;

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

        this.removeAll();

        this.add(marquee, JLayeredPane.DRAG_LAYER);
        marquee.setVisible(false);

        for (Iterator iter = objectViews.iterator(); iter.hasNext();) {
            BSBObjectViewHolder viewHolder = (BSBObjectViewHolder) iter.next();
            viewHolder.removeSelectionListener(this);
            viewHolder.setGroupMovementListener(null);
            viewHolder.removeComponentListener(cl);
            viewHolder.getBSBObjectView().cleanup();
        }

        objectViews.clear();
    }

    /**
     * @param bsbObj
     */
    public BSBObjectViewHolder addBSBObject(BSBObject bsbObj) {
        return addBSBObject(bsbObj, true);
    }

    public BSBObjectViewHolder addBSBObject(BSBObject bsbObj, boolean revalidate) {
        if (bsbInterface != null) {
            bsbInterface.addBSBObject(bsbObj);
        }

        BSBObjectView objectView = BSBObjectEditorFactory.getView(bsbObj);
        BSBObjectViewHolder viewHolder = new BSBObjectViewHolder(objectView);

        viewHolder.setEditing(this.isEditing());
        viewHolder.setLocation(bsbObj.getX(), bsbObj.getY());
        objectViews.add(viewHolder);

        this.add(viewHolder);

        viewHolder.addSelectionListener(this);
        viewHolder.setGroupMovementListener(selectionList);
        viewHolder.addComponentListener(cl);

        if (revalidate) {
            revalidate();
            repaint();
        }

        return viewHolder;
    }

    public void selectionPerformed(SelectionEvent e) {
        BSBObjectViewHolder selectedItem = (BSBObjectViewHolder) e.getSelectedItem();

        switch (e.getSelectionType()) {
            case SelectionEvent.SELECTION_CLEAR:
                for (Iterator iter = objectViews.iterator(); iter.hasNext();) {
                    BSBObjectViewHolder viewHolder = (BSBObjectViewHolder) iter.next();
                    viewHolder.setSelected(false);
                }

                break;
            case SelectionEvent.SELECTION_SINGLE:
                if (selectedItem.isSelected()) {
                    return;
                }

                for (Iterator iter = objectViews.iterator(); iter.hasNext();) {
                    BSBObjectViewHolder viewHolder = (BSBObjectViewHolder) iter.next();
                    viewHolder.setSelected(viewHolder == selectedItem);
                }

                break;
            case SelectionEvent.SELECTION_ADD:
                selectedItem.setSelected(true);
                break;
            case SelectionEvent.SELECTION_REMOVE:
                selectedItem.setSelected(false);
                break;

        }

        EventListener[] listeners = listenerList.getListeners(SelectionListener.class);

        for (int i = 0; i < listeners.length; i++) {
            SelectionListener listener = (SelectionListener) listeners[i];
            listener.selectionPerformed(e);
        }

    }

    public void addSelectionListener(SelectionListener sl) {
        listenerList.add(SelectionListener.class, sl);
    }

    public void removeSelectionListener(SelectionListener sl) {
        listenerList.remove(SelectionListener.class, sl);
    }

    /* BUFFER METHODS */
    protected void cut() {
        if (selectionList.size() > 0) {
            copy();
            removeSelectedBSBObjects();
        }
    }

    protected void copy() {
        copyBuffer.clear();

        copyX = Integer.MAX_VALUE;
        copyY = Integer.MAX_VALUE;

        for (Iterator items = selectionList.iterator(); items.hasNext();) {
            BSBObjectViewHolder viewHolder = (BSBObjectViewHolder) items.next();

            if (viewHolder.getX() < copyX) {
                copyX = viewHolder.getX();
            }

            if (viewHolder.getY() < copyY) {
                copyY = viewHolder.getY();
            }

            copyBuffer.add(viewHolder.getBSBObjectView().getBSBObject());
        }
    }

    protected void paste(int x, int y) {
        int offSetX = x - copyX;
        int offSetY = y - copyY;

        selectionPerformed(clearSelection);

        for (Iterator iter = copyBuffer.iterator(); iter.hasNext();) {
            BSBObject bsbObj = (BSBObject) iter.next();
            bsbObj = (BSBObject) bsbObj.clone();

            BSBObjectViewHolder viewHolder = addBSBObject(bsbObj);

            viewHolder.setLocation(viewHolder.getX() + offSetX, viewHolder.getY() + offSetY);

            selectionPerformed(new SelectionEvent(viewHolder,
                    SelectionEvent.SELECTION_ADD));

        }

    }

    /**
     * 
     */
    public void removeSelectedBSBObjects() {
        for (Iterator iter = selectionList.iterator(); iter.hasNext();) {
            BSBObjectViewHolder viewHolder = (BSBObjectViewHolder) iter.next();
            BSBObject bsbObj = viewHolder.getBSBObjectView().getBSBObject();

            if (bsbInterface != null) {
                bsbInterface.remove(bsbObj);
            }

            viewHolder.removeSelectionListener(this);
            viewHolder.setGroupMovementListener(null);
            viewHolder.removeComponentListener(cl);
            viewHolder.getBSBObjectView().cleanup();

            this.remove(viewHolder);
        }

        selectionList.clear();

        selectionPerformed(clearSelection);

        repaint();
    }

    /**
     * @return
     */
    public boolean canPaste() {
        return (copyBuffer.size() > 0);
    }

    /**
     * @return
     */
    public ArrayList getSelectionList() {
        return selectionList;
    }
}