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
import java.io.FileFilter;
import java.util.Arrays;
import java.util.List;
import org.openide.nodes.AbstractNode;
import org.openide.nodes.ChildFactory;
import org.openide.nodes.Children;
import org.openide.nodes.Node;

/**
 *
 * @author stevenyi
 */
public class FileNode extends AbstractNode {

    private final File file;
    private boolean useFullName;

    public FileNode(File f) {
        this(f, false);
    }

    public FileNode(File f, boolean useFullName) {
        super(f.isDirectory()
                ? Children.create(new FileChildFactory(f), true)
                : Children.LEAF);
        this.file = f;
        this.useFullName = useFullName;
        setDisplayName(useFullName ? f.getAbsolutePath() : f.getName());
    }

    static class FileChildFactory extends ChildFactory<File> {

        private final File file;

        public FileChildFactory(File f) {
            this.file = f;
        }

        @Override
        protected boolean createKeys(List<File> toPopulate) {
            toPopulate.addAll(Arrays.asList(file.listFiles(new FileFilter() {

                @Override
                public boolean accept(File pathname) {
                   return !pathname.getName().startsWith(".");
                }
                
            })));
            return true;
        }

        @Override
        protected Node createNodeForKey(File key) {
            return new FileNode(key);
        }

    }
}
