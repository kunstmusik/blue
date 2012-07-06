package blue;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */

import blue.udo.UDOLibrary;
import blue.utility.EnvironmentVars;
import blue.utility.FileUtilities;
import electric.xml.Document;
import electric.xml.ParseException;
import java.awt.Image;
import java.awt.Toolkit;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Locale;
import java.util.MissingResourceException;
import java.util.ResourceBundle;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;

public class BlueSystem {

    // private static boolean isInitialized = false;
    private static String programRootDir;

    private static String userConfigurationDirectory;

    private static ResourceBundle systemMessages;

    private static File currentProjectDirectory;

    private static InstrumentLibrary userInstrumentLibrary = null;

    private static UDOLibrary udoLibrary = null;

    private static BlueData blueData = null;

    private static int menuShortcutKey = -1;

//    private static BlueMainFrame blueMainFrame = null;

    static {
        init();
    }

    private static void init() {
        System.out.println("[blue] - initialization");

        initializeProgramRootDir();

        System.out.println("\nprogram root directory: " + programRootDir);

        setUserConfigurationDirectory();
        
        setLocale();

        System.out.println("\n> loading classes from registry");
//        try {
//            Document doc = new Document(new File(getConfDir() + File.separator
//                    + "registry.xml"));
//            System.out.println("> using registry file: " + getConfDir()
//                    + File.separator + "registry.xml");

//            initializePlugins(doc);

//        } catch (Exception e) {
//            System.err.println("[ERROR] - in loading from registry");
//        }
        // isInitialized = true;

    }

    public static void setLocale() {

        Locale currentLocale = new Locale("en", "");

        try {
            systemMessages = ResourceBundle.getBundle(
                    "blue.resources.locale.SystemMessages", currentLocale);
        } catch (MissingResourceException mre) {
            System.out.println(mre.getLocalizedMessage());
            System.exit(1);
        }
    }


    /**
     * Initialize Program Root Directory
     */
    private static void initializeProgramRootDir() {
        programRootDir = System.getProperty("BLUE_HOME");

        if (programRootDir == null) {

            // String classPath = System.getProperty("java.class.path");
            // String[] paths = classPath.split(File.pathSeparator);
            //
            // System.out.println("ClassPath: " + classPath);
            //
            // for(int i = 0; i < paths.length; i++) {
            // String path = paths[i];
            // String searchString = File.separator + "lib" + File.separator +
            // "jython.jar";
            // if(path.indexOf(searchString) > -1) {
            // programRootDir = path.substring(0, path
            // .indexOf(searchString));
            // break;
            // }
            // }

            programRootDir = System.getProperty("user.dir");
        }
    }

    public static String getString(String key) {
        String retVal = null;

        try {
            retVal = systemMessages.getString(key);
        } catch (MissingResourceException mre) {
            System.err.println("SystemMessages: Could not find key: " + key);
        }

        return retVal;
    }

    public static void setMenuText(JMenuItem item, String keyBase) {
        item.setText(systemMessages.getString(keyBase + ".text"));
        try {
            item.setMnemonic(systemMessages.getString(keyBase + ".mnemonic")
                    .charAt(0));
        } catch (Exception e) {
            // just ignore
        }
    }


    /** ************************************************************** */

    public static String getShortClassName(String fullClassName) {
        int i = fullClassName.lastIndexOf('.');
        return fullClassName.substring(i + 1);
    }

    public static String getProgramRootDir() {
        return programRootDir;
    }

    public static String getConfDir() {
        return programRootDir + File.separator + "conf";
    }

    public static String getLibDir() {
        return programRootDir + File.separator + "lib";
    }

    public static String getUserConfigurationDirectory() {
        return userConfigurationDirectory;
    }

    public static Image getImage(String imageName) {
        Image retVal = Toolkit.getDefaultToolkit().createImage(
                ClassLoader.getSystemResource("blue/resources/images/"
                        + imageName));

        return retVal;
    }

    /*
     * Does alot of checks to update legacy configuration files and move them
     * into userConfigurationDirectory (this was added in 0.92.2)
     */
    private static void setUserConfigurationDirectory() {

        userConfigurationDirectory = GlobalVariables
                .get(GlobalVariables.USER_CONFIG_DIR);

        if (userConfigurationDirectory == null) {
            userConfigurationDirectory = System.getProperty("user.home")
                    + File.separator + ".blue";

            GlobalVariables.set(GlobalVariables.USER_CONFIG_DIR,
                    userConfigurationDirectory);
        }

        boolean existed = FileUtilities
                .ensureDirectoryExists(userConfigurationDirectory);

        if (!existed) {
            System.out.println("Creating user configuration directory: "
                    + userConfigurationDirectory);

            String userPythonLib = userConfigurationDirectory + File.separator
                    + "pythonLib";

            FileUtilities.ensureDirectoryExists(userPythonLib);

            System.out.println("Creating user python lib in: " + userPythonLib);

            getCodeRepository();
        }

        File legacyConfFile = new File(System.getProperty("user.home")
                + File.separator + ".blueConfig.xml");
        File confFile = new File(userConfigurationDirectory + File.separator
                + ".blueConfig.xml");

        boolean wasNotThere = FileUtilities.copyIfNotThere(legacyConfFile,
                confFile);

        if (wasNotThere) {
            System.out
                    .println("Copying legacy configuration file to user configuration directory");
        }

        System.out.println("user configuration directory: "
                + userConfigurationDirectory);
    }

    public static File getCodeRepository() {
        
        File repository = new File(blue.BlueSystem
                .getUserConfigurationDirectory()
                + File.separator + "codeRepository.xml");

        if (!repository.exists()) {
            System.out
                    .println("Copying default code repository to user configuration directory");
            try {
                Document doc = new Document(BlueSystem.class.getResourceAsStream("codeRepository.xml"));
                doc.write(repository);
            } catch (ParseException ex) {
                ExceptionHandler.printStackTrace(ex);
            } catch (IOException ex) {
                ExceptionHandler.printStackTrace(ex);
            }
        }

        return repository;

    }

    public static File getCurrentProjectDirectory() {
        return currentProjectDirectory;
    }

    public static void setCurrentProjectDirectory(File _currentProjectDirectory) {
        currentProjectDirectory = _currentProjectDirectory;
    }

    public static InstrumentLibrary getUserInstrumentLibrary() {
        if (userInstrumentLibrary == null) {
            String userInstrFileName = BlueSystem
                    .getUserConfigurationDirectory()
                    + File.separator + "userInstrumentLibrary.xml";

            File f = new File(userInstrFileName);

            if (f.exists()) {

                boolean error = false;

                try {
                    Document doc = new Document(f);
                    userInstrumentLibrary = InstrumentLibrary.loadFromXML(doc
                            .getRoot());

                } catch (ParseException e1) {
                    e1.printStackTrace();
                    error = true;
                } catch (Exception e) {
                    e.printStackTrace();
                    error = true;
                }

                if (error) {
                    JOptionPane
                            .showMessageDialog(
                                    null,
                                    "There was an error loading "
                                            + f.getAbsolutePath()
                                            + "\nPlease fix this file or remove it and restart blue.",
                                    "Error", JOptionPane.ERROR_MESSAGE);
                    System.exit(0);
                }

            } else {
                userInstrumentLibrary = new InstrumentLibrary();
            }
        }

        return userInstrumentLibrary;
    }

    public static void saveUserInstrumentLibrary() {
        String userInstrFileName = BlueSystem.getUserConfigurationDirectory()
                + File.separator + "userInstrumentLibrary.xml";

        String tmpFileName = userInstrFileName + ".tmp";

        PrintWriter out = null;

        
        try {
            out = new PrintWriter(new FileWriter(tmpFileName));
        } catch (IOException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }

        if (out != null) {

            String lib = userInstrumentLibrary.saveAsXML().toString();

            out.print(lib);

            out.flush();
            out.close();

            System.out.println("Saved User Instrument Library: "
                    + userInstrFileName);
        } else {
            System.err.println("Unable to Save User Instrument Library: "
                    + userInstrFileName);
            return;
        }

        File f = new File(userInstrFileName);

        if (f.exists()) {
            File backup = new File(userInstrFileName + "~");
            if (backup.exists()) {
                backup.delete();
            }
            f.renameTo(backup);
        }

        f = new File(tmpFileName);
        f.renameTo(new File(userInstrFileName));
    }

    public static UDOLibrary getUDOLibrary() {
        if (udoLibrary == null) {
            String userInstrFileName = BlueSystem
                    .getUserConfigurationDirectory()
                    + File.separator + "udoLibrary.xml";

            File f = new File(userInstrFileName);

            if (f.exists()) {

                boolean error = false;

                try {
                    Document doc = new Document(f);
                    udoLibrary = udoLibrary.loadFromXML(doc.getRoot());

                } catch (ParseException e1) {
                    e1.printStackTrace();
                    error = true;
                } catch (Exception e) {
                    e.printStackTrace();
                    error = true;
                }

                if (error) {
                    JOptionPane
                            .showMessageDialog(
                                    null,
                                    "There was an error loading "
                                            + f.getAbsolutePath()
                                            + "\nPlease fix this file or remove it and restart blue.",
                                    "Error", JOptionPane.ERROR_MESSAGE);
                    System.exit(0);
                }

            } else {
                udoLibrary = new UDOLibrary();
            }
        }

        return udoLibrary;
    }

    public static void saveUDOLibrary() {
        String userInstrFileName = BlueSystem.getUserConfigurationDirectory()
                + File.separator + "udoLibrary.xml";

        String tmpFileName = userInstrFileName + ".tmp";

        PrintWriter out = null;

        try {
            out = new PrintWriter(new FileWriter(tmpFileName));
        } catch (IOException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }

        if (out != null) {

            String lib = udoLibrary.saveAsXML().toString();

            out.print(lib);

            out.flush();
            out.close();

            System.out.println("Saved UDO Library: " + userInstrFileName);
        } else {
            System.err.println("Unable to Save UDO Library: "
                    + userInstrFileName);
            return;
        }

        File f = new File(userInstrFileName);

        if (f.exists()) {
            File backup = new File(userInstrFileName + "~");
            if (backup.exists()) {
                backup.delete();
            }
            f.renameTo(backup);
        }

        f = new File(tmpFileName);
        f.renameTo(new File(userInstrFileName));
    }

    /** ************************************************************** */

    public static void main(String args[]) {
        System.out.println(BlueSystem.getConfDir());
    }

    /**
     * @param data
     */
    public static void setCurrentBlueData(BlueData _data) {
        blueData = _data;
    }

    public static BlueData getCurrentBlueData() {
        return blueData;
    }

    /**
     * Gets path of file, returns truncated name if file is relative to project
     * root directory, or simply returns filename if not
     * 
     * @param path
     * @return
     */
    public static String getRelativePath(String path) {
        File projectDir = BlueSystem.getCurrentProjectDirectory();
        if (projectDir == null) {
            return path;
        }

        String projectPath = null;

        try {
            projectPath = projectDir.getCanonicalPath();
        } catch (IOException e) {
            return path;
        }

        if (path.startsWith(projectPath)) {
            return path.substring(projectPath.length() + 1);
        }

        return path;
    }

    /**
     * Tries to find file in project directory, then as absolute file name, or
     * returns null if not exists as either
     * 
     * @param path
     * @return
     */
    public static File findFile(final String path) {
        if(path == null) {
            return null;
        }

        File projectDir = BlueSystem.getCurrentProjectDirectory();
        if (projectDir != null) {
            String projectPath = null;

            try {
                projectPath = projectDir.getCanonicalPath();
            } catch (IOException e) {

            }

            if (projectPath != null) {
                File f = new File(projectPath + File.separator + path);

                if (f.exists() && f.isFile()) {
                    return f;
                }
            }
        }

        File f = new File(path);

        if (f.exists() && f.isFile()) {
            return f;
        }

        if (path.indexOf(File.separator) < 0) {
            String sfDir = EnvironmentVars.getProperty("SFDIR");

            if (sfDir != null) {
                f = new File(sfDir + File.separator + path);

                // System.out.println("Looking for file: " + sfDir
                // + File.separator + path);

                if (f.exists() && f.isFile()) {
                    return f;
                }
            }
        }

        return null;
    }

    public static ClassLoader getClassLoader() {
        return BlueSystem.class.getClassLoader();
    }

//    public static BlueMainFrame getBlueMainFrame() {
//        return blueMainFrame;
//    }
//
//    public static void setBlueMainFrame(BlueMainFrame blueMainFrame) {
//        BlueSystem.blueMainFrame = blueMainFrame;
//    }

    public static synchronized int getMenuShortcutKey() {
        if (menuShortcutKey == -1) {
            menuShortcutKey = Toolkit.getDefaultToolkit()
                    .getMenuShortcutKeyMask();
        }
        return menuShortcutKey;
    }

}
