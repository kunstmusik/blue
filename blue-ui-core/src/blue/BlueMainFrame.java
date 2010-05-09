package blue;

///*
// * blue - object composition environment for csound Copyright (c) 2001-2003
// * Steven Yi (stevenyi@gmail.com)
// *
// * This program is free software; you can redistribute it and/or modify it under
// * the terms of the GNU General Public License as published by the Free
// * Software Foundation; either version 2 of the License or (at your option) any
// * later version.
// *
// * This program is distributed in the hope that it will be useful, but WITHOUT
// * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
// * details.
// *
// * You should have received a copy of the GNU General Public License
// * along with this program; see the file COPYING.LIB. If not, write to the Free
// * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
// * USA
// */
//package blue;
//
//import blue.render.CsdRenderResult;
//import java.awt.AWTEvent;
//import java.awt.BorderLayout;
//import java.awt.Color;
//import java.awt.Dimension;
//import java.awt.Insets;
//import java.awt.dnd.DropTarget;
//import java.awt.event.ActionEvent;
//import java.awt.event.ActionListener;
//import java.awt.event.ComponentEvent;
//import java.awt.event.KeyEvent;
//import java.awt.event.WindowEvent;
//import java.io.BufferedReader;
//import java.io.BufferedWriter;
//import java.io.File;
//import java.io.FileNotFoundException;
//import java.io.FileWriter;
//import java.io.IOException;
//import java.io.PrintWriter;
//import java.io.StringReader;
//import java.lang.reflect.Method;
//import java.util.ArrayList;
//import java.util.HashMap;
//import java.util.Iterator;
//import java.util.Map;
//import java.util.Map.Entry;
//
//import javax.swing.AbstractAction;
//import javax.swing.Action;
//import javax.swing.BorderFactory;
//import javax.swing.JFileChooser;
//import javax.swing.JFrame;
//import javax.swing.JLabel;
//import javax.swing.JMenu;
//import javax.swing.JMenuBar;
//import javax.swing.JMenuItem;
//import javax.swing.JOptionPane;
//import javax.swing.JPanel;
//import javax.swing.JTabbedPane;
//import javax.swing.KeyStroke;
//import javax.swing.SwingUtilities;
//import javax.swing.border.BevelBorder;
//import javax.swing.event.ChangeEvent;
//import javax.swing.event.ChangeListener;
//import javax.swing.event.MenuEvent;
//import javax.swing.event.MenuListener;
//import javax.swing.filechooser.FileFilter;
//
//import org.python.core.PyException;
//
//import Silence.XMLSerializer;
//import blue.actions.BlueAction;
//import blue.actions.DialogFlipAction;
//import blue.actions.TabSelectionAction;
//import blue.actions.URLOpenAction;
//import blue.automation.AutomationManager;
//import blue.blueLive.BlueLiveDialog2;
//import blue.components.JScrollNavigator;
//import blue.gui.CsoundOutputDlg;
//import blue.gui.DialogUtil;
//import blue.gui.ExceptionDialog;
//import blue.gui.FileChooserManager;
//import blue.gui.InfoDialog;
//import blue.gui.TabbedPaneSwitchDropTarget;
//import blue.mixer.EffectsLibraryDialog;
//import blue.mixer.MixerDialog;
//import blue.patterns.PatternsData;
//import blue.render.CSDRender;
//import blue.render.ProcessConsole;
//import blue.render.RenderTimeManager;
//import blue.score.AuditionManager;
//import blue.score.ScoreGUI;
//import blue.score.TimeBar;
//import blue.scripting.PythonProxy;
//import blue.scripting.Script;
//import blue.scripting.ScriptCategory;
//import blue.scripting.ScriptLibrary;
//import blue.scripting.ScriptLibraryDialog;
//import blue.settings.DiskRenderSettings;
//import blue.settings.RealtimeRenderSettings;
//import blue.soundFile.SoundFileManager;
//import blue.soundObject.AudioFile;
//import blue.soundObject.NoteParseException;
//import blue.soundObject.PolyObject;
//import blue.soundObject.SoundObject;
//import blue.soundObject.SoundObjectException;
//import blue.tools.codeRepository.CodeRepositoryDialog;
//import blue.tools.ftableConverter.FTableConverterDialog;
//import blue.tools.scanned.ScannedMatrixEditor;
//import blue.tools.soundFont.SoundFontViewer;
//import blue.udo.UserDefinedOpcodeGUI;
//import blue.undo.BlueUndoManager;
//import blue.utility.APIUtilities;
//import blue.utility.BlueSystemTimer;
//import blue.utility.CSDUtility;
//import blue.utility.GUI;
//import blue.utility.GenericFileFilter;
//import blue.utility.MidiUtilities;
//import blue.utility.TextUtilities;
//import electric.xml.Document;
//import electric.xml.Element;
//import java.awt.event.ComponentAdapter;
//import javax.swing.JCheckBoxMenuItem;
//
///**
// * Main GUI Frame for blue
// *
// * @author steven
// * @created November 11, 2001
// */
//public final class BlueMainFrame extends JFrame implements
//        WindowSettingsSavable {
//
//    private static String FILE_MAIN = "blueMainFrame.mainFileDialog";
//
//    private static String FILE_GEN = "blueMainFrame.generateCSD";
//
//    private static String FILE_IMPORT = "blueMainFrame.fileImport";
//
//    private static String FILE_IMPORT_ORC = "blueMainFrame.fileImportOrc";
//
//    private static String FILE_IMPORT_SCO = "blueMainFrame.fileImportSco";
//
//    private static String FILE_IMPORT_MIDI = "blueMainFrame.fileImportMidi";
//
//    private static String FILE_LIBRARY = "blueMainFrame.library";
//
//    private static String FILE_SAVE = "blueMainFrame.fileSave";
//
//    // public static OpcodeMap opcodeMap = new OpcodeMap();
//    ArrayList blueDataFileArray = new ArrayList();
//
//    BlueDataFile currentDataFile;
//
//    BlueData data;
//
//    JPanel contentPane;
//
//    JLabel statusBar = new JLabel("");
//
//    JPanel MainPanel = new JPanel();
//
//    JTabbedPane viewSelectPane = new JTabbedPane();
//
//    JPanel Orchestra = new JPanel();
//
//    JPanel sObjEditPane = new JPanel();
//
//    // Custom GUI units
//    // public static OrchestraGUI orch = new OrchestraGUI();
//    ScoreGUI score = new ScoreGUI(this);
//
//    InstrumentsGUI instruments = new InstrumentsGUI();
//
//    // 2002.11.6 - made static to get a reference for updating from "convert to
//    // generic score"
//    public static TablesGUI tables = new TablesGUI();
//
//    GlobalGUI global = new GlobalGUI();
//
//    UserDefinedOpcodeGUI udo = new UserDefinedOpcodeGUI();
//
//    // public static ProjectPropertiesGUI props = new ProjectPropertiesGUI();
//    private final ProjectPropertiesPanel props = new ProjectPropertiesPanel();
//
//    SoundFileManager soundFileManager = new SoundFileManager();
//
//    // FTableGUI ftables = new FTableGUI();
//    ScratchPadDialog sPadDialog;
//
//    BlueLiveDialog2 blueLiveDialog;
//
//    JScrollNavigator scoreNavDialog;
//
//    MarkersListDialog markersListDialog;
//
//    MixerDialog mixerDialog;
//
//    UserToolsDialog userToolsDialog = null; // Lazily initialized
//
//    public BlueMenuBar blueMenuBar;
//
//    private static CsoundOutputDlg csoundOutputDlg = null;
//
//    MainToolBar mainToolBar = new MainToolBar();
//
//    BackupFileSaver backupFileSaver = new BackupFileSaver();
//
//    private RenderToDiskDialog renderToDiskDialog = null;
//
//    protected boolean shouldPlayAfterRender = false;
//
//    private AudioFileDependencyDialog dependencyDialog = null;
//
//    ProgramOptionsDialog programOptionsDialog = null;
//
//    // Construct the frame
//    public BlueMainFrame(ArrayList filesToOpen) {
//        BlueSystem.setBlueMainFrame(this);
//
//        enableEvents(AWTEvent.WINDOW_EVENT_MASK);
//
//        try {
//            jbInit();
//        } catch (Exception e) {
//            e.printStackTrace();
//        }
//        if (filesToOpen.size() == 0) {
//            fileNew();
//        } else {
//            boolean atleastOneOpened = false;
//            for (Iterator iter = filesToOpen.iterator(); iter.hasNext();) {
//                String fileName = (String) iter.next();
//                File f = new File(fileName);
//                if (!f.exists() || !f.isFile()) {
//                    String errorMessage = BlueSystem.getString(
//                            "message.file.couldNotOpen") + " \"" + fileName + "\"";
//
//                    JOptionPane.showMessageDialog(this, errorMessage,
//                            BlueSystem.getString("message.file.notFound"),
//                            JOptionPane.ERROR_MESSAGE);
//
//                } else {
//                    open(f);
//                    atleastOneOpened = true;
//                }
//                if (!atleastOneOpened) {
//                    fileNew();
//                }
//            }
//        }
//
//        Thread t = new Thread(backupFileSaver);
//        t.setPriority(Thread.MIN_PRIORITY);
//        t.setDaemon(true);
//        t.start();
//
//        registerOSX();
//    }
//
//    // Component initialization
//    private void jbInit() throws Exception {
//
//        sPadDialog = new ScratchPadDialog(this);
//        blueLiveDialog = new BlueLiveDialog2(this, false);
//
//        mixerDialog = new MixerDialog(this, false);
//
//        setIconImage(BlueSystem.getImage("BlueIcon.gif"));
//
//        // new TypeAheadSelector(genFileDialog);
//        contentPane = (JPanel) this.getContentPane();
//        contentPane.setLayout(new BorderLayout());
//
//        this.setTitle(BlueConstants.getVersion());
//        statusBar.setBorder(BorderFactory.createCompoundBorder(BorderFactory.
//                createBevelBorder(BevelBorder.LOWERED, Color.white,
//                Color.white, new Color(142, 142, 142), new Color(99,
//                99, 99)), BorderFactory.createEmptyBorder(0, 5,
//                0, 0)));
//
//        StatusBar.setStatusLabel(statusBar);
//
//        contentPane.setEnabled(true);
//        contentPane.setMinimumSize(new Dimension(800, 600));
//        contentPane.setPreferredSize(new Dimension(800, 600));
//        MainPanel.setBorder(BorderFactory.createEtchedBorder());
//        MainPanel.setPreferredSize(new Dimension(550, 400));
//        MainPanel.setLayout(new BorderLayout());
//
//        // Orchestra.setLayout(new BorderLayout());
//
//        if (getCsoundOutputDialog() == null) {
//            setCsoundOutputDialog(new CsoundOutputDlg(this));
//        }
//
//        contentPane.add(viewSelectPane, BorderLayout.CENTER);
//        viewSelectPane.add(score, BlueSystem.getString(
//                "blueMainFrame.tabs.score"));
//        viewSelectPane.add(instruments, BlueSystem.getString(
//                "blueMainFrame.tabs.orchestra"));
//        viewSelectPane.add(tables, BlueSystem.getString(
//                "blueMainFrame.tabs.tables"));
//        // viewSelectPane.add(ftables, "ftables");
//        viewSelectPane.add(global, BlueSystem.getString(
//                "blueMainFrame.tabs.global"));
//        viewSelectPane.add(udo, "udo");
//        viewSelectPane.add(props, BlueSystem.getString(
//                "blueMainFrame.tabs.projectProperties"));
//        viewSelectPane.add(soundFileManager, BlueSystem.getString(
//                "blueMainFrame.tabs.soundFile"));
//        viewSelectPane.addChangeListener(new ChangeListener() {
//
//            public void stateChanged(ChangeEvent e) {
//                BlueUndoManager.setUndoManager(viewSelectPane.getTitleAt(viewSelectPane.
//                        getSelectedIndex()));
//            }
//        });
//
//        new DropTarget(viewSelectPane, new TabbedPaneSwitchDropTarget(
//                viewSelectPane));
//
//        contentPane.add(statusBar, BorderLayout.SOUTH);
//        contentPane.add(mainToolBar, BorderLayout.NORTH);
//
//        mainToolBar.setFloatable(false);
//
//        markersListDialog = new MarkersListDialog(this);
//
//        scoreNavDialog = new JScrollNavigator(this);
//        scoreNavDialog.setJScrollPane(score.getScoreScrollPane());
//
//        setupFileChoosers();
//
//        // Default Size and Location
//        this.setSize(800, 600);
//        GUI.centerOnScreen(this);
//
//        WindowSettingManager.getInstance().registerWindow("blueMainFrame", this);
//
//        blueMenuBar = new BlueMenuBar();
//        blueMenuBar.setBorder(null);
//        this.setJMenuBar(blueMenuBar);
//
//        DialogUtil.setupDialogActions(blueMenuBar);
//    }
//
//    private void registerOSX() {
//        if (System.getProperty("os.name").toLowerCase().startsWith("mac os x")) {
//            try {
//                Class osxAdapter = ClassLoader.getSystemClassLoader().loadClass(
//                        "blue.OSXHandler");
//
//                Class[] defArgs = {BlueMainFrame.class};
//                Method registerMethod = osxAdapter.getDeclaredMethod("install",
//                        defArgs);
//                if (registerMethod != null) {
//                    Object[] args = {this};
//                    registerMethod.invoke(osxAdapter, args);
//                }
//
//            } catch (NoClassDefFoundError e) {
//                // This will be thrown first if the OSXAdapter is loaded on a
//                // system without the EAWT
//                // because OSXAdapter extends ApplicationAdapter in its def
//                System.err.println(
//                        "This version of Mac OS X does not support " + "the Apple EAWT.  Application Menu handling " + "has been disabled (" + e + ")");
//            } catch (ClassNotFoundException e) {
//                // This shouldn't be reached; if there's a problem with the
//                // OSXHandler we should get the
//                // above NoClassDefFoundError first.
//                System.err.println(
//                        "This version of Mac OS X does not support " + "the Apple EAWT.  Application Menu handling " + "has been disabled (" + e + ")");
//            } catch (Exception e) {
//                System.err.println("Exception while loading the OSXHandler:");
//                e.printStackTrace();
//            }
//        }
//    }
//
//    private void setupFileChoosers() {
//        File defaultFile = new File(ProgramOptions.getGeneralSettings().
//                getDefaultDirectory() + File.separator + "default.blue");
//
//        FileFilter csdFilter = new GenericFileFilter("csd",
//                BlueSystem.getString("fileFilters.csd"));
//        FileFilter orcFilter = new GenericFileFilter("orc",
//                BlueSystem.getString("fileFilters.orc"));
//        FileFilter scoFilter = new GenericFileFilter("sco",
//                BlueSystem.getString("fileFilters.sco"));
//        FileFilter blueFilter = new GenericFileFilter("blue", BlueSystem.
//                getString("fileFilters.blue"));
//        FileFilter midiFilter = new FileFilter() {
//
//            String descr = BlueSystem.getString("fileFilters.midi");
//
//            public boolean accept(File f) {
//                if (f.isDirectory()) {
//                    return true;
//                }
//                String name = f.getName().toLowerCase();
//
//                return (name.endsWith("mid") || name.endsWith("midi"));
//            }
//
//            public String getDescription() {
//                return descr;
//            }
//        };
//
//        FileChooserManager.addFilter(FILE_MAIN, csdFilter);
//        FileChooserManager.addFilter(FILE_MAIN, blueFilter);
//        FileChooserManager.setMultiSelect(FILE_MAIN, true);
//        FileChooserManager.setSelectedFile(FILE_MAIN, defaultFile);
//
//        FileChooserManager.setDialogTitle(FILE_GEN, BlueSystem.getString(
//                "fileDialogs.generateToFile"));
//        FileChooserManager.addFilter(FILE_GEN, csdFilter);
//
//        FileChooserManager.setDialogTitle(FILE_IMPORT, BlueSystem.getString(
//                "fileDialogs.fileImport"));
//        FileChooserManager.addFilter(FILE_IMPORT, csdFilter);
//
//        FileChooserManager.setDialogTitle(FILE_IMPORT_ORC, BlueSystem.getString(
//                "fileDialogs.fileImportOrc"));
//        FileChooserManager.addFilter(FILE_IMPORT_ORC, orcFilter);
//
//        FileChooserManager.setDialogTitle(FILE_IMPORT_SCO, BlueSystem.getString(
//                "fileDialogs.fileImportSco"));
//        FileChooserManager.addFilter(FILE_IMPORT_SCO, scoFilter);
//
//        FileChooserManager.setDialogTitle(FILE_IMPORT_MIDI,
//                BlueSystem.getString("fileDialogs.fileImportMidi"));
//        FileChooserManager.addFilter(FILE_IMPORT_MIDI, midiFilter);
//
//        FileChooserManager.addFilter(FILE_SAVE, blueFilter);
//        FileChooserManager.setDialogTitle(FILE_SAVE, BlueSystem.getString(
//                "fileDialogs.fileSave"));
//        FileChooserManager.setSelectedFile(FILE_SAVE, defaultFile);
//
//        FileChooserManager.addFilter(FILE_LIBRARY, blueFilter);
//        FileChooserManager.setDialogTitle(FILE_LIBRARY, BlueSystem.getString(
//                "fileDialogs.openLibrary"));
//
//        FileChooserManager.setSelectedFile(FILE_LIBRARY, defaultFile);
//    }
//
//    // File | Exit action performed
//    public void exitBlue() {
//        if (closeAllFiles()) {
//            backupFileSaver.quitFileSaver();
//            mainToolBar.stopRendering();
//            saveWindowStateCheck();
//            saveLibraries();
//
//            if (ProgramOptions.getGeneralSettings().isShowTimeLogOnExit()) {
//                showTimeLog();
//            }
//
//            System.exit(0);
//        }
//    }
//
//    public void saveLibraries() {
//        BlueSystem.saveUserInstrumentLibrary();
//        BlueSystem.saveUDOLibrary();
//    }
//
//    // Help | About action performed
//    public void showAboutBlue() {
//        BlueMainFrame_AboutBox dlg = new BlueMainFrame_AboutBox(this);
//        GUI.centerOnScreen(dlg);
//        dlg.setModal(true);
//        dlg.show();
//    }
//
//    public void showProgramOptionsDialog() {
//        if (programOptionsDialog == null) {
//            programOptionsDialog = new ProgramOptionsDialog(this);
//        }
//        programOptionsDialog.show();
//        GUI.adjustIfOffScreen(programOptionsDialog);
//    }
//
//    // Overridden so we can exit when window is closed
//    protected void processWindowEvent(WindowEvent e) {
//        if (e.getID() == WindowEvent.WINDOW_CLOSING) {
//            if (closeAllFiles()) {
//                backupFileSaver.quitFileSaver();
//                mainToolBar.stopRendering();
//                saveWindowStateCheck();
//                saveLibraries();
//                super.processWindowEvent(e);
//
//                if (ProgramOptions.getGeneralSettings().isShowTimeLogOnExit()) {
//                    showTimeLog();
//                }
//
//                System.exit(0);
//            }
//        }
//    }
//
//    private void saveWindowStateCheck() {
//        if (ProgramOptions.getGeneralSettings().isMaintainLastState()) {
//            WindowSettingManager.getInstance().save();
//        }
//    }
//
//    private boolean closeAllFiles() {
//        while (blueDataFileArray.size() > 0) {
//            if (saveCheck()) {
//                int index = blueDataFileArray.indexOf(currentDataFile);
//                blueDataFileArray.remove(currentDataFile);
//
//                if (currentDataFile.tempFile != null) {
//                    currentDataFile.tempFile.delete();
//                }
//
//                // menuBar1.resetWindowsMenu();
//
//                if (blueDataFileArray.size() == 0) {
//                    return true;
//                } else if (index >= blueDataFileArray.size()) {
//                    setCurrentBlueDataFile((BlueDataFile) blueDataFileArray.get(blueDataFileArray.
//                            size() - 1));
//                } else {
//                    setCurrentBlueDataFile((BlueDataFile) blueDataFileArray.get(
//                            index));
//                }
//            } else {
//                return false;
//            }
//        }
//        return true;
//    }
//
//    public BlueData getBlueData() {
//        return data;
//    }
//
//    private void setRevertEnabled() {
//        boolean hasFile = (currentDataFile.dataFile != null);
//        blueMenuBar.enableRevert(hasFile);
//    }
//
//    public void open() {
//        // check to see if changed; ask for save
//
//        int rValue = FileChooserManager.showOpenDialog(FILE_MAIN, this);
//
//        if (rValue == JFileChooser.APPROVE_OPTION) {
//            // File temp = fileDialog.getSelectedFile();
//            File[] tempFiles = FileChooserManager.getSelectedFiles(FILE_MAIN);
//
//            for (int i = 0; i < tempFiles.length; i++) {
//                File temp = tempFiles[i];
//
//                if (temp.getName().trim().endsWith(".patterns")) {
//                    openPatternsFile(temp);
//                } else {
//
//                    if (!(temp.getName().trim().endsWith(".blue"))) {
//                        temp = new File(temp.getAbsolutePath() + ".blue");
//                    }
//
//                    open(temp);
//                }
//            }
//
//        } else if (rValue == JFileChooser.CANCEL_OPTION) {
//            StatusBar.updateStatus(BlueSystem.getString(
//                    "message.actionCancelled"));
//        }
//    }
//
//    public void openPatternsFile(File patternsFile) {
//        BlueData tempData = PatternsData.loadFromFile(patternsFile).convert();
//
//        BlueDataFile bdf = new BlueDataFile(tempData, null);
//
//        this.blueDataFileArray.add(bdf);
//
//        setCurrentBlueDataFile(bdf);
//    }
//
//    public void open(File selected) {
//
//        File absoluteSelected = selected.getAbsoluteFile();
//
//        File temp = absoluteSelected;
//
//        BlueDataFile tempBdf = getBlueDataFile(temp);
//
//        if (tempBdf != null) {
//            setCurrentBlueDataFile(tempBdf);
//            return;
//        }
//
//        File backup = new File(absoluteSelected.getAbsolutePath() + "~");
//
//        boolean wasTempFile = false;
//
//        if (backup.exists() && backup.lastModified() > temp.lastModified()) {
//            String message = "A backup work file was found. This should only " + "occur if blue did not close successfully.\n\n" + "Would you like to open the backup file?\n\n" + "If you open the backup file, it will be required to " + "\"Save as\" the file to overwrite your old work.)";
//
//            int retVal = JOptionPane.showConfirmDialog(this, message);
//
//            if (retVal == JOptionPane.YES_OPTION) {
//                temp = backup;
//                wasTempFile = true;
//            } else if (retVal == JOptionPane.CANCEL_OPTION) {
//                return;
//            }
//        }
//
//        try {
//
//            String text = TextUtilities.getTextFromFile(temp);
//
//            BlueData tempData;
//
//            if (text.startsWith("<blueData")) {
//                Document d = new Document(text);
//                tempData = BlueData.loadFromXML(d.getElement("blueData"));
//            } else {
//                JOptionPane.showMessageDialog(this, BlueSystem.getString(
//                        "blue.pre94"));
//
//                XMLSerializer xmlSer = new XMLSerializer();
//                BufferedReader xmlIn = new BufferedReader(
//                        new StringReader(text));
//
//                tempData = (BlueData) xmlSer.read(xmlIn);
//
//                xmlIn.close();
//                tempData.upgradeData();
//            }
//
//            InstrumentLibrary iLibrary = tempData.getInstrumentLibrary();
//
//            if (iLibrary != null) {
//                tempData.normalizeArrangement();
//                tempData.setInstrumentLibrary(null);
//
//                // TODO - TRANSLATE
//                String message = "This project contains an InstrumentLibrary \n" + "which is no longer being used in blue. The project's\n " + "orchestra will be updated to have individual copies of\n " + "each instrument from the library. \n\n" + "Upon saving, the InstrumentLibrary in this project will\n" + "no longer be accessible.\n\n" + "Would you like to import a copy of your library into " + "your user InstrumentLibrary?";
//
//                int retVal = JOptionPane.showConfirmDialog(this, message);
//
//                if (retVal == JOptionPane.YES_OPTION) {
//                    BlueSystem.getUserInstrumentLibrary().importLibrary(
//                            iLibrary);
//                }
//            }
//
//            ProgramOptions.addRecentFile(temp);
//            blueMenuBar.resetRecentFiles();
//            ProgramOptions.save();
//
//            BlueDataFile bdf;
//
//            if (wasTempFile) {
//                bdf = new BlueDataFile(tempData, null);
//                bdf.tempFile = temp;
//                bdf.wasTempFile = wasTempFile;
//            } else {
//                bdf = new BlueDataFile(tempData, temp);
//            }
//
//            this.blueDataFileArray.add(bdf);
//
//            temp = null;
//
//            // StatusBar.updateStatus(selected.getName() + " opened.");
//
//            // menuBar1.resetWindowsMenu();
//            setCurrentBlueDataFile(bdf);
//
//            checkDependencies(tempData);
//
//        } catch (FileNotFoundException fe) {
//            StatusBar.updateStatus(
//                    "[" + BlueSystem.getString("message.error") + "] " + BlueSystem.
//                    getString("message.file.notFound") + " " + temp.toString() + ".");
//
//            String errorMessage = BlueSystem.getString(
//                    "message.file.couldNotOpen") + " \"" + temp.toString() + "\"";
//
//            JOptionPane.showMessageDialog(this, errorMessage, BlueSystem.
//                    getString("message.file.notFound"),
//                    JOptionPane.ERROR_MESSAGE);
//
//        } catch (Exception e) {
//            e.printStackTrace();
//
//            StatusBar.updateStatus("[" + BlueSystem.getString("message.error") + "] " + BlueSystem.
//                    getString("message.file.couldNotOpen") + " \"" + temp.
//                    toString() + "\"");
//        }
//
//    }
//
//    private BlueDataFile getBlueDataFile(File f) {
//        if (f == null) {
//            return null;
//        }
//
//        BlueDataFile bdf = null;
//
//        for (Iterator it = this.blueDataFileArray.iterator(); it.hasNext();) {
//            BlueDataFile elem = (BlueDataFile) it.next();
//            if (elem.dataFile != null && elem.dataFile.equals(f)) {
//                bdf = elem;
//                break;
//            }
//        }
//
//        return bdf;
//    }
//
//    // public void openLibrary() {
//    // int rValue = FileChooserManager.showOpenDialog(FILE_LIBRARY, this);
//    // if(rValue == JFileChooser.APPROVE_OPTION) {
//    // File temp = FileChooserManager.getSelectedFile(FILE_LIBRARY);
//    // BlueData tempData;
//    // if(!(temp.getName().trim().endsWith(".blue"))) {
//    // String errorMessage = BlueSystem
//    // .getString("message.file.incorrectEnding")
//    // + " .blue";
//    // JOptionPane.showMessageDialog(null, errorMessage,
//    // BlueSystem.getString("message.error"),
//    // JOptionPane.ERROR_MESSAGE);
//    // }
//    //
//    // try {
//    // XMLSerializer xmlSer = new XMLSerializer();
//    // BufferedReader xmlIn = new BufferedReader(new FileReader(temp));
//    // tempData = (BlueData) xmlSer.read(xmlIn);
//    // xmlIn.close();
//    //
//    // InstrumentLibraryImportDialog instLibDialog = new
//    // InstrumentLibraryImportDialog(
//    // this, tempData);
//    // Dimension screenSize = Toolkit.getDefaultToolkit()
//    // .getScreenSize();
//    // instLibDialog.setSize(200, screenSize.height - 50);
//    // instLibDialog.setLocation(screenSize.width - 225, 25);
//    // instLibDialog.show();
//    // } catch(Exception e) {
//    // StatusBar.updateStatus("["
//    // + BlueSystem.getString("message.error")
//    // + "] "
//    // + BlueSystem
//    // .getString("message.file.couldNotOpen") + " \""
//    // + temp.toString() + "\"");
//    // e.printStackTrace();
//    // }
//    //
//    // } else if(rValue == JFileChooser.CANCEL_OPTION) {
//    // StatusBar.updateStatus(BlueSystem
//    // .getString("message.actionCancelled"));
//    // }
//    // }
//    private void checkDependencies(BlueData tempData) {
//        PolyObject pObj = tempData.getPolyObject();
//
//        ArrayList filesList = new ArrayList();
//
//        checkAudioFiles(pObj, filesList);
//
//        if (filesList.size() > 0) {
//            if (dependencyDialog == null) {
//                dependencyDialog = new AudioFileDependencyDialog();
//            }
//
//            dependencyDialog.setFilesList(filesList);
//
//            if (dependencyDialog.ask()) {
//
//                HashMap map = dependencyDialog.getFilesMap();
//
//                if (map == null || map.size() == 0) {
//                    return;
//                }
//
//                for (Iterator iter = map.entrySet().iterator(); iter.hasNext();) {
//                    Map.Entry entry = (Entry) iter.next();
//
//                    String key = (String) entry.getKey();
//                    String val = (String) entry.getValue();
//
//                    val = BlueSystem.getRelativePath(val);
//
//                    entry.setValue(val);
//
//                }
//
//                System.out.println(map);
//
//                reconcileAudioFiles(pObj, map);
//            }
//        }
//
//    }
//
//    private void reconcileAudioFiles(PolyObject pObj, HashMap map) {
//        for (Iterator iter = pObj.getSoundObjects(true).iterator(); iter.hasNext();) {
//            SoundObject sObj = (SoundObject) iter.next();
//            if (sObj instanceof AudioFile) {
//                AudioFile af = (AudioFile) sObj;
//
//                String soundFileName = af.getSoundFileName();
//
//                if (map.containsKey(soundFileName)) {
//                    // if (!filesList.contains(soundFileName)) {
//                    // filesList.add(soundFileName);
//                    // }
//                    af.setSoundFileName((String) map.get(soundFileName));
//                }
//            } else if (sObj instanceof PolyObject) {
//                reconcileAudioFiles((PolyObject) sObj, map);
//            }
//        }
//
//    }
//
//    private void checkAudioFiles(PolyObject pObj, ArrayList filesList) {
//        for (Iterator iter = pObj.getSoundObjects(true).iterator(); iter.hasNext();) {
//            SoundObject sObj = (SoundObject) iter.next();
//            if (sObj instanceof AudioFile) {
//                AudioFile af = (AudioFile) sObj;
//
//                String soundFileName = af.getSoundFileName();
//
//                if (BlueSystem.findFile(soundFileName) == null) {
//                    if (!filesList.contains(soundFileName)) {
//                        filesList.add(soundFileName);
//                    }
//                }
//            } else if (sObj instanceof PolyObject) {
//                checkAudioFiles((PolyObject) sObj, filesList);
//            }
//        }
//    }
//
//    public void importCSD() {
//        int rValue = FileChooserManager.showOpenDialog(FILE_IMPORT, this);
//
//        if (rValue == JFileChooser.APPROVE_OPTION) {
//            File temp = FileChooserManager.getSelectedFile(FILE_IMPORT);
//
//            if (!(temp.getName().trim().toLowerCase().endsWith(".csd"))) {
//                String errorMessage = BlueSystem.getString(
//                        "message.file.incorrectEnding") + " .csd";
//                JOptionPane.showMessageDialog(this, errorMessage, BlueSystem.
//                        getString("message.error"), JOptionPane.ERROR_MESSAGE);
//            }
//
//            /*
//             * if(!saveCheck()) { System.out.println("!saveCheck() in
//             * BlueMainFrame"); return;
//             */
//
//            final Object[] values = {BlueSystem.getString("csd.import1"),
//                BlueSystem.getString("csd.import2"),
//                BlueSystem.getString("csd.import3")};
//
//            Object selectedValue = JOptionPane.showInputDialog(this, BlueSystem.
//                    getString("csd.importMethod.message"), BlueSystem.getString(
//                    "csd.importMethod.title"),
//                    JOptionPane.INFORMATION_MESSAGE, null, values, values[0]);
//
//            if (selectedValue == null) {
//                return;
//            }
//
//            int modeType = 0;
//
//            for (int i = 0; i < values.length; i++) {
//                if (selectedValue == values[i]) {
//                    modeType = i;
//                    break;
//                }
//            }
//
//            BlueData tempData = CSDUtility.convertCSDtoBlue(temp, modeType);
//
//            if (tempData != null) {
//                BlueDataFile bdf = new BlueDataFile(tempData, null);
//                this.blueDataFileArray.add(bdf);
//                setCurrentBlueDataFile(bdf);
//            // menuBar1.resetWindowsMenu();
//            } else {
//                JOptionPane.showMessageDialog(this, BlueSystem.getString(
//                        "message.file.couldNotImport"), BlueSystem.getString(
//                        "message.error"), JOptionPane.ERROR_MESSAGE);
//            }
//
//        } else if (rValue == JFileChooser.CANCEL_OPTION) {
//            StatusBar.updateStatus(BlueSystem.getString(
//                    "message.actionCancelled"));
//        }
//
//    }
//
//    public void importOrcSco() {
//        int rValue = FileChooserManager.showOpenDialog(FILE_IMPORT_ORC, this);
//
//        if (rValue != JFileChooser.APPROVE_OPTION) {
//            StatusBar.updateStatus(BlueSystem.getString(
//                    "message.actionCancelled"));
//            return;
//        }
//
//        rValue = FileChooserManager.showOpenDialog(FILE_IMPORT_SCO, this);
//
//        if (rValue != JFileChooser.APPROVE_OPTION) {
//            StatusBar.updateStatus(BlueSystem.getString(
//                    "message.actionCancelled"));
//            return;
//        }
//
//        File orcFile = FileChooserManager.getSelectedFile(FILE_IMPORT_ORC);
//        File scoFile = FileChooserManager.getSelectedFile(FILE_IMPORT_SCO);
//
//        final Object[] values = {BlueSystem.getString("csd.import1"),
//            BlueSystem.getString("csd.import2"),
//            BlueSystem.getString("csd.import3")};
//
//        Object selectedValue = JOptionPane.showInputDialog(this, BlueSystem.
//                getString("csd.importMethod.message"), BlueSystem.getString(
//                "csd.importMethod.title"),
//                JOptionPane.INFORMATION_MESSAGE, null, values, values[0]);
//
//        if (selectedValue == null) {
//            return;
//        }
//
//        int modeType = 0;
//
//        for (int i = 0; i < values.length; i++) {
//            if (selectedValue == values[i]) {
//                modeType = i;
//                break;
//            }
//        }
//
//        BlueData tempData = CSDUtility.convertOrcScoToBlue(orcFile, scoFile,
//                modeType);
//
//        if (tempData != null) {
//            BlueDataFile bdf = new BlueDataFile(tempData, null);
//            this.blueDataFileArray.add(bdf);
//            setCurrentBlueDataFile(bdf);
//        // menuBar1.resetWindowsMenu();
//        } else {
//            JOptionPane.showMessageDialog(this, BlueSystem.getString(
//                    "message.file.couldNotImport"), BlueSystem.getString(
//                    "message.error"), JOptionPane.ERROR_MESSAGE);
//        }
//
//    }
//
//    public void importMidiFile() {
//        int rValue = FileChooserManager.showOpenDialog(FILE_IMPORT_MIDI, this);
//
//        if (rValue != JFileChooser.APPROVE_OPTION) {
//            StatusBar.updateStatus(BlueSystem.getString(
//                    "message.actionCancelled"));
//            return;
//        }
//        File midiFile = FileChooserManager.getSelectedFile(FILE_IMPORT_MIDI);
//
//        BlueData tempData = new BlueData();
//
//        try {
//            PolyObject pObj = MidiUtilities.convertMidiFile(this, midiFile);
//            if (pObj == null) {
//                JOptionPane.showMessageDialog(this, BlueSystem.getString(
//                        "message.file.couldNotImport"), BlueSystem.getString(
//                        "message.error"), JOptionPane.ERROR_MESSAGE);
//                return;
//            }
//            tempData.setPolyObject(pObj);
//        } catch (NoteParseException e) {
//            JOptionPane.showMessageDialog(this, BlueSystem.getString(
//                    "message.file.couldNotImport"), BlueSystem.getString(
//                    "message.error"), JOptionPane.ERROR_MESSAGE);
//            return;
//        }
//
//        BlueDataFile bdf = new BlueDataFile(tempData, null);
//        this.blueDataFileArray.add(bdf);
//        setCurrentBlueDataFile(bdf);
//
//    }
//
//    public void save() {
//        if (currentDataFile.dataFile != null) {
//            try {
//                PrintWriter out = new PrintWriter(new FileWriter(
//                        currentDataFile.dataFile));
//
//                out.print(data.saveAsXML().toString());
//
//                out.flush();
//                out.close();
//                StatusBar.updateStatus(BlueSystem.getString(
//                        "message.file.saveAs") + " " + currentDataFile.dataFile.
//                        getName());
//            } catch (IOException ioe) {
//                String errorMessage = BlueSystem.getString(
//                        "message.file.couldNotSave") + "\n\n" + ioe.
//                        getLocalizedMessage();
//                JOptionPane.showMessageDialog(this, errorMessage, BlueSystem.
//                        getString("message.error"), JOptionPane.ERROR_MESSAGE);
//                StatusBar.updateStatus(BlueSystem.getString(
//                        "message.file.couldNotSave") + " - " + ioe.
//                        getLocalizedMessage());
//            } catch (Exception e) {
//                e.printStackTrace();
//            }
//        } else {
//            saveAs();
//        }
//    }
//
//    public boolean saveAs() {
//
//        int rValue = FileChooserManager.showSaveDialog(FILE_SAVE, this);
//        if (rValue == JFileChooser.APPROVE_OPTION) {
//            File temp = FileChooserManager.getSelectedFile(FILE_SAVE);
//            if (!(temp.getName().trim().endsWith(".blue"))) {
//                temp = new File(temp.getAbsolutePath() + ".blue");
//            }
//
//            if (currentDataFile.wasTempFile) {
//                currentDataFile.tempFile.delete();
//                currentDataFile.wasTempFile = false;
//            }
//
//            try {
//                PrintWriter out = new PrintWriter(new FileWriter(temp));
//
//                out.print(data.saveAsXML().toString());
//
//                out.flush();
//                out.close();
//
//                StatusBar.updateStatus(BlueSystem.getString(
//                        "message.file.saveAs") + " " + temp.getName());
//                ProgramOptions.addRecentFile(temp);
//                blueMenuBar.resetRecentFiles();
//                ProgramOptions.save();
//                // fileName = temp;
//
//                this.currentDataFile.dataFile = temp;
//
//                BlueSystem.setCurrentProjectDirectory(temp.getParentFile());
//
//                temp = null;
//                this.setTitle(BlueConstants.getVersion() + " - " + currentDataFile.dataFile.
//                        getName());
//                setRevertEnabled();
//            } catch (Exception e) {
//                e.printStackTrace();
//                String errorMessage = BlueSystem.getString(
//                        "message.file.couldNotSave") + "\n\n" + e.
//                        getLocalizedMessage();
//                JOptionPane.showMessageDialog(this, errorMessage, BlueSystem.
//                        getString("message.error"), JOptionPane.ERROR_MESSAGE);
//                StatusBar.updateStatus(BlueSystem.getString(
//                        "message.file.couldNotSave") + " - " + e.
//                        getLocalizedMessage());
//            }
//            return true;
//        } else if (rValue == JFileChooser.CANCEL_OPTION) {
//            StatusBar.updateStatus(BlueSystem.getString(
//                    "message.actionCancelled"));
//            return false;
//        } else {
//            return false;
//        }
//    }
//
//    private boolean saveCheck() {
//        int retValue = JOptionPane.showConfirmDialog(this, BlueSystem.getString(
//                "message.file.saveCheck.text"), BlueSystem.getString(
//                "message.file.saveCheck.title"),
//                JOptionPane.YES_NO_CANCEL_OPTION);
//
//        if (retValue == JOptionPane.YES_OPTION) {
//            if (currentDataFile.dataFile != null) {
//                save();
//                return true;
//            }
//
//            return (saveAs());
//
//        } else if (retValue == JOptionPane.NO_OPTION) {
//            return true;
//        }
//
//        return false;
//    }
//
//    public void close() {
//        if (saveCheck()) {
//            if (currentDataFile.tempFile != null && !currentDataFile.wasTempFile) {
//                currentDataFile.tempFile.delete();
//            }
//
//            int index = blueDataFileArray.indexOf(currentDataFile);
//            blueDataFileArray.remove(currentDataFile);
//
//            // menuBar1.resetWindowsMenu();
//
//            if (blueDataFileArray.size() == 0) {
//                fileNew();
//            } else if (index >= blueDataFileArray.size()) {
//                setCurrentBlueDataFile((BlueDataFile) blueDataFileArray.get(blueDataFileArray.
//                        size() - 1));
//            } else {
//                setCurrentBlueDataFile((BlueDataFile) blueDataFileArray.get(
//                        index));
//            }
//        }
//    }
//
//    public void fileNew() {
//        // perhaps add a new file wizard?
//
//        BlueData tempData = null;
//
//        String defaultFileName = BlueSystem.getUserConfigurationDirectory() + File.separator + "default.blue";
//
//        File defaultFile = new File(defaultFileName);
//
//        if (defaultFile.exists()) {
//            try {
//                String text = TextUtilities.getTextFromFile(defaultFile);
//                Document d = new Document(text);
//                tempData = BlueData.loadFromXML(d.getElement("blueData"));
//            } catch (Exception e) {
//                // swallow exception
//            }
//        }
//
//        if (tempData == null) {
//            tempData = new BlueData();
//        }
//
//        BlueDataFile bdf = new BlueDataFile(tempData, null);
//        this.blueDataFileArray.add(bdf);
//
//        // grab defaults from program options
//        ProjectProperties proj = tempData.getProjectProperties();
//        proj.author = ProgramOptions.getDefaultAuthor();
//
//        RealtimeRenderSettings rtSettings = ProgramOptions.
//                getRealtimeRenderSettings();
//
//        proj.sampleRate = rtSettings.defaultSr;
//        proj.ksmps = rtSettings.defaultKsmps;
//        proj.channels = rtSettings.defaultNchnls;
//
//        proj.useAudioOut = rtSettings.audioOutEnabled;
//        proj.useAudioIn = rtSettings.audioInEnabled;
//        proj.useMidiIn = rtSettings.midiInEnabled;
//        proj.useMidiOut = rtSettings.midiOutEnabled;
//
//        proj.noteAmpsEnabled = rtSettings.noteAmpsEnabled;
//        proj.outOfRangeEnabled = rtSettings.outOfRangeEnabled;
//        proj.warningsEnabled = rtSettings.warningsEnabled;
//        proj.benchmarkEnabled = rtSettings.benchmarkEnabled;
//
//        proj.advancedSettings = rtSettings.advancedSettings;
//
//        // proj.commandLine = ProgramOptions.getDefaultCommandline();
//
//        DiskRenderSettings diskSettings = ProgramOptions.getDiskRenderSettings();
//
//        proj.diskSampleRate = diskSettings.defaultSr;
//        proj.diskKsmps = diskSettings.defaultKsmps;
//        proj.diskChannels = diskSettings.defaultNchnls;
//
//        proj.diskNoteAmpsEnabled = diskSettings.noteAmpsEnabled;
//        proj.diskOutOfRangeEnabled = diskSettings.outOfRangeEnabled;
//        proj.diskWarningsEnabled = diskSettings.warningsEnabled;
//        proj.diskBenchmarkEnabled = diskSettings.benchmarkEnabled;
//
//        proj.diskAdvancedSettings = diskSettings.advancedSettings;
//
//        // proj.diskCommandLine = ProgramOptions.getDefaultDiskCommandline();
//
//        setCurrentBlueDataFile(bdf);
//    }
//
//    void generateScore() {
//        int rValue = FileChooserManager.showSaveDialog(FILE_GEN, this);
//        if (rValue == JFileChooser.APPROVE_OPTION) {
//            File temp = FileChooserManager.getSelectedFile(FILE_GEN);
//            if (!(temp.getName().trim().endsWith(".csd"))) {
//                temp = new File(temp.getAbsolutePath() + ".csd");
//            }
//            try {
//                PrintWriter out = new PrintWriter(new BufferedWriter(
//                        new FileWriter(temp)));
//                final CsdRenderResult renderResult = CSDRender.generateCSD(
//                        this.data, this.data.getRenderStartTime(), this.data.
//                        getRenderEndTime(), false);
//
//                out.print(renderResult.getCsdText());
//                out.flush();
//                out.close();
//                StatusBar.updateStatus(BlueSystem.getString(
//                        "message.generateScore.success") + " " + temp.getName());
//            } catch (SoundObjectException soe) {
//                ExceptionDialog.showExceptionDialog(SwingUtilities.getRoot(this),
//                        soe);
//                throw new RuntimeException("CSDRender Failed");
//            } catch (Exception ex) {
//                StatusBar.updateStatus("[" + BlueSystem.getString(
//                        "message.error") + "] " + BlueSystem.getString(
//                        "message.generateScore.error"));
//                System.err.println("[" + BlueSystem.getString("message.error") + "] " + ex.
//                        getLocalizedMessage());
//                ex.printStackTrace();
//            }
//        }
//        if (rValue == JFileChooser.CANCEL_OPTION) {
//            StatusBar.updateStatus(BlueSystem.getString(
//                    "message.actionCancelled"));
//        }
//    }
//
//    void generateScoreToRun() {
//        if (mainToolBar.isRendering()) {
//            mainToolBar.stopRendering();
//        } else {
//            mainToolBar.renderProject();
//        }
//    }
//
//    void generateScoreForTesting() {
//        mainToolBar.generateScoreForTesting();
//    }
//
//    void renderToDisk(boolean playAfterRender) {
//
//        shouldPlayAfterRender = playAfterRender;
//
//        if (renderToDiskDialog == null) {
//            renderToDiskDialog = new RenderToDiskDialog(this);
//            renderToDiskDialog.setRenderDialogListener(new RenderDialogListener() {
//
//                public void renderFinished() {
//                    if (shouldPlayAfterRender) {
//                        String fileOut = renderToDiskDialog.getFileOutputName();
//
//                        if (fileOut == null) {
//                            JOptionPane.showMessageDialog(
//                                    BlueMainFrame.this,
//                                    "Could not parse file name from command line");
//                            return;
//                        }
//
//                        File f = BlueSystem.findFile(fileOut);
//
//                        if (f == null) {
//                            JOptionPane.showMessageDialog(
//                                    BlueMainFrame.this,
//                                    "Could not find generated file: " + fileOut);
//                            return;
//                        }
//
//                        DiskRenderSettings settings = ProgramOptions.
//                                getDiskRenderSettings();
//
//                        if (settings.externalPlayCommandEnabled) {
//                            String command = settings.externalPlayCommand;
//                            command = command.replaceAll("\\$outfile",
//                                    f.getAbsolutePath());
//
//                            try {
//
//                                if (System.getProperty("os.name").indexOf(
//                                        "Windows") >= 0) {
//                                    Runtime.getRuntime().exec(command);
//                                } else {
//                                    String[] cmdArray = ProcessConsole.
//                                            splitCommandString(command);
//                                    Runtime.getRuntime().exec(cmdArray);
//                                }
//
//                                System.out.println(command);
//                            } catch (Exception e) {
//                                JOptionPane.showMessageDialog(
//                                        BlueMainFrame.this,
//                                        "Could not run command: " + command,
//                                        "Error",
//                                        JOptionPane.ERROR_MESSAGE);
//                                System.err.println("[" + BlueSystem.getString(
//                                        "message.error") + "] - " + e.
//                                        getLocalizedMessage());
//                                e.printStackTrace();
//                            }
//                        } else {
//                            soundFileManager.playFile(f);
//                        }
//                    }
//                }
//            });
//        }
//
//        if (mainToolBar.isRendering()) {
//            mainToolBar.stopRendering();
//        }
//
//        renderToDiskDialog.renderToDisk(data);
//    }
//
//    private void setCurrentBlueDataFile(BlueDataFile bdf) {
//        currentDataFile = bdf;
//
//        BlueSystem.setCurrentBlueData(bdf.data);
//
//        setData(bdf.data);
//
//        try {
//            bdf.data.getPolyObject().processOnLoad();
//        } catch (SoundObjectException soe) {
//            ExceptionDialog.showExceptionDialog(this, soe);
//        }
//
//
//        if (currentDataFile.dataFile == null) {
//            setTitle("blue - " + BlueConstants.getVersion() + " - " + BlueSystem.
//                    getString("message.newProject"));
//            BlueSystem.setCurrentProjectDirectory(null);
//        } else {
//            setTitle("blue - " + BlueConstants.getVersion() + " - " + currentDataFile.dataFile.
//                    getName());
//            BlueSystem.setCurrentProjectDirectory(currentDataFile.dataFile.
//                    getParentFile());
//        }
//
//        setRevertEnabled();
//        blueMenuBar.resetWindowsMenu();
//        blueMenuBar.hilightBlueDataFile(bdf);
//
//    }
//
//    private void previousProject() {
//        if (blueDataFileArray.size() < 2) {
//            return;
//        }
//
//        int index = blueDataFileArray.indexOf(this.currentDataFile) - 1;
//        if (index < 0) {
//            index = blueDataFileArray.size() - 1;
//        }
//
//        setCurrentBlueDataFile((BlueDataFile) blueDataFileArray.get(index));
//    }
//
//    private void nextProject() {
//        if (blueDataFileArray.size() < 2) {
//            return;
//        }
//
//        int index = blueDataFileArray.indexOf(this.currentDataFile) + 1;
//        if (index >= blueDataFileArray.size()) {
//            index = 0;
//        }
//
//        BlueDataFile blueDataFile = (BlueDataFile) blueDataFileArray.get(index);
//
//        setCurrentBlueDataFile(blueDataFile);
//    }
//
//    private void setData(BlueData data) {
//        BlueUndoManager.setUndoGroup(null);
//
//        this.data = data;
//
//        AutomationManager.getInstance().setData(data);
//
//        mainToolBar.setData(data);
//        // orch.setOrchestra(data.getOrchestra());
//        instruments.setInstrumentData(data.getArrangement());
//
//        score.setData(data);
//        tables.setTables(data.getTableSet());
//        // ftables.setData(data);
//        global.setGlobalOrcSco(data.getGlobalOrcSco());
//        // udo.setData(data);
//        udo.editOpcodeList(data.getOpcodeList());
//
//        props.setProjectProperties(data.getProjectProperties());
//
//        sPadDialog.setScratchPadData(data.getScratchPadData());
//        blueLiveDialog.setData(data);
//
//        markersListDialog.setData(data);
//
//        mixerDialog.setMixer(data.getMixer());
//        mixerDialog.setArrangement(data.getArrangement());
//
////        BlueUndoManager.setUndoGroup(data.getUndoManager());
//    }
//
//    private void revert() {
//        if (currentDataFile.dataFile != null) {
//            int retVal = JOptionPane.showConfirmDialog(this, BlueSystem.
//                    getString("message.file.revert.text"), BlueSystem.getString(
//                    "message.file.revert.title"),
//                    JOptionPane.YES_NO_CANCEL_OPTION);
//            if (retVal == JOptionPane.YES_OPTION) {
//                try {
//                    String text = TextUtilities.getTextFromFile(
//                            currentDataFile.dataFile);
//
//                    BlueData tempData;
//
//                    if (text.startsWith("<blueData")) {
//                        Document d = new Document(text);
//                        tempData = BlueData.loadFromXML(d.getElement("blueData"));
//                    } else {
//                        JOptionPane.showMessageDialog(this,
//                                BlueSystem.getString("blue.pre94"));
//
//                        XMLSerializer xmlSer = new XMLSerializer();
//                        BufferedReader xmlIn = new BufferedReader(
//                                new StringReader(text));
//
//                        tempData = (BlueData) xmlSer.read(xmlIn);
//
//                        xmlIn.close();
//                        tempData.upgradeData();
//                    }
//
//                    currentDataFile.data = tempData;
//
//                    setCurrentBlueDataFile(currentDataFile);
//
//                } catch (Exception e) {
//                    e.printStackTrace();
//                }
//            }
//        }
//    }
//
//    private void showPreviousTab() {
//        int index = viewSelectPane.getSelectedIndex() - 1;
//        int size = viewSelectPane.getComponentCount();
//        if (index < 0) {
//            index = size - 1;
//        }
//
//        viewSelectPane.setSelectedIndex(index);
//    }
//
//    private void showNextTab() {
//        int index = viewSelectPane.getSelectedIndex() + 1;
//        int size = viewSelectPane.getComponentCount();
//        if (index >= size) {
//            index = 0;
//        }
//
//        viewSelectPane.setSelectedIndex(index);
//    }
//
//    public static void setCsoundOutputDialog(CsoundOutputDlg csoundOutputDlg) {
//        BlueMainFrame.csoundOutputDlg = csoundOutputDlg;
//    }
//
//    public static CsoundOutputDlg getCsoundOutputDialog() {
//        return csoundOutputDlg;
//    }
//
//    public void showTimeLog() {
//        String message = "Start Time: " + BlueSystemTimer.getInstance().
//                getStartTime() + "\nElapsed Time: " + BlueSystemTimer.
//                getInstance().getElapsedTime();
//        JOptionPane.showMessageDialog(BlueMainFrame.this, message, "Time Log",
//                JOptionPane.PLAIN_MESSAGE);
//    }
//
//    public void resetTimeLog() {
//        BlueSystemTimer.getInstance().startTimer();
//    }
//
//    class BackupFileSaver implements Runnable {
//        // private long waitTime = 5 * 60 * 1000;
//
//        private final long waitTime = 60 * 1000;
//
//        boolean shouldRun = true;
//
//        public void run() {
//            while (shouldRun) {
//
//                saveFileBackups();
//
//                try {
//                    Thread.sleep(waitTime);
//                } catch (InterruptedException e) {
//                    shouldRun = false;
//                }
//            }
//        }
//
//        private void saveFileBackups() {
//            for (int i = 0; i < blueDataFileArray.size(); i++) {
//                BlueDataFile bdf = (BlueDataFile) blueDataFileArray.get(i);
//
//                if (bdf.dataFile != null && !bdf.wasTempFile) {
//
//                    if (bdf.tempFile == null) {
//                        bdf.tempFile = new File(
//                                bdf.dataFile.getAbsolutePath() + "~");
//                    }
//
//                    try {
//                        PrintWriter out = new PrintWriter(new FileWriter(
//                                bdf.tempFile));
//
//                        out.print(bdf.data.saveAsXML().toString());
//
//                        out.flush();
//                        out.close();
//                    } catch (IOException ioe) {
//                        // String errorMessage = BlueSystem
//                        // .getString("message.file.couldNotSave")
//                        // + "\n\n" + ioe.getLocalizedMessage();
//                        // JOptionPane.showMessageDialog(null, errorMessage,
//                        // BlueSystem
//                        // .getString("message.error"),
//                        // JOptionPane.ERROR_MESSAGE);
//                        // StatusBar.updateStatus(BlueSystem
//                        // .getString("message.file.couldNotSave")
//                        // + " - " + ioe.getLocalizedMessage());
//                    } catch (Exception e) {
//                        e.printStackTrace();
//                    }
//                }
//            }
//        }
//
//        public void quitFileSaver() {
//            shouldRun = false;
//        }
//    }
//
//    /**
//     * MenuBar was made into an Inner class for convenience of looking at the
//     * code. Will probably refactor into its own class later.
//     *
//     * @author steven
//     * @created November 11, 2001
//     */
//    class BlueMenuBar extends JMenuBar {
//
//        static final String URL_RFE = "http://sourceforge.net/tracker/?group_id=74382&atid=540833";
//
//        static final String URL_BUGS = "http://sourceforge.net/tracker/?group_id=74382&atid=540830";
//
//        static final String URL_DONATIONS = "http://www.kunstmusik.com/donations";
//
//        final int MENU_SHORTCUT_KEY = BlueSystem.getMenuShortcutKey();
//
//        // FILE MENU
//        JMenuItem saveFile = new JMenuItem();
//
//        JMenuItem saveAsFile = new JMenuItem();
//
//        JMenuItem revertFile = new JMenuItem();
//
//        JMenu recentFiles = new JMenu();
//
//        // Tools Menu
//        JMenu menuTools = new JMenu();
//
//        Action codeRepositoryAction;
//
//        Action scannedMatrixAction = new OpenScannedMatrixAction();
//
//        Action blueShareAction = new OpenBlueShareAction();
//
//        Action soundFontAction = new OpenSoundFontViewerAction();
//
//        Action ftableConverterAction = new OpenFTableConverterAction();
//
//        Action openEffectsLibraryAction = new OpenEffectsLibraryAction();
//
//        Action manageToolsAction;
//
//        // Script Menu
//        JMenu scriptsRootMenu = new JMenu("Scripts");
//
//        // Window Menu
//        JMenu menuWindow = new JMenu();
//
//        Action[] windowMenuActions1;
//
//        Action[] tabActions = new Action[7];
//
//        Action[] windowMenuActions2;
//
//        Action[] windowMenuActions3;
//
//        ActionListener toolMenuActionListener;
//
//        ActionListener windowMenuActionListener;
//
//        /**
//         * Constructor for the BlueMenuBar object
//         */
//        public BlueMenuBar() {
//            try {
//                blueMenuInit();
//            } catch (Exception e) {
//                e.printStackTrace();
//            }
//        }
//
//        private void blueMenuInit() throws Exception {
//
//            // TOOLS MENU
//            BlueSystem.setMenuText(menuTools, "menu.tools");
//
//            codeRepositoryAction = new BlueAction("menu.tools.codeRepository") {
//
//                CodeRepositoryDialog c;
//
//                public void actionPerformed(ActionEvent e) {
//                    if (c == null) {
//                        c = new CodeRepositoryDialog();
//                    }
//
//                    if (c.isShowing()) {
//                        c.requestFocus();
//                    } else {
//                        c.show();
//                    }
//
//                }
//            };
//
//            manageToolsAction = new BlueAction("menu.tools.manageTools") {
//
//                public void actionPerformed(ActionEvent e) {
//                    if (userToolsDialog == null) {
//                        userToolsDialog = new UserToolsDialog();
//                    }
//
//                    userToolsDialog.show(ProgramOptions.getUserTools());
//                    if (!userToolsDialog.isCancelled) {
//                        ProgramOptions.setUserTools(userToolsDialog.
//                                getUpdatedUserTools());
//                        ProgramOptions.save();
//                        blueMenuBar.resetToolsMenu();
//                    }
//                }
//            };
//
//            // WINDOW MENU
//            BlueSystem.setMenuText(menuWindow, "menu.window");
//
//            Action sObjPropertyAction = new DialogFlipAction(
//                    "menu.window.soundObjProp", score.
//                    getSoundObjectPropertyDialog(), KeyStroke.getKeyStroke(
//                    KeyEvent.VK_F3, 0, false));
//
//            Action sObjLibraryAction = new DialogFlipAction(
//                    "menu.window.soundObjLib",
//                    score.getSoundObjectLibraryDialog(), KeyStroke.getKeyStroke(
//                    KeyEvent.VK_F4, 0, false));
//
//            Action scratchPadAction = new DialogFlipAction(
//                    "menu.window.scratchPad", sPadDialog,
//                    KeyStroke.getKeyStroke(KeyEvent.VK_F5, 0, false));
//
//            Action blueLiveAction = new DialogFlipAction(
//                    "menu.window.blueLive", blueLiveDialog, KeyStroke.
//                    getKeyStroke(KeyEvent.VK_F6, 0, false));
//
//            Action csoundOutputDialogAction = new DialogFlipAction(
//                    "menu.window.csoundOutputDialogWindow", BlueMainFrame.
//                    getCsoundOutputDialog(), KeyStroke.getKeyStroke(
//                    KeyEvent.VK_F7, 0, false));
//
//            Action scoreNavigatorAction = new DialogFlipAction(
//                    "menu.window.scoreNavigator", scoreNavDialog, KeyStroke.
//                    getKeyStroke(KeyEvent.VK_F3,
//                    KeyEvent.SHIFT_DOWN_MASK, false));
//
//            Action markersDialogAction = new DialogFlipAction(
//                    "menu.window.markersList", markersListDialog, KeyStroke.
//                    getKeyStroke(KeyEvent.VK_F4,
//                    KeyEvent.SHIFT_DOWN_MASK, false));
//
//            Action mixerDialogAction = new DialogFlipAction(
//                    "menu.window.mixer", mixerDialog, KeyStroke.getKeyStroke(
//                    KeyEvent.VK_F5, KeyEvent.SHIFT_DOWN_MASK, false));
//
//            windowMenuActions1 = new Action[]{sObjPropertyAction,
//                        sObjLibraryAction, scratchPadAction, blueLiveAction,
//                        csoundOutputDialogAction, scoreNavigatorAction,
//                        markersDialogAction, mixerDialogAction};
//
//            // TABS QUICK KEYS
//
//            tabActions[0] = new TabSelectionAction("menu.window.scoreTab",
//                    KeyStroke.getKeyStroke(KeyEvent.VK_1, MENU_SHORTCUT_KEY,
//                    false), viewSelectPane, 0);
//            tabActions[1] = new TabSelectionAction("menu.window.orchTab",
//                    KeyStroke.getKeyStroke(KeyEvent.VK_2, MENU_SHORTCUT_KEY,
//                    false), viewSelectPane, 1);
//            tabActions[2] = new TabSelectionAction("menu.window.tablesTab",
//                    KeyStroke.getKeyStroke(KeyEvent.VK_3, MENU_SHORTCUT_KEY,
//                    false), viewSelectPane, 2);
//            tabActions[3] = new TabSelectionAction("menu.window.globalsTab",
//                    KeyStroke.getKeyStroke(KeyEvent.VK_4, MENU_SHORTCUT_KEY,
//                    false), viewSelectPane, 3);
//            tabActions[4] = new TabSelectionAction("menu.window.udoTab",
//                    KeyStroke.getKeyStroke(KeyEvent.VK_5, MENU_SHORTCUT_KEY,
//                    false), viewSelectPane, 4);
//            tabActions[5] = new TabSelectionAction("menu.window.projPropTab",
//                    KeyStroke.getKeyStroke(KeyEvent.VK_6, MENU_SHORTCUT_KEY,
//                    false), viewSelectPane, 5);
//            tabActions[6] = new TabSelectionAction("menu.window.soundFileTab",
//                    KeyStroke.getKeyStroke(KeyEvent.VK_7, MENU_SHORTCUT_KEY,
//                    false), viewSelectPane, 6);
//
//            Action previousProjectAction = new BlueAction(
//                    "menu.window.previousProject", KeyStroke.getKeyStroke(
//                    KeyEvent.VK_PAGE_UP,
//                    MENU_SHORTCUT_KEY | KeyEvent.SHIFT_DOWN_MASK, false)) {
//
//                public void actionPerformed(ActionEvent e) {
//                    previousProject();
//                }
//            };
//
//            Action nextProjectAction = new BlueAction(
//                    "menu.window.nextProject", KeyStroke.getKeyStroke(
//                    KeyEvent.VK_PAGE_DOWN,
//                    MENU_SHORTCUT_KEY | KeyEvent.SHIFT_DOWN_MASK, false)) {
//
//                public void actionPerformed(ActionEvent e) {
//                    nextProject();
//                }
//            };
//
//            Action previousManagerAction = new BlueAction(
//                    "menu.window.previousManager", KeyStroke.getKeyStroke(
//                    KeyEvent.VK_LEFT, KeyEvent.ALT_DOWN_MASK, false)) {
//
//                public void actionPerformed(ActionEvent e) {
//                    showPreviousTab();
//                }
//            };
//
//            Action nextManagerAction = new BlueAction(
//                    "menu.window.nextManager", KeyStroke.getKeyStroke(
//                    KeyEvent.VK_RIGHT, KeyEvent.ALT_DOWN_MASK, false)) {
//
//                public void actionPerformed(ActionEvent e) {
//                    showNextTab();
//                }
//            };
//
//            windowMenuActions2 = new Action[]{previousManagerAction,
//                        nextManagerAction};
//
//            windowMenuActions3 = new Action[]{previousProjectAction,
//                        nextProjectAction};
//
//            // HELP MENU
//
//            this.add(getFileMenu());
//            this.add(getEditMenu());
//            this.add(getProjectMenu());
//            this.add(menuTools);
//            this.add(getScriptMenu());
//            this.add(menuWindow);
//            this.add(getHelpMenu());
//
//            toolMenuActionListener = new ActionListener() {
//
//                public void actionPerformed(ActionEvent ae) {
//                    ToolMenuItem t = (ToolMenuItem) ae.getSource();
//                    try {
//                        Runtime.getRuntime().exec(t.commandLine);
//                        System.out.println(
//                                BlueSystem.getString(
//                                "message.userTool.runningCommand") + " " + t.commandLine);
//                    } catch (Exception e) {
//                        JOptionPane.showMessageDialog(
//                                BlueMainFrame.this,
//                                BlueSystem.getString(
//                                "message.userTool.error.text") + " " + t.commandLine,
//                                BlueSystem.getString(
//                                "message.userTool.error.title"),
//                                JOptionPane.ERROR_MESSAGE);
//                        System.err.println("[" + BlueSystem.getString(
//                                "message.error") + "] - " + e.
//                                getLocalizedMessage());
//                        e.printStackTrace();
//                    }
//                }
//            };
//
//            windowMenuActionListener = new ActionListener() {
//
//                public void actionPerformed(ActionEvent ae) {
//                    BlueDataFileMenuItem item = (BlueDataFileMenuItem) ae.
//                            getSource();
//                    setCurrentBlueDataFile(item.bdf);
//                }
//            };
//
//            resetScriptsRootMenu();
//            resetToolsMenu();
//            resetWindowsMenu();
//        }
//
//        private JMenu getFileMenu() {
//            JMenu menuFile = new JMenu();
//
//            JMenuItem menuFileExit = new JMenuItem();
//
//            JMenuItem newFile = new JMenuItem();
//
//            JMenuItem openFile = new JMenuItem();
//
//            // JMenuItem openLibraryFile = new JMenuItem();
//            JMenuItem importFile = new JMenuItem();
//
//            JMenuItem importOrcScoFile = new JMenuItem();
//
//            JMenuItem importMidiFile = new JMenuItem();
//
//            JMenuItem closeFile = new JMenuItem();
//
//            JMenuItem renderToDisk = new JMenuItem();
//
//            JMenuItem renderToDiskAndPlay = new JMenuItem();
//
//            JMenuItem programOptions = new JMenuItem();
//
//            JMenuItem saveLibrariesItem = new JMenuItem();
//
//            // FILE MENU
//            menuFile.setMargin(new Insets(0, 0, 0, 0));
//            BlueSystem.setMenuText(menuFile, "menu.file");
//            BlueSystem.setMenuText(menuFileExit, "menu.file.exit");
//
//            menuFileExit.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_X,
//                    KeyEvent.ALT_MASK, false));
//            menuFileExit.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    exitBlue();
//                }
//            });
//
//            BlueSystem.setMenuText(newFile, "menu.file.new");
//            newFile.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_N,
//                    MENU_SHORTCUT_KEY, false));
//            newFile.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    fileNew();
//                }
//            });
//
//            BlueSystem.setMenuText(openFile, "menu.file.open");
//            openFile.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_O,
//                    MENU_SHORTCUT_KEY, false));
//            openFile.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    open();
//                }
//            });
//
//            // BlueSystem.setMenuText(openLibraryFile, "menu.file.openLibrary");
//            // openLibraryFile.setAccelerator(KeyStroke.getKeyStroke(
//            // 76, MENU_SHORTCUT_KEY, false));
//            // openLibraryFile.addActionListener(new ActionListener() {
//            //
//            // public void actionPerformed(ActionEvent e) {
//            // openLibrary();
//            // }
//            // });
//
//            BlueSystem.setMenuText(importFile, "menu.file.import");
//            importFile.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    importCSD();
//                }
//            });
//
//            BlueSystem.setMenuText(importOrcScoFile, "menu.file.importOrcSco");
//            importOrcScoFile.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    importOrcSco();
//                }
//            });
//
//            BlueSystem.setMenuText(importMidiFile, "menu.file.importMidiFile");
//            importMidiFile.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    importMidiFile();
//                }
//            });
//
//            BlueSystem.setMenuText(closeFile, "menu.file.close");
//            closeFile.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_W,
//                    MENU_SHORTCUT_KEY, false));
//            closeFile.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    close();
//                }
//            });
//
//            BlueSystem.setMenuText(revertFile, "menu.file.revert");
//            revertFile.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    revert();
//                }
//            });
//
//            // saveFile.setEnabled(false);
//            BlueSystem.setMenuText(saveFile, "menu.file.save");
//            saveFile.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_S,
//                    MENU_SHORTCUT_KEY, false));
//            saveFile.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    save();
//                }
//            });
//
//            BlueSystem.setMenuText(saveAsFile, "menu.file.saveAs");
//            saveAsFile.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    saveAs();
//                }
//            });
//
//            BlueSystem.setMenuText(renderToDisk, "menu.file.renderToDisk");
//            renderToDisk.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_F9,
//                    MENU_SHORTCUT_KEY | KeyEvent.SHIFT_DOWN_MASK, false));
//            renderToDisk.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    renderToDisk(false);
//                }
//            });
//
//            BlueSystem.setMenuText(renderToDiskAndPlay,
//                    "menu.file.renderToDiskAndPlay");
//            renderToDiskAndPlay.setAccelerator(KeyStroke.getKeyStroke(
//                    KeyEvent.VK_F9, KeyEvent.SHIFT_DOWN_MASK, false));
//            renderToDiskAndPlay.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    renderToDisk(true);
//                }
//            });
//
//            BlueSystem.setMenuText(programOptions, "menu.file.programOptions");
//            programOptions.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    showProgramOptionsDialog();
//                }
//            });
//
//            BlueSystem.setMenuText(saveLibrariesItem, "menu.file.saveLibraries");
//            saveLibrariesItem.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    saveLibraries();
//                    StatusBar.updateStatus("Libraries saved");
//                }
//            });
//
//            BlueSystem.setMenuText(recentFiles, "menu.file.recentFiles");
//            resetRecentFiles();
//
//            menuFile.add(newFile);
//            menuFile.addSeparator();
//            menuFile.add(openFile);
//            // menuFile.add(openLibraryFile);
//            menuFile.add(importFile);
//            menuFile.add(importOrcScoFile);
//            menuFile.add(importMidiFile);
//            menuFile.addSeparator();
//            menuFile.add(closeFile);
//            menuFile.add(revertFile);
//            menuFile.addSeparator();
//            menuFile.add(saveFile);
//            menuFile.add(saveAsFile);
//            menuFile.addSeparator();
//            menuFile.add(renderToDisk);
//            menuFile.add(renderToDiskAndPlay);
//            menuFile.addSeparator();
//            menuFile.add(programOptions);
//            menuFile.add(saveLibrariesItem);
//            menuFile.addSeparator();
//            menuFile.add(recentFiles);
//            menuFile.addSeparator();
//            menuFile.add(menuFileExit);
//
//            return menuFile;
//        }
//
//        private JMenu getEditMenu() {
//            JMenu menuEdit = new JMenu();
//
//            JMenuItem undoEdit = new JMenuItem();
//            JMenuItem redoEdit = new JMenuItem();
//
//            // EDIT MENU
//            BlueSystem.setMenuText(menuEdit, "menu.edit");
//
//            undoEdit.setEnabled(false);
//            BlueSystem.setMenuText(undoEdit, "menu.edit.undo");
//            undoEdit.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_Z,
//                    MENU_SHORTCUT_KEY, false));
//            undoEdit.addActionListener(BlueUndoManager.getMenuActionListener());
//            BlueUndoManager.setUndoMenuItem(undoEdit);
//
//            redoEdit.setEnabled(false);
//            BlueSystem.setMenuText(redoEdit, "menu.edit.redo");
//            redoEdit.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_Z,
//                    MENU_SHORTCUT_KEY | java.awt.event.KeyEvent.SHIFT_MASK,
//                    false));
//            redoEdit.addActionListener(BlueUndoManager.getMenuActionListener());
//            BlueUndoManager.setRedoMenuItem(redoEdit);
//
//            menuEdit.add(undoEdit);
//            menuEdit.add(redoEdit);
//
//            return menuEdit;
//        }
//
//        private JMenu getProjectMenu() {
//            JMenu menuProject = new JMenu();
//
//            JMenuItem generateScore = new JMenuItem();
//            JMenuItem generateScoreTest = new JMenuItem();
//            JMenuItem renderStopProject = new JMenuItem();
//
//            // PROJECT MENU
//            BlueSystem.setMenuText(menuProject, "menu.project");
//
//            BlueSystem.setMenuText(generateScore, "menu.project.genToFile");
//            generateScore.setAccelerator(KeyStroke.getKeyStroke(KeyEvent.VK_G,
//                    MENU_SHORTCUT_KEY, false));
//            generateScore.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    generateScore();
//                }
//            });
//
//            BlueSystem.setMenuText(generateScoreTest,
//                    "menu.project.genToScreen");
//            generateScoreTest.setAccelerator(KeyStroke.getKeyStroke(
//                    KeyEvent.VK_G, MENU_SHORTCUT_KEY | KeyEvent.SHIFT_MASK,
//                    false));
//            generateScoreTest.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    generateScoreForTesting();
//                }
//            });
//
//            BlueSystem.setMenuText(renderStopProject, "menu.project.renderStop");
//            /*
//             * renderStopProject.setAccelerator( KeyStroke.getKeyStroke(
//             * KeyEvent.VK_SPACE, MENU_SHORTCUT_KEY | KeyEvent.SHIFT_MASK,
//             */
//            renderStopProject.setAccelerator(KeyStroke.getKeyStroke(
//                    KeyEvent.VK_F9, 0, false));
//            renderStopProject.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    generateScoreToRun();
//                }
//            });
//
//            BlueAction loopToggle = new BlueAction("menu.project.toggleLoop",
//                    KeyStroke.getKeyStroke(KeyEvent.VK_L, MENU_SHORTCUT_KEY)) {
//
//                public void actionPerformed(ActionEvent e) {
//                    BlueData data = BlueSystem.getCurrentBlueData();
//
//                    data.setLoopRendering(!data.isLoopRendering());
//                }
//            };
//
//
//            final JCheckBoxMenuItem
//                    useCsoundAPIItem = new JCheckBoxMenuItem("Use Csound API");
//            useCsoundAPIItem.setEnabled(APIUtilities.isCsoundAPIAvailable());
//            useCsoundAPIItem.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    boolean usingAPI = useCsoundAPIItem.isSelected();
//                    ProgramOptions.getGeneralSettings().setUsingCsoundAPI(
//                            usingAPI);
//                    ProgramOptions.save();
//                    System.err.println("USE CSOUND API ITEM ACTION PERFORMED");
//                }
//
//
//
//            });
//
//            final BlueAction addMarker = new BlueAction(
//                    "menu.project.addMarker", KeyStroke.getKeyStroke(
//                    KeyEvent.VK_M, MENU_SHORTCUT_KEY)) {
//
//                public void actionPerformed(ActionEvent e) {
//                    BlueData data = BlueSystem.getCurrentBlueData();
//
//                    RenderTimeManager timeManager = RenderTimeManager.
//                            getInstance();
//
//                    if (score.getPolyObject() == data.getPolyObject()) {
//                        float markerTime = mainToolBar.isRendering() ? timeManager.
//                                getRenderTime() + timeManager.getRenderStartTime() : data.
//                                getRenderStartTime();
//                        data.getMarkersList().addMarker(markerTime);
//                    }
//
//                // data.setLoopRendering(!data.isLoopRendering());
//                }
//            };
//
//            final BlueAction auditionSoundObjects = new BlueAction(
//                    "menu.project.auditionSoundObjects", KeyStroke.getKeyStroke(
//                    KeyEvent.VK_A, MENU_SHORTCUT_KEY | KeyEvent.SHIFT_MASK)) {
//
//                public void actionPerformed(ActionEvent e) {
//                    SwingUtilities.invokeLater(new Runnable() {
//
//                        public void run() {
//                            BlueData data = BlueSystem.getCurrentBlueData();
//
//                            SoundObject[] soundObjects = score.
//                                    getSoundObjectsAsArray();
//
//                            if(soundObjects.length == 0) {
//                                return;
//                            }
//
//                            AuditionManager audition = AuditionManager.
//                                    getInstance();
//                            audition.stop();
//                            audition.auditionSoundObjects(data, soundObjects);
//                        }
//                    });
//
//                }
//            };
//
//            menuProject.addMenuListener(new MenuListener() {
//
//                public void menuCanceled(MenuEvent e) {
//                    // TODO Auto-generated method stub
//                }
//
//                public void menuDeselected(MenuEvent e) {
//                    // TODO Auto-generated method stub
//                }
//
//                public void menuSelected(MenuEvent e) {
//                    useCsoundAPIItem.setSelected(ProgramOptions.
//                            getGeneralSettings().isUsingCsoundAPI());
//                }
//            });
//
//            /* SET UP MENU */
//
//            menuProject.add(generateScore);
//            menuProject.add(generateScoreTest);
//            menuProject.add(renderStopProject);
//            menuProject.add(auditionSoundObjects);
//
//            menuProject.addSeparator();
//            menuProject.add(useCsoundAPIItem);
//
//            menuProject.addSeparator();
//            menuProject.add(addMarker);
//
//            menuProject.addSeparator();
//            menuProject.add(loopToggle);
//            // menuProject.add(addMarker);
//
//            return menuProject;
//        }
//
//        private JMenu getScriptMenu() {
//
//            JMenu menuScript = new JMenu();
//
//            JMenu menuJython = new JMenu();
//
//            JMenuItem jythonConsole = new JMenuItem();
//
//            JMenuItem jythonReinit = new JMenuItem();
//
//            JMenu menuRhino = new JMenu();
//
//            JMenuItem rhinoConsole = new JMenuItem();
//
//            JMenuItem rhinoReinit = new JMenuItem();
//
//            BlueSystem.setMenuText(menuScript, "menu.script");
//
//            BlueSystem.setMenuText(menuJython, "menu.script.jython");
//            BlueSystem.setMenuText(menuRhino, "menu.script.rhino");
//
//            BlueSystem.setMenuText(jythonConsole, "menu.script.jython.console");
//            jythonConsole.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    new blue.scripting.JythonConsole().show();
//                }
//            });
//
//            BlueSystem.setMenuText(jythonReinit, "menu.script.jython.reinit");
//            jythonReinit.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    blue.scripting.PythonProxy.reinitialize();
//                }
//            });
//
//            BlueSystem.setMenuText(rhinoConsole, "menu.script.rhino.console");
//            rhinoConsole.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    // openToolsManagementDialog();
//                }
//            });
//            rhinoConsole.setEnabled(false);
//
//            BlueSystem.setMenuText(rhinoReinit, "menu.script.rhino.reinit");
//            rhinoReinit.addActionListener(new ActionListener() {
//
//                public void actionPerformed(ActionEvent e) {
//                    blue.scripting.RhinoProxy.reinitialize();
//                }
//            });
//
//            Action scriptLibraryAction = new AbstractAction() {
//
//                private ScriptLibraryDialog dialog = null;
//
//                public void actionPerformed(ActionEvent e) {
//                    if (dialog == null) {
//                        dialog = new ScriptLibraryDialog(BlueMainFrame.this,
//                                true);
//                    }
//                    dialog.show();
//                    resetScriptsRootMenu();
//                }
//            };
//            scriptLibraryAction.putValue(Action.NAME, "Manage Script Library");
//
//            Action showInfoTabsAction = new AbstractAction() {
//
//                public void actionPerformed(ActionEvent e) {
//                    if (!InfoDialog.infoTabsHasTabs()) {
//                        JOptionPane.showMessageDialog(BlueMainFrame.this,
//                                "InfoTabs Dialog is empty");
//                        return;
//                    }
//
//                    InfoDialog.showInfoTabsDialog();
//                }
//            };
//            showInfoTabsAction.putValue(Action.NAME,
//                    "Show/Hide Info Tabs Dialog");
//            showInfoTabsAction.putValue(Action.ACCELERATOR_KEY, KeyStroke.
//                    getKeyStroke(KeyEvent.VK_I,
//                    MENU_SHORTCUT_KEY | KeyEvent.SHIFT_DOWN_MASK));
//
//            menuScript.add(scriptsRootMenu);
//            menuScript.addSeparator();
//            menuScript.add(scriptLibraryAction);
//            menuScript.add(showInfoTabsAction);
//            menuScript.addSeparator();
//            menuScript.add(menuJython);
//            menuScript.add(menuRhino);
//
//            menuJython.add(jythonConsole);
//            menuJython.add(jythonReinit);
//            menuRhino.add(rhinoConsole);
//            menuRhino.add(rhinoReinit);
//
//            return menuScript;
//        }
//
//        public JMenu getHelpMenu() {
//            JMenu menuHelp = new JMenu();
//
//            BlueSystem.setMenuText(menuHelp, "menu.help");
//
//            Action aboutAction = new BlueAction("menu.help.about") {
//
//                public void actionPerformed(ActionEvent e) {
//                    showAboutBlue();
//                }
//            };
//
//            String helpURL = BlueSystem.getProgramRootDir() + File.separator + "documentation" + File.separator + "html" + File.separator + "index.html";
//
//            Action helpAction = new URLOpenAction("menu.help.help", helpURL,
//                    KeyStroke.getKeyStroke(112, 0, false));
//
//            Action requestFeature = new URLOpenAction(
//                    "menu.help.requestFeature", URL_RFE);
//
//            Action reportBug = new URLOpenAction("menu.help.reportBug",
//                    URL_BUGS);
//
//            Action makeDonation = new URLOpenAction("menu.help.makeDonation",
//                    URL_DONATIONS);
//
//            Action runGC = new BlueAction("menu.help.runGC") {
//
//                public void actionPerformed(ActionEvent e) {
//                    String message = "[" + BlueSystem.getString(
//                            "message.gc.before") + "] " + BlueSystem.getString(
//                            "message.gc.free") + " " + Runtime.getRuntime().
//                            freeMemory() + " " + BlueSystem.getString(
//                            "message.gc.total") + " " + Runtime.getRuntime().
//                            totalMemory();
//
//                    System.out.println(message);
//                    System.gc();
//                    System.runFinalization();
//
//                    message = "[" + BlueSystem.getString("message.gc.after") + "] " + BlueSystem.
//                            getString("message.gc.free") + " " + Runtime.
//                            getRuntime().freeMemory() + " " + BlueSystem.
//                            getString("message.gc.total") + Runtime.getRuntime().
//                            totalMemory();
//
//                    System.out.println(message);
//                }
//            };
//
//            Action timeLog = new AbstractAction("Time Log") {
//
//                public void actionPerformed(ActionEvent e) {
//                    showTimeLog();
//                }
//            };
//
//            Action resetTimeLog = new AbstractAction("Reset Time Log") {
//
//                public void actionPerformed(ActionEvent e) {
//                    resetTimeLog();
//                }
//            };
//
//            menuHelp.add(aboutAction);
//            menuHelp.add(helpAction);
//            menuHelp.addSeparator();
//            menuHelp.add(requestFeature);
//            menuHelp.add(reportBug);
//            menuHelp.add(makeDonation);
//            menuHelp.addSeparator();
//            menuHelp.add(runGC);
//            menuHelp.add(timeLog);
//            menuHelp.add(resetTimeLog);
//
//            return menuHelp;
//        }
//
//        public void enableRevert(boolean val) {
//            revertFile.setEnabled(val);
//        }
//
//        /**
//         * Description of the Method
//         */
//        public void resetRecentFiles() {
//            recentFiles.removeAll();
//            ArrayList temp = ProgramOptions.getRecentFiles();
//            int size = temp.size();
//            for (int i = size - 1; i >= 0; i--) {
//                JMenuItem tempMenuItem = new JMenuItem();
//                tempMenuItem.setText(((File) temp.get(i)).getAbsolutePath());
//                tempMenuItem.addActionListener(new ActionListener() {
//
//                    public void actionPerformed(ActionEvent e) {
//                        open(new File(((JMenuItem) e.getSource()).getText()));
//                    }
//                });
//                recentFiles.add(tempMenuItem);
//            }
//        }
//
//        public void resetScriptsRootMenu() {
//            scriptsRootMenu.removeAll();
//            ScriptCategory cat = ScriptLibrary.getInstance().
//                    getRootScriptCategory();
//
//            buildScriptsMenu(scriptsRootMenu, cat);
//        }
//
//        private void buildScriptsMenu(JMenu menu, ScriptCategory cat) {
//            ArrayList categories = cat.getSubCategories();
//            ArrayList scripts = cat.getScripts();
//
//            for (int i = 0; i < categories.size(); i++) {
//                ScriptCategory tempCat = (ScriptCategory) categories.get(i);
//
//                JMenu temp = new JMenu(tempCat.getCategoryName());
//
//                menu.add(temp);
//
//                buildScriptsMenu(temp, tempCat);
//            }
//
//            for (int i = 0; i < scripts.size(); i++) {
//                Script script = (Script) scripts.get(i);
//
//                menu.add(createScriptAction(script));
//            }
//        }
//
//        private Action createScriptAction(final Script script) {
//            Action action = new AbstractAction(script.getName()) {
//
//                public void actionPerformed(ActionEvent ae) {
//                    try {
//                        PythonProxy.processScript(script.getCode());
//                    } catch (PyException pyEx) {
//                        String msg = "Jython Error:\n" + pyEx.toString();
//                        JOptionPane.showMessageDialog(BlueMainFrame.this, msg,
//                                BlueSystem.getString("common.error"),
//                                JOptionPane.ERROR_MESSAGE);
//                    }
//                }
//            };
//            action.putValue(Action.SHORT_DESCRIPTION, script.getDescription());
//
//            return action;
//        }
//
//        public void resetToolsMenu() {
//            menuTools.removeAll();
//
//            menuTools.add(codeRepositoryAction);
//            menuTools.add(scannedMatrixAction);
//            menuTools.add(blueShareAction);
//            menuTools.add(soundFontAction);
//            menuTools.add(ftableConverterAction);
//            menuTools.add(openEffectsLibraryAction);
//
//            menuTools.addSeparator();
//
//            ArrayList temp = ProgramOptions.getUserTools();
//
//            for (int i = 0; i < temp.size(); i++) {
//                UserTool tool = (UserTool) temp.get(i);
//                ToolMenuItem toolMenuItem = new ToolMenuItem(tool.name,
//                        tool.commandLine);
//                toolMenuItem.addActionListener(toolMenuActionListener);
//
//                menuTools.add(toolMenuItem);
//            }
//            if (temp.size() > 0) {
//                menuTools.addSeparator();
//            }
//            menuTools.add(manageToolsAction);
//
//        }
//
//        public void resetWindowsMenu() {
//            menuWindow.removeAll();
//
//            for (int i = 0; i < windowMenuActions1.length; i++) {
//                menuWindow.add(windowMenuActions1[i]);
//            }
//
//            menuWindow.addSeparator();
//
//            for (int i = 0; i < tabActions.length; i++) {
//                menuWindow.add(tabActions[i]);
//            }
//
//            menuWindow.addSeparator();
//
//            for (int i = 0; i < windowMenuActions2.length; i++) {
//                menuWindow.add(windowMenuActions2[i]);
//            }
//
//            menuWindow.addSeparator();
//
//            for (int i = 0; i < windowMenuActions3.length; i++) {
//                menuWindow.add(windowMenuActions3[i]);
//            }
//
//            menuWindow.addSeparator();
//
//            for (int i = 0; i < blueDataFileArray.size(); i++) {
//                BlueDataFile bdf = (BlueDataFile) blueDataFileArray.get(i);
//                BlueDataFileMenuItem item = new BlueDataFileMenuItem(bdf);
//                item.setText(i + " " + item.getText());
//                item.setMnemonic(Integer.toString(i).charAt(0));
//                menuWindow.add(item);
//                item.addActionListener(windowMenuActionListener);
//            }
//        }
//
//        public void hilightBlueDataFile(BlueDataFile bdf) {
//            for (int i = 0; i < menuWindow.getItemCount(); i++) {
//                if (menuWindow.getItem(i) instanceof BlueDataFileMenuItem) {
//                    BlueDataFileMenuItem item = (BlueDataFileMenuItem) menuWindow.
//                            getItem(i);
//                    if (item.bdf == bdf) {
//                        item.setEnabled(false);
//                    } else {
//                        item.setEnabled(true);
//                    }
//                }
//            }
//        }
//
//        class OpenScannedMatrixAction extends BlueAction {
//
//            public OpenScannedMatrixAction() {
//                super("menu.tools.scannedSynth");
//            }
//
//            public void actionPerformed(ActionEvent e) {
//                // need to make so it reuses component, lazily initialized
//                blue.utility.GUI.showComponentAsStandalone(
//                        new ScannedMatrixEditor(), BlueSystem.getString(
//                        "menu.tools.scannedSynth.text"),
//                        false);
//            }
//        }
//
//        class OpenBlueShareAction extends BlueAction {
//
//            public OpenBlueShareAction() {
//                super("menu.tools.blueShare");
//            }
//
//            public void actionPerformed(ActionEvent e) {
//                blue.tools.blueShare.BlueShare.runBlueShare();
//            }
//        }
//
//        class OpenSoundFontViewerAction extends BlueAction {
//
//            SoundFontViewer soundFontViewer = null;
//
//            public OpenSoundFontViewerAction() {
//                super("soundFont");
//            }
//
//            public void actionPerformed(ActionEvent e) {
//                if (soundFontViewer == null) {
//                    soundFontViewer = new SoundFontViewer();
//                }
//
//                blue.utility.GUI.showComponentAsStandalone(soundFontViewer,
//                        BlueSystem.getString("soundFont.text"), false);
//            }
//        }
//
//        class OpenFTableConverterAction extends BlueAction {
//
//            FTableConverterDialog converter = null;
//
//            public OpenFTableConverterAction() {
//                super("ftableConverter");
//            }
//
//            public void actionPerformed(ActionEvent e) {
//                if (converter == null) {
//                    converter = new FTableConverterDialog(BlueMainFrame.this,
//                            true);
//                }
//
//                converter.setVisible(true);
//
//            }
//        }
//
//        class OpenEffectsLibraryAction extends BlueAction {
//
//            EffectsLibraryDialog dialog = null;
//
//            public OpenEffectsLibraryAction() {
//                super("effectsLibrary");
//            }
//
//            public void actionPerformed(ActionEvent e) {
//                if (dialog == null) {
//                    dialog = new EffectsLibraryDialog(BlueMainFrame.this, true);
//                }
//
//                dialog.setVisible(true);
//
//            }
//        }
//    }
//
//    public void loadWindowSettings(Element settings) {
//        WindowSettingManager.setBasicSettings(settings, this);
//        score.loadWindowSettings(settings);
//        instruments.loadWindowSettings(settings);
//        global.loadWindowSettings(settings);
//        udo.loadWindowSettings(settings);
//    }
//
//    public Element saveWindowSettings() {
//        Element retVal = WindowSettingManager.getBasicSettings(this);
//
//        retVal.addElement(score.saveWindowSettings());
//        retVal.addElement(instruments.saveWindowSettings());
//        retVal.addElement(global.saveWindowSettings());
//        retVal.addElement(udo.saveWindowSettings());
//
//        return retVal;
//    }
//
//    /**
//     * Data Class for Tool Menu Tools
//     */
//    static class ToolMenuItem extends JMenuItem {
//
//        public String commandLine;
//
//        public ToolMenuItem(String name, String commandLine) {
//            this.setText(name);
//            this.commandLine = commandLine;
//        }
//    }
//
//    /**
//     * MenuItem used to hold references to BlueData Files Used on the Windows
//     * Menu
//     */
//    static class BlueDataFileMenuItem extends JMenuItem {
//
//        public BlueDataFile bdf;
//
//        public BlueDataFileMenuItem(BlueDataFile bdf) {
//            this.bdf = bdf;
//            if (bdf.dataFile == null) {
//                this.setText(BlueSystem.getString("menu.project.newProject"));
//            } else {
//                this.setText(bdf.dataFile.getName());
//            }
//        }
//    }
//
//    /**
//     * BlueData file holds a references to a BlueData instance and the file from
//     * which it was loaded (or null if a new project)
//     */
//    static class BlueDataFile {
//
//        public boolean wasTempFile;
//
//        BlueData data;
//
//        File dataFile;
//
//        File tempFile;
//
//        public BlueDataFile(BlueData data, File dataFile) {
//            this.data = data;
//            this.dataFile = dataFile;
//        }
//    }
//}
