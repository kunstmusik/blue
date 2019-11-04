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

import java.util.logging.Logger;
import org.openide.filesystems.FileObject;
import org.openide.util.Lookup;

/**
 *
 * @author stevenyi
 */
public class ClassAssociationProcessor implements LazyPluginFactory.MetaDataProcessor {
    private static final Logger LOGGER = 
            Logger.getLogger("ClassAssociationProcessor");
    
    private final String attribute;

    /**
     * Create processor with given attribute to use load associated class
     * 
     * @param attribute 
     */
    public ClassAssociationProcessor(String attribute) {
        this.attribute = attribute;
    }
    
    @Override
    public void process(FileObject fObj, LazyPlugin plugin) {
        ClassLoader cl = Lookup.getDefault().lookup(ClassLoader.class);

        if(fObj.getAttribute(attribute) == null) {
            String message = String.format(
                "ClassAssocationProcessor did not find attribute %s with plugin %s",
                    attribute, fObj.getPath());
            LOGGER.warning(message);     
            return;
        }
        
        try {
            plugin.setMetaData("association", 
                    cl.loadClass((String) fObj.getAttribute(
                    attribute)));
        } catch (ClassNotFoundException ex) {
            
            String message = String.format(
                "ClassAssocationProcessor unable to load class %s for attribute %s with plugin %s",
                    (String)fObj.getAttribute(attribute), attribute, fObj.getPath());
            LOGGER.warning(message);     
        }
    }
    
}
