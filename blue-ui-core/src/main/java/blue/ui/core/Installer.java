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
import blue.settings.GeneralSettings;
import blue.settings.ProjectDefaultsSettings;
import blue.soundObject.PolyObjectLayerGroupProvider;
import blue.ui.core.blueLive.BlueLiveToolBar;
import blue.ui.core.midi.MidiInputEngine;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.nbutilities.BlueNbUtilities;
import blue.utility.TempFileManager;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.beans.PropertyEditorManager;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.logging.Logger;
import javax.swing.SwingUtilities;
import jiconfont.icons.elusive.Elusive;
import jiconfont.icons.font_awesome.FontAwesome;
import jiconfont.icons.google_material_design_icons.GoogleMaterialDesignIcons;
import jiconfont.swing.IconFontSwing;
import org.openide.modules.InstalledFileLocator;
import org.openide.modules.ModuleInstall;
import org.openide.util.Lookup;
import org.openide.util.Lookup.Result;
import org.openide.util.LookupEvent;
import org.openide.util.LookupListener;
import org.openide.util.lookup.Lookups;
import org.openide.windows.WindowManager;

/**
 * Manages a module's lifecycle. Remember that an installer is optional and
 * often not needed at all.
 */
public class Installer extends ModuleInstall {

    BackupFileSaver backupFileSaver;

    private PropertyChangeListener windowTitlePropertyChangeListener;
    private final TempFileCleaner tempFileCleaner = new TempFileCleaner();
    private static final Logger logger = Logger.getLogger(
            Installer.class.getName());

    Result<LayerGroupProvider> result = null;
    private LookupListener lookupListener;

    @Override
    public void restored() {
        Locale.setDefault(Locale.Category.FORMAT, Locale.ENGLISH);
        System.setProperty("jffi.unsafe.disabled", "true");

        PolyObjectLayerGroupProvider.setDefaultHeightIndexProvider(() -> {
            return ProjectDefaultsSettings.getInstance().layerHeightDefault;
        });
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
        ParameterTimeManagerFactory.setInstance(new ParameterTimeManagerImpl());

        windowTitlePropertyChangeListener = (PropertyChangeEvent evt) -> {
            SwingUtilities.invokeLater(() -> {
                if (WindowManager.getDefault().getMainWindow() != null) {
                    setWindowTitle();
                }
            });
        };

        BlueProjectManager.getInstance().addPropertyChangeListener(
                windowTitlePropertyChangeListener);
        BlueProjectManager.getInstance().addPropertyChangeListener(
                tempFileCleaner);

        WindowManager.getDefault().invokeWhenUIReady(() -> {
            setWindowTitle();
            backupFileSaver = new BackupFileSaver();
            Thread t = new Thread(backupFileSaver);
            t.setPriority(Thread.MIN_PRIORITY);
            t.setDaemon(true);
            t.start();

            var tempFileManager = TempFileManager.getInstance();
            var genSettings = GeneralSettings.getInstance();

            tempFileManager.setDirectoryTempFileLimit(genSettings.getDirectoryTempFileLimit());

            genSettings.addChangeListener(evt -> {
                System.out.println("Temp file changed");
                tempFileManager.setDirectoryTempFileLimit(genSettings.getDirectoryTempFileLimit());
            });

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
        SwingUtilities.invokeLater(() -> {
            MidiInputManager.getInstance().addReceiver(
                    MidiInputEngine.getInstance());
        });

        new Thread(() -> {
            OSCManager oscManager = OSCManager.getInstance();
            OSCActions.installActions(oscManager);
            oscManager.start();
        }).start();

        Lookup lkp = Lookups.forPath("blue/score/layers");
        result = lkp.lookupResult(LayerGroupProvider.class);
        result.addLookupListener(lookupListener);

        LayerGroupProviderManager.getInstance().updateProviders(
                result.allInstances());

        lookupListener = (LookupEvent ev) -> {
            LayerGroupProviderManager.getInstance().updateProviders(
                    result.allInstances());
        };

        //        for(LayerGroupPanelProvider provider : lkp.lookupAll(
        //                LayerGroupPanelProvider.class)) {
        //            JComponent comp = provider.getLayerGroupPanel(layerGroup, timeState, data);
        //
        //            if(comp != null) {
        //                return comp;
        //            }
        //        }
        
        SwingUtilities.invokeLater(() -> {
            BlueNbUtilities.setMainWindow(WindowManager.getDefault().getMainWindow());
        });

        // REGISTER ICON FONTS
        IconFontSwing.register(Elusive.getIconFont());
        IconFontSwing.register(GoogleMaterialDesignIcons.getIconFont());
        IconFontSwing.register(FontAwesome.getIconFont());

        // REGISTER GLOBAL PROPERTY EDITORS
        List<String> paths = Arrays.asList(PropertyEditorManager.getEditorSearchPath());
        paths = new ArrayList(paths);
        paths.add("blue.orchestra.editor.blueSynthBuilder.swing.editors");
        PropertyEditorManager.setEditorSearchPath(paths.toArray(new String[0]));
        // editors from above path will be found based on className + "Editor"
        //PropertyEditorManager.registerEditor(LineList.class, LineListEditor.class);
    }

    @Override
    public void uninstalled() {
        ParameterTimeManagerFactory.setInstance(null);
        BlueProjectManager.getInstance().removePropertyChangeListener(
                windowTitlePropertyChangeListener);
        BlueProjectManager.getInstance().removePropertyChangeListener(
                tempFileCleaner);
        MidiInputManager.getInstance().removeReceiver(
                MidiInputEngine.getInstance());

        RealtimeRenderManager.getInstance().stopAuditioning();
        RealtimeRenderManager.getInstance().shutdown();

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

        final String t = title;

        SwingUtilities.invokeLater(() -> {
            WindowManager.getDefault().getMainWindow().setTitle(t);
        });

    }

    @Override
    public boolean closing() {
        boolean result = BlueProjectManager.getInstance().closeAllFiles();

        if (result) {
            WindowSettingManager.getInstance().save();
        }
        return result;
    }

    @Override
    public void close() {
        backupFileSaver.quitFileSaver();

        saveLibraries();

        MainToolBar.getInstance().stopRendering();
        BlueLiveToolBar.getInstance().stopRendering();

        result.removeLookupListener(lookupListener);

        RealtimeRenderManager.getInstance().stopRendering();
        RealtimeRenderManager.getInstance().stopBlueLiveRendering();

        super.close();
    }

    public void saveLibraries() {
        BlueSystem.saveUserInstrumentLibrary();
        BlueSystem.saveUDOLibrary();
        BlueSystem.saveSoundObjectLibrary();
    }

}
