/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
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

package blue.scripting;

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
 * 
 * @author steven
 */
public class ScriptLibrary implements Serializable, TreeModel {

    private static ScriptLibrary library = null;

    ScriptCategory rootScriptCategory = new ScriptCategory();

    transient Vector listeners = new Vector();

    transient Vector changeListeners = new Vector();

    private ScriptLibrary() {
        this.rootScriptCategory.setRoot(true);
        this.rootScriptCategory.setCategoryName("Script Library");
    }

    public static ScriptLibrary getInstance() {
        if (library == null) {
            String scriptLibFileName = BlueSystem
                    .getUserConfigurationDirectory()
                    + File.separator + "scriptLibrary.xml";

            File f = new File(scriptLibFileName);

            if (f.exists()) {

                boolean error = false;

                try {
                    Document doc = new Document(f);
                    library = ScriptLibrary.loadFromXML(doc.getRoot());
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
                library = new ScriptLibrary();
                System.out.println("Creating new Script Library");
            }

        }
        return library;
    }

    public ScriptCategory getRootScriptCategory() {
        return rootScriptCategory;
    }

    public void setRootScriptCategory(ScriptCategory rootScriptCategory) {
        this.rootScriptCategory = rootScriptCategory;
    }

    public void addScript(ScriptCategory parent, Script script) {
        addScript(parent, -1, script);
    }

    public void addScript(ScriptCategory parent, int insertIndex, Script script) {

        if (insertIndex < 0 || insertIndex >= parent.getScripts().size()) {
            parent.addScript(script);
        } else {
            parent.addScript(insertIndex, script);
        }

        int index = getIndexOfChild(parent, script);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = script;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(script),
                childIndices, children);
        fireNodesInserted(e);
    }

    private Object[] getPathForObject(Object obj) {
        Vector v = new Vector();
        getPathForObject(getRootScriptCategory(), obj, v);

        Collections.reverse(v);

        return v.toArray();
    }

    private Object getPathForObject(ScriptCategory current, Object obj, Vector v) {

        if (current == obj) {
            return v;
        }

        if (current.getScripts().contains(obj)) {
            v.add(current);
            return v;
        }

        for (Iterator iter = current.getSubCategories().iterator(); iter
                .hasNext();) {
            ScriptCategory cat = (ScriptCategory) iter.next();
            Object pathObj = getPathForObject(cat, obj, v);
            if (pathObj != null) {
                v.add(current);
                return v;
            }
        }

        return null;

    }

    public void addCategory(ScriptCategory parent, ScriptCategory cat) {
        parent.addScriptCategory(cat);

        int index = getIndexOfChild(parent, cat);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = cat;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(cat),
                childIndices, children);
        fireNodesInserted(e);
    }

    public void removeScript(Script script) {
        ScriptCategory parent = findParent(rootScriptCategory, script);
        int index = getIndexOfChild(parent, script);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = script;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(script),
                childIndices, children);

        rootScriptCategory.removeScript(script);

        fireNodesRemoved(e);
    }

    public void removeScriptCategory(ScriptCategory cat) {
        ScriptCategory parent = findParent(rootScriptCategory, cat);
        int index = getIndexOfChild(parent, cat);

        int[] childIndices = new int[1];
        childIndices[0] = index;

        Object[] children = new Object[1];
        children[0] = cat;

        TreeModelEvent e = new TreeModelEvent(this, getPathForObject(cat),
                childIndices, children);

        rootScriptCategory.removeScriptCategory(cat);

        fireNodesRemoved(e);
    }

    // SERIALIZATION METHODS

    public static ScriptLibrary loadFromXML(Element data) throws Exception {
        ScriptLibrary iLibrary = new ScriptLibrary();
        iLibrary.setRootScriptCategory(ScriptCategory.loadFromXML(data
                .getElement("scriptCategory")));

        return iLibrary;
    }

    public Element saveAsXML() {
        Element retVal = new Element("scriptLibrary");
        retVal.addElement(rootScriptCategory.saveAsXML());

        return retVal;
    }

    public void save() {
        String scriptLibFileName = BlueSystem.getUserConfigurationDirectory()
                + File.separator + "scriptLibrary.xml";

        PrintWriter out = null;

        File f = new File(scriptLibFileName);

        if (f.exists()) {
            File backup = new File(scriptLibFileName + "~");
            if (backup.exists()) {
                backup.delete();
            }
            f.renameTo(backup);
        }

        try {
            out = new PrintWriter(new FileWriter(scriptLibFileName));
        } catch (IOException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }

        if (out != null) {

            String lib = saveAsXML().toString();

            out.print(lib);

            out.flush();
            out.close();

            System.out.println("Saved Script Library: " + scriptLibFileName);
        } else {
            System.err.println("Unable to Save Script Library: "
                    + scriptLibFileName);
        }

        fireChangeEvent();
    }

    // TREE MODEL METHODS

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#getRoot()
     */
    @Override
    public Object getRoot() {
        return getRootScriptCategory();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.tree.TreeModel#getChildCount(java.lang.Object)
     */
    @Override
    public int getChildCount(Object parent) {
        if (parent instanceof Script) {
            return 0;
        } else if (parent instanceof ScriptCategory) {
            ScriptCategory cat = (ScriptCategory) parent;
            return cat.getSubCategories().size() + cat.getScripts().size();
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
        return (node instanceof Script);
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

        if (obj instanceof ScriptCategory) {
            ((ScriptCategory) obj).setCategoryName(newValue.toString());
        } else if (obj instanceof Script) {
            ((Script) obj).setName(newValue.toString());
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
        ScriptCategory category = (ScriptCategory) parent;

        if (category == null) {
            return null;
        }

        if (index >= category.getSubCategories().size()) {
            return category.getScripts().get(
                    index - category.getSubCategories().size());
        }

        return category.getSubCategories().get(index);

    }

    @Override
    public int getIndexOfChild(Object parent, Object child) {
        ScriptCategory category = (ScriptCategory) parent;

        if (category == null || child == null) {
            return -1;
        }

        int retVal = ListUtil.indexOfByRef(category.getSubCategories(), child);

        if (retVal >= 0) {
            return retVal;
        }

        retVal = ListUtil.indexOfByRef(category.getScripts(), child);

        if (retVal >= 0) {
            return retVal + category.getSubCategories().size();
        }

        return -1;
    }

    private ScriptCategory findParent(ScriptCategory cat, Object obj) {

        if (ListUtil.containsByRef(cat.getScripts(), obj)
                || ListUtil.containsByRef(cat.getSubCategories(), obj)) {
            return cat;
        }

        for (Iterator iter = cat.getSubCategories().iterator(); iter.hasNext();) {
            ScriptCategory c = (ScriptCategory) iter.next();

            ScriptCategory temp = findParent(c, obj);

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

    public void importScript(Script script) {
        ArrayList categories = rootScriptCategory.getSubCategories();

        for (Iterator iter = categories.iterator(); iter.hasNext();) {
            ScriptCategory cat = (ScriptCategory) iter.next();
            if (cat.getCategoryName().equals("Imported Scripts")) {
                addScript(cat, script);
                save();
                return;
            }
        }

        ScriptCategory cat = new ScriptCategory();
        cat.setCategoryName("Imported Scripts");
        cat.addScript(script);

        addCategory(rootScriptCategory, cat);
        save();

    }
}
