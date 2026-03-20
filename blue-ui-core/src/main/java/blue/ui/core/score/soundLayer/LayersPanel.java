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
import blue.score.Score;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.soundObject.PolyObject;
import blue.ui.core.score.ScoreController;
import blue.ui.utilities.LayerSelectionCoordinator;
import blue.ui.utilities.LayerSelectionProvider;
import blue.ui.utilities.SelectionModel;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JComponent;
import javax.swing.BoxLayout;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import skt.swing.SwingUtil;

public class LayersPanel extends JComponent implements LayerGroupListener, LayerSelectionProvider {

    private final SoundLayerLayout layout = new SoundLayerLayout();

    private PolyObject pObj = null;

    private NoteProcessorChainMap npcMap = null;

    private final SelectionModel selection = new SelectionModel();
    private LayerSelectionCoordinator coordinator;
    
    JPopupMenu menu;

    public LayersPanel() {
        
        this.setLayout(layout);

        this.setMinimumSize(new Dimension(0, 0));
 
        final LayerAddAboveAction layerAddAboveAction = new LayerAddAboveAction();
        final LayerAddBelowAction layerAddBelowAction = new LayerAddBelowAction();
        final LayerRemoveAction layerRemoveAction = new LayerRemoveAction();
        final PushUpAction pushUpAction = new PushUpAction();
        final PushDownAction pushDownAction = new PushDownAction();

        menu = new JPopupMenu("Layer Operations") {

            @Override
            public void show(Component invoker, int x, int y) {
                if(pObj == null) {
                    return;
                }

                boolean multiGroup = coordinator != null
                        && coordinator.isMultiGroupSelected();
                int selCount = selection.getEndIndex() - selection.getStartIndex() + 1;
                boolean singleSel = !multiGroup && selCount == 1;

                for (int i = 0; i < getComponentCount(); i++) {
                    Component c = getComponent(i);
                    if (c instanceof javax.swing.JMenuItem mi) {
                        Action a = mi.getAction();
                        if (a instanceof LayerAddAboveAction
                                || a instanceof LayerAddBelowAction) {
                            mi.setVisible(singleSel);
                        } else if (a instanceof PushUpAction
                                || a instanceof PushDownAction) {
                            mi.setVisible(!multiGroup);
                        }
                    }
                }

                layerRemoveAction.setEnabled(selection.getStartIndex() >= 0);
                pushUpAction.setEnabled(selection.getStartIndex() >= 1);
                pushDownAction.setEnabled(selection.getEndIndex() < pObj.size() - 1);
                
                super.show(invoker, x, y);
            }
            
        };
        
        menu.add(layerAddAboveAction);
        menu.add(layerAddBelowAction);
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
                            if (coordinator != null) {
                                coordinator.clearSelections();
                            } else {
                                selection.clear();
                            }
                            return;
                        }

                        if (me.isShiftDown()) {
                            if (coordinator != null
                                    && coordinator.getAnchorProvider() != null
                                    && coordinator.getAnchorProvider() != LayersPanel.this) {
                                coordinator.handleCrossGroupShiftClick(
                                        LayersPanel.this, index);
                            } else {
                                selection.setEnd(index);
                            }
                        } else {
                            selection.setAnchor(index);
                        }

                    } else if (me.getClickCount() == 2) {
                        Component c = SwingUtilities.getDeepestComponentAt(
                                LayersPanel.this, me.getX(), me.getY());

                        if (c instanceof JLabel) {
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

    @Override
    public SelectionModel getSelectionModel() {
        return selection;
    }

    @Override
    public int getLayerCount() {
        return pObj == null ? 0 : pObj.size();
    }

    @Override
    public void setCoordinator(LayerSelectionCoordinator coordinator) {
        this.coordinator = coordinator;
    }

    @Override
    public LayerSelectionCoordinator getCoordinator() {
        return coordinator;
    }

    @Override
    public void removeSelectedLayers(boolean deleteEmptyGroup) {
        int start = selection.getStartIndex();
        int end = selection.getEndIndex();
        if (end < 0 || pObj == null) {
            return;
        }
        boolean removingAll = ((end - start) + 1 >= pObj.size());
        pObj.removeLayers(start, end);
        selection.setAnchor(-1);
        if (removingAll && deleteEmptyGroup) {
            Score score = ScoreController.getInstance().getScore();
            int groupIndex = score.indexOf(pObj);
            if (groupIndex >= 0) {
                score.remove(groupIndex);
            }
        }
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
        int anchorIndex = selection.getAnchorIndex();
        int leadIndex = selection.getLeadIndex();

        // This is a hack to determine what direction the layers were
        // pushed
        boolean isUp = ((start >= 0) && (end >= 0));

        if (isUp) {
            Component c = getComponent(start);

            SoundLayerPanel panel = (SoundLayerPanel) c;
            remove(start);
            add(c, end);

            selection.setAnchor(anchorIndex - 1);
            selection.setEnd(leadIndex - 1);

        } else {
            // have to flip because listDataEvent stores as min and max
            Component c = getComponent(-start);

            SoundLayerPanel panel = (SoundLayerPanel) c;
            remove(-start);
            add(c, -end);

            selection.setAnchor(anchorIndex + 1);
            selection.setEnd(leadIndex + 1);
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
            int anchorIndex = selection.getAnchorIndex();
            int leadIndex = selection.getLeadIndex();

            if (end < 0 || start == 0) {
                return;
            }

            pObj.pushUpLayers(start, end);

            selection.setAnchor(anchorIndex - 1);
            selection.setEnd(leadIndex - 1);
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
            int anchorIndex = selection.getAnchorIndex();
            int leadIndex = selection.getLeadIndex();

            if (end < 0 || end >= pObj.size() - 1) {
                return;
            }

            pObj.pushDownLayers(start, end);

            selection.setAnchor(anchorIndex + 1);
            selection.setEnd(leadIndex + 1);
        }

    }
    
    class LayerAddAboveAction extends AbstractAction {

        public LayerAddAboveAction() {
            super("Add Layer Above");
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            int start = selection.getStartIndex();
            if (start < 0) {
                return;
            }
            pObj.newLayerAt(start);
        }
    }

    class LayerAddBelowAction extends AbstractAction {

        public LayerAddBelowAction() {
            super("Add Layer Below");
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
            boolean multiGroup = coordinator != null
                    && coordinator.isMultiGroupSelected();

            if (multiGroup) {
                performCrossGroupRemove();
                return;
            }

            int start = selection.getStartIndex();
            int end = selection.getEndIndex();

            if (end < 0) {
                return;
            }

            int len = (end - start) + 1;
            boolean removingAll = (len >= pObj.size());

            String message = BlueSystem
                    .getString("soundLayerEditPanel.delete.message1")
                    + " "
                    + len
                    + " "
                    + BlueSystem.getString("soundLayerEditPanel.delete.message2");

            JCheckBox deleteGroupCb = null;
            Object dialogMessage;
            if (removingAll) {
                deleteGroupCb = new JCheckBox("Delete empty Layer Group", true);
                JPanel panel = new JPanel();
                panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
                panel.add(new JLabel(message));
                panel.add(deleteGroupCb);
                dialogMessage = panel;
            } else {
                dialogMessage = message;
            }

            if (JOptionPane.showConfirmDialog(null, dialogMessage) == JOptionPane.OK_OPTION) {
                pObj.removeLayers(start, end);
                selection.setAnchor(-1);

                if (removingAll && deleteGroupCb.isSelected()) {
                    Score score = ScoreController.getInstance().getScore();
                    int groupIndex = score.indexOf(pObj);
                    if (groupIndex >= 0) {
                        score.remove(groupIndex);
                    }
                }
            }
        }

        private void performCrossGroupRemove() {
            var selected = coordinator.getSelectedProviders();
            int totalLayers = 0;
            boolean anyRemovingAll = false;
            for (var p : selected) {
                var sm = p.getSelectionModel();
                int len = sm.getEndIndex() - sm.getStartIndex() + 1;
                totalLayers += len;
                if (len >= p.getLayerCount()) {
                    anyRemovingAll = true;
                }
            }

            String message = BlueSystem
                    .getString("soundLayerEditPanel.delete.message1")
                    + " "
                    + totalLayers
                    + " "
                    + BlueSystem.getString("soundLayerEditPanel.delete.message2");

            JCheckBox deleteGroupCb = null;
            Object dialogMessage;
            if (anyRemovingAll) {
                deleteGroupCb = new JCheckBox("Delete empty Layer Groups", true);
                JPanel panel = new JPanel();
                panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
                panel.add(new JLabel(message));
                panel.add(deleteGroupCb);
                dialogMessage = panel;
            } else {
                dialogMessage = message;
            }

            if (JOptionPane.showConfirmDialog(null, dialogMessage) == JOptionPane.OK_OPTION) {
                boolean deleteEmpty = deleteGroupCb != null && deleteGroupCb.isSelected();
                for (var p : selected) {
                    p.removeSelectedLayers(deleteEmpty);
                }
            }
        }
        
    }
}
