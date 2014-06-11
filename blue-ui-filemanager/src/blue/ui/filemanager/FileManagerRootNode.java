/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
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
package blue.ui.filemanager;

import java.io.File;
import java.io.IOException;
import java.util.List;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import org.openide.nodes.AbstractNode;
import org.openide.nodes.ChildFactory;
import org.openide.nodes.Children;
import org.openide.nodes.Node;

/**
 *
 * @author stevenyi
 */
public class FileManagerRootNode extends AbstractNode {
    private final FileManagerRoots roots;

    public FileManagerRootNode(FileManagerRoots roots) {
        super(Children.create(new FileManagerRootChildFactory(roots), true));
        this.roots = roots;
        setDisplayName("Roots");
    }

    static class FileManagerRootChildFactory extends ChildFactory<File> {
        private final FileManagerRoots roots;

        private FileManagerRootChildFactory(FileManagerRoots roots) {
            this.roots = roots;
            roots.addChangeListener(new ChangeListener() {

                @Override
                public void stateChanged(ChangeEvent e) {
                    refresh(true);
                }
            });
        }

        @Override
        protected boolean createKeys(List<File> toPopulate) {
            toPopulate.addAll(roots.getRoots());
            return true;
        }

        @Override
        protected Node createNodeForKey(File key) {
            return new FileNode(key, true, roots);
        }
        
    }
}
