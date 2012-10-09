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
import blue.BlueSystem;
import blue.MainToolBar;
import blue.WindowSettingManager;
import blue.automation.ParameterTimeManagerFactory;
import blue.automation.ParameterTimeManagerImpl;
import blue.midi.MidiInputManager;
import blue.osc.OSCManager;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.score.layers.LayerGroupProvider;
import blue.score.layers.LayerGroupProviderManager;
import blue.scripting.PythonProxy;
import blue.settings.TextColorsSettings;
import blue.ui.core.blueLive.BlueLiveToolBar;
import blue.ui.core.midi.MidiInputEngine;
import java.awt.Color;
import java.awt.Frame;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.logging.Logger;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import org.openide.modules.InstalledFileLocator;
import org.openide.modules.ModuleInstall;
import org.openide.util.Lookup;
import org.openide.util.Lookup.Result;
import org.openide.util.LookupEvent;
import org.openide.util.LookupListener;
import org.openide.util.lookup.Lookups;
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
    
    Result<LayerGroupProvider> result = null;
    private LookupListener lookupListener;

    @Override
    public void restored() {

//        System.setProperty("netbeans.winsys.no_toolbars", "true");
//
//        SwingUtilities.invokeLater(new Runnable() {
//
//            @Override
//            public void run() {
//                //Get the main window of the NetBeans Platform:
//                JFrame frame = (JFrame) WindowManager.getDefault().getMainWindow();
//                //Get our custom main toolbar:  
//                JPanel panel = new JPanel();
//                panel.setLayout(new FlowLayout(FlowLayout.CENTER));
//                panel.add(new blue.ui.core.toolbar.MainToolBar(), BorderLayout.CENTER);
//                panel.setPreferredSize(new Dimension(100, 70));
//
//                //Set the new layout of our root pane:
//                frame.getRootPane().setLayout(new MyRootPaneLayout(panel));
//                //Install a new toolbar component into the layered pane 
//                //of the main frame on layer 0: 
//                panel.putClientProperty(JLayeredPane.LAYER_PROPERTY, 0);
//                frame.getRootPane().getLayeredPane().add(panel, 0);
//            }
//        });

        initializeTextDefaults();

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
        
        PythonProxy.setLibDir(InstalledFileLocator.getDefault().
                locate("pythonLib", "jython", false));

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
        
        OSCManager oscManager = OSCManager.getInstance();
        OSCActions.installActions(oscManager);
        oscManager.start();
        
        TextColorsSettings.getInstance().addChangeListener(textColorChangeListener);
        
        Lookup lkp = Lookups.forPath("blue/score/layers");
        result = lkp.lookupResult(LayerGroupProvider.class);
        result.addLookupListener(lookupListener);
        
        LayerGroupProviderManager.getInstance().updateProviders(result.allInstances());
        
        lookupListener = new LookupListener() {

            @Override
            public void resultChanged(LookupEvent ev) {
                LayerGroupProviderManager.getInstance().updateProviders(result.allInstances());
            }
        };
        
        //        for(LayerGroupPanelProvider provider : lkp.lookupAll(
        //                LayerGroupPanelProvider.class)) {
        //            JComponent comp = provider.getLayerGroupPanel(layerGroup, timeState, data);
        //
        //            if(comp != null) {
        //                return comp;
        //            }
        //        }
        
        
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

        saveLibraries();

        WindowSettingManager.getInstance().save();

        MainToolBar.getInstance().stopRendering();
        BlueLiveToolBar.getInstance().stopRendering();

        result.removeLookupListener(lookupListener);
        
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

}
