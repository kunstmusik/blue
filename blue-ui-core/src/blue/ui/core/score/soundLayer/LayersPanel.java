/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.score.soundLayer;

import blue.BlueSystem;
import blue.SoundLayer;
import blue.noteProcessor.NoteProcessorChainMap;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.soundObject.PolyObject;
import blue.ui.utilities.SelectionModel;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.FocusEvent;
import java.awt.event.FocusListener;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPopupMenu;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import skt.swing.SwingUtil;

public class LayersPanel extends JComponent implements LayerGroupListener {

    private SoundLayerLayout layout = new SoundLayerLayout();

    private PolyObject pObj = null;

    private NoteProcessorChainMap npcMap = null;

    private SelectionModel selection = new SelectionModel();
    
    JPopupMenu menu;

    public LayersPanel() {
        
        this.setLayout(layout);

        this.setMinimumSize(new Dimension(0, 0));
 
        final LayerAddAction layerAddAction = new LayerAddAction();
        final LayerRemoveAction layerRemoveAction = new LayerRemoveAction();
        final PushUpAction pushUpAction = new PushUpAction();
        final PushDownAction pushDownAction = new PushDownAction();

        menu = new JPopupMenu("Layer Operations") {

            @Override
            public void show(Component invoker, int x, int y) {
                if(pObj == null) {
                    return;
                }
                        
                layerRemoveAction.setEnabled(pObj.size() >= 2);
                pushUpAction.setEnabled(selection.getStartIndex() >= 1);
                pushDownAction.setEnabled(selection.getEndIndex() < pObj.size() - 1);
                
                super.show(invoker, x, y);
            }
            
        };
        
        menu.add(layerAddAction);
        menu.add(layerRemoveAction);
        menu.add(pushUpAction);
        menu.add(pushDownAction);
        
        this.addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent me) {
                LayersPanel.this.requestFocus();

                if (me.isPopupTrigger()) {
                    Component c = getComponentAt(me.getPoint());
                    int index = getIndexOfComponent(c);
                    
                    if(index > selection.getEndIndex() ||
                            index < selection.getStartIndex()) {
                        selection.setAnchor(index);
                    }
                    
                    menu.show(me.getComponent(), me.getX(), me.getY());
                } else if (SwingUtilities.isLeftMouseButton(me)) {

                    if (me.getClickCount() == 1) {
                        Component c = getComponentAt(me.getPoint());
                        int index = getIndexOfComponent(c);

                        if (index < 0) {
                            return;
                        }

                        if (me.isShiftDown()) {
                            selection.setEnd(index);
                        } else {
                            selection.setAnchor(index);
                        }

                    } else if (me.getClickCount() == 2) {
                        Component c = SwingUtilities.getDeepestComponentAt(
                                LayersPanel.this, me.getX(), me.getY());

                        if (c != null && c instanceof JLabel) {
                            Component panel = getComponentAt(me.getPoint());

                            ((SoundLayerPanel) panel).editName();

                        }

                    }
                }
            }
        });

        selection.addChangeListener((ChangeEvent e) -> {
            updateSelection();
        });

        this.addFocusListener(new FocusListener() {
            @Override
            public void focusGained(FocusEvent e) {
            }

            @Override
            public void focusLost(FocusEvent e) {
                if (!e.isTemporary()) {
                    selection.setAnchor(-1);
                }
            }
        });

        initActions();
    }

    private void initActions() {
        SwingUtil.installActions(this, new Action[] { new ShiftUpAction(),
                new UpAction(), new ShiftDownAction(), new DownAction() },
                WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
    }

    private int getIndexOfComponent(Component c) {
        Component[] comps = getComponents();

        for (int i = 0; i < comps.length; i++) {
            if (comps[i] == c) {
                return i;
            }
        }
        return -1;
    }

    public void setPolyObject(PolyObject pObj) {
        if (this.pObj != null) {
            this.pObj.removeLayerGroupListener(this);
        }

        layout.setPolyObject(pObj);

        this.pObj = pObj;

        this.populate();
    }

    private void populate() {
        this.checkSize();

        this.removeAll();

        if (pObj == null) {
            return;
        }

        for (SoundLayer sLayer : pObj) {
            SoundLayerPanel panel = new SoundLayerPanel(sLayer, npcMap);
            this.add(panel);
        }
        revalidate();
    }

    public void checkSize() {
        if (pObj == null || getParent() == null) {
            setSize(0, 0);
            return;
        }

        int w = getParent().getWidth();

        int h = pObj.getTotalHeight();

        this.setSize(w, h * pObj.size());
    }

    /* SELECTION */

    private void updateSelection() {
        int start = selection.getStartIndex();
        int end = selection.getEndIndex();

        Component[] comps = getComponents();

        for (int i = 0; i < comps.length; i++) {
            SoundLayerPanel panel = (SoundLayerPanel) comps[i];
            panel.setSelected(i >= start && i <= end);
        }
    }

    public SelectionModel getSelectionModel() {
        return selection;
    }

    public void setNoteProcessorChainMap(NoteProcessorChainMap npcMap) {
        this.npcMap = npcMap;
    }

    @Override 
    public void addNotify() {
        super.addNotify();
        
        if(this.pObj != null) {
            this.pObj.addLayerGroupListener(this);
            
        }
    }
    
    @Override
    public void removeNotify() {
        super.removeNotify();
        
        if(this.pObj != null) {
            this.pObj.removeLayerGroupListener(this);
        }
    }
    
    /* LAYER GROUP LISTENER */

    @Override
    public void layerGroupChanged(LayerGroupDataEvent event) {
        switch(event.getType()) {
            case LayerGroupDataEvent.DATA_ADDED:
                layersAdded(event);
                break;
            case LayerGroupDataEvent.DATA_REMOVED:
                layersRemoved(event);
                break;
            case LayerGroupDataEvent.DATA_CHANGED:
                contentsChanged(event);
                break;
        }
    }
    
     public void layersAdded(LayerGroupDataEvent e) {
        int index = e.getStartIndex();
        SoundLayer sLayer = pObj.get(index);

        SoundLayerPanel panel = new SoundLayerPanel(sLayer, npcMap);
        this.add(panel, index);
        
        checkSize();
        revalidate();
    }

    public void layersRemoved(LayerGroupDataEvent e) {
        int start = e.getStartIndex();
        int end = e.getEndIndex();

        for (int i = end; i >= start; i--) {
            remove(i);
        }

        checkSize();

        selection.setAnchor(-1);
        revalidate();
    }

    public void contentsChanged(LayerGroupDataEvent e) {
        int start = e.getStartIndex();
        int end = e.getEndIndex();

        // This is a hack to determine what direction the layers were
        // pushed
        boolean isUp = ((start >= 0) && (end >= 0));

        if (isUp) {
            Component c = getComponent(start);

            SoundLayerPanel panel = (SoundLayerPanel) c;
            remove(start);
            add(c, end);
            
            int i1 = selection.getStartIndex() - 1;
            int i2 = selection.getEndIndex() - 1;

            selection.setAnchor(i1);
            selection.setEnd(i2);

        } else {
            // have to flip because listDataEvent stores as min and max
            Component c = getComponent(-start);

            SoundLayerPanel panel = (SoundLayerPanel) c;
            remove(-start);
            add(c, -end);

            int i1 = selection.getStartIndex() + 1;
            int i2 = selection.getEndIndex() + 1;

            selection.setAnchor(i1);
            selection.setEnd(i2);
        }

        revalidate();
    }

    /* Keyboard Actions */

    class UpAction extends AbstractAction {

        public UpAction() {
            super("up");
            putValue(Action.SHORT_DESCRIPTION, "Up Action");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_UP, 0));
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            int index = selection.getLastIndexSet() - 1;
            index = index < 0 ? 0 : index;

//            if (index != selection.getStartIndex()) {
                selection.setAnchor(index);
            //}

        }

    }

    class ShiftUpAction extends AbstractAction {

        public ShiftUpAction() {
            super("shift-up");
            putValue(Action.SHORT_DESCRIPTION, "Shift-Up Action");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_UP, InputEvent.SHIFT_DOWN_MASK));
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            int index = selection.getLastIndexSet() - 1;
            index = index < 0 ? 0 : index;

            selection.setEnd(index);
        }

    }

    class DownAction extends AbstractAction {

        public DownAction() {
            super("down");
            putValue(Action.SHORT_DESCRIPTION, "Down Action");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_DOWN, 0));
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            int index = selection.getLastIndexSet() + 1;
            int length = getComponents().length;
            index = index >= length ? length - 1 : index;

//            if (index != selection.getEndIndex()) {
                selection.setAnchor(index);
//            }
        }

    }

    class ShiftDownAction extends AbstractAction {

        public ShiftDownAction() {
            super("shift-Down");
            putValue(Action.SHORT_DESCRIPTION, "Shift-Down Action");
            putValue(Action.ACCELERATOR_KEY, KeyStroke.getKeyStroke(
                    KeyEvent.VK_DOWN, InputEvent.SHIFT_DOWN_MASK));
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            int index = selection.getLastIndexSet() + 1;
            int length = getComponents().length;
            index = index >= length ? length - 1 : index;

            selection.setEnd(index);
        }

    }
    
    class PushUpAction extends AbstractAction {

        public PushUpAction() {
            super("Push Up Layers");
        }
        
        @Override
        public void actionPerformed(ActionEvent e) {
            int start = selection.getStartIndex();
            int end = selection.getEndIndex();

            if (end < 0 || start == 0) {
                return;
            }

            pObj.pushUpLayers(start, end);

            selection.setAnchor(start - 1);
        }

    }
    
    class PushDownAction extends AbstractAction {

        public PushDownAction() {
            super("Push Down Layers");
        }
        
        @Override
        public void actionPerformed(ActionEvent e) {     
            int start = selection.getStartIndex();
            int end = selection.getEndIndex();

            if (end < 0 || end >= pObj.size() - 1) {
                return;
            }

            pObj.pushDownLayers(start, end);

            selection.setAnchor(start + 1);
        }

    }
    
    class LayerAddAction extends AbstractAction {

        public LayerAddAction() {
            super("Add Layer");
        }
        
        @Override
        public void actionPerformed(ActionEvent e) {
            int end = selection.getEndIndex();

            if (end < 0) {
                return;
            } 
            end++;
            
            pObj.newLayerAt(end);

        }

    }
    
    class LayerRemoveAction extends AbstractAction {

        public LayerRemoveAction() {
            super("Remove Layers");
        }
        
        @Override
        public void actionPerformed(ActionEvent e) {
            int start = selection.getStartIndex();
            int end = selection.getEndIndex();

            if (end < 0 || pObj.size() < 2) {
                return;
            }

            int len = (end - start) + 1;

            String message = BlueSystem
                    .getString("soundLayerEditPanel.delete.message1")
                    + " "
                    + len
                    + " "
                    + BlueSystem.getString("soundLayerEditPanel.delete.message2");
            if (JOptionPane.showConfirmDialog(null, message) == JOptionPane.OK_OPTION) {
                pObj.removeLayers(start, end);
                selection.setAnchor(-1);
            }
        }
        
    }
}
