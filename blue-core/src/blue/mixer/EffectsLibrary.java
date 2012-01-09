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

package blue.mixer;

import blue.BlueSystem;
import blue.utility.ListUtil;
import electric.xml.Document;
import electric.xml.Element;
import electric.xml.ParseException;
import java.io.*;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.JOptionPane;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import javax.swing.event.TreeModelEvent;
import javax.swing.event.TreeModelListener;
import javax.swing.tree.TreeModel;
import javax.swing.tree.TreePath;

/**
 * @author steven
 * 
 * Tree like data holder for Effects and EffectCategories.
 * 
 */

public class EffectsLibrary implements Serializable, TreeModel {
    private static EffectsLibrary library = null;

    EffectCategory rootEffectCategory = new EffectCategory();

    transient Vector listeners = new Vector();

    transient Vector changeListeners = new Vector();

    private EffectsLibrary() {
        this.rootEffectCategory.setRoot(true);
        this.rootEffectCategory.setCategoryName("Effects Library");
    }

    public static EffectsLibrary getInstance() {
        if (library == null) {
            String effectLibFileName = BlueSystem
                    .getUserConfigurationDirectory()
                    + File.separator + "effectsLibrary.xml";

            File f = new File(effectLibFileName);

            if (f.exists()) {

                boolean error = false;

                try {
                    Document doc = new Document(f);
                    library = EffectsLibrary.loadFromXML(doc.getRoot());
                } catch (ParseException e1) {
                    e1.printStackTrace();
                    error = true;
                } catch (Exception e) {
                    e.printStackTrace();
                    error = true;
                }

                if (error) {
                    JOptionPane
                            .showMessageDialog(
                                    null,
                                    "There was an error loading "
                                            + f.getAbsolutePath()
                                            + "\nPlease fix this file or remove it and restart blue.",
                                    "Error", JOptionPane.ERROR_MESSAGE);
                    System.exit(0);
                }

            }

            if (library == null) {
                library = new EffectsLibrary();
                System.out.println("Creating new Effects Library");
            }

        }
        return library;
    }

    public EffectCategory getRootEffectCategory() {
        return rootEffectCategory;
    }

    public void setRootEffectCategory(EffectCategory rootEffectCategory) {
        this.rootEffectCategory = rootEffectCategory;
    }

    public void addEffect(EffectCategory parent, Effect effect) {
        addEffect(parent, -1, effect);
    }

    public void addEffect(EffectCategory parent, int insertIndex, Effect effect) {

        if (insertIndex < 0 || insertIndex >= parent.getEffects().size()) {
            parent.addEffect(effect);

        } else {
            parent.addEffect(insertIndex, effect);
        }

        int index = getIndexOfChild(parent, effect);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = effect;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(effect),
                childIndices, children);
        fireNodesInserted(e);
    }

    private Object[] getPathForObject(Object obj) {
        Vector v = new Vector();
        getPathForObject(getRootEffectCategory(), obj, v);

        Collections.reverse(v);

        return v.toArray();
    }

    private Object getPathForObject(EffectCategory current, Object obj, Vector v) {

        if (current == obj) {
            return v;
        }

        if (ListUtil.containsByRef(current.getEffects(), obj)) {
            v.add(current);
            return v;
        }

        for (Iterator iter = current.getSubCategories().iterator(); iter
                .hasNext();) {
            EffectCategory cat = (EffectCategory) iter.next();
            Object pathObj = getPathForObject(cat, obj, v);
            if (pathObj != null) {
                v.add(current);
                return v;
            }
        }

        return null;

    }

    public void addCategory(EffectCategory parent, EffectCategory cat) {
        parent.addEffectCategory(cat);

        int index = getIndexOfChild(parent, cat);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = cat;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(cat),
                childIndices, children);
        fireNodesInserted(e);
    }

    public void removeEffect(Effect effect) {
        EffectCategory parent = findParent(rootEffectCategory, effect);
        int index = getIndexOfChild(parent, effect);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = effect;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(effect),
                childIndices, children);

        rootEffectCategory.removeEffect(effect);

        fireNodesRemoved(e);
    }

    public void removeEffectCategory(EffectCategory cat) {
        EffectCategory parent = findParent(rootEffectCategory, cat);
        int index = getIndexOfChild(parent, cat);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = cat;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(cat),
                childIndices, children);

        rootEffectCategory.removeEffectCategory(cat);

        fireNodesRemoved(e);
    }

    // SERIALIZATION METHODS

    public static EffectsLibrary loadFromXML(Element data) throws Exception {
        EffectsLibrary iLibrary = new EffectsLibrary();
        iLibrary.setRootEffectCategory(EffectCategory.loadFromXML(data
                .getElement("effectCategory")));

        return iLibrary;
    }

    public Element saveAsXML() {
        Element retVal = new Element("effectsLibrary");
        retVal.addElement(rootEffectCategory.saveAsXML());

        return retVal;
    }

    public void save() {
        String userInstrFileName = BlueSystem.getUserConfigurationDirectory()
                + File.separator + "effectsLibrary.xml";

        PrintWriter out = null;

        File f = new File(userInstrFileName);

        if (f.exists()) {
            File backup = new File(userInstrFileName + "~");
            if (backup.exists()) {
                backup.delete();
            }
            f.renameTo(backup);
        }

        try {
            out = new PrintWriter(new FileWriter(userInstrFileName));
        } catch (IOException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }

        if (out != null) {

            String lib = saveAsXML().toString();

            out.print(lib);

            out.flush();
            out.close();

            System.out.println("Saved Effect Library: " + userInstrFileName);
        } else {
            System.err.println("Unable to Save Effect Library: "
                    + userInstrFileName);
        }

        fireChangeEvent();
    }

    // TREE MODEL METHODS

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#getRoot()
     */
    public Object getRoot() {
        return getRootEffectCategory();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#getChildCount(java.lang.Object)
     */
    public int getChildCount(Object parent) {
        if (parent instanceof Effect) {
            return 0;
        } else if (parent instanceof EffectCategory) {
            EffectCategory cat = (EffectCategory) parent;
            return cat.getSubCategories().size() + cat.getEffects().size();
        }

        return 0;
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#isLeaf(java.lang.Object)
     */
    public boolean isLeaf(Object node) {
        return (node instanceof Effect);
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

        if (obj instanceof EffectCategory) {
            ((EffectCategory) obj).setCategoryName(newValue.toString());
        } else if (obj instanceof Effect) {
            ((Effect) obj).setName(newValue.toString());
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

    public Object getChild(Object parent, int index) {
        EffectCategory category = (EffectCategory) parent;

        if (category == null) {
            return null;
        }

        if (index >= category.getSubCategories().size()) {
            return category.getEffects().get(
                    index - category.getSubCategories().size());
        }

        return category.getSubCategories().get(index);

    }

    public int getIndexOfChild(Object parent, Object child) {
        EffectCategory category = (EffectCategory) parent;

        if (category == null || child == null) {
            return -1;
        }

        int retVal = ListUtil.indexOfByRef(category.getSubCategories(), child);

        if (retVal >= 0) {
            return retVal;
        }

        retVal = ListUtil.indexOfByRef(category.getEffects(), child);

        if (retVal >= 0) {
            return retVal + category.getSubCategories().size();
        }

        return -1;
    }

    private EffectCategory findParent(EffectCategory cat, Object obj) {

        if (ListUtil.containsByRef(cat.getEffects(), obj)
                || ListUtil.containsByRef(cat.getSubCategories(), obj)) {
            return cat;
        }

        for (Iterator iter = cat.getSubCategories().iterator(); iter.hasNext();) {
            EffectCategory c = (EffectCategory) iter.next();

            EffectCategory temp = findParent(c, obj);

            if (temp != null) {
                return temp;
            }

        }

        return null;
    }

    /* CHANGE LISTENER CODE */

    public void addChangeListener(ChangeListener listener) {
        changeListeners.add(listener);
    }

    public void removeChangeListener(ChangeListener listener) {
        changeListeners.remove(listener);
    }

    public void fireChangeEvent() {
        ChangeEvent evt = new ChangeEvent(this);

        for (Iterator it = changeListeners.iterator(); it.hasNext();) {
            ChangeListener listener = (ChangeListener) it.next();
            listener.stateChanged(evt);
        }
    }

    public void importEffect(Effect effect) {
        ArrayList categories = rootEffectCategory.getSubCategories();

        for (Iterator iter = categories.iterator(); iter.hasNext();) {
            EffectCategory cat = (EffectCategory) iter.next();
            if (cat.getCategoryName().equals("Imported Effects")) {
                addEffect(cat, effect);
                save();
                return;
            }
        }

        EffectCategory cat = new EffectCategory();
        cat.setCategoryName("Imported Effects");
        cat.addEffect(effect);

        addCategory(rootEffectCategory, cat);
        save();

    }
}