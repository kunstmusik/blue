/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2004 Steven Yi (stevenyi@gmail.com)
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
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.util.ArrayList;
import java.util.Iterator;

import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;

import blue.components.IconFactory;
import blue.soundObject.PolyObject;
import blue.ui.utilities.UiUtilities;
import java.util.Vector;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */
public final class PolyObjectBar extends JComponent implements ActionListener {

    MouseListener popupListener;

    private final JPopupMenu popup;

    private final ArrayList<PolyObjectButton> polyObjectBarList = new ArrayList<PolyObjectButton>();

    private PolyObject focusedPolyObject;

    private PolyObject selectedPolyObject = null;

    private Vector<PolyObjectChangeListener> listeners = null;

    private static PolyObjectBar instance = null;

    public static PolyObjectBar getInstance() {
        if(instance == null) {
            instance = new PolyObjectBar();
        }
        return instance;
    }

    private PolyObjectBar() {
        this.setLayout(new javax.swing.BoxLayout(this,
                javax.swing.BoxLayout.X_AXIS));

        popup = getPopupMenu();
        popupListener = new MouseAdapter() {

            public void mousePressed(MouseEvent e) {
                if (UiUtilities.isRightMouseButton(e)) {
                    popup.show(e.getComponent(), e.getX(), e.getY());
                }
            }
        };

//        BlueProjectManager.getInstance().addPropertyChangeListener(new PropertyChangeListener() {
//
//            public void propertyChange(PropertyChangeEvent evt) {
//                reinitialize();
//            }
//        });
//
//        reinitialize();
    }

//    private void reinitialize() {
//
//        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
//        if (project == null) {
//
////            instrumentEditPanel1.editInstrument(null);
////            arrangementPanel.setArrangement(null);
//        } else {
//            reset();
//            this.addPolyObject(project.getData().getPolyObject());
//
////            instrumentEditPanel1.editInstrument(null);
////            arrangementPanel.setArrangement(project.getData().getArrangement());
//        }
//    }

    private JPopupMenu getPopupMenu() {
        JPopupMenu retVal = new JPopupMenu() {

            public void show(Component invoker, int x, int y) {
                PolyObjectButton b = (PolyObjectButton) invoker;

                selectedPolyObject = b.getPolyObject();

                super.show(invoker, x, y);
            }
        };

        Action editProperties = new AbstractAction("Edit NoteProcessors") {

            public void actionPerformed(ActionEvent e) {
                if (selectedPolyObject != null) {
                    // JOptionPane.showMessageDialog(null, "Not yet
                    // implemented.");

                    NoteProcessorDialog npcDialog = NoteProcessorDialog
                            .getInstance();
                    npcDialog.setNoteProcessorChain(selectedPolyObject
                            .getNoteProcessorChain());
                    npcDialog.show(true);
                    resetNames();
                }
            }
        };

        retVal.add(editProperties);

        return retVal;
    }

    protected void resetNames() {
        for (Iterator iter = polyObjectBarList.iterator(); iter.hasNext();) {
            PolyObjectButton btn = (PolyObjectButton) iter.next();
            btn.resetName();
        }
    }

    void addPolyObject(PolyObject pObj) {
        PolyObjectButton btn = findPolyObject(pObj);

        if (btn != null) {
            polyObjectBarRefocus(btn);
            return;
        }

        if (pObj.getSize() < 1) {
            pObj.newLayerAt(-1);
        }

        PolyObjectButton polyObjectButton = new PolyObjectButton(pObj);

        polyObjectButton.addMouseListener(popupListener);

        polyObjectButton.addActionListener(this);

        this.add(polyObjectButton);
        if (polyObjectBarList.size() > 0) {
            int scrollBarXVal = ScoreTopComponent.findInstance().getHorizontalScrollValue();
            int scrollBarYVal = ScoreTopComponent.findInstance().getVerticalScrollValue();

            PolyObjectButton temp = polyObjectBarList
                    .get(polyObjectBarList.size() - 1);
            temp.setXVal(scrollBarXVal);
            temp.setYVal(scrollBarYVal);
        }

        polyObjectBarList.add(polyObjectButton);
        this.revalidate();
        this.repaint();
        focusedPolyObject = pObj;

        PolyObjectChangeEvent poce = new PolyObjectChangeEvent(
            focusedPolyObject, 0, 0);

        fireChangeEvent(poce);

    }

    /*
     * public PolyObject getFocusedPolyObject() { return focusedPolyObject; }
     */
    private PolyObjectButton findPolyObject(PolyObject pObj) {
        for (Iterator<PolyObjectButton> iter = polyObjectBarList.iterator(); iter.hasNext();) {
            PolyObjectButton btn = iter.next();
            if (btn.polyObject == pObj) {
                return btn;
            }
        }
        return null;
    }

    private int indexOf(PolyObject pObj) {
        for (int i = 0; i < polyObjectBarList.size(); i++) {
            PolyObjectButton btn = polyObjectBarList.get(i);
            if (btn.polyObject == pObj) {
                return i;
            }
        }
        return -1;
    }

    public void reset() {
        focusedPolyObject = null;
        polyObjectBarList.clear();
        this.removeAll();
        this.repaint();
    }

    void polyObjectBarRefocus(PolyObjectButton polyObjectButton) {
        if (polyObjectButton.polyObject != focusedPolyObject) {
            int pObjIndex = polyObjectBarList.indexOf(polyObjectButton);

            while (polyObjectBarList.size() - 1 > pObjIndex) {
                PolyObjectButton tempPObjButton = polyObjectBarList.get(polyObjectBarList.size() - 1);
                tempPObjButton.removeMouseListener(popupListener);

                this.remove(tempPObjButton);

                polyObjectBarList.remove(polyObjectBarList.size() - 1);
            }
            this.repaint();

            focusedPolyObject = polyObjectButton.polyObject;

            PolyObjectChangeEvent poce = new PolyObjectChangeEvent(
                    focusedPolyObject,
                    polyObjectButton.getXVal(),
                    polyObjectButton.getYVal());

            fireChangeEvent(poce);
        }
    }

    public PolyObject getFocusedPolyObject() {
        return focusedPolyObject;
    }

    public void actionPerformed(ActionEvent e) {
        polyObjectBarRefocus((PolyObjectButton) (e.getSource()));
    }

    public void setLibraryPolyObject(PolyObject pObj) {
        if (polyObjectBarList.size() > 1) {
            polyObjectBarRefocus(polyObjectBarList.get(0));
        }

        addPolyObject(pObj);

    }

    public void removeLibraryPolyObject(PolyObject pObj) {
        if (indexOf(pObj) == 1) {
            polyObjectBarRefocus(polyObjectBarList.get(0));
        }
    }

    // LISTENERS
    public void addChangeListener(PolyObjectChangeListener cl) {
        if (this.listeners == null) {
            listeners = new Vector<PolyObjectChangeListener>();
        }
        listeners.add(cl);
    }

    public void removeChangeListener(PolyObjectChangeListener cl) {
        if (this.listeners != null) {
            this.listeners.remove(cl);
        }
    }

    public void fireChangeEvent(PolyObjectChangeEvent poce) {
        if (listeners != null) {
            for (PolyObjectChangeListener cl : listeners) {
                cl.polyObjectChanged(poce);
            }
        }
    }

    /*
     * public void addSelectionListener(SelectionListener sl) {
     * listenerList.add(SelectionListener.class, sl); }
     *
     * public void removeSelectionListener(SelectionListener sl) {
     * listenerList.remove(SelectionListener.class, sl); }
     */
    /**
     * Inner JButton Class to hold extra information
     */
    static class PolyObjectButton extends JButton {

        int xVal = 0;

        int yVal = 0;

        PolyObject polyObject;

        public PolyObjectButton(PolyObject polyObject) {
            super();
            this.polyObject = polyObject;
            resetName();
            this.setFocusable(false);
            this.setIcon(IconFactory.getRightArrowIcon());
            this.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
            this.setBorderPainted(false);

        }

        public void resetName() {
            String name = polyObject.getName();

            if (polyObject.getNoteProcessorChain().size() > 0) {
                name = "*" + name;
            }

            final String finalName = name;

            SwingUtilities.invokeLater(new Runnable() {
                public void run() {
                    PolyObjectButton.this.setText(finalName);
                }
            });



        }

        public void setXVal(int xVal) {
            this.xVal = xVal;
        }

        public int getXVal() {
            return xVal;
        }

        public void setYVal(int yVal) {
            this.yVal = yVal;
        }

        public int getYVal() {
            return this.yVal;
        }

        public PolyObject getPolyObject() {
            return polyObject;
        }
    }
}