/*
 * blue - object composition environment for csound
 * Copyright (C) 2020
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
package blue.ui.core.score.layers.soundObject.views;

import blue.score.TimeState;
import blue.soundObject.SoundObject;
import blue.ui.nbutilities.lazyplugin.ClassAssociationProcessor;
import blue.ui.nbutilities.lazyplugin.LazyPlugin;
import blue.ui.nbutilities.lazyplugin.LazyPluginFactory;
import java.lang.reflect.InvocationTargetException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class SoundObjectViewFactory {

    private Map<Class, Class> sObjViewMap = new HashMap<>();

    private static SoundObjectViewFactory INSTANCE = null;

    private SoundObjectViewFactory() {
        List<LazyPlugin<SoundObjectView>> plugins = LazyPluginFactory.
                loadPlugins("blue/score/soundObjectViews",
                        SoundObjectView.class,
                        new ClassAssociationProcessor("soundObjectType"));

        for (var plugin : plugins) {
            sObjViewMap.put(
                    (Class) plugin.getMetaData("association"), plugin.getInstance().getClass());
        }
    }

    public static SoundObjectViewFactory getInstance() {
        if (INSTANCE == null) {
            INSTANCE = new SoundObjectViewFactory();
        }
        return INSTANCE;
    }

    public SoundObjectView createView(SoundObject sObj, TimeState ts) {
        for (Class c : sObjViewMap.keySet()) {
            if (c.isAssignableFrom(sObj.getClass())) {
                Class<SoundObjectView> viewClass = sObjViewMap.get(c);
                
                try {
                    var view = (SoundObjectView) viewClass.newInstance();
                    view.initialize(sObj, ts);
                    return view;
                } catch (SecurityException | InstantiationException 
                        | IllegalAccessException | IllegalArgumentException  ex) {
                    Exceptions.printStackTrace(ex);
                }

            }
        }
        return null;
    }

}
