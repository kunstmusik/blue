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
//
//package blue;
//
//import blue.render.CsdRenderResult;
//import electric.xml.Document;
//import gnu.getopt.Getopt;
//
//import java.io.BufferedReader;
//import java.io.BufferedWriter;
//import java.io.File;
//import java.io.FileWriter;
//import java.io.PrintWriter;
//import java.io.StringReader;
//import java.util.ArrayList;
//
//import javax.swing.LookAndFeel;
//import javax.swing.SwingUtilities;
//import javax.swing.UIManager;
//
//import skt.swing.MySwing;
//import Silence.XMLSerializer;
//import blue.mixer.EffectsLibrary;
//import blue.render.CSDRender;
//import blue.scripting.PythonProxy;
//import blue.scripting.ScriptLibrary;
//import blue.settings.JavaSystemSettings;
//import blue.utility.APIUtilities;
//import blue.utility.BlueSystemTimer;
//import blue.utility.TextUtilities;
//
//public final class Blue {
//
//    boolean packFrame = false;
//
//    public Blue(final ArrayList filesToOpen) {
//        checkLibaries();
//
//        SwingUtilities.invokeLater(new Runnable() {
//
//            public void run() {
//
//                System.setProperty(
//                        "com.apple.mrj.application.apple.menu.about.name",
//                        "blue");
//
//                MySwing.install();
//
//                SplashScreen s = new SplashScreen(null);
//                s.show();
//
//                BlueMainFrame frame = new BlueMainFrame(filesToOpen);
//                if (packFrame) {
//                    frame.pack();
//                } else {
//                    frame.validate();
//                }
//
//                frame.setVisible(true);
//
//                s.dispose();
//                s = null;
//            }
//
//        });
//    }
//
//    private static void setJava2dAcceleration() {
//        String val = JavaSystemSettings.getInstance().getJava2dAcceleration();
//
//        // String val = GeneralSettings.J2D_ACCEL_OPEN_GL;
//
//        if (val.equals(JavaSystemSettings.J2D_ACCEL_OPEN_GL)) {
//            System.out.println("Setting Java 2D Acceleration to Open GL");
//            System.setProperty("sun.java2d.opengl", "True");
//        }
//    }
//
//    /**
//     * Loads in blue user libraries to make sure they are loadable; if not, they
//     * will cause blue to exit early before any damage can be done to library
//     * files by overwriting
//     */
//    private void checkLibaries() {
//        // call this here to get it to load so that if there are any errors it
//        // be detected before program gets started
//        EffectsLibrary.getInstance();
//        ScriptLibrary.getInstance();
//
//        // TODO need to do UDOLibrary and InstrumentLibrary as getInstance
//        // methods
//    }
//
//    private static void printWelcomeMessage() {
//        System.out.println("\nblue - " + BlueConstants.getVersion() + "\n"
//                + BlueConstants.getVersionDate());
//        System.out.println("Copyright (c) 2001-2007 Steven Yi\n");
//    }
//
//    public static void printLicense() {
//        System.out.println("blue comes with ABSOLUTELY NO WARRANTY");
//        System.out
//                .println("This is free software, and you are welcome to redistribute it");
//        System.out
//                .println("under certain conditions (consult the included license.txt file)\n");
//    }
//
//    public static void printAPIAvailability() {
//        System.out.println(">> Csound API available: " + APIUtilities.isCsoundAPIAvailable() + " <<\n");
//    }
//
//    private static void setupLookAndFeel() {
////        LookAndFeel plaf = new blue.plaf.BlueLookAndFeel();
////
////        String runtimePlaf = System.getProperty("plaf");
////
////        if (runtimePlaf != null) {
////            System.out.println("Runtime PLAF requested: " + runtimePlaf);
////            try {
////                plaf = (LookAndFeel) Class.forName(runtimePlaf).newInstance();
////            } catch (Exception e) {
////                System.err
////                        .println("Could not instantiate PLAF: " + runtimePlaf);
////            }
////        }
////
////        try {
////            UIManager.setLookAndFeel(plaf);
////        } catch (Exception e) {
////            e.printStackTrace();
////        }
//    }
//
//    public static void main(String[] args) {
//        printWelcomeMessage();
//        printLicense();
//        printAPIAvailability();
//
//        String programOptionsFilename = null;
//        String compileFilename = null;
//        String csdOutputFilename = null;
//        String jythonFilename = null;
//
//        Getopt g = new Getopt("blue", args, "-c:o:hu:j:a");
//        int c;
//        String arg;
//
//        ArrayList filesToOpen = new ArrayList();
//
//        while ((c = g.getopt()) != -1) {
//            switch (c) {
//                case 'c':
//                    arg = g.getOptarg();
//                    compileFilename = arg;
//                    break;
//
//                case 'h':
//                    usage();
//                    System.exit(0);
//                    break;
//
//                case 'o':
//                    arg = g.getOptarg();
//                    csdOutputFilename = arg;
//                    break;
//
//                case 'j':
//                    arg = g.getOptarg();
//                    jythonFilename = arg;
//                    break;
//
//                case 'u':
//                    arg = g.getOptarg();
//                    GlobalVariables.set(GlobalVariables.USER_CONFIG_DIR, arg);
//                    break;
//
//                case ':':
//                    System.out.println(BlueSystem
//                            .getString("blue.missingArgument")
//                            + " " + (char) g.getOptopt());
//                    System.exit(1);
//                    break;
//
//                case '?':
//                    System.out.println(BlueSystem
//                            .getString("blue.invalidOption")
//                            + " " + (char) g.getOptopt());
//                    System.exit(1);
//                    break;
//                default:
//                    int i = g.getOptind();
//                    String argVal = args[i - 1];
//                    if (argVal.endsWith(".blue")) {
//                        filesToOpen.add(argVal);
//                    } else {
//                        System.out.println(BlueSystem
//                                .getString("blue.illegalArgument")
//                                + " " + argVal);
//                        System.exit(1);
//                    }
//                    break;
//            }
//        }
//
//        checkBlueHomeSet();
//
//        if (compileFilename != null) {
//            generateCSD(compileFilename, csdOutputFilename);
//            System.exit(0);
//        } else if (jythonFilename != null) {
//            PythonProxy.processPythonFile(jythonFilename);
//            System.exit(0);
//        }
//
//        setJava2dAcceleration();
//        setupLookAndFeel();
//
//        ProgramOptions.load(programOptionsFilename);
//
//        BlueSystemTimer.getInstance().startTimer();
//
//        new Blue(filesToOpen);
//    }
//
//    /**
//     *
//     */
//    private static void checkBlueHomeSet() {
//        String home = BlueSystem.getProgramRootDir();
//
//        if (home == null) {
//            System.err.println(BlueSystem.getString("blue.blueHomeNotSet"));
//            System.exit(1);
//        }
//    }
//
//    private static void generateCSD(String compileFilename,
//            String csdOutputFilename) {
//        File in = new File(compileFilename);
//        String outFileName = csdOutputFilename;
//
//        if (!in.exists() || !in.isFile()) {
//            System.err.println(BlueSystem.getString("message.errorLabel") + " "
//                    + compileFilename + " "
//                    + BlueSystem.getString("blue.fileNotExist"));
//            System.exit(1);
//        }
//
//        if (outFileName == null) {
//            outFileName = compileFilename.substring(0, compileFilename
//                    .indexOf(".blue"))
//                    + ".csd";
//        }
//
//        PrintWriter out = null;
//
//        try {
//
//            String text = TextUtilities.getTextFromFile(in);
//
//            BlueData tempData;
//
//            if (text.startsWith("<blueData")) {
//                Document d = new Document(text);
//                tempData = BlueData.loadFromXML(d.getElement("blueData"));
//            } else {
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
//            /*
//             * XMLSerializer xmlSer = new XMLSerializer(); BufferedReader xmlIn =
//             * new BufferedReader(new FileReader(in)); BlueData tempData =
//             * (BlueData) xmlSer.read(xmlIn);
//             */
//
//            out = new PrintWriter(new BufferedWriter(
//                    new FileWriter(outFileName)));
//            CsdRenderResult renderResult =
//                    CSDRender.generateCSD(tempData, 0.0F, -1.0F, false);
//            out.print(renderResult.getCsdText());
//            out.close();
//
//            System.out.println(compileFilename + " "
//                    + BlueSystem.getString("blue.compiledTo") + " "
//                    + outFileName);
//
//        } catch (Exception e) {
//            if (out != null) {
//                out.close();
//            }
//            System.err.println(BlueSystem.getString("message.errorLabel") + " "
//                    + BlueSystem.getString("blue.csdCompileError"));
//            System.exit(1);
//        }
//    }
//
//    private static void usage() {
//        String output = "Usage: blue [flags]\n\n";
//        output += "-c filename\tcompile a .blue file to .csd\n";
//        output += "-o filename\toptional output name for .csd if -c used\n";
//        output += "-u dirname\tset user configuration directory to use\n";
//        output += "-j filename\tinterpret a jython file\n";
//
//        System.out.println(output);
//    }
//
//}