/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
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
package blue.score.layers.patterns.core;

import blue.plugin.BluePluginFactory;
import blue.plugin.DefaultBluePluginProvider;
import blue.soundObject.*;

/**
 *
 * @author stevenyi
 */
public class PatternsPluginProvider extends DefaultBluePluginProvider {

    public PatternsPluginProvider() {

        BluePluginFactory factory = new BluePluginFactory(this);

        // SOUND OBBJECTS

        factory.setPluginType(SoundObject.class);

//        factory.appendPlugin(AudioFile.class, false);
//        factory.appendPlugin(Comment.class, false);
        factory.appendPlugin(External.class, true);
        factory.appendPlugin(GenericScore.class, true);
//        factory.appendPlugin(JMask.class, true);
//        factory.appendPlugin(LineObject.class, false);
        factory.appendPlugin(ObjectBuilder.class, true);
        factory.appendPlugin(PatternObject.class, true);
        factory.appendPlugin(PianoRoll.class, true);
//        factory.appendPlugin(PolyObject.class, false);
        factory.appendPlugin(PythonObject.class, true);
        factory.appendPlugin(RhinoObject.class, true);
//        factory.appendPlugin(Sound.class, false);
        factory.appendPlugin(TrackerObject.class, true);
//        factory.appendPlugin(ZakLineObject.class, false);
    }
}
