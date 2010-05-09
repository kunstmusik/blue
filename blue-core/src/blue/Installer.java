/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue;

import blue.noteProcessor.AddProcessor;
import blue.noteProcessor.EqualsProcessor;
import blue.noteProcessor.InversionProcessor;
import blue.noteProcessor.LineAddProcessor;
import blue.noteProcessor.LineMultiplyProcessor;
import blue.noteProcessor.MultiplyProcessor;
import blue.noteProcessor.NoteProcessor;
import blue.noteProcessor.PchAddProcessor;
import blue.noteProcessor.PchInversionProcessor;
import blue.noteProcessor.PythonProcessor;
import blue.noteProcessor.RandomAddProcessor;
import blue.noteProcessor.RandomMultiplyProcessor;
import blue.noteProcessor.RetrogradeProcessor;
import blue.noteProcessor.RotateProcessor;
import blue.noteProcessor.SubListProcessor;
import blue.noteProcessor.SwitchProcessor;
import blue.noteProcessor.TimeWarpProcessor;
import blue.noteProcessor.TuningProcessor;
import blue.orchestra.BlueSynthBuilder;
import blue.orchestra.BlueX7;
import blue.orchestra.GenericInstrument;
import blue.orchestra.Instrument;
import blue.orchestra.PythonInstrument;
import blue.orchestra.RhinoInstrument;
import blue.soundObject.AudioFile;
import blue.soundObject.Comment;
import blue.soundObject.External;
import blue.soundObject.GenericScore;
import blue.soundObject.JMask;
import blue.soundObject.LineObject;
import blue.soundObject.ObjectBuilder;
import blue.soundObject.PatternObject;
import blue.soundObject.PianoRoll;
import blue.soundObject.PolyObject;
import blue.soundObject.PythonObject;
import blue.soundObject.RhinoObject;
import blue.soundObject.Sound;
import blue.soundObject.SoundObject;
import blue.soundObject.TrackerObject;
import blue.soundObject.ZakLineObject;
import org.openide.modules.ModuleInstall;

/**
 * Manages a module's lifecycle. Remember that an installer is optional and
 * often not needed at all.
 */
public class Installer extends ModuleInstall {

    @Override
    public void restored() {

        BluePluginFactory factory = new BluePluginFactory();
        factory.setPluginType(NoteProcessor.class);

        // Note Processors

        factory.appendPlugin(AddProcessor.class);
        factory.appendPlugin(PchAddProcessor.class);
        factory.appendPlugin(MultiplyProcessor.class);
        factory.appendPlugin(RandomAddProcessor.class);
        factory.appendPlugin(RandomMultiplyProcessor.class);
        factory.appendPlugin(SubListProcessor.class);
        factory.appendPlugin(RotateProcessor.class);
        factory.appendPlugin(RetrogradeProcessor.class);
        factory.appendPlugin(InversionProcessor.class);
        factory.appendPlugin(PchInversionProcessor.class);
        factory.appendPlugin(EqualsProcessor.class);
        factory.appendPlugin(SwitchProcessor.class);
        factory.appendPlugin(TimeWarpProcessor.class);
        factory.appendPlugin(LineAddProcessor.class);
        factory.appendPlugin(LineMultiplyProcessor.class);
        factory.appendPlugin(TuningProcessor.class);
        factory.appendPlugin(PythonProcessor.class);

        // INSTRUMENTS

        factory.setPluginType(Instrument.class);

        factory.appendPlugin(GenericInstrument.class);
        factory.appendPlugin(PythonInstrument.class);
        factory.appendPlugin(RhinoInstrument.class);
        factory.appendPlugin(BlueX7.class);
        factory.appendPlugin(BlueSynthBuilder.class);

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
