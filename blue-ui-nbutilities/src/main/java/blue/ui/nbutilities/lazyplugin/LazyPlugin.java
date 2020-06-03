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

import java.util.HashMap;
import java.util.Map;
import org.openide.filesystems.FileObject;
import org.openide.filesystems.FileUtil;

/**
 * Lazy Plugin class that wraps a NB FileObject.  
 * 
 * @author stevenyi
 */
public class LazyPlugin<T extends Object> {
    private final String displayName;
    private final String path;
    private final Class clazz;
    private final Map<String, Object> metaData;

    
    public LazyPlugin(FileObject fObj, Class c) {
        this.displayName = (String) fObj.getAttribute("displayName");
        this.path = fObj.getPath();
        this.clazz = c;
        metaData = new HashMap<>();
    }

    public String getDisplayName() {
        return displayName;
    }
   
    @SuppressWarnings("unchecked")
    public T getInstance() {
        return (T) FileUtil.getConfigObject(path, clazz);
    }
   
    public Object getMetaData(String key) {
        return metaData.get(key);
    }

    public void setMetaData(String key, Object value) {
        metaData.put(key, value);
    }
}
