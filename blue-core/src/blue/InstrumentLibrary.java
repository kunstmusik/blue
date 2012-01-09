/*
 * blue - object composition environment for csound Copyright (c) 2000-2003
 * Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue;

import blue.orchestra.Instrument;
import blue.orchestra.InstrumentCategory;
import blue.utility.ListUtil;
import electric.xml.Element;
import java.io.Serializable;
import java.util.*;
import javax.swing.event.TreeModelEvent;
import javax.swing.event.TreeModelListener;
import javax.swing.tree.TreeModel;
import javax.swing.tree.TreePath;

/**
 * @author steven
 * 
 * Tree like data holder for instruments and instrumentCategories.
 * 
 */

public class InstrumentLibrary implements Serializable, TreeModel {

    InstrumentCategory rootInstrumentCategory = new InstrumentCategory();

    transient Vector<TreeModelListener> listeners = new Vector<TreeModelListener>();

    public InstrumentLibrary() {
        this.rootInstrumentCategory.setRoot(true);
        this.rootInstrumentCategory.setCategoryName(BlueSystem
                .getString("instrument.instrumentLibrary"));
    }

    public InstrumentCategory getRootInstrumentCategory() {
        return rootInstrumentCategory;
    }

    public void setRootInstrumentCategory(
            InstrumentCategory rootInstrumentCategory) {
        this.rootInstrumentCategory = rootInstrumentCategory;
    }

    public void addInstrument(InstrumentCategory parent, Instrument instr) {
        addInstrument(parent, -1, instr);
    }

    public void addInstrument(InstrumentCategory parent, int insertIndex,
            Instrument instr) {
        if (insertIndex < 0 || insertIndex >= parent.getInstruments().size()) {
            parent.addInstrument(instr);
        } else {
            parent.addInstrument(insertIndex, instr);
        }

        int index = getIndexOfChild(parent, instr);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = instr;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(instr),
                childIndices, children);
        fireNodesInserted(e);
    }

    private Object[] getPathForObject(Object obj) {
        Vector v = new Vector();
        getPathForObject(getRootInstrumentCategory(), obj, v);

        Collections.reverse(v);

        return v.toArray();
    }

    private Object getPathForObject(InstrumentCategory current, Object obj,
            Vector v) {

        if (current == obj) {
            return v;
        }

        if (ListUtil.containsByRef(current.getInstruments(), obj)) {
            v.add(current);
            return v;
        }

        for (Iterator iter = current.getSubCategories().iterator(); iter
                .hasNext();) {
            InstrumentCategory cat = (InstrumentCategory) iter.next();
            Object pathObj = getPathForObject(cat, obj, v);
            if (pathObj != null) {
                v.add(current);
                return v;
            }
        }

        return null;

    }

    public void addCategory(InstrumentCategory parent, InstrumentCategory cat) {
        parent.addInstrumentCategory(cat);

        int index = getIndexOfChild(parent, cat);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = cat;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(cat),
                childIndices, children);
        fireNodesInserted(e);
    }

    public void removeInstrument(Instrument instr) {
        InstrumentCategory parent = findParent(rootInstrumentCategory, instr);
        int index = getIndexOfChild(parent, instr);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = instr;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(instr),
                childIndices, children);

        rootInstrumentCategory.removeInstrument(instr);

        fireNodesRemoved(e);
    }

    public void removeCategory(InstrumentCategory cat) {
        InstrumentCategory parent = findParent(rootInstrumentCategory, cat);
        int index = getIndexOfChild(parent, cat);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = cat;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(cat),
                childIndices, children);

        rootInstrumentCategory.removeInstrumentCategory(cat);

        fireNodesRemoved(e);
    }

    // SERIALIZATION METHODS

    public static InstrumentLibrary loadFromXML(Element data) throws Exception {
        InstrumentLibrary iLibrary = new InstrumentLibrary();
        iLibrary.setRootInstrumentCategory(InstrumentCategory.loadFromXML(data
                .getElement("instrumentCategory")));

        return iLibrary;
    }

    public Element saveAsXML() {
        Element retVal = new Element("instrumentLibrary");
        retVal.addElement(rootInstrumentCategory.saveAsXML());

        return retVal;
    }

    public String getInstrumentId(Instrument instr) {
        return rootInstrumentCategory.getInstrumentId(instr);
    }

    public Instrument getInstrumentById(String instrId) {
        StringTokenizer st = new StringTokenizer(instrId, ":");
        int idArray[] = new int[st.countTokens()];

        int count = 0;
        while (st.hasMoreTokens()) {
            idArray[count] = Integer.parseInt(st.nextToken());
            count++;
        }
        return getRootInstrumentCategory().getInstrumentById(idArray, 0);
    }

    // TREE MODEL METHODS

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#getRoot()
     */
    public Object getRoot() {
        return getRootInstrumentCategory();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#getChildCount(java.lang.Object)
     */
    public int getChildCount(Object parent) {
        if (parent instanceof Instrument) {
            return 0;
        } else if (parent instanceof InstrumentCategory) {
            InstrumentCategory cat = (InstrumentCategory) parent;
            return cat.getSubCategories().size() + cat.getInstruments().size();
        }

        return 0;
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#isLeaf(java.lang.Object)
     */
    public boolean isLeaf(Object node) {
        return (node instanceof Instrument);
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

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#valueForPathChanged(javax.swing.tree.TreePath,
     *      java.lang.Object)
     */
    public void valueForPathChanged(TreePath path, Object newValue) {
        Object obj = path.getLastPathComponent();

        if (obj instanceof InstrumentCategory) {
            ((InstrumentCategory) obj).setCategoryName(newValue.toString());
        } else if (obj instanceof Instrument) {
            ((Instrument) obj).setName(newValue.toString());
        }

        TreeModelEvent e = new TreeModelEvent(this, path);
        fireNodesChanged(e);

    }

    // UTILITY METHODS FOR FIRING EVENTS

    private void fireNodesChanged(TreeModelEvent e) {
        for (int i = 0; i < listeners.size(); i++) {
            listeners.get(i).treeNodesChanged(e);
        }
    }

    private void fireNodesInserted(TreeModelEvent e) {
        for (int i = 0; i < listeners.size(); i++) {
            listeners.get(i).treeNodesInserted(e);
        }
    }

    private void fireNodesRemoved(TreeModelEvent e) {
        for (int i = 0; i < listeners.size(); i++) {
            listeners.get(i).treeNodesRemoved(e);
        }
    }

    private void fireTreeStructureChanged(TreeModelEvent e) {
        for (int i = 0; i < listeners.size(); i++) {
            listeners.get(i).treeStructureChanged(e);
        }
    }

    public Object getChild(Object parent, int index) {
        InstrumentCategory category = (InstrumentCategory) parent;

        if (category == null) {
            return null;
        }

        if (index >= category.getSubCategories().size()) {
            return category.getInstruments().get(
                    index - category.getSubCategories().size());
        }

        return category.getSubCategories().get(index);

    }

    public int getIndexOfChild(Object parent, Object child) {
        InstrumentCategory category = (InstrumentCategory) parent;

        if (category == null || child == null) {
            return -1;
        }

        int retVal = ListUtil.indexOfByRef(category.getSubCategories(), child);

        if (retVal >= 0) {
            return retVal;
        }

        retVal = ListUtil.indexOfByRef(category.getInstruments(), child);

        if (retVal >= 0) {
            return retVal + category.getSubCategories().size();
        }

        return -1;
    }

    private InstrumentCategory findParent(InstrumentCategory cat, Object obj) {

        if (ListUtil.containsByRef(cat.getInstruments(), obj)
                || ListUtil.containsByRef(cat.getSubCategories(), obj)) {
            return cat;
        }

        // if (cat.getInstruments().contains(obj)
        // || cat.getSubCategories().contains(obj)) {
        // return cat;
        // }

        for (Iterator iter = cat.getSubCategories().iterator(); iter.hasNext();) {
            InstrumentCategory c = (InstrumentCategory) iter.next();

            InstrumentCategory temp = findParent(c, obj);

            if (temp != null) {
                return temp;
            }

        }

        return null;
    }

    /**
     * @param library
     */
    public void importLibrary(InstrumentLibrary library) {
        InstrumentCategory category = library.getRootInstrumentCategory();

        category.setCategoryName("Imported from Project");

        addCategory(getRootInstrumentCategory(), category);

    }

    public void importInstrument(Instrument instr) {
        List categories = rootInstrumentCategory.getSubCategories();

        for (Iterator iter = categories.iterator(); iter.hasNext();) {
            InstrumentCategory cat = (InstrumentCategory) iter.next();
            if (cat.getCategoryName().equals("Imported Instruments")) {
                addInstrument(cat, instr);
                return;
            }
        }

        InstrumentCategory cat = new InstrumentCategory();
        cat.setCategoryName("Imported Instruments");
        cat.addInstrument(instr);

        addCategory(rootInstrumentCategory, cat);

    }
}