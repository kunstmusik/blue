/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core;

import blue.orchestra.BlueSynthBuilder;
import blue.orchestra.BlueX7;
import blue.orchestra.GenericInstrument;
import blue.orchestra.PythonInstrument;
import blue.orchestra.RhinoInstrument;
import blue.orchestra.editor.InstrumentEditor;
import blue.plugin.BluePlugin;
import blue.plugin.BluePluginFactory;
import blue.plugin.DefaultBluePluginProvider;
import blue.soundObject.*;
import blue.soundObject.editor.*;
import blue.ui.core.orchestra.editor.BlueSynthBuilderEditor;
import blue.ui.core.orchestra.editor.BlueX7Editor;
import blue.ui.core.orchestra.editor.GenericInstrumentEditor;
import blue.ui.core.orchestra.editor.PythonInstrumentEditor;
import blue.ui.core.orchestra.editor.RhinoInstrumentEditor;
import blue.ui.core.soundObject.renderer.*;

/**
 *
 * @author stevenyi
 */
public class BlueUICorePluginProvider extends DefaultBluePluginProvider {
    
    public BlueUICorePluginProvider() {
          
        //SOUND OBJECT EDITORS
        BluePluginFactory factory = new BluePluginFactory(this);
//        factory.setPluginType(ScoreObjectEditor.class);
//        factory.setPropertyType(BluePlugin.PROP_EDIT_CLASS);
//
//        factory.appendPlugin(PatternEditor.class, PatternObject.class);
//        factory.appendPlugin(JMaskEditor.class, JMask.class);
//        factory.appendPlugin(ZakLineEditor.class, ZakLineObject.class);
//        factory.appendPlugin(PianoRollEditor.class, PianoRoll.class);
//        factory.appendPlugin(PolyObjectEditor.class, PolyObject.class);
//        factory.appendPlugin(LineEditor.class, LineObject.class);
//        factory.appendPlugin(PythonEditor.class, PythonObject.class);
//        factory.appendPlugin(GenericScoreEditor.class, GenericScore.class);
//        factory.appendPlugin(CommentEditor.class, Comment.class);
//        factory.appendPlugin(RhinoObjectEditor.class, RhinoObject.class);
//        factory.appendPlugin(SoundEditor.class, Sound.class);
//        factory.appendPlugin(ObjectBuilderEditor.class, ObjectBuilder.class);
//        factory.appendPlugin(TrackerEditor.class, TrackerObject.class);
//        factory.appendPlugin(InstanceEditor.class, Instance.class);
//        factory.appendPlugin(ExternalEditor.class, External.class);
//        factory.appendPlugin(AudioFileEditor.class, AudioFile.class);
//        factory.appendPlugin(NotationEditor.class, NotationObject.class);
//        factory.appendPlugin(FrozenSoundObjectEditor.class,
//                FrozenSoundObject.class);


        // INSTRUMENT EDITORS
        factory.setPluginType(InstrumentEditor.class);

        factory.appendPlugin(BlueSynthBuilderEditor.class,
                BlueSynthBuilder.class);
        factory.appendPlugin(BlueX7Editor.class, BlueX7.class);
        factory.appendPlugin(GenericInstrumentEditor.class,
                GenericInstrument.class);
        factory.appendPlugin(PythonInstrumentEditor.class,
                PythonInstrument.class);
        factory.appendPlugin(RhinoInstrumentEditor.class,
                RhinoInstrument.class);


        // BAR RENDERERS

        factory.setPluginType(BarRenderer.class);

        factory.appendPlugin(AudioFileRenderer.class, AudioFile.class);
        factory.appendPlugin(AbstractLineObjectRenderer.class,
                AbstractLineObject.class);
        factory.appendPlugin(CommentRenderer.class, Comment.class);
        factory.appendPlugin(ExternalRenderer.class, External.class);
        factory.appendPlugin(FrozenSoundObjectRenderer.class,
                FrozenSoundObject.class);
        factory.appendPlugin(blue.ui.core.soundObject.renderer.GenericRenderer.class, 
                blue.soundObject.GenericViewable.class);
        factory.appendPlugin(InstanceRenderer.class, Instance.class);
        factory.appendPlugin(JMaskRenderer.class, JMask.class);
        factory.appendPlugin(ObjectBuilderRenderer.class, ObjectBuilder.class);
        factory.appendPlugin(PythonObjectRenderer.class, PythonObject.class);
        factory.appendPlugin(RhinoObjectRenderer.class, RhinoObject.class);
        factory.appendPlugin(SoundRenderer.class, Sound.class);
        factory.appendPlugin(TrackerRenderer.class, TrackerObject.class);
        factory.appendPlugin(PianoRollRenderer.class, PianoRoll.class);
    }
}
