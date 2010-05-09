/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

import java.io.Serializable;
import java.util.Collections;
import java.util.Iterator;
import java.util.Vector;

import javax.swing.event.TreeModelEvent;
import javax.swing.event.TreeModelListener;
import javax.swing.tree.TreeModel;
import javax.swing.tree.TreePath;

import blue.orchestra.blueSynthBuilder.Preset;
import blue.orchestra.blueSynthBuilder.PresetGroup;

/**
 * @author Steven
 * 
 */
public class PresetsTreeModel implements Serializable, TreeModel {

    PresetGroup rootGroup;

    transient Vector listeners = new Vector();

    public PresetsTreeModel(PresetGroup rootGroup) {
        this.rootGroup = rootGroup;
    }

    public void addPreset(PresetGroup parent, Preset preset) {
        parent.addPreset(preset);

        int index = getIndexOfChild(parent, preset);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = preset;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(preset),
                childIndices, children);
        fireNodesInserted(e);
    }

    public void addPresetGroup(PresetGroup parent, PresetGroup presetGroup) {
        parent.addPresetGroup(presetGroup);

        int index = getIndexOfChild(parent, presetGroup);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = presetGroup;

        TreeModelEvent e = new TreeModelEvent(this,
                getPathForObject(presetGroup), childIndices, children);
        fireNodesInserted(e);
    }

    public void removePreset(Preset preset) {
        PresetGroup parent = findParent(rootGroup, preset);
        int index = getIndexOfChild(parent, preset);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = preset;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(preset),
                childIndices, children);

        rootGroup.removePreset(preset);

        fireNodesRemoved(e);
    }

    public void removePresetGroup(PresetGroup presetGroup) {
        PresetGroup parent = findParent(rootGroup, presetGroup);
        int index = getIndexOfChild(parent, presetGroup);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = presetGroup;

        TreeModelEvent e = new TreeModelEvent(this,
                getPathForObject(presetGroup), childIndices, children);

        rootGroup.removePresetGroup(presetGroup);

        fireNodesRemoved(e);
    }

    /* TREE MODEL METHODS */

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#getRoot()
     */
    public Object getRoot() {
        return rootGroup;
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#getChild(java.lang.Object, int)
     */
    public Object getChild(Object parent, int index) {
        PresetGroup presetGroup = (PresetGroup) parent;

        if (presetGroup == null) {
            return null;
        }

        if (index >= presetGroup.getSubGroups().size()) {
            return presetGroup.getPresets().get(
                    index - presetGroup.getSubGroups().size());
        }

        return presetGroup.getSubGroups().get(index);
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#getChildCount(java.lang.Object)
     */
    public int getChildCount(Object parent) {
        if (parent instanceof Preset) {
            return 0;
        } else if (parent instanceof PresetGroup) {
            PresetGroup presetGroup = (PresetGroup) parent;
            return presetGroup.getSubGroups().size()
                    + presetGroup.getPresets().size();
        }

        return 0;

    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#isLeaf(java.lang.Object)
     */
    public boolean isLeaf(Object node) {
        return (node instanceof Preset);
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#valueForPathChanged(javax.swing.tree.TreePath,
     *      java.lang.Object)
     */
    public void valueForPathChanged(TreePath path, Object newValue) {
        Object obj = path.getLastPathComponent();

        if (obj instanceof PresetGroup) {
            ((PresetGroup) obj).setPresetGroupName(newValue.toString());
        } else if (obj instanceof Preset) {
            ((Preset) obj).setPresetName(newValue.toString());
        }

        TreeModelEvent e = new TreeModelEvent(this, path);

        fireNodesChanged(e);
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#getIndexOfChild(java.lang.Object,
     *      java.lang.Object)
     */
    public int getIndexOfChild(Object parent, Object child) {
        PresetGroup presetGroup = (PresetGroup) parent;

        if (presetGroup == null || child == null) {
            return -1;
        }

        int retVal = presetGroup.getSubGroups().indexOf(child);

        if (retVal >= 0) {
            return retVal;
        }

        retVal = presetGroup.getPresets().indexOf(child);

        if (retVal >= 0) {
            return retVal + presetGroup.getSubGroups().size();
        }

        return -1;
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#addTreeModelListener(javax.swing.event.TreeModelListener)
     */
    public void addTreeModelListener(TreeModelListener l) {
        listeners.add(l);
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#removeTreeModelListener(javax.swing.event.TreeModelListener)
     */
    public void removeTreeModelListener(TreeModelListener l) {
        listeners.remove(l);
    }

    // UTILITY METHODS FOR FIRING EVENTS

    private void fireNodesChanged(TreeModelEvent e) {
        for (int i = 0; i < listeners.size(); i++) {
            ((TreeModelListener) listeners.get(i)).treeNodesChanged(e);
        }
    }

    private void fireNodesInserted(TreeModelEvent e) {
        for (int i = 0; i < listeners.size(); i++) {
            ((TreeModelListener) listeners.get(i)).treeNodesInserted(e);
        }
    }

    private void fireNodesRemoved(TreeModelEvent e) {
        for (int i = 0; i < listeners.size(); i++) {
            ((TreeModelListener) listeners.get(i)).treeNodesRemoved(e);
        }
    }

    private void fireTreeStructureChanged(TreeModelEvent e) {
        for (int i = 0; i < listeners.size(); i++) {
            ((TreeModelListener) listeners.get(i)).treeStructureChanged(e);
        }
    }

    private Object[] getPathForObject(Object obj) {
        Vector v = new Vector();
        getPathForObject(rootGroup, obj, v);

        Collections.reverse(v);

        return v.toArray();
    }

    private Object getPathForObject(PresetGroup current, Object obj, Vector v) {

        if (current == obj) {
            return v;
        }

        if (current.getPresets().contains(obj)) {
            v.add(current);
            return v;
        }

        for (Iterator iter = current.getSubGroups().iterator(); iter.hasNext();) {
            PresetGroup pGroup = (PresetGroup) iter.next();
            Object pathObj = getPathForObject(pGroup, obj, v);
            if (pathObj != null) {
                v.add(current);
                return v;
            }
        }

        return null;

    }

    private PresetGroup findParent(PresetGroup presetGroup, Object obj) {

        if (presetGroup.getPresets().contains(obj)
                || presetGroup.getSubGroups().contains(obj)) {
            return presetGroup;
        }

        for (Iterator iter = presetGroup.getSubGroups().iterator(); iter
                .hasNext();) {
            PresetGroup c = (PresetGroup) iter.next();

            PresetGroup temp = findParent(c, obj);

            if (temp != null) {
                return temp;
            }

        }

        return null;
    }

}