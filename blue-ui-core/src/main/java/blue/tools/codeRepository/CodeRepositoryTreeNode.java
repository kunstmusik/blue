/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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

package blue.tools.codeRepository;

import java.util.Vector;
import javax.swing.tree.DefaultMutableTreeNode;
import javax.swing.tree.MutableTreeNode;

class CodeRepositoryTreeNode extends DefaultMutableTreeNode {

    @Override
    public void insert(MutableTreeNode newChild, int childIndex) {
        ElementHolder elem = (ElementHolder) this.getUserObject();

        if (!elem.isGroup) {
            throw new IllegalStateException("node does not allow children");
        } else if (newChild == null) {
            throw new IllegalArgumentException("new child is null");
        } else if (isNodeAncestor(newChild)) {
            throw new IllegalArgumentException("new child is an ancestor");
        }

        MutableTreeNode oldParent = (MutableTreeNode) newChild.getParent();

        if (oldParent != null) {
            oldParent.remove(newChild);
        }

        newChild.setParent(this);

        if (children == null) {
            children = new Vector();
        }

        children.insertElementAt(newChild, childIndex);
    }

    @Override
    public boolean isLeaf() {
        try {
            ElementHolder elem = (ElementHolder) this.getUserObject();
            return !elem.isGroup;
        } catch (ClassCastException cce) {
            return (getChildCount() == 0);
        }
    }

    @Override
    public void setUserObject(Object obj) {
        if (obj instanceof String) {
            ElementHolder elem = (ElementHolder) this.getUserObject();
            elem.title = obj.toString();
        } else {
            super.setUserObject(obj);
        }
    }
}