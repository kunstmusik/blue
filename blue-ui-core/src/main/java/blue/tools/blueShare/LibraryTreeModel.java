/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
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
package blue.tools.blueShare;

import blue.library.Library;
import blue.library.LibraryItem;
import blue.soundObject.SoundObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import javafx.scene.control.TreeItem;
import javax.swing.event.TreeModelEvent;
import javax.swing.event.TreeModelListener;
import javax.swing.tree.TreeModel;
import javax.swing.tree.TreePath;

/**
 *
 * @author stevenyi
 */
public class LibraryTreeModel implements TreeModel {

    Library<? extends SoundObject> library;
    List<TreeModelListener> listeners = 
            Collections.synchronizedList(new ArrayList<>());


    public LibraryTreeModel(Library<? extends SoundObject> library) {
        this.library = library;

        // FIXME - Replace usage of this with BeanTreeView and Node API
//        library.getRoot().addEventHandler(TreeItem.childrenModificationEvent(), 
//                evt -> {
//                    for(TreeModelListener listener : listeners) {
//                        listener.treeStructureChanged(new TreeModelEvent(this, new TreePath(library.getRoot())));
//                    }
////                    System.out.println(evt.getEventType() + " : " + evt.); 
//                });
    }

    @Override
    public Object getRoot() {
        return library.getRoot();
    }

    @Override
    public Object getChild(Object parent, int index) {
        TreeItem<LibraryItem<SoundObject>> node = 
                (TreeItem<LibraryItem<SoundObject>>) parent;
        if(node.isLeaf()) {
            return null;
        }
        return node.getChildren().get(index);
    }

    @Override
    public int getChildCount(Object parent) {
        TreeItem<LibraryItem<SoundObject>> node = 
                (TreeItem<LibraryItem<SoundObject>>) parent;
        return node.getChildren().size();
    }

    @Override
    public boolean isLeaf(Object node) {
        TreeItem<LibraryItem<SoundObject>> n = 
                (TreeItem<LibraryItem<SoundObject>>) node;
        return n.isLeaf();
    }

    @Override
    public void valueForPathChanged(TreePath path, Object newValue) {
//        Object obj = path.getLastPathComponent();

//        TreeItem<LibraryItem<SoundObject>> n = 
//                (TreeItem<LibraryItem<SoundObject>>) obj;
        
//        n.getValue().setText(newValue.toString());

//        TreeModelEvent e = new TreeModelEvent(this, path);
//        fireNodesChanged(e);

    }

    @Override
    public int getIndexOfChild(Object parent, Object child) {
        TreeItem<LibraryItem<SoundObject>> node = 
                (TreeItem<LibraryItem<SoundObject>>) parent;
        return node.getChildren().indexOf(child);
    }

    @Override
    public void addTreeModelListener(TreeModelListener l) {
        listeners.add(l);
    }

    @Override
    public void removeTreeModelListener(TreeModelListener l) {
        listeners.remove(l);
    }
    
}
