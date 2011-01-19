/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core;

import blue.BlueConstants;
import blue.BluePlugin;
import blue.BluePluginFactory;
import blue.BlueSystem;
import blue.MainToolBar;
import blue.WindowSettingManager;
import blue.automation.ParameterTimeManagerFactory;
import blue.automation.ParameterTimeManagerImpl;
import blue.midi.MidiInputManager;
import blue.orchestra.BlueSynthBuilder;
import blue.orchestra.BlueX7;
import blue.orchestra.editor.InstrumentEditor;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.settings.TextColorsSettings;
import blue.soundObject.*;
import blue.soundObject.editor.AudioFileEditor;
import blue.soundObject.editor.CeciliaModuleEditor;
import blue.soundObject.editor.ExternalEditor;
import blue.soundObject.editor.FrozenSoundObjectEditor;
import blue.soundObject.editor.GenericEditor;
import blue.soundObject.editor.InstanceEditor;
import blue.soundObject.editor.JMaskEditor;
import blue.soundObject.editor.LineEditor;
import blue.soundObject.editor.NotationEditor;
import blue.soundObject.editor.ObjectBuilderEditor;
import blue.soundObject.editor.PatternEditor;
import blue.soundObject.editor.PianoRollEditor;
import blue.soundObject.editor.PolyObjectEditor;
import blue.soundObject.editor.PythonEditor;
import blue.soundObject.editor.SoundObjectEditor;
import blue.soundObject.editor.TrackerEditor;
import blue.soundObject.editor.ZakLineEditor;
import blue.ui.core.blueLive.BlueLiveToolBar;
import blue.ui.core.midi.MidiInputEngine;
import blue.ui.core.orchestra.editor.BlueSynthBuilderEditor;
import blue.ui.core.orchestra.editor.BlueX7Editor;
import blue.ui.core.soundObject.renderer.AbstractLineObjectRenderer;
import blue.ui.core.soundObject.renderer.AudioFileRenderer;
import blue.ui.core.soundObject.renderer.BarRenderer;
import blue.ui.core.soundObject.renderer.CommentRenderer;
import blue.ui.core.soundObject.renderer.ExternalRenderer;
import blue.ui.core.soundObject.renderer.FrozenSoundObjectRenderer;
import blue.ui.core.soundObject.renderer.GenericRenderer;
import blue.ui.core.soundObject.renderer.InstanceRenderer;
import blue.ui.core.soundObject.renderer.JMaskRenderer;
import blue.ui.core.soundObject.renderer.ObjectBuilderRenderer;
import blue.ui.core.soundObject.renderer.PythonObjectRenderer;
import blue.ui.core.soundObject.renderer.RhinoObjectRenderer;
import blue.ui.core.soundObject.renderer.SoundRenderer;
import blue.ui.core.soundObject.renderer.TrackerRenderer;
import java.awt.Color;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.logging.Logger;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import org.openide.modules.ModuleInstall;
import org.openide.windows.WindowManager;
import org.syntax.jedit.SyntaxStyle;
import org.syntax.jedit.TextAreaDefaults;
import org.syntax.jedit.tokenmarker.Token;

/**
 * Manages a module's lifecycle. Remember that an installer is optional and
 * often not needed at all.
 */
public class Installer extends ModuleInstall {

    BackupFileSaver backupFileSaver = new BackupFileSaver();
    private ChangeListener textColorChangeListener;
    private boolean textDefaultsInitialized = false;
    private PropertyChangeListener windowTitlePropertyChangeListener;

    private static final Logger logger = Logger.getLogger(Installer.class.getName());

    @Override
    public void restored() {
        initializeTextDefaults();
        initializeBluePlugins();

        Thread t = new Thread(backupFileSaver);
        t.setPriority(Thread.MIN_PRIORITY);
        t.setDaemon(true);
        t.start();

        ParameterTimeManagerFactory.setInstance(new ParameterTimeManagerImpl());

        textColorChangeListener = new ChangeListener() {

            public void stateChanged(ChangeEvent e) {
                setTextColors();
            }
        };

        windowTitlePropertyChangeListener = new PropertyChangeListener() {

            public void propertyChange(PropertyChangeEvent evt) {
                if (WindowManager.getDefault().getMainWindow() != null) {
                    setWindowTitle();
                }
            }
        };



        BlueProjectManager.getInstance().addPropertyChangeListener(windowTitlePropertyChangeListener);

        WindowManager.getDefault().invokeWhenUIReady(new Runnable() {

            public void run() {
                setWindowTitle();
            }
        });

//        WindowManager.getDefault().invokeWhenUIReady(new Runnable() {
//
//            public void run() {
//
//                new Thread() {
//
//                    public void run() {
//
//                        ProgressHandle handle = ProgressHandleFactory.createHandle("Initializing Python Interpreter...");
//                        handle.start();
//                        handle.progress("Initializing...");
//
//                        try {
//                            PythonProxy.reinitialize();
//                            PythonProxy.processScript("import random");
//                        } catch (Exception e) {
//
//                        }
//
//                        handle.finish();
//                    }
//
//                }.start();
//            }
//        });

        MidiInputManager.getInstance().addReceiver(MidiInputEngine.getInstance());

        TextColorsSettings.getInstance().addChangeListener(textColorChangeListener);
    }

    @Override
    public void uninstalled() {
        ParameterTimeManagerFactory.setInstance(null);
        BlueProjectManager.getInstance().removePropertyChangeListener(windowTitlePropertyChangeListener);
        MidiInputManager.getInstance().removeReceiver(MidiInputEngine.getInstance());
        TextColorsSettings.getInstance().removeChangeListener(textColorChangeListener);

        logger.info("blue-ui-core Installer uninstalled");
    }

    private void setWindowTitle() {
        BlueProjectManager bpm = BlueProjectManager.getInstance();
        BlueProject proj = bpm.getCurrentProject();

        String title = "blue - " + BlueConstants.getVersion();

        if (proj != null) {
            title += " - ";

            if (proj.getDataFile() == null) {
                title += "New Project";
            } else {
                title += proj.getDataFile().getName();
            }
        }

        WindowManager.getDefault().getMainWindow().setTitle(title);
    }

    @Override
    public boolean closing() {
        return BlueProjectManager.getInstance().closeAllFiles();
    }

    @Override
    public void close() {
        backupFileSaver.quitFileSaver();
        MainToolBar.getInstance().stopRendering();
        BlueLiveToolBar.getInstance().stopRendering();

        saveLibraries();

        WindowSettingManager.getInstance().save();

        super.close();
    }

    public void saveLibraries() {
        BlueSystem.saveUserInstrumentLibrary();
        BlueSystem.saveUDOLibrary();
    }

    public void initializeTextDefaults() {
        if (!textDefaultsInitialized) {
            TextAreaDefaults defaults = TextAreaDefaults.getDefaults();

            defaults.caretBlinks = true;
            defaults.caretColor = Color.WHITE;
            defaults.selectionColor = new Color(0x666680);
            defaults.lineHighlight = false;

            setTextColors();

            textDefaultsInitialized = true;
        }
    }

    public void setTextColors() {
        TextAreaDefaults defaults = TextAreaDefaults.getDefaults();

        SyntaxStyle[] styles = defaults.styles;

        TextColorsSettings settings = TextColorsSettings.getInstance();

        styles[Token.NULL] = new SyntaxStyle(settings.blueSyntaxNormal, false,
                false);

        styles[Token.KEYWORD1] = new SyntaxStyle(settings.blueSyntaxKeyword,
                false, true);
        styles[Token.KEYWORD2] = new SyntaxStyle(settings.blueSyntaxVariable,
                false,
                false);
        styles[Token.KEYWORD3] = new SyntaxStyle(settings.blueSyntaxPfield,
                false,
                false);
        styles[Token.COMMENT1] = new SyntaxStyle(settings.blueSyntaxComment,
                false,
                false);

        styles[Token.LITERAL1] = new SyntaxStyle(settings.blueSyntaxQuote, false,
                false);
        styles[Token.LITERAL2] = new SyntaxStyle(settings.blueSyntaxQuote, false,
                true);

        defaults.bracketHighlightColor = settings.blueSyntaxNormal;
    }

    private void initializeBluePlugins() {

        //SOUND OBJECT EDITORS
        BluePluginFactory factory = new BluePluginFactory();
        factory.setPluginType(SoundObjectEditor.class);
        factory.setPropertyType(BluePlugin.PROP_EDIT_CLASS);

        factory.appendPlugin(PatternEditor.class, PatternObject.class);
        factory.appendPlugin(JMaskEditor.class, JMask.class);
        factory.appendPlugin(ZakLineEditor.class, ZakLineObject.class);
        factory.appendPlugin(PianoRollEditor.class, PianoRoll.class);
        factory.appendPlugin(CeciliaModuleEditor.class, CeciliaModule.class);
        factory.appendPlugin(PolyObjectEditor.class, PolyObject.class);
        factory.appendPlugin(LineEditor.class, LineObject.class);
        factory.appendPlugin(PythonEditor.class, PythonObject.class);
        factory.appendPlugin(GenericEditor.class, GenericEditable.class);
        factory.appendPlugin(ObjectBuilderEditor.class, ObjectBuilder.class);
        factory.appendPlugin(TrackerEditor.class, TrackerObject.class);
        factory.appendPlugin(InstanceEditor.class, Instance.class);
        factory.appendPlugin(ExternalEditor.class, External.class);
        factory.appendPlugin(AudioFileEditor.class, AudioFile.class);
        factory.appendPlugin(NotationEditor.class, NotationObject.class);
        factory.appendPlugin(FrozenSoundObjectEditor.class,
                FrozenSoundObject.class);


        // INSTRUMENT EDITORS
        factory.setPluginType(InstrumentEditor.class);

        factory.appendPlugin(BlueSynthBuilderEditor.class,
                BlueSynthBuilder.class);
        factory.appendPlugin(BlueX7Editor.class, BlueX7.class);
        factory.appendPlugin(blue.ui.core.orchestra.editor.GenericEditor.class,
                blue.orchestra.editor.GenericEditable.class);


        // BAR RENDERERS

        factory.setPluginType(BarRenderer.class);

        factory.appendPlugin(AudioFileRenderer.class, AudioFile.class);
        factory.appendPlugin(AbstractLineObjectRenderer.class,
                AbstractLineObject.class);
        factory.appendPlugin(CommentRenderer.class, Comment.class);
        factory.appendPlugin(ExternalRenderer.class, External.class);
        factory.appendPlugin(FrozenSoundObjectRenderer.class,
                FrozenSoundObject.class);
        factory.appendPlugin(GenericRenderer.class, GenericViewable.class);
        factory.appendPlugin(InstanceRenderer.class, Instance.class);
        factory.appendPlugin(JMaskRenderer.class, JMask.class);
        factory.appendPlugin(ObjectBuilderRenderer.class, ObjectBuilder.class);
        factory.appendPlugin(PythonObjectRenderer.class, PythonObject.class);
        factory.appendPlugin(RhinoObjectRenderer.class, RhinoObject.class);
        factory.appendPlugin(SoundRenderer.class, Sound.class);
        factory.appendPlugin(TrackerRenderer.class, TrackerObject.class);
    }
}
