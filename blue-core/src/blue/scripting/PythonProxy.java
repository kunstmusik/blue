package blue.scripting;

import blue.BlueSystem;
import blue.ExceptionHandler;
import blue.soundObject.NoteList;
import blue.utility.FileUtilities;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import org.python.core.*;
import org.python.util.InteractiveInterpreter;
import org.python.util.PythonInterpreter;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class PythonProxy {

    private static InteractiveInterpreter interp;
    private static PythonInterpreter expressionInterpreter;

    private static PySystemState state = new PySystemState();
    private static File libDir = null;
    
    private static ArrayList<PythonProxyListener> listeners = 
            new ArrayList<>();

    public static void setLibDir(File newLibDir) {
        libDir = newLibDir;
    }
    
    public static final void reinitialize() {
        if(Py.getSystemState() != state) {
            for (String pathEntry : getPythonLibPath().split(File.pathSeparator)) {
                state.path.append(Py.newString(pathEntry));
            }
            Py.setSystemState(state);
        }
        
        interp = new InteractiveInterpreter();
        interp.exec("import site");
        expressionInterpreter = new PythonInterpreter();
        expressionInterpreter.exec("from __future__ import division\n");

        System.out.println(BlueSystem
                .getString("scripting.python.reinitialized"));
        
        for(PythonProxyListener listener : listeners) {
            listener.pythonProxyReinitializePerformed();
        }
    }
    
    public static final void addPythonProxyListener(PythonProxyListener listener) {
        listeners.add(listener);
    }
    
    public static final void removePythonProxyListener(PythonProxyListener listener) {
        listeners.remove(listener);
    }

    public static final String processPythonScore(String pythonCode,
            float subjectiveDuration) {
        if (interp == null) {
            reinitialize();
        }

        File currentDirFile = BlueSystem.getCurrentProjectDirectory();

        String currentDir = (currentDirFile == null) ? "" : currentDirFile
                .getAbsolutePath()
                + File.separator;

//        String blueLibDir = BlueSystem.getLibDir() + File.separator;
//        String userConfDir = BlueSystem.getUserConfigurationDirectory()
//                + File.separator;

        interp.set("score", new PyString());

        interp.set("blueDuration", new PyFloat(subjectiveDuration));
        interp.set("blueProjectDir", new PyString(currentDir));
//        interp.set("blueLibDir", new PyString(blueLibDir));
//        interp.set("userConfigDir", new PyString(userConfDir));

        interp.exec(pythonCode);
        PyObject tempScore = interp.get("score");
        return tempScore.toString();
    }

//    public static final void processPythonFile(String jythonFileName) {
//        if (interp == null) {
//            reinitialize();
//        }
//        System.out.println(BlueSystem
//                .getString("scripting.python.interpreting")
//                + " " + jythonFileName);
//        interp.execfile(jythonFileName);
//    }

    public static final String processPythonInstrument(String pythonCode) {
        if (interp == null) {
            reinitialize();
        }
        interp.set("instrument", new PyString());
        interp.exec(pythonCode);
        PyObject tempInstr = interp.get("instrument");
        return tempInstr.toString();
    }

    public static void processPythonNoteProcessor(NoteList nl, String pythonCode) {
        if (interp == null) {
            reinitialize();
        }

        interp.set("noteList", nl);
        interp.exec(pythonCode);

    }

    public static void processScript(String pythonCode) {
        if (interp == null) {
            reinitialize();
        }

        File currentDirFile = BlueSystem.getCurrentProjectDirectory();

        String currentDir = (currentDirFile == null) ? "" : currentDirFile
                .getAbsolutePath()
                + File.separator;

//        String blueLibDir = BlueSystem.getLibDir() + File.separator;
//        String userConfDir = BlueSystem.getUserConfigurationDirectory()
//                + File.separator;

//        MotionBuffer buffer = MotionBuffer.getInstance();
//
//        interp.set("selectedSoundObjects", buffer.getSoundObjectsAsArray());
        interp.set("blueData", BlueSystem.getCurrentBlueData());
        interp.set("blueProjectDir", new PyString(currentDir));
//        interp.set("blueLibDir", new PyString(blueLibDir));
//        interp.set("userConfigDir", new PyString(userConfDir));

        interp.exec(pythonCode);

    }

    public static final float evalExpression(final String expression) {
        if (interp == null) {
            reinitialize();
        }

        expressionInterpreter.exec("temp = " + expression);
        PyObject retVal = expressionInterpreter.get("temp");

        if (retVal.isNumberType()) {
            return Float.parseFloat(retVal.toString());
        }

        return Float.MIN_VALUE;
    }

    private static final String getPythonLibPath() {

//        String home = BlueSystem.getProgramRootDir();
        String sep = File.separator;
//        String programPythonPath = home + sep + "lib" + sep + "pythonLib";

        File pythonLib = libDir;

        String programPythonPath = null;

        try {
            programPythonPath = pythonLib.getCanonicalPath();
        } catch (IOException ex) {
            ExceptionHandler.printStackTrace(ex);
        }

        String userPythonPath = BlueSystem.getUserConfigurationDirectory()
                + sep + "pythonLib";

        FileUtilities.ensureDirectoryExists(userPythonPath);

        String pythonPath;

        if (programPythonPath != null) {
            String path1 = programPythonPath + File.separator + "standard";
            String path2 = programPythonPath + File.separator + "blue";
            pythonPath = path1 + File.pathSeparator + 
                    path2 + File.pathSeparator + userPythonPath;
        } else {
            pythonPath = userPythonPath;
        }
         

        System.out.println(BlueSystem.getString("scripting.python.libdir")
                + " " + pythonPath);
        return (pythonPath);
    }
    
    public static InteractiveInterpreter getInterpreter() {
        if (interp == null) {
            reinitialize();
        }
        return interp;
    }
}