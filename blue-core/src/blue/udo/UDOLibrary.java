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

package blue.udo;

import blue.utility.ListUtil;
import electric.xml.Element;
import java.io.Serializable;
import java.util.Collections;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.event.TreeModelEvent;
import javax.swing.event.TreeModelListener;
import javax.swing.tree.TreeModel;
import javax.swing.tree.TreePath;

/**
 * @author steven
 * 
 * Tree like data holder for UserDefinedOpcodes and UDOCategories.
 * 
 */

public class UDOLibrary implements Serializable, TreeModel {

    UDOCategory rootUDOCategory = new UDOCategory();

    transient Vector listeners = new Vector();

    public UDOLibrary() {
        this.rootUDOCategory.setRoot(true);
        this.rootUDOCategory.setCategoryName("UDO Library");
    }

    public UDOCategory getRootUDOCategory() {
        return rootUDOCategory;
    }

    public void setRootUDOCategory(UDOCategory rootUDOCategory) {
        this.rootUDOCategory = rootUDOCategory;
    }

    public void addUDO(UDOCategory parent, UserDefinedOpcode udo) {
        addUDO(parent, -1, udo);
    }

    public void addUDO(UDOCategory parent, int insertIndex,
            UserDefinedOpcode udo) {

        if (insertIndex < 0
                || insertIndex >= parent.getUserDefinedOpcodes().size()) {
            parent.addUDO(udo);
        } else {
            parent.addUDO(insertIndex, udo);
        }

        int index = getIndexOfChild(parent, udo);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = udo;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(udo),
                childIndices, children);
        fireNodesInserted(e);
    }

    private Object[] getPathForObject(Object obj) {
        Vector v = new Vector();
        getPathForObject(getRootUDOCategory(), obj, v);

        Collections.reverse(v);

        return v.toArray();
    }

    private Object getPathForObject(UDOCategory current, Object obj, Vector v) {

        if (current == obj) {
            return v;
        }

        if (ListUtil.containsByRef(current.getUserDefinedOpcodes(), obj)) {
            v.add(current);
            return v;
        }

        for (Iterator iter = current.getSubCategories().iterator(); iter
                .hasNext();) {
            UDOCategory cat = (UDOCategory) iter.next();
            Object pathObj = getPathForObject(cat, obj, v);
            if (pathObj != null) {
                v.add(current);
                return v;
            }
        }

        return null;

    }

    public void addCategory(UDOCategory parent, UDOCategory cat) {
        parent.addUDOCategory(cat);

        int index = getIndexOfChild(parent, cat);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = cat;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(cat),
                childIndices, children);
        fireNodesInserted(e);
    }

    public void removeUDO(UserDefinedOpcode udo) {
        UDOCategory parent = findParent(rootUDOCategory, udo);
        int index = getIndexOfChild(parent, udo);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = udo;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(udo),
                childIndices, children);

        rootUDOCategory.removeUDO(udo);

        fireNodesRemoved(e);
    }

    public void removeCategory(UDOCategory cat) {
        UDOCategory parent = findParent(rootUDOCategory, cat);
        int index = getIndexOfChild(parent, cat);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = cat;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(cat),
                childIndices, children);

        rootUDOCategory.removeUDOCategory(cat);

        fireNodesRemoved(e);
    }

    // SERIALIZATION METHODS

    public static UDOLibrary loadFromXML(Element data) throws Exception {
        UDOLibrary iLibrary = new UDOLibrary();
        iLibrary.setRootUDOCategory(UDOCategory.loadFromXML(data
                .getElement("udoCategory")));

        return iLibrary;
    }

    public Element saveAsXML() {
        Element retVal = new Element("udoLibrary");
        retVal.addElement(rootUDOCategory.saveAsXML());

        return retVal;
    }

    // public String getInstrumentId(Instrument instr) {
    // return rootUDOCategory.getInstrumentId(instr);
    // }
    //
    // public Instrument getInstrumentById(String instrId) {
    // StringTokenizer st = new StringTokenizer(instrId, ":");
    // int idArray[] = new int[st.countTokens()];
    //
    // int count = 0;
    // while (st.hasMoreTokens()) {
    // idArray[count] = Integer.parseInt(st.nextToken());
    // count++;
    // }
    // return getRootUDOCategory().getInstrumentById(idArray, 0);
    // }

    // TREE MODEL METHODS

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#getRoot()
     */
    @Override
    public Object getRoot() {
        return getRootUDOCategory();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#getChildCount(java.lang.Object)
     */
    @Override
    public int getChildCount(Object parent) {
        if (parent instanceof UserDefinedOpcode) {
            return 0;
        } else if (parent instanceof UDOCategory) {
            UDOCategory cat = (UDOCategory) parent;
            return cat.getSubCategories().size()
                    + cat.getUserDefinedOpcodes().size();
        }

        return 0;
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#isLeaf(java.lang.Object)
     */
    @Override
    public boolean isLeaf(Object node) {
        return (node instanceof UserDefinedOpcode);
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#addTreeModelListener(javax.swing.event.TreeModelListener)
     */
    @Override
    public void addTreeModelListener(TreeModelListener l) {
        listeners.add(l);
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#removeTreeModelListener(javax.swing.event.TreeModelListener)
     */
    @Override
    public void removeTreeModelListener(TreeModelListener l) {
        listeners.remove(l);
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#valueForPathChanged(javax.swing.tree.TreePath,
     *      java.lang.Object)
     */
    @Override
    public void valueForPathChanged(TreePath path, Object newValue) {
        Object obj = path.getLastPathComponent();

        if (obj instanceof UDOCategory) {
            ((UDOCategory) obj).setCategoryName(newValue.toString());
        } else if (obj instanceof UserDefinedOpcode) {
            ((UserDefinedOpcode) obj).setOpcodeName(newValue.toString());
        }

        TreeModelEvent e = new TreeModelEvent(this, path);
        fireNodesChanged(e);

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

    @Override
    public Object getChild(Object parent, int index) {
        UDOCategory category = (UDOCategory) parent;

        if (category == null) {
            return null;
        }

        if (index >= category.getSubCategories().size()) {
            return category.getUserDefinedOpcodes().get(
                    index - category.getSubCategories().size());
        }

        return category.getSubCategories().get(index);

    }

    @Override
    public int getIndexOfChild(Object parent, Object child) {
        UDOCategory category = (UDOCategory) parent;

        if (category == null || child == null) {
            return -1;
        }

        int retVal = ListUtil.indexOfByRef(category.getSubCategories(), child);

        if (retVal >= 0) {
            return retVal;
        }

        retVal = ListUtil.indexOfByRef(category.getUserDefinedOpcodes(), child);

        if (retVal >= 0) {
            return retVal + category.getSubCategories().size();
        }

        return -1;
    }

    private UDOCategory findParent(UDOCategory cat, Object obj) {

        if (ListUtil.containsByRef(cat.getUserDefinedOpcodes(), obj)
                || ListUtil.containsByRef(cat.getSubCategories(), obj)) {
            return cat;
        }

        for (Iterator iter = cat.getSubCategories().iterator(); iter.hasNext();) {
            UDOCategory c = (UDOCategory) iter.next();

            UDOCategory temp = findParent(c, obj);

            if (temp != null) {
                return temp;
            }

        }

        return null;
    }

    // /**
    // * @param library
    // */
    // public void importLibrary(InstrumentLibrary library) {
    // UDOCategory category = library.getRootUDOCategory();
    //
    // category.setCategoryName("Imported from Project");
    //
    // addCategory(getRootUDOCategory(), category);
    //
    // }

}