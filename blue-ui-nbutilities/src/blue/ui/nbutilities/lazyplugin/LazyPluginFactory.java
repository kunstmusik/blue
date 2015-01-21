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
package blue.ui.nbutilities.lazyplugin;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.openide.filesystems.FileObject;
import org.openide.filesystems.FileUtil;

/**
 *
 * @author stevenyi
 */
public class LazyPluginFactory {

    private LazyPluginFactory() {
    }

    public static <T> List<LazyPlugin<T>> loadPlugins(String folder, Class z) {
        return loadPlugins(folder, z, null, null);
    }

    public static <T> List<LazyPlugin<T>> loadPlugins(String folder, Class z, MetaDataProcessor processor) {
        return loadPlugins(folder, z, processor, null);
    }


    public static <T> List<LazyPlugin<T>> loadPlugins(String folder, Class z, Filter filter) {
        return loadPlugins(folder, z, null, filter);
    }
    
    public static <T> List<LazyPlugin<T>> loadPlugins(String folder, Class pluginClass,
            MetaDataProcessor processor, Filter f) {
        List<LazyPlugin<T>> plugins = new ArrayList<>();

        FileObject files[] = FileUtil.getConfigFile(
                folder).getChildren();

        List<FileObject> orderedFiles = FileUtil.getOrder(
                    Arrays.asList(files), true);

        for (FileObject fObj : orderedFiles) {

            if(fObj.isFolder()) {
                continue;
            }

            if(f != null && !f.accept(fObj)) {
                continue;
            }
            
            LazyPlugin<T> plugin = new LazyPlugin<>(fObj, pluginClass);

            if (processor != null) {
                processor.process(fObj, plugin);
            }

            plugins.add(plugin);
        }

        return plugins;
    }

    public static interface Filter {
        public boolean accept(FileObject fObj);
    }
    
    public static interface MetaDataProcessor {
        public void process(FileObject fObj, LazyPlugin plugin);
    }
}
