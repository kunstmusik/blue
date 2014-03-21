/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue;

import blue.plugin.BluePlugin;
import blue.plugin.BluePluginFactory;
import blue.plugin.DefaultBluePluginProvider;
import blue.soundObject.*;

/**
 *
 * @author stevenyi
 */
public class BlueCorePluginProvider extends DefaultBluePluginProvider {
    
    public BlueCorePluginProvider() {
        BluePluginFactory factory = new BluePluginFactory(this);
//        factory.setPluginType(NoteProcessor.class);

        // Note Processors

//        factory.appendPlugin(AddProcessor.class);
//        factory.appendPlugin(PchAddProcessor.class);
//        factory.appendPlugin(MultiplyProcessor.class);
//        factory.appendPlugin(RandomAddProcessor.class);
//        factory.appendPlugin(RandomMultiplyProcessor.class);
//        factory.appendPlugin(SubListProcessor.class);
//        factory.appendPlugin(RotateProcessor.class);
//        factory.appendPlugin(RetrogradeProcessor.class);
//        factory.appendPlugin(InversionProcessor.class);
//        factory.appendPlugin(PchInversionProcessor.class);
//        factory.appendPlugin(EqualsProcessor.class);
//        factory.appendPlugin(SwitchProcessor.class);
//        factory.appendPlugin(TimeWarpProcessor.class);
//        factory.appendPlugin(LineAddProcessor.class);
//        factory.appendPlugin(LineMultiplyProcessor.class);
//        factory.appendPlugin(TuningProcessor.class);
//        factory.appendPlugin(PythonProcessor.class);

        // INSTRUMENTS

//        factory.setPluginType(Instrument.class);
//
//        factory.appendPlugin(GenericInstrument.class);
//        factory.appendPlugin(PythonInstrument.class);
//        factory.appendPlugin(RhinoInstrument.class);
//        factory.appendPlugin(BlueX7.class);
//        factory.appendPlugin(BlueSynthBuilder.class);

        // SOUND OBBJECTS

        factory.setPluginType(SoundObject.class);
        factory.setPropertyType(BluePlugin.PROP_LIVE);

        factory.appendPlugin(AudioFile.class, false);
        factory.appendPlugin(Comment.class, false);
        factory.appendPlugin(External.class, true);
        factory.appendPlugin(GenericScore.class, true);
        factory.appendPlugin(JMask.class, true);
        factory.appendPlugin(LineObject.class, false);
        factory.appendPlugin(ObjectBuilder.class, true);
        factory.appendPlugin(PatternObject.class, true);
        factory.appendPlugin(PianoRoll.class, true);
        factory.appendPlugin(PolyObject.class, false);
        factory.appendPlugin(PythonObject.class, true);
        factory.appendPlugin(RhinoObject.class, true);
        factory.appendPlugin(Sound.class, false);
        factory.appendPlugin(TrackerObject.class, true);
        factory.appendPlugin(ZakLineObject.class, false);
    }
}
