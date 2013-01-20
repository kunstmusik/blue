/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
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
package blue.clojure;

import blue.clojure.soundObject.ClojureSoundObject;
import blue.clojure.soundObject.ClojureSoundObjectEditor;
import blue.clojure.soundObject.ClojureSoundObjectRenderer;
import blue.plugin.BluePlugin;
import blue.plugin.BluePluginFactory;
import blue.plugin.DefaultBluePluginProvider;
import blue.soundObject.SoundObject;
import blue.soundObject.editor.SoundObjectEditor;
import blue.ui.core.soundObject.renderer.BarRenderer;

/**
 *
 * @author stevenyi
 */
public class BlueClojurePluginProvider extends DefaultBluePluginProvider {
    
    public BlueClojurePluginProvider() {
        BluePluginFactory factory = new BluePluginFactory(this);

        // SOUND OBBJECTS
        factory.setPluginType(SoundObject.class);
        factory.setPropertyType(BluePlugin.PROP_LIVE);

        factory.appendPlugin(ClojureSoundObject.class, false);
        
        factory.setPluginType(SoundObjectEditor.class);
        factory.setPropertyType(BluePlugin.PROP_EDIT_CLASS);

        factory.appendPlugin(ClojureSoundObjectEditor.class, ClojureSoundObject.class);

        factory.setPluginType(BarRenderer.class);
        factory.appendPlugin(ClojureSoundObjectRenderer.class, ClojureSoundObject.class);

    }

}
