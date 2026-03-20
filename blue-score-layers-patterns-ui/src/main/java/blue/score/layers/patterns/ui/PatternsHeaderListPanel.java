/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.score.layers.patterns.ui;

import blue.score.Score;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.score.layers.patterns.core.PatternLayer;
import blue.score.layers.patterns.core.PatternsLayerGroup;
import blue.soundObject.SoundObject;
import blue.ui.utilities.LinearLayout;
import blue.ui.utilities.LayerSelectionCoordinator;
import blue.ui.utilities.LayerSelectionProvider;
import blue.ui.utilities.SelectionModel;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Toolkit;
import java.awt.event.ActionEvent;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.Collection;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.BoxLayout;
import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.Timer;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import org.openide.util.Lookup;
import org.openide.util.LookupEvent;
import org.openide.util.LookupListener;
import org.openide.util.Utilities;
import org.openide.util.lookup.InstanceContent;
import skt.swing.SwingUtil;

/**
 *
 * @author stevenyi
 */
public class PatternsHeaderListPanel extends JPanel implements 
        LayerGroupListener, LookupListener, LayerSelectionProvider {

    private final PatternsLayerGroup layerGroup;
    
    private SelectionModel selection = new SelectionModel();
    private LayerSelectionCoordinator coordinator;

    JPopupMenu menu;

    private InstanceContent content;

    Lookup.Result<SoundObject> result = null;

    private final Timer openSoundObjectEditorTimer;

    private PatternLayerPanel pendingSoundObjectEditor = null;

    public PatternsHeaderListPanel(PatternsLayerGroup patternsLayerGroup, InstanceContent ic) {
        this.content = ic;
        this.layerGroup = patternsLayerGroup;
        this.layerGroup.addLayerGroupListener(this);
        this.setLayout(new LinearLayout());
        this.setPreferredSize(new Dimension(30,
                22 * patternsLayerGroup.size()));

        int clickInterval = 250;
        Object desktopProperty = Toolkit.getDefaultToolkit()
                .getDesktopProperty("awt.multiClickInterval");
        if (desktopProperty instanceof Number number) {
            clickInterval = number.intValue();
        }

        openSoundObjectEditorTimer = new Timer(clickInterval, e -> {
            PatternLayerPanel panel = pendingSoundObjectEditor;
            pendingSoundObjectEditor = null;
            if (panel != null) {
                panel.openSoundObjectEditor();
            }
        });
        openSoundObjectEditorTimer.setRepeats(false);

        for (PatternLayer layer : patternsLayerGroup) {
            this.add(new PatternLayerPanel(layer, ic));
        }
        
        selection.addChangeListener(new ChangeListener() {
            @Override
            public void stateChanged(ChangeEvent e) {
                updateSelection();
                int start = selection.getStartIndex();
                int end = selection.getEndIndex();
                if (start < 0 || start != end) {
                    clearSelectedSoundObjects();
                }
            }
        });

        
        final LayerAddAboveAction layerAddAboveAction = new LayerAddAboveAction();
        final LayerAddBelowAction layerAddBelowAction = new LayerAddBelowAction();
        final LayerRemoveAction layerRemoveAction = new LayerRemoveAction();
        final PushUpAction pushUpAction = new PushUpAction();
        final PushDownAction pushDownAction = new PushDownAction();
        
        menu = new JPopupMenu("Layer Operations") {

            @Override
            public void show(Component invoker, int x, int y) {
                if(layerGroup == null) {
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
                pushDownAction.setEnabled(selection.getEndIndex() < layerGroup.size() - 1);
                
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
                cancelPendingSoundObjectEditor();
                PatternsHeaderListPanel.this.requestFocus();

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
                                    && coordinator.getAnchorProvider() != PatternsHeaderListPanel.this) {
                                coordinator.handleCrossGroupShiftClick(
                                        PatternsHeaderListPanel.this, index);
                            } else {
                                selection.setEnd(index);
                            }
                            clearSelectedSoundObjects();
                        } else {
                            selection.setAnchor(index);
                            PatternLayerPanel panel = (PatternLayerPanel) c;
                            panel.selectSoundObject();
                            panel.setSelected(true);
                            scheduleSoundObjectEditor(panel);
                        }

                    } else if (me.getClickCount() == 2) {
                        Component c = SwingUtilities.getDeepestComponentAt(
                                PatternsHeaderListPanel.this, me.getX(), me.getY());

                        if (c instanceof JLabel) {
                            cancelPendingSoundObjectEditor();
                            Component panel = getComponentAt(me.getPoint());

                            ((PatternLayerPanel) panel).editName();

                        }

                    }
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

    private void clearSelectedSoundObjects() {
        if (layerGroup == null) {
            return;
        }

        for (PatternLayer pLayer : layerGroup) {
            content.remove(pLayer.getSoundObject());
        }
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
    
    private void updateSelection() {
        int start = selection.getStartIndex();
        int end = selection.getEndIndex();

        Component[] comps = getComponents();

        for (int i = 0; i < comps.length; i++) {
            PatternLayerPanel panel = (PatternLayerPanel) comps[i];
            panel.setSelected(i >= start && i <= end);
        }
    }
    
    @Override
    public SelectionModel getSelectionModel() {
        return selection;
    }

    @Override
    public int getLayerCount() {
        return layerGroup == null ? 0 : layerGroup.size();
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
        if (end < 0 || layerGroup == null) {
            return;
        }
        boolean removingAll = ((end - start) + 1 >= layerGroup.size());
        layerGroup.removeLayers(start, end);
        selection.setAnchor(-1);
        if (removingAll && deleteEmptyGroup) {
            blue.score.Score score = blue.ui.core.score.ScoreController.getInstance().getScore();
            int groupIndex = score.indexOf(layerGroup);
            if (groupIndex >= 0) {
                score.remove(groupIndex);
            }
        }
    }

    public void checkSize() {
        if (layerGroup == null || getParent() == null) {
            setSize(0, 0);
            return;
        }

        int w = getParent().getWidth();

        int h = layerGroup.size() * Layer.LAYER_HEIGHT;

        this.setSize(w, h);
    }

    @Override
    public void addNotify() {
        super.addNotify();

        result = Utilities.actionsGlobalContext().lookupResult(SoundObject.class);
        result.addLookupListener (this);
        resultChanged(null);
    }
    
    @Override
    public void removeNotify() {
        cancelPendingSoundObjectEditor();
        if(this.layerGroup != null) {
            this.layerGroup.removeLayerGroupListener(this);
        }
        result.removeLookupListener(this);
        super.removeNotify();
    }

    private void scheduleSoundObjectEditor(PatternLayerPanel panel) {
        pendingSoundObjectEditor = panel;
        openSoundObjectEditorTimer.restart();
    }

    private void cancelPendingSoundObjectEditor() {
        pendingSoundObjectEditor = null;
        if (openSoundObjectEditorTimer.isRunning()) {
            openSoundObjectEditorTimer.stop();
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
        PatternLayer sLayer = layerGroup.get(index);

        PatternLayerPanel panel = new PatternLayerPanel(sLayer, content);
        
        this.add(panel, index);
        checkSize();
    }

    public void layersRemoved(LayerGroupDataEvent e) {
        int start = e.getStartIndex();
        int end = e.getEndIndex();

        for (int i = end; i >= start; i--) {
            remove(i);
        }

        checkSize();

        selection.setAnchor(-1);
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

            PatternLayerPanel panel = (PatternLayerPanel) c;
            remove(start);
            add(c, end);

            selection.setAnchor(anchorIndex - 1);
            selection.setEnd(leadIndex - 1);

        } else {
            // have to flip because listDataEvent stores as min and max
            Component c = getComponent(-start);

            PatternLayerPanel panel = (PatternLayerPanel) c;
            remove(-start);
            add(c, -end);

            selection.setAnchor(anchorIndex + 1);
            selection.setEnd(leadIndex + 1);
        }

        revalidate();
    }

    @Override
    public void resultChanged(LookupEvent ev) {
        Collection<? extends SoundObject> allEvents = result.allInstances();

        if (pendingSoundObjectEditor != null) {
            return;
        }

        if (allEvents.isEmpty()) {
            selection.clear();
            return;
        }

        boolean found = false;

        for(PatternLayer pLayer : layerGroup) {
            if(allEvents.contains(pLayer.getSoundObject())) {
                found = true;
                break;
            }
        }

        if(!found) {
            selection.clear();
        }
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
                ((PatternLayerPanel)getComponent(index)).editSoundObject();
//            }

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
            
            clearSelectedSoundObjects();
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
                ((PatternLayerPanel)getComponent(index)).editSoundObject();
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
            
            clearSelectedSoundObjects();
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

            layerGroup.pushUpLayers(start, end);

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

            if (end < 0 || end >= layerGroup.size() - 1) {
                return;
            }

            layerGroup.pushDownLayers(start, end);

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
            layerGroup.newLayerAt(start);
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
            layerGroup.newLayerAt(end);
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
            boolean removingAll = (len >= layerGroup.size());

            String message = "Please confirm deleting these "
                    + len
                    + " layers.";

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
                layerGroup.removeLayers(start, end);
                selection.setAnchor(-1);

                if (removingAll && deleteGroupCb.isSelected()) {
                    Score score = blue.ui.core.score.ScoreController.getInstance().getScore();
                    int groupIndex = score.indexOf(layerGroup);
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

            String message = "Please confirm deleting these "
                    + totalLayers
                    + " layers.";

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
